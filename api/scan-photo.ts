/**
 * Vercel Function: POST /api/scan-photo
 * Versi serverless dari endpoint scan foto di server.ts (logika Gemini sama).
 * Env wajib di Vercel: GEMINI_API_KEY. Opsional: ALLOWED_ORIGINS (pisahkan koma).
 */
import dns from 'node:dns';
import { GoogleGenAI, Type } from '@google/genai';

dns.setDefaultResultOrder('ipv4first');

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum tersedia di server.');
  }
  return new GoogleGenAI({ apiKey });
}

const PHOTO_NUTRITION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isReadable: {
      type: Type.BOOLEAN,
      description:
        'True if the image contains food, drink, a nutrition facts label, or a nutrition/macro screenshot.',
    },
    foodName: {
      type: Type.STRING,
      description:
        'Clear, concise name of the food, meal, or packaged product (in Bahasa Indonesia or original product name).',
    },
    portionGrams: {
      type: Type.NUMBER,
      description:
        'Weight in grams for the numbers returned. If reading a label with Takaran Saji / Serving Size in grams, use that gram value. If per 100g, use 100. If estimating a food photo, estimate realistic total portion weight in grams.',
    },
    calories: {
      type: Type.NUMBER,
      description: 'Total calories (kcal / kkal) strictly for portionGrams.',
    },
    protein: {
      type: Type.NUMBER,
      description: 'Total protein in grams (g) strictly for portionGrams.',
    },
    carbs: {
      type: Type.NUMBER,
      description: 'Total carbohydrates (karbohidrat / carb) in grams (g) strictly for portionGrams.',
    },
    fat: {
      type: Type.NUMBER,
      description: 'Total fat (lemak) in grams (g) strictly for portionGrams.',
    },
    basis: {
      type: Type.STRING,
      description: '"per100g" if the numbers are per 100g, or "portion" if for a specific serving/portion.',
    },
    confidenceNote: {
      type: Type.STRING,
      description:
        'Short 1-sentence note in Bahasa Indonesia explaining the source of the calculation (e.g., "Dibaca dari tabel Informasi Nilai Gizi (takaran saji 35g)" or "Estimasi visual porsi makanan (~250g)").',
    },
  },
  required: [
    'isReadable',
    'foodName',
    'portionGrams',
    'calories',
    'protein',
    'carbs',
    'fat',
    'basis',
  ],
};

const SYSTEM_INSTRUCTION = `Anda adalah sistem pembaca & penghitung nutrisi presisi tinggi.
Tugas Anda HANYA mengekstrak dan menghitung 4 nilai nutrisi utama dari foto:
1. Kalori (calories, dalam kkal/kcal)
2. Protein (protein, dalam gram)
3. Karbohidrat / Carb (carbs, dalam gram)
4. Lemak / Fat (fat, dalam gram)
beserta nama makanan (foodName) dan berat porsi gramnya (portionGrams).

Aturan Ketat:
- JIKA FOTO ADALAH LABEL INFORMASI NILAI GIZI / NUTRITION FACTS:
  * Baca angka persis yang tertulis di label kemasan untuk Energi Total (Kalori), Protein, Karbohidrat Total (Total Carbohydrate), dan Lemak Total (Total Fat).
  * Perhatikan "Takaran Saji" / "Serving Size" dalam gram/ml dan masukkan ke portionGrams. Jika tabel sudah per 100g, isi portionGrams = 100 dan basis = "per100g".
  * JANGAN tertukar antara gram (g) dengan persentase "% AKG" atau "% DV".
  * Abaikan natrium, gula, serat, vitamin, atau kolesterol — fokus 100% pada Kalori, Protein, Karbohidrat (Carb), dan Lemak (Fat).

- JIKA FOTO ADALAH SCREENSHOT APLIKASI NUTRISI / CATATAN MAKANAN:
  * Baca angka Kalori (kkal/kcal), Protein (P), Karbohidrat (K / Carb), dan Lemak (L / Fat) secara akurat sesuai yang tertulis di layar.
  * Jika ada beberapa item makanan dalam satu daftar log, jumlahkan total Kalori, Protein, Carb, dan Fat seluruh item tersebut secara presisi (atau ambil makanan utamanya jika hanya 1 makanan).

- JIKA FOTO ADALAH MAKANAN / MINUMAN ASLI DI PIRING / KEMASAN:
  * Identifikasi jenis makanan & bahan yang terlihat, perkirakan berat porsi realistis dalam gram (portionGrams).
  * Hitung nilai Kalori (kkal), Protein (g), Karbohidrat (g), dan Lemak (g) secara akurat berdasarkan data komposisi pangan standar (TKPI / USDA).
  * Pastikan konsistensi matematis Atwater: Kalori ≈ (4 × Protein) + (4 × Karbohidrat) + (9 × Lemak).`;

async function analyzeNutritionImageWithGemini(base64Data: string, mimeType: string) {
  const ai = getGenAIClient();
  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
  ];
  let lastError: unknown = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: 'Baca foto ini secara akurat dan hitung HANYA Kalori (kcal), Protein (g), Karbohidrat/Carb (g), dan Lemak/Fat (g) beserta nama makanan dan takaran gramnya.',
            },
          ],
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: PHOTO_NUTRITION_SCHEMA,
        },
      });

      const rawText = response.text;
      if (rawText) {
        return JSON.parse(rawText.trim());
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal menganalisis foto.');
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024; // sekitar 6 MB gambar
const SCAN_RATE_PER_MIN = Number(process.env.SCAN_RATE_PER_MIN) || 8;

// Pembatas sederhana per instance (best effort). Untuk batas keras, pakai batas kuota di Google AI Studio.
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (ipHits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= SCAN_RATE_PER_MIN) {
    ipHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipHits.set(ip, recent);
  if (ipHits.size > 1000) ipHits.clear();
  return false;
}

function buildAllowedOrigins(): Set<string> {
  return new Set([
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    ...(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !buildAllowedOrigins().has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function jsonResponse(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
  });
}

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (isRateLimited(ip)) {
      return jsonResponse(request, 429, { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });
    }

    const body = (await request.json().catch(() => null)) as
      | { imageBase64?: unknown; mimeType?: unknown }
      | null;
    const imageBase64 = body?.imageBase64;
    const mimeType = body?.mimeType;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return jsonResponse(request, 400, { error: 'Data foto tidak ditemukan.' });
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return jsonResponse(request, 413, {
        error: 'Ukuran foto terlalu besar. Gunakan foto yang lebih kecil.',
      });
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const safeMimeType =
      typeof mimeType === 'string' && ALLOWED_IMAGE_TYPES.has(mimeType) ? mimeType : 'image/jpeg';

    const parsed = await analyzeNutritionImageWithGemini(cleanBase64, safeMimeType);
    return jsonResponse(request, 200, parsed);
  } catch (err) {
    console.error('Error in /api/scan-photo:', err);
    return jsonResponse(request, 500, {
      error: 'Gagal membaca foto. Pastikan foto cukup jelas dan coba lagi.',
    });
  }
}
