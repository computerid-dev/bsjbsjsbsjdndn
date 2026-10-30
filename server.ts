/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import dns from 'node:dns';
import fs from 'node:fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum tersedia di server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

function mountStaticDist(app: express.Express) {
  const distPath = path.join(__dirname, 'dist');
  const publicPath = path.join(__dirname, 'public');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }));
  }
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }));
  }
  app.use((_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const distIndex = path.join(distPath, 'index.html');
    if (fs.existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  });
}

// Pembatas sederhana (in-memory) agar endpoint scan tidak bisa dipakai menguras kuota Gemini.
// Atur lewat env: SCAN_RATE_PER_MIN (per IP, default 8) dan SCAN_DAILY_LIMIT (total harian, default 300).
const SCAN_RATE_PER_MIN = Number(process.env.SCAN_RATE_PER_MIN) || 8;
const SCAN_DAILY_LIMIT = Number(process.env.SCAN_DAILY_LIMIT) || 300;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BASE64_CHARS = 8 * 1024 * 1024; // sekitar 6 MB gambar

const ipHits = new Map<string, number[]>();
let dailyCount = 0;
let dailyKey = new Date().toISOString().split('T')[0];

function checkScanLimit(ip: string): string | null {
  const today = new Date().toISOString().split('T')[0];
  if (today !== dailyKey) {
    dailyKey = today;
    dailyCount = 0;
  }
  if (dailyCount >= SCAN_DAILY_LIMIT) {
    return 'Batas scan harian server sudah tercapai. Coba lagi besok atau isi angka secara manual.';
  }
  const now = Date.now();
  const recent = (ipHits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= SCAN_RATE_PER_MIN) {
    ipHits.set(ip, recent);
    return 'Terlalu banyak permintaan scan. Tunggu sebentar lalu coba lagi.';
  }
  recent.push(now);
  ipHits.set(ip, recent);
  dailyCount += 1;
  return null;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Di balik proxy (Cloud Run, Vercel, dsb.) agar req.ip berisi IP pengguna asli
  app.set('trust proxy', 1);
  // CORS: izinkan APK (Capacitor memakai origin https://localhost) memanggil API ini.
  // Tambah origin lain lewat env ALLOWED_ORIGINS (pisahkan dengan koma).
  const allowedOrigins = new Set([
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    ...(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '10mb' }));

  setInterval(() => {
    const now = Date.now();
    for (const [ip, hits] of ipHits) {
      if (hits.every((t) => now - t >= 60_000)) ipHits.delete(ip);
    }
  }, 5 * 60_000).unref();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/scan-photo', async (req, res) => {
    try {
      const limitMessage = checkScanLimit(req.ip || 'unknown');
      if (limitMessage) {
        res.status(429).json({ error: limitMessage });
        return;
      }

      const { imageBase64, mimeType } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Data foto tidak ditemukan.' });
        return;
      }
      if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
        res.status(413).json({ error: 'Ukuran foto terlalu besar. Gunakan foto yang lebih kecil.' });
        return;
      }

      const cleanBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      const safeMimeType =
        typeof mimeType === 'string' && ALLOWED_IMAGE_TYPES.has(mimeType)
          ? mimeType
          : 'image/jpeg';

      const parsed = await analyzeNutritionImageWithGemini(cleanBase64, safeMimeType);
      res.json(parsed);
    } catch (err: any) {
      // Detail error hanya dicatat di log server, tidak dikirim ke pengguna
      console.error('Error in /api/scan-photo:', err);
      res.status(500).json({
        error: 'Gagal membaca foto. Pastikan foto cukup jelas dan coba lagi.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);

      // Dev SPA route fallback for any navigation requests
      app.use('*', async (req, res, next) => {
        const url = req.originalUrl;
        if (url.startsWith('/api/')) return next();
        try {
          const indexPath = path.resolve(__dirname, 'index.html');
          if (fs.existsSync(indexPath)) {
            let template = fs.readFileSync(indexPath, 'utf-8');
            template = await vite.transformIndexHtml(url, template);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
            return;
          }
          next();
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (err) {
      console.warn('Vite dev server unavailable, falling back to static build:', err);
      mountStaticDist(app);
    }
  } else {
    mountStaticDist(app);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KaloriKu server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
