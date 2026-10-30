/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Calculator,
  Camera,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Plus,
} from 'lucide-react';
import { FoodItem, DailyLogItem } from '../types';
import {
  convertServingTo100g,
  verifyAtwater,
  PhotoNutritionResult,
  normalizePhotoNutritionResult,
  scalePhotoNutritionByGrams,
  parseNutritionTextToCoreMacros,
  getLocalTodayStr,
} from '../utils/nutrition';

interface NutritionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFood: (foodData: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddLogs?: (newLogs: Omit<DailyLogItem, 'id'>[]) => void;
  selectedDate?: string;
  initialMode?: 'photo' | 'serving' | 'paste';
}

export const NutritionImportModal: React.FC<NutritionImportModalProps> = ({
  isOpen,
  onClose,
  onSaveFood,
  onAddLogs,
  selectedDate,
  initialMode = 'photo',
}) => {
  const [activeMode, setActiveMode] = useState<'photo' | 'serving' | 'paste'>(initialMode);

  // Common state for Serving / Paste modes
  const [foodName, setFoodName] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Mode A: Serving Converter State
  const [servingGrams, setServingGrams] = useState<number | ''>(100);
  const [servingCalories, setServingCalories] = useState<number | ''>('');
  const [servingProtein, setServingProtein] = useState<number | ''>('');
  const [servingFat, setServingFat] = useState<number | ''>('');
  const [servingCarbs, setServingCarbs] = useState<number | ''>('');

  // Mode B: Paste Text State
  const [pastedText, setPastedText] = useState('');

  // Final Per-100g Values for Serving & Paste modes
  const [finalCaloriesPer100g, setFinalCaloriesPer100g] = useState<number>(0);
  const [finalProteinPer100g, setFinalProteinPer100g] = useState<number | null>(null);
  const [finalFatPer100g, setFinalFatPer100g] = useState<number | null>(null);
  const [finalCarbsPer100g, setFinalCarbsPer100g] = useState<number | null>(null);

  // Mode C: Smart Photo Tracker State (Strictly Calories, Protein, Carb, Fat)
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressedBase64, setCompressedBase64] = useState<string | null>(null);
  const [isScanningPhoto, setIsScanningPhoto] = useState<boolean>(false);
  const [photoBaseResult, setPhotoBaseResult] = useState<PhotoNutritionResult | null>(null);
  const [photoFoodName, setPhotoFoodName] = useState<string>('');
  const [photoGrams, setPhotoGrams] = useState<number | ''>(100);
  const [photoCalories, setPhotoCalories] = useState<number | ''>('');
  const [photoProtein, setPhotoProtein] = useState<number | ''>('');
  const [photoCarbs, setPhotoCarbs] = useState<number | ''>('');
  const [photoFat, setPhotoFat] = useState<number | ''>('');
  const [photoConfidenceNote, setPhotoConfidenceNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
      setImportError(null);
    }
  }, [isOpen, initialMode]);

  // Real-time calculation for Serving Converter
  const calculateFromServing = () => {
    const sGrams = typeof servingGrams === 'number' && servingGrams > 0 ? servingGrams : 100;
    const sCal = typeof servingCalories === 'number' ? servingCalories : 0;
    const sProt = typeof servingProtein === 'number' ? servingProtein : null;
    const sFat = typeof servingFat === 'number' ? servingFat : null;
    const sCarbs = typeof servingCarbs === 'number' ? servingCarbs : null;

    const res = convertServingTo100g(sGrams, sCal, sProt, sFat, sCarbs);
    setFinalCaloriesPer100g(res.calories);
    setFinalProteinPer100g(res.protein);
    setFinalFatPer100g(res.fat);
    setFinalCarbsPer100g(res.carbs);
  };

  useEffect(() => {
    if (isOpen && activeMode === 'serving') {
      calculateFromServing();
    }
  }, [isOpen, activeMode, servingGrams, servingCalories, servingProtein, servingFat, servingCarbs]);

  if (!isOpen) return null;

  // Parse Pasted Text
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    setImportError(null);

    const parsed = parseNutritionTextToCoreMacros(pastedText);
    if (!parsed) {
      setImportError(
        'Teks nutrisi belum terbaca. Pastikan terdapat angka Kalori, Protein, Karbohidrat, atau Lemak.'
      );
      return;
    }

    setServingGrams(parsed.portionGrams);
    setServingCalories(parsed.calories);
    setServingProtein(parsed.protein);
    setServingCarbs(parsed.carbs);
    setServingFat(parsed.fat);

    const scaled = scalePhotoNutritionByGrams(parsed, 100);
    setFinalCaloriesPer100g(scaled.per100g.calories);
    setFinalProteinPer100g(scaled.per100g.protein);
    setFinalCarbsPer100g(scaled.per100g.carbs);
    setFinalFatPer100g(scaled.per100g.fat);

    const lines = pastedText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0 && lines[0].length < 35 && !foodName) {
      setFoodName(lines[0]);
    }
  };

  // Compress image on canvas & run AI Photo Nutrition Scanner
  const scanPhotoBase64 = async (base64Jpeg: string) => {
    setIsScanningPhoto(true);
    setImportError(null);
    setPhotoConfidenceNote(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/scan-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Jpeg,
          mimeType: 'image/jpeg',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal membaca foto nutrisi.');
      }

      const normalized = normalizePhotoNutritionResult(data);
      if (!normalized) {
        setImportError(
          'Foto belum dapat dibaca sebagai makanan atau label gizi. Gunakan foto makanan atau label nutrisi yang jelas, atau isi angka di bawah.'
        );
        return;
      }

      setPhotoBaseResult(normalized);
      setPhotoFoodName(normalized.foodName);
      setPhotoGrams(normalized.portionGrams);
      setPhotoCalories(normalized.calories);
      setPhotoProtein(normalized.protein);
      setPhotoCarbs(normalized.carbs);
      setPhotoFat(normalized.fat);
      setPhotoConfidenceNote(
        normalized.confidenceNote ||
          `Terbaca akurat untuk takaran ${normalized.portionGrams}g.`
      );
    } catch (err: any) {
      setImportError(
        err?.message ||
          'Gagal menganalisis foto. Periksa koneksi internet Anda atau masukkan angka secara langsung.'
      );
    } finally {
      setIsScanningPhoto(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setIsScanningPhoto(true);
    setPhotoConfidenceNote(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setIsScanningPhoto(false);
        return;
      }
      setImagePreview(dataUrl);

      // Resize & compress image via Canvas for fast, reliable upload
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let width = img.width || 800;
        let height = img.height || 800;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCompressedBase64(jpegDataUrl);
          scanPhotoBase64(jpegDataUrl);
        } else {
          setCompressedBase64(dataUrl);
          scanPhotoBase64(dataUrl);
        }
      };
      img.onerror = () => {
        setCompressedBase64(dataUrl);
        scanPhotoBase64(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setIsScanningPhoto(false);
      setImportError('Gagal membaca file gambar.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePhotoGramsChange = (newGramsVal: string) => {
    if (newGramsVal === '') {
      setPhotoGrams('');
      return;
    }
    const parsedG = parseFloat(newGramsVal);
    if (!Number.isFinite(parsedG) || parsedG <= 0) {
      setPhotoGrams(newGramsVal as any);
      return;
    }
    setPhotoGrams(parsedG);
    if (photoBaseResult) {
      const scaled = scalePhotoNutritionByGrams(photoBaseResult, parsedG);
      setPhotoCalories(scaled.calories);
      setPhotoProtein(scaled.protein);
      setPhotoCarbs(scaled.carbs);
      setPhotoFat(scaled.fat);
    }
  };

  // Log scanned photo directly to today's meals (Makanan hari ini)
  const handleLogPhotoToToday = () => {
    setImportError(null);
    const cal = typeof photoCalories === 'number' ? Math.round(photoCalories) : 0;
    const prot = typeof photoProtein === 'number' ? Math.round(photoProtein * 10) / 10 : 0;
    const carb = typeof photoCarbs === 'number' ? Math.round(photoCarbs * 10) / 10 : 0;
    const fatVal = typeof photoFat === 'number' ? Math.round(photoFat * 10) / 10 : 0;
    const gramsVal = typeof photoGrams === 'number' && photoGrams > 0 ? photoGrams : 100;

    if (cal <= 0 && prot <= 0 && carb <= 0 && fatVal <= 0) {
      setImportError('Masukkan foto makanan/label terlebih dahulu hingga Kalori, Protein, Carb, Fat terbaca.');
      return;
    }

    const finalCalories = cal > 0 ? cal : Math.round(prot * 4 + carb * 4 + fatVal * 9);
    const cleanName = photoFoodName.trim() || 'Makanan dari Foto';

    if (onAddLogs) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      onAddLogs([
        {
          foodName: cleanName,
          grams: gramsVal,
          calories: finalCalories,
          protein: prot,
          carbs: carb,
          fat: fatVal,
          time: timeStr,
          date: selectedDate || getLocalTodayStr(),
        },
      ]);
      onClose();
    }
  };

  // Save scanned photo to MyFood database (normalized per 100g)
  const handleSavePhotoToMyFood = () => {
    setImportError(null);
    const cal = typeof photoCalories === 'number' ? Math.round(photoCalories) : 0;
    const prot = typeof photoProtein === 'number' ? Math.round(photoProtein * 10) / 10 : 0;
    const carb = typeof photoCarbs === 'number' ? Math.round(photoCarbs * 10) / 10 : 0;
    const fatVal = typeof photoFat === 'number' ? Math.round(photoFat * 10) / 10 : 0;
    const gramsVal = typeof photoGrams === 'number' && photoGrams > 0 ? photoGrams : 100;

    if (cal <= 0 && prot <= 0 && carb <= 0 && fatVal <= 0) {
      setImportError('Masukkan foto makanan/label terlebih dahulu hingga Kalori, Protein, Carb, Fat terbaca.');
      return;
    }

    const finalCalories = cal > 0 ? cal : Math.round(prot * 4 + carb * 4 + fatVal * 9);
    const cleanName = photoFoodName.trim() || 'Makanan dari Foto';
    const per100 = convertServingTo100g(gramsVal, finalCalories, prot, fatVal, carb);

    onSaveFood({
      name: cleanName,
      aliases: [],
      calories: per100.calories,
      protein: per100.protein,
      fat: per100.fat,
      carbs: per100.carbs,
      source: 'Foto Smart Tracking',
      notes: `Porsi foto awal: ${gramsVal}g`,
    });

    onClose();
  };

  const handleAddAlias = () => {
    const clean = aliasInput.trim();
    if (clean && !aliases.includes(clean)) {
      setAliases([...aliases, clean]);
      setAliasInput('');
    }
  };

  const atwater = verifyAtwater(
    finalCaloriesPer100g,
    finalProteinPer100g,
    finalFatPer100g,
    finalCarbsPer100g
  );

  const handleSaveServingOrPasteToDatabase = () => {
    setImportError(null);
    if (!foodName.trim()) {
      setImportError('Mohon masukkan nama makanan.');
      return;
    }
    if (finalCaloriesPer100g <= 0) {
      setImportError('Kalori per 100g harus lebih besar dari 0.');
      return;
    }

    onSaveFood({
      name: foodName.trim(),
      aliases: aliases,
      calories: finalCaloriesPer100g,
      protein: finalProteinPer100g,
      fat: finalFatPer100g,
      carbs: finalCarbsPer100g,
      source: 'Konversi Takaran Saji',
      notes: `Takaran saji awal: ${servingGrams || 100}g`,
    });

    onClose();
  };

  const hasPhotoNumbers =
    (typeof photoCalories === 'number' && photoCalories > 0) ||
    (typeof photoProtein === 'number' && photoProtein > 0) ||
    (typeof photoCarbs === 'number' && photoCarbs > 0) ||
    (typeof photoFat === 'number' && photoFat > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0f172a] border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] flex flex-col shadow-2xl safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Smart Photo & Nutrition Track</h3>
              <p className="text-xs text-slate-400">
                Hitung akurat Kalori, Protein, Carb & Fat dari foto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* 3 Modes Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 my-3 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            data-testid="import-tab-photo"
            onClick={() => {
              setActiveMode('photo');
              setImportError(null);
            }}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
              activeMode === 'photo'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera size={13} />
            <span>Foto / Kamera</span>
          </button>
          <button
            type="button"
            data-testid="import-tab-serving"
            onClick={() => {
              setActiveMode('serving');
              setImportError(null);
              calculateFromServing();
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'serving'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Takaran Saji
          </button>
          <button
            type="button"
            data-testid="import-tab-paste"
            onClick={() => {
              setActiveMode('paste');
              setImportError(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeMode === 'paste'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Paste Teks
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
          {importError && (
            <div
              data-testid="photo-scan-error"
              className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between"
            >
              <span>{importError}</span>
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* MODE C: SMART PHOTO TRACKER (ONLY CALORIES, PROTEIN, CARB, FAT) */}
          {activeMode === 'photo' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                data-testid="photo-file-input"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black max-h-44 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Foto Makanan / Label Nutrisi"
                    className="max-h-44 object-contain"
                  />
                  <div className="absolute bottom-2 right-2 flex items-center space-x-1.5">
                    {compressedBase64 && !isScanningPhoto && (
                      <button
                        type="button"
                        onClick={() => scanPhotoBase64(compressedBase64)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-emerald-400 text-[11px] font-bold border border-slate-700 flex items-center space-x-1 hover:bg-slate-800"
                      >
                        <RefreshCw size={11} />
                        <span>Scan Ulang</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold border border-slate-700 hover:bg-slate-800"
                    >
                      Ganti Foto
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="choose-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-7 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-3xl bg-slate-950/60 flex flex-col items-center justify-center space-y-2 text-slate-300 hover:text-white transition-all active:scale-[0.99]"
                >
                  <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-400">
                    <Camera size={28} />
                  </div>
                  <span className="text-sm font-bold text-white">
                    Ambil / Pilih Foto Makanan atau Label Gizi
                  </span>
                  <span className="text-[11px] text-slate-400 max-w-xs text-center">
                    Otomatis membaca & menghitung Kalori, Protein, Carb, dan Fat secara akurat
                  </span>
                </button>
              )}

              {/* Scanning Indicator */}
              {isScanningPhoto && (
                <div
                  data-testid="photo-scanning-status"
                  className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/40 flex items-center justify-center space-x-3 text-emerald-300"
                >
                  <RefreshCw size={18} className="animate-spin text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold block text-white">
                      Membaca nutrisi dari foto...
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Menghitung Kalori, Protein, Carb, dan Fat
                    </span>
                  </div>
                </div>
              )}

              {/* Strictly 4-Macro Calculation Card (Calories, Protein, Carb, Fat) */}
              {!isScanningPhoto && (imagePreview || hasPhotoNumbers) && (
                <div
                  data-testid="photo-macro-result-card"
                  className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/40 space-y-3 shadow-lg"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wide flex items-center space-x-1.5">
                      <Sparkles size={13} className="shrink-0" />
                      <span>Hasil Hitung Foto (4 Makro Utama)</span>
                    </span>
                    {photoConfidenceNote && (
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {photoConfidenceNote}
                      </p>
                    )}
                  </div>

                  {/* Compact Food Name & Portion Grams Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-slate-400 block">
                        Nama Makanan
                      </label>
                      <input
                        type="text"
                        data-testid="photo-food-name-input"
                        value={photoFoodName}
                        onChange={(e) => setPhotoFoodName(e.target.value)}
                        placeholder="Nama makanan..."
                        className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 block">
                        Porsi (g)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        data-testid="photo-grams-input"
                        value={photoGrams}
                        onChange={(e) => handlePhotoGramsChange(e.target.value)}
                        className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white text-right focus:outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>
                  </div>

                  {/* ONLY THE 4 CORE VALUES: CALORIES, PROTEIN, CARB, FAT */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* 1. Calories */}
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-emerald-500/30">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase block">
                        Calories
                      </span>
                      <div className="flex items-baseline space-x-1 mt-0.5">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          data-testid="photo-calories-input"
                          value={photoCalories}
                          placeholder="0"
                          onChange={(e) =>
                            setPhotoCalories(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full bg-transparent text-base font-black text-emerald-400 focus:outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                          kkal
                        </span>
                      </div>
                    </div>

                    {/* 2. Protein */}
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold text-slate-300 uppercase block">
                        Protein
                      </span>
                      <div className="flex items-baseline space-x-1 mt-0.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          data-testid="photo-protein-input"
                          value={photoProtein}
                          placeholder="0"
                          onChange={(e) =>
                            setPhotoProtein(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full bg-transparent text-base font-black text-white focus:outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                          g
                        </span>
                      </div>
                    </div>

                    {/* 3. Carb */}
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold text-sky-400 uppercase block">
                        Carb
                      </span>
                      <div className="flex items-baseline space-x-1 mt-0.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          data-testid="photo-carbs-input"
                          value={photoCarbs}
                          placeholder="0"
                          onChange={(e) =>
                            setPhotoCarbs(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full bg-transparent text-base font-black text-sky-300 focus:outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                          g
                        </span>
                      </div>
                    </div>

                    {/* 4. Fat */}
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-bold text-amber-400 uppercase block">
                        Fat
                      </span>
                      <div className="flex items-baseline space-x-1 mt-0.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          data-testid="photo-fat-input"
                          value={photoFat}
                          placeholder="0"
                          onChange={(e) =>
                            setPhotoFat(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full bg-transparent text-base font-black text-amber-300 focus:outline-none tabular-nums"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                          g
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE A & B: Serving Converter & Paste Text */}
          {activeMode !== 'photo' && (
            <>
              {/* Food Name & Aliases */}
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div>
                  <label className="text-xs font-bold text-slate-300">
                    Nama Makanan <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    placeholder="Contoh: Susu Kedelai Kotak, Roti Gandum"
                    className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex space-x-1.5 pt-1">
                  <input
                    type="text"
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    placeholder="Tambah alias (opsional)..."
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddAlias}
                    className="px-2.5 py-1.5 bg-slate-800 text-sky-400 rounded-xl text-xs font-bold hover:bg-slate-700"
                  >
                    +
                  </button>
                </div>

                {aliases.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {aliases.map((a, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded border border-slate-700"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {activeMode === 'serving' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        Nilai Sesuai Kemasan Produk
                      </span>
                      <span className="text-[11px] text-sky-400">1 sajian</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400">
                          Takaran Saji (gram/ml)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={servingGrams}
                          onChange={(e) => {
                            setServingGrams(parseFloat(e.target.value) || '');
                          }}
                          onBlur={calculateFromServing}
                          className="w-full mt-0.5 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400">Kalori Per Sajian</label>
                        <input
                          type="number"
                          min="0"
                          value={servingCalories}
                          placeholder="0"
                          onChange={(e) => {
                            setServingCalories(parseFloat(e.target.value) || '');
                          }}
                          onBlur={calculateFromServing}
                          className="w-full mt-0.5 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400">Protein (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={servingProtein}
                          placeholder="0"
                          onChange={(e) => {
                            setServingProtein(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            );
                          }}
                          onBlur={calculateFromServing}
                          className="w-full mt-0.5 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Carb (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={servingCarbs}
                          placeholder="0"
                          onChange={(e) => {
                            setServingCarbs(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            );
                          }}
                          onBlur={calculateFromServing}
                          className="w-full mt-0.5 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Fat (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={servingFat}
                          placeholder="0"
                          onChange={(e) => {
                            setServingFat(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            );
                          }}
                          onBlur={calculateFromServing}
                          className="w-full mt-0.5 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeMode === 'paste' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300">
                    Tempel Teks Informasi Nilai Gizi
                  </label>
                  <textarea
                    rows={4}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Contoh:&#10;Energi total: 140 kkal&#10;Takaran saji: 40g&#10;Protein: 10g&#10;Karbohidrat: 18g&#10;Lemak total: 4.5g"
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    disabled={!pastedText.trim()}
                    className="w-full py-2 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold hover:bg-sky-400 active:scale-95 disabled:opacity-40"
                  >
                    Ekstrak Kalori, Protein, Carb & Fat
                  </button>
                </div>
              )}

              {/* FINAL RESULT PREVIEW PER 100g (For Serving & Paste modes) */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                    Hasil Konversi Basis 100 Gram
                  </span>
                  <span className="text-[10px] text-slate-400">4 Makro Utama</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Calories</span>
                    <input
                      type="number"
                      value={finalCaloriesPer100g || ''}
                      placeholder="0"
                      onChange={(e) => setFinalCaloriesPer100g(parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent text-sm font-black text-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Protein</span>
                    <input
                      type="number"
                      step="0.1"
                      value={finalProteinPer100g ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        setFinalProteinPer100g(
                          e.target.value === '' ? null : parseFloat(e.target.value)
                        )
                      }
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>

                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Carb</span>
                    <input
                      type="number"
                      step="0.1"
                      value={finalCarbsPer100g ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        setFinalCarbsPer100g(
                          e.target.value === '' ? null : parseFloat(e.target.value)
                        )
                      }
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>

                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Fat</span>
                    <input
                      type="number"
                      step="0.1"
                      value={finalFatPer100g ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        setFinalFatPer100g(
                          e.target.value === '' ? null : parseFloat(e.target.value)
                        )
                      }
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>

                {finalCaloriesPer100g > 0 && !atwater.isConsistent && (
                  <p className="text-[10px] text-amber-400 flex items-center space-x-1">
                    <AlertCircle size={11} />
                    <span>{atwater.message}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex space-x-2">
          {activeMode === 'photo' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-3.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="photo-save-myfood-btn"
                disabled={isScanningPhoto || !hasPhotoNumbers}
                onClick={handleSavePhotoToMyFood}
                className="flex-1 py-3 px-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-bold hover:bg-slate-700 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center space-x-1"
              >
                <Plus size={14} />
                <span>Simpan MyFood</span>
              </button>
              {onAddLogs && (
                <button
                  type="button"
                  data-testid="photo-log-today-btn"
                  disabled={isScanningPhoto || !hasPhotoNumbers}
                  onClick={handleLogPhotoToToday}
                  className="flex-1 py-3 px-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center space-x-1"
                >
                  <Check size={15} strokeWidth={3} />
                  <span>Catat Hari Ini</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!foodName.trim() || finalCaloriesPer100g <= 0}
                onClick={handleSaveServingOrPasteToDatabase}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center space-x-1"
              >
                <Check size={16} strokeWidth={3} />
                <span>Simpan ke Database</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
