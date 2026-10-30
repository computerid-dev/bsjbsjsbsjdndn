/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Tag,
  Lock,
  Unlock,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { FoodItem } from '../types';
import { verifyAtwater, detectSimilarFood } from '../utils/nutrition';

interface ManualFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (foodData: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string) => void;
  editingFood?: FoodItem | null;
  existingFoods: FoodItem[];
  prefillName?: string;
  isNutritionLocked?: boolean;
  onUnlockRequest?: () => void;
  onRelockSession?: () => void;
}

export const ManualFoodModal: React.FC<ManualFoodModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingFood,
  existingFoods,
  prefillName = '',
  isNutritionLocked = false,
  onUnlockRequest,
  onRelockSession,
}) => {
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');

  const [calories, setCalories] = useState<number | ''>('');

  const [protein, setProtein] = useState<number | ''>('');
  const [isProteinUnknown, setIsProteinUnknown] = useState(false);

  const [fat, setFat] = useState<number | ''>('');
  const [isFatUnknown, setIsFatUnknown] = useState(false);

  const [carbs, setCarbs] = useState<number | ''>('');
  const [isCarbsUnknown, setIsCarbsUnknown] = useState(false);

  const [prepState, setPrepState] = useState<'mentah' | 'matang' | 'lainnya'>('mentah');
  const [pricePerKg, setPricePerKg] = useState<number | ''>('');
  const [stockGrams, setStockGrams] = useState<number | ''>('');
  const [source, setSource] = useState('Label Kemasan');
  const [notes, setNotes] = useState('');

  // Duplicate Warning & Form Error
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Old vs New Comparison Modal State
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'> | null>(null);

  useEffect(() => {
    if (editingFood) {
      setName(editingFood.name);
      setAliases(editingFood.aliases || []);
      setCalories(editingFood.calories);

      if (editingFood.protein === null) {
        setIsProteinUnknown(true);
        setProtein('');
      } else {
        setIsProteinUnknown(false);
        setProtein(editingFood.protein);
      }

      if (editingFood.fat === null) {
        setIsFatUnknown(true);
        setFat('');
      } else {
        setIsFatUnknown(false);
        setFat(editingFood.fat);
      }

      if (editingFood.carbs === null) {
        setIsCarbsUnknown(true);
        setCarbs('');
      } else {
        setIsCarbsUnknown(false);
        setCarbs(editingFood.carbs);
      }

      setPrepState(editingFood.prepState || 'mentah');
      setPricePerKg(editingFood.pricePerKg ?? '');
      setStockGrams(editingFood.stockGrams ?? '');
      setSource(editingFood.source || 'Label Kemasan');
      setNotes(editingFood.notes || '');
    } else {
      setName(prefillName);
      setAliases([]);
      setNewAliasInput('');
      setCalories('');
      setProtein('');
      setIsProteinUnknown(false);
      setFat('');
      setIsFatUnknown(false);
      setCarbs('');
      setIsCarbsUnknown(false);
      setPrepState('mentah');
      setPricePerKg('');
      setStockGrams('');
      setSource('Label Kemasan');
      setNotes('');
    }
    setShowComparisonModal(false);
    setPendingSaveData(null);
    setFormError(null);
  }, [editingFood, prefillName, isOpen]);

  // Check duplicate name
  useEffect(() => {
    if (name.trim()) {
      const match = detectSimilarFood(name.trim(), existingFoods, editingFood?.id);
      if (match) {
        setDuplicateWarning(
          `Perhatian: Sudah ada makanan "${match.name}" di database dengan nama serupa.`
        );
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  }, [name, existingFoods, editingFood]);

  if (!isOpen) return null;

  const handleAddAlias = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newAliasInput.trim();
    if (clean && !aliases.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      setAliases([...aliases, clean]);
      setNewAliasInput('');
    }
  };

  const handleRemoveAlias = (index: number) => {
    setAliases(aliases.filter((_, i) => i !== index));
  };

  const numCalories = typeof calories === 'number' ? calories : 0;
  const numProtein = isProteinUnknown ? null : typeof protein === 'number' ? protein : null;
  const numFat = isFatUnknown ? null : typeof fat === 'number' ? fat : null;
  const numCarbs = isCarbsUnknown ? null : typeof carbs === 'number' ? carbs : null;

  const atwater = verifyAtwater(numCalories, numProtein, numFat, numCarbs);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Nama makanan wajib diisi.');
      return;
    }
    if (typeof calories !== 'number' || isNaN(calories) || calories < 0) {
      setFormError('Kalori per 100g wajib diisi dengan angka valid (minimal 0).');
      return;
    }
    if (numProtein !== null && (isNaN(numProtein) || numProtein < 0)) {
      setFormError('Nilai protein harus berupa angka valid (minimal 0) atau kosongkan.');
      return;
    }
    if (numFat !== null && (isNaN(numFat) || numFat < 0)) {
      setFormError('Nilai lemak harus berupa angka valid (minimal 0) atau kosongkan.');
      return;
    }
    if (numCarbs !== null && (isNaN(numCarbs) || numCarbs < 0)) {
      setFormError('Nilai karbohidrat harus berupa angka valid (minimal 0) atau kosongkan.');
      return;
    }

    const newFoodData: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      aliases: aliases,
      calories: numCalories,
      protein: numProtein,
      fat: numFat,
      carbs: numCarbs,
      prepState: prepState,
      servingUnit: 'g',
      servingSize: 100,
      pricePerKg: typeof pricePerKg === 'number' && !isNaN(pricePerKg) ? pricePerKg : null,
      stockGrams: typeof stockGrams === 'number' && !isNaN(stockGrams) ? stockGrams : null,
      source: source.trim(),
      notes: notes.trim(),
    };

    // If editing existing food, check if nutrition values were modified
    if (editingFood) {
      const isNutritionChanged =
        editingFood.calories !== numCalories ||
        editingFood.protein !== numProtein ||
        editingFood.fat !== numFat ||
        editingFood.carbs !== numCarbs ||
        (editingFood.prepState || 'mentah') !== prepState;

      if (isNutritionChanged) {
        setPendingSaveData(newFoodData);
        setShowComparisonModal(true);
        return;
      }
    }

    // Direct save if new food or only non-nutrition fields were edited
    onSave(newFoodData, editingFood?.id);
    if (editingFood) {
      onRelockSession?.();
    }
    onClose();
  };

  const handleConfirmComparisonSave = () => {
    if (!pendingSaveData) return;
    onSave(pendingSaveData, editingFood?.id);
    onRelockSession?.();
    setShowComparisonModal(false);
    setPendingSaveData(null);
    onClose();
  };

  const isFormNutritionLocked = Boolean(editingFood && isNutritionLocked);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0f172a] border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] flex flex-col shadow-2xl safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">
              {editingFood ? 'Edit Makanan Pribadi' : 'Tambah Makanan Baru'}
            </h3>
            <p className="text-xs text-slate-400">Nutrisi dasar per 100 gram</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Nutrition Lock Status Banner (Read-Only when locked; no unlock button inside modal) */}
          {editingFood && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition-colors ${
                isFormNutritionLocked
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                {isFormNutritionLocked ? (
                  <Lock size={16} className="text-amber-400 shrink-0" />
                ) : (
                  <Unlock size={16} className="text-emerald-400 shrink-0" />
                )}
                <div>
                  <span className="font-bold block">
                    {isFormNutritionLocked ? 'Kunci Nutrisi Aktif' : 'Sesi Edit Nutrisi Terbuka'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isFormNutritionLocked
                      ? 'Kalori, makro, dan basis bahan dikunci. Hanya nama, alias, stok, dan catatan yang dapat diubah. Buka kunci hanya di menu Pengaturan dengan sandi.'
                      : 'Anda dapat mengedit angka kalori & makro. Kunci otomatis aktif kembali setelah disimpan.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Warning */}
          {duplicateWarning && (
            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start space-x-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs font-bold text-slate-300">
              Nama Makanan <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Dada Ayam Mentah, Telur Rebus, Nasi Putih"
              className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Aliases Section */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                <Tag size={13} className="text-emerald-400" />
                <span>Alias / Nama Lain (Pencarian & Quick Log)</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              Contoh: "ayam", "chicken breast", "fillet dada" akan otomatis mengenali makanan ini.
            </p>

            {/* Existing Aliases */}
            <div className="flex flex-wrap gap-1.5">
              {aliases.map((alias, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 text-xs bg-slate-800 text-slate-200 rounded-lg flex items-center space-x-1 border border-slate-700"
                >
                  <span>{alias}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAlias(idx)}
                    className="text-slate-400 hover:text-rose-400 ml-1"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Alias Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={newAliasInput}
                onChange={(e) => setNewAliasInput(e.target.value)}
                placeholder="Ketik alias lalu tekan Tambah..."
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddAlias}
                disabled={!newAliasInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-emerald-400 text-xs font-bold hover:bg-slate-700 disabled:opacity-40"
              >
                + Tambah
              </button>
            </div>
          </div>

          {/* Calories (Mandatory) */}
          <div>
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <span>Kalori per 100g</span>
                <span className="text-rose-400">*</span>
                {isFormNutritionLocked && <Lock size={12} className="text-amber-400" />}
              </label>
              <span className="text-[11px] text-emerald-400 font-semibold">Energi Utama</span>
            </div>
            <div className="relative mt-1">
              <input
                type="number"
                step="any"
                min="0"
                required
                disabled={isFormNutritionLocked}
                value={calories}
                onChange={(e) =>
                  setCalories(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                placeholder="Contoh: 165"
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed pr-14"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">
                kkal
              </span>
            </div>
          </div>

          {/* 3 Macros (Protein, Fat, Carbs) with Unknown Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Protein */}
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                  <span>Protein</span>
                  {isFormNutritionLocked && <Lock size={10} className="text-amber-400" />}
                </span>
                <label className={`flex items-center space-x-1 ${isFormNutritionLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    disabled={isFormNutritionLocked}
                    checked={isProteinUnknown}
                    onChange={(e) => setIsProteinUnknown(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500 w-3 h-3"
                  />
                  <span className="text-[10px] text-slate-400">Belum tahu</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={isProteinUnknown || isFormNutritionLocked}
                  value={isProteinUnknown ? '' : protein}
                  onChange={(e) =>
                    setProtein(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder={isProteinUnknown ? '-' : '0.0'}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed pr-8"
                />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400">g</span>
              </div>
            </div>

            {/* Fat */}
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                  <span>Lemak</span>
                  {isFormNutritionLocked && <Lock size={10} className="text-amber-400" />}
                </span>
                <label className={`flex items-center space-x-1 ${isFormNutritionLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    disabled={isFormNutritionLocked}
                    checked={isFatUnknown}
                    onChange={(e) => setIsFatUnknown(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-amber-500 w-3 h-3"
                  />
                  <span className="text-[10px] text-slate-400">Belum tahu</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={isFatUnknown || isFormNutritionLocked}
                  value={isFatUnknown ? '' : fat}
                  onChange={(e) =>
                    setFat(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder={isFatUnknown ? '-' : '0.0'}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed pr-8"
                />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400">g</span>
              </div>
            </div>

            {/* Carbs */}
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center space-x-1">
                  <span>Karbohidrat</span>
                  {isFormNutritionLocked && <Lock size={10} className="text-amber-400" />}
                </span>
                <label className={`flex items-center space-x-1 ${isFormNutritionLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    disabled={isFormNutritionLocked}
                    checked={isCarbsUnknown}
                    onChange={(e) => setIsCarbsUnknown(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-sky-500 w-3 h-3"
                  />
                  <span className="text-[10px] text-slate-400">Belum tahu</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={isCarbsUnknown || isFormNutritionLocked}
                  value={isCarbsUnknown ? '' : carbs}
                  onChange={(e) =>
                    setCarbs(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder={isCarbsUnknown ? '-' : '0.0'}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-sky-500 disabled:opacity-40 disabled:cursor-not-allowed pr-8"
                />
                <span className="absolute right-2 top-2 text-[10px] text-slate-400">g</span>
              </div>
            </div>
          </div>

          {/* Atwater Formula Live Preview */}
          <div
            className={`p-3 rounded-2xl border text-xs ${
              atwater.isConsistent
                ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
            }`}
          >
            <div className="flex items-center space-x-1.5 font-bold mb-1">
              {atwater.isConsistent ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <AlertTriangle size={14} className="text-amber-400" />
              )}
              <span>Verifikasi Nutrisi 4-4-9 (Atwater)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{atwater.message}</p>
          </div>

          {/* Optional: Price per kg & Stock inventory */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-300">
                Harga Beli (Opsional)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  min="0"
                  value={pricePerKg}
                  onChange={(e) =>
                    setPricePerKg(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="Rp per kg"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-500">Untuk kalkulator efisiensi protein</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">
                Stok Awal (Opsional)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  min="0"
                  value={stockGrams}
                  onChange={(e) =>
                    setStockGrams(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="Gram di dapur"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-500">Auto potong saat dicatat makan</span>
            </div>
          </div>

          {/* Prep State (Mentah / Matang), Source & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                <span>Kondisi Bahan</span>
                {isFormNutritionLocked && <Lock size={10} className="text-amber-400" />}
              </label>
              <select
                disabled={isFormNutritionLocked}
                value={prepState}
                onChange={(e) =>
                  setPrepState(e.target.value as 'mentah' | 'matang' | 'lainnya')
                }
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="mentah">Mentah (Raw)</option>
                <option value="matang">Matang (Cooked)</option>
                <option value="lainnya">Lainnya / Olahan</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                <span>Sumber Data</span>
                {isFormNutritionLocked && <Lock size={10} className="text-amber-400" />}
              </label>
              <select
                disabled={isFormNutritionLocked}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="Label Kemasan">Label Kemasan</option>
                <option value="Tabel Komposisi Pangan">Tabel Komposisi Pangan</option>
                <option value="Resep Masakan">Resep Masakan</option>
                <option value="Estimasi Pribadi">Estimasi Pribadi</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Catatan Tambahan</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Merk, rasa, porsi..."
                className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-800 flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
            >
              {editingFood ? 'Simpan Perubahan' : 'Tambah ke My Foods'}
            </button>
          </div>
        </form>
      </div>

      {/* Old vs New Comparison Modal Overlay */}
      {showComparisonModal && pendingSaveData && editingFood && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f172a] border border-amber-500/40 w-full max-w-md rounded-3xl p-5 shadow-2xl flex flex-col space-y-3.5">
            {/* Header */}
            <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white">Konfirmasi Perubahan Nutrisi</h3>
                <p className="text-xs text-slate-400">{editingFood.name}</p>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Periksa perbandingan nilai sebelum perubahan disimpan ke database:
            </p>

            {/* Comparison Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/80 text-xs">
              <div className="grid grid-cols-4 p-2 bg-slate-900/90 font-bold text-slate-400 text-[11px] border-b border-slate-800">
                <span>Nutrisi / Nilai</span>
                <span className="text-center">Nilai Lama</span>
                <span className="text-center">Nilai Baru</span>
                <span className="text-right">Perubahan</span>
              </div>

              {/* Calories Row */}
              <div className="grid grid-cols-4 p-2 border-b border-slate-800/60 items-center">
                <span className="font-bold text-white">Kalori (per 100g)</span>
                <span className="text-center text-slate-400">{editingFood.calories} kkal</span>
                <span className="text-center font-bold text-emerald-400">
                  {pendingSaveData.calories} kkal
                </span>
                <span
                  className={`text-right font-bold ${
                    pendingSaveData.calories - editingFood.calories > 0
                      ? 'text-rose-400'
                      : pendingSaveData.calories - editingFood.calories < 0
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }`}
                >
                  {pendingSaveData.calories - editingFood.calories > 0
                    ? `+${pendingSaveData.calories - editingFood.calories}`
                    : `${pendingSaveData.calories - editingFood.calories}`}{' '}
                  kkal
                </span>
              </div>

              {/* Protein Row */}
              <div className="grid grid-cols-4 p-2 border-b border-slate-800/60 items-center">
                <span className="font-bold text-emerald-400">Protein</span>
                <span className="text-center text-slate-400">
                  {editingFood.protein !== null ? `${editingFood.protein}g` : '-'}
                </span>
                <span className="text-center font-bold text-white">
                  {pendingSaveData.protein !== null ? `${pendingSaveData.protein}g` : '-'}
                </span>
                <span className="text-right text-slate-400 font-semibold">
                  {editingFood.protein !== null && pendingSaveData.protein !== null
                    ? `${(pendingSaveData.protein - editingFood.protein >= 0 ? '+' : '') + (Math.round((pendingSaveData.protein - editingFood.protein) * 10) / 10)}g`
                    : 'Ubah data'}
                </span>
              </div>

              {/* Fat Row */}
              <div className="grid grid-cols-4 p-2 border-b border-slate-800/60 items-center">
                <span className="font-bold text-amber-400">Lemak</span>
                <span className="text-center text-slate-400">
                  {editingFood.fat !== null ? `${editingFood.fat}g` : '-'}
                </span>
                <span className="text-center font-bold text-white">
                  {pendingSaveData.fat !== null ? `${pendingSaveData.fat}g` : '-'}
                </span>
                <span className="text-right text-slate-400 font-semibold">
                  {editingFood.fat !== null && pendingSaveData.fat !== null
                    ? `${(pendingSaveData.fat - editingFood.fat >= 0 ? '+' : '') + (Math.round((pendingSaveData.fat - editingFood.fat) * 10) / 10)}g`
                    : 'Ubah data'}
                </span>
              </div>

              {/* Carbs Row */}
              <div className="grid grid-cols-4 p-2 border-b border-slate-800/60 items-center">
                <span className="font-bold text-sky-400">Karbohidrat</span>
                <span className="text-center text-slate-400">
                  {editingFood.carbs !== null ? `${editingFood.carbs}g` : '-'}
                </span>
                <span className="text-center font-bold text-white">
                  {pendingSaveData.carbs !== null ? `${pendingSaveData.carbs}g` : '-'}
                </span>
                <span className="text-right text-slate-400 font-semibold">
                  {editingFood.carbs !== null && pendingSaveData.carbs !== null
                    ? `${(pendingSaveData.carbs - editingFood.carbs >= 0 ? '+' : '') + (Math.round((pendingSaveData.carbs - editingFood.carbs) * 10) / 10)}g`
                    : 'Ubah data'}
                </span>
              </div>

              {/* Prep State Row */}
              <div className="grid grid-cols-4 p-2 border-b border-slate-800/60 items-center text-[11px]">
                <span className="font-medium text-slate-300">Kondisi Bahan</span>
                <span className="text-center text-slate-400 capitalize">
                  {editingFood.prepState || 'mentah'}
                </span>
                <span className="text-center font-bold text-white capitalize">
                  {pendingSaveData.prepState || 'mentah'}
                </span>
                <span className="text-right text-slate-500">
                  {editingFood.prepState === pendingSaveData.prepState ? 'Sama' : 'Diperbarui'}
                </span>
              </div>

              {/* Source Row */}
              <div className="grid grid-cols-4 p-2 items-center text-[11px]">
                <span className="font-medium text-slate-300">Sumber</span>
                <span className="text-center text-slate-400 truncate">
                  {editingFood.source || '-'}
                </span>
                <span className="text-center font-bold text-white truncate">
                  {pendingSaveData.source || '-'}
                </span>
                <span className="text-right text-slate-500">
                  {editingFood.source === pendingSaveData.source ? 'Sama' : 'Diperbarui'}
                </span>
              </div>
            </div>

            {/* Atwater Formula 4-4-9 explanation */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-200 block">
                Pemeriksaan Rumus 4-4-9 (Atwater):
              </span>
              <p>
                {verifyAtwater(
                  pendingSaveData.calories,
                  pendingSaveData.protein,
                  pendingSaveData.fat,
                  pendingSaveData.carbs
                ).message}
              </p>
              <p className="text-[10px] text-slate-500 italic">
                *Rumus 4-4-9 hanya indikator keselarasan matematis makro terhadap kalori tertera, bukan pembuktian akurasi uji lab.
              </p>
            </div>

            {/* Historical Snapshot Immutable Protection Assurance */}
            <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-[11px] flex items-start space-x-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <p>
                <strong>Keamanan Riwayat Konsumsi:</strong> Catatan makanan lama pada riwayat harian Anda tidak akan berubah karena tersimpan mandiri sebagai snapshot permanen.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowComparisonModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Batal (Cek Ulang)
              </button>
              <button
                type="button"
                onClick={handleConfirmComparisonSave}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Setujui & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
