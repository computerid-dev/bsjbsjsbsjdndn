/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Zap, Plus, Check, X, AlertCircle } from 'lucide-react';
import { FoodItem, DailyLogItem } from '../types';
import {
  parseQuickLogText,
  ParsedQuickLogItem,
  QuickLogUnitMode,
  computeQuickLogItemMetrics,
  formatQuickLogNumberID,
} from '../utils/nutrition';

interface QuickLogBarProps {
  foods: FoodItem[];
  selectedDate: string;
  onAddLogs: (newLogs: Omit<DailyLogItem, 'id'>[]) => void;
  onOpenAddFoodModal: (prefillName?: string) => void;
  directSave?: boolean;
}

export const QuickLogBar: React.FC<QuickLogBarProps> = ({
  foods,
  selectedDate,
  onAddLogs,
  onOpenAddFoodModal,
}) => {
  const [inputText, setInputText] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState<ParsedQuickLogItem[]>([]);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Extract the trailing unfinished query segment so we can show live autocomplete chips
  const getActiveTailState = (raw: string) => {
    if (!raw || !raw.trim()) {
      return {
        prefix: '',
        tail: '',
        exactFoodMatch: null as FoodItem | null,
        suggestions: [] as FoodItem[],
      };
    }

    // Match all completed "<name> <number>[g|gr|gram|kkal|kcal|kalori]" segments at the start of the string
    const completedPrefixMatch = raw.match(
      /^(?:[a-zA-Z\u00C0-\u024F\s\(\)\-\.\/&']+?\s*\d+(?:[.,]\d+)?\s*(?:grams|gram|gr|g|kalori|kkal|kcal)?(?:[,;\s]+|$))+/i
    );
    const prefix = completedPrefixMatch ? completedPrefixMatch[0] : '';
    const tail = raw.slice(prefix.length).replace(/^[,;\s]+/, '');

    // If the tail is empty or already ends with a number/unit, no name autocomplete needed
    if (!tail || /\d+\s*(?:grams|gram|gr|g|kalori|kkal|kcal)?\s*$/i.test(tail)) {
      return {
        prefix,
        tail: '',
        exactFoodMatch: null as FoodItem | null,
        suggestions: [] as FoodItem[],
      };
    }

    const q = tail.toLowerCase().trim();
    if (!q) {
      return {
        prefix,
        tail: '',
        exactFoodMatch: null as FoodItem | null,
        suggestions: [] as FoodItem[],
      };
    }

    const exactFoodMatch =
      foods.find(
        (f) =>
          f.name.toLowerCase().trim() === q ||
          f.aliases.some((a) => a.toLowerCase().trim() === q)
      ) || null;

    const suggestions = foods
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.aliases.some((a) => a.toLowerCase().includes(q))
      )
      .slice(0, 6);

    return { prefix, tail, exactFoodMatch, suggestions };
  };

  const { prefix, tail, exactFoodMatch, suggestions } = getActiveTailState(inputText);

  const handleSelectFoodSuggestion = (food: FoodItem) => {
    const cleanPrefix = prefix ? (prefix.endsWith(' ') ? prefix : `${prefix} `) : '';
    const nextValue = `${cleanPrefix}${food.name} `;
    setInputText(nextValue);
    setErrorHint(null);
    inputRef.current?.focus();
  };

  const handleSelectQuickGrams = (grams: number) => {
    const trimmed = inputText.trimEnd();
    const nextValue = `${trimmed} ${grams}g `;
    setInputText(nextValue);
    setErrorHint(null);
    inputRef.current?.focus();
  };

  const handleSelectQuickCalories = (calories: number) => {
    const trimmed = inputText.trimEnd();
    const nextValue = `${trimmed} ${calories} kkal `;
    setInputText(nextValue);
    setErrorHint(null);
    inputRef.current?.focus();
  };

  const handleParseAndSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    setErrorHint(null);

    const { items } = parseQuickLogText(inputText, foods);

    if (items.length === 0) {
      setErrorHint(
        'Ketik nama makanan & jumlah gram atau kalori (contoh: "French fries 200g" atau "French fries 200 kkal").'
      );
      return;
    }

    setPreviewItems(items);
    // Always display preview of name, grams, calories, and all macros before confirming save
    setShowPreviewModal(true);
  };

  const saveItemsToLog = (itemsToSave: ParsedQuickLogItem[]) => {
    const allReady =
      itemsToSave.length > 0 &&
      itemsToSave.every(
        (item) =>
          item.isMatched &&
          item.matchedFood &&
          !item.needsUnitSelection &&
          !item.needsFoodSelection &&
          !item.hasInvalidFoodCalories
      );
    if (!allReady) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const validLogs: Omit<DailyLogItem, 'id'>[] = itemsToSave.map((item) => ({
      foodId: item.matchedFood!.id,
      foodName: item.matchedFood!.name,
      grams: item.grams,
      calories: item.calculatedCalories,
      protein: item.calculatedProtein,
      fat: item.calculatedFat,
      carbs: item.calculatedCarbs,
      isEstimate: false,
      time: timeStr,
      date: selectedDate,
    }));

    if (validLogs.length > 0) {
      onAddLogs(validLogs);
      setShowPreviewModal(false);
      setInputText('');
    }
  };

  const handleSelectCandidateFood = (index: number, chosenFood: FoodItem) => {
    const updated = [...previewItems];
    const current = updated[index];
    if (!current) return;

    updated[index] = computeQuickLogItemMetrics({
      queryText: current.queryText,
      inputValue: current.inputValue,
      unitMode: current.unitMode,
      matchedFood: chosenFood,
      candidateFoods: current.candidateFoods,
    });
    setPreviewItems(updated);
  };

  const handleResetFoodSelection = (index: number) => {
    const updated = [...previewItems];
    const current = updated[index];
    if (!current || current.candidateFoods.length <= 1) return;

    updated[index] = computeQuickLogItemMetrics({
      queryText: current.queryText,
      inputValue: current.inputValue,
      unitMode: current.unitMode,
      matchedFood: null,
      candidateFoods: current.candidateFoods,
    });
    setPreviewItems(updated);
  };

  const handleSelectUnitMode = (index: number, nextUnitMode: QuickLogUnitMode) => {
    const updated = [...previewItems];
    const current = updated[index];
    if (!current) return;

    updated[index] = computeQuickLogItemMetrics({
      queryText: current.queryText,
      inputValue: current.inputValue,
      unitMode: nextUnitMode,
      matchedFood: current.matchedFood,
      candidateFoods: current.candidateFoods,
    });
    setPreviewItems(updated);
  };

  const handleInputValueChange = (index: number, rawNextValue: string) => {
    const parsed = parseFloat(rawNextValue.replace(',', '.'));
    const nextValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const updated = [...previewItems];
    const current = updated[index];
    if (!current) return;

    updated[index] = computeQuickLogItemMetrics({
      queryText: current.queryText,
      inputValue: nextValue,
      unitMode: current.unitMode,
      matchedFood: current.matchedFood,
      candidateFoods: current.candidateFoods,
    });
    setPreviewItems(updated);
  };

  const handleRemovePreviewItem = (index: number) => {
    const updated = previewItems.filter((_, i) => i !== index);
    setPreviewItems(updated);
    if (updated.length === 0) {
      setShowPreviewModal(false);
    }
  };

  const totalCaloriesPreview = previewItems
    .filter((i) => i.isMatched)
    .reduce((sum, i) => sum + i.calculatedCalories, 0);

  const canConfirmSave =
    previewItems.length > 0 &&
    previewItems.every(
      (i) =>
        i.isMatched &&
        Boolean(i.matchedFood) &&
        !i.needsUnitSelection &&
        !i.needsFoodSelection &&
        !i.hasInvalidFoodCalories
    );

  return (
    <div className="w-full space-y-1.5">
      {/* Quick Log Input Box */}
      <form onSubmit={handleParseAndSubmit} className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          data-testid="quicklog-input"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (errorHint) setErrorHint(null);
          }}
          placeholder="Ketik: French fries 200g atau 200 kkal..."
          className="w-full pl-4 pr-24 py-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-500 text-base focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          data-testid="quicklog-submit-btn"
          disabled={!inputText.trim()}
          className="absolute right-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          Catat
        </button>
      </form>

      {/* Autocomplete Chips & Quick Gram/Calorie Chips when typing */}
      {tail && (suggestions.length > 0 || exactFoodMatch) && (
        <div
          data-testid="quicklog-autocomplete-bar"
          className="px-0.5 pt-0.5 space-y-1.5"
        >
          {/* Food Name Suggestions */}
          {suggestions.length > 0 && (
            <div
              data-testid="quicklog-autocomplete-chips"
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5"
            >
              {suggestions.map((food) => {
                const isExact = exactFoodMatch?.id === food.id;
                return (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => handleSelectFoodSuggestion(food)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all active:scale-95 flex items-center space-x-1.5 shrink-0 ${
                      isExact
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500/40'
                    }`}
                  >
                    <span>{food.name}</span>
                    <span className="text-[10px] text-emerald-400/90 font-normal">
                      {formatQuickLogNumberID(food.calories)} kkal/100g
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Gram & Calorie Pills once a food name matches */}
          {exactFoodMatch && (
            <div
              data-testid="quicklog-gram-chips"
              className="flex items-center flex-wrap gap-1.5"
            >
              <span className="text-[11px] text-slate-400 shrink-0">Takaran:</span>
              {[100, 150, 200].map((g) => (
                <button
                  key={`g-${g}`}
                  type="button"
                  data-testid={`quicklog-chip-gram-${g}`}
                  onClick={() => handleSelectQuickGrams(g)}
                  className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 active:scale-95 shrink-0"
                >
                  +{g}g
                </button>
              ))}
              {[150, 200, 300].map((kcal) => (
                <button
                  key={`kcal-${kcal}`}
                  type="button"
                  data-testid={`quicklog-chip-kcal-${kcal}`}
                  onClick={() => handleSelectQuickCalories(kcal)}
                  className="px-2.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold hover:bg-sky-500/25 active:scale-95 shrink-0"
                >
                  +{kcal} kkal
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {errorHint && <p className="text-xs text-amber-400 px-1">{errorHint}</p>}

      {/* Confirmation & Preview Modal Sheet */}
      {showPreviewModal && (
        <div
          data-testid="quicklog-preview-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0f172a] border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] flex flex-col shadow-2xl safe-bottom">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Preview Quick Log</h3>
                  <p className="text-xs text-slate-400">
                    Periksa nama, gram, kalori, dan seluruh makro sebelum simpan
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup preview"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Parsed Items List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-3">
              {previewItems.map((item, idx) => {
                const isNotFound =
                  !item.matchedFood && !item.needsFoodSelection && item.candidateFoods.length === 0;

                return (
                  <div
                    key={idx}
                    data-testid={`quicklog-preview-item-${idx}`}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                      item.isMatched
                        ? 'bg-slate-900/80 border-slate-800'
                        : item.needsFoodSelection || item.needsUnitSelection
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-rose-950/20 border-rose-800/40'
                    }`}
                  >
                    {/* Top Row: Name + Status Badge + Remove */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span
                            data-testid={`quicklog-preview-name-${idx}`}
                            className="font-bold text-sm text-white"
                          >
                            {item.matchedFood ? item.matchedFood.name : item.queryText}
                          </span>

                          {item.isMatched && item.unitMode === 'grams' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                              Input Gram
                            </span>
                          )}

                          {item.isMatched && item.unitMode === 'calories' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold">
                              Input Kalori → {formatQuickLogNumberID(item.grams)} g
                            </span>
                          )}

                          {item.needsFoodSelection && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                              Pilih Makanan ({item.candidateFoods.length} cocok)
                            </span>
                          )}

                          {!item.needsFoodSelection && item.needsUnitSelection && item.matchedFood && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                              Pilih Satuan
                            </span>
                          )}

                          {isNotFound && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                              Tidak Ditemukan
                            </span>
                          )}

                          {item.hasInvalidFoodCalories && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                              Kalori Belum Diketahui / Nol
                            </span>
                          )}
                        </div>

                        {item.matchedFood && !item.hasInvalidFoodCalories && (
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center flex-wrap gap-2">
                            <span>
                              Acuan My Foods: {formatQuickLogNumberID(item.matchedFood.calories)}{' '}
                              kkal / 100g
                            </span>
                            {item.candidateFoods.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleResetFoodSelection(idx)}
                                className="text-sky-400 hover:underline font-semibold"
                              >
                                Ganti makanan
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label="Hapus item dari preview"
                        onClick={() => handleRemovePreviewItem(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400 shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* 1. Ambiguous Food Matches: Ask user to choose which food */}
                    {item.needsFoodSelection && item.candidateFoods.length > 1 && (
                      <div
                        data-testid={`quicklog-food-selector-${idx}`}
                        className="p-2.5 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-2"
                      >
                        <p className="text-xs font-semibold text-amber-300">
                          Ada beberapa makanan yang cocok dengan &ldquo;{item.queryText}&rdquo;.
                          Pilih makanan yang dimaksud:
                        </p>
                        <div className="space-y-1.5">
                          {item.candidateFoods.map((cand) => (
                            <button
                              key={cand.id}
                              type="button"
                              data-testid={`quicklog-candidate-${idx}-${cand.id}`}
                              onClick={() => handleSelectCandidateFood(idx, cand)}
                              className="w-full text-left px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition-all flex items-center justify-between"
                            >
                              <div>
                                <span className="text-xs font-bold text-white block">
                                  {cand.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  P:{' '}
                                  {cand.protein !== null
                                    ? `${formatQuickLogNumberID(cand.protein)}g`
                                    : 'Belum diketahui'}{' '}
                                  · L:{' '}
                                  {cand.fat !== null
                                    ? `${formatQuickLogNumberID(cand.fat)}g`
                                    : 'Belum diketahui'}{' '}
                                  · K:{' '}
                                  {cand.carbs !== null
                                    ? `${formatQuickLogNumberID(cand.carbs)}g`
                                    : 'Belum diketahui'}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-emerald-400 shrink-0 ml-2">
                                {formatQuickLogNumberID(cand.calories)} kkal/100g
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Missing Unit: Ask user to choose Gram (g) or Kalori (kkal) */}
                    {!item.needsFoodSelection &&
                      item.matchedFood &&
                      !item.hasInvalidFoodCalories &&
                      item.needsUnitSelection && (
                        <div
                          data-testid={`quicklog-unit-selector-${idx}`}
                          className="p-2.5 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-2"
                        >
                          <p className="text-xs font-semibold text-amber-300">
                            Satuan untuk angka{' '}
                            <strong>{formatQuickLogNumberID(item.inputValue)}</strong> belum ditulis.
                            Pilih satuan:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              data-testid={`quicklog-choose-gram-${idx}`}
                              onClick={() => handleSelectUnitMode(idx, 'grams')}
                              className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all active:scale-95"
                            >
                              {formatQuickLogNumberID(item.inputValue)} gram (g)
                            </button>
                            <button
                              type="button"
                              data-testid={`quicklog-choose-kkal-${idx}`}
                              onClick={() => handleSelectUnitMode(idx, 'calories')}
                              className="py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 text-xs font-bold transition-all active:scale-95"
                            >
                              {formatQuickLogNumberID(item.inputValue)} kkal
                            </button>
                          </div>
                        </div>
                      )}

                    {/* 3. Food Not Found in My Foods */}
                    {isNotFound && (
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-rose-500/30 text-xs text-slate-300 space-y-2">
                        <p>
                          Makanan <strong>&ldquo;{item.queryText}&rdquo;</strong> tidak ditemukan di
                          My Foods. Konversi tidak dikarang.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPreviewModal(false);
                            onOpenAddFoodModal(item.queryText);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-xs text-sky-300 hover:bg-sky-500/30 font-bold inline-flex items-center space-x-1"
                        >
                          <Plus size={13} />
                          <span>Tambah ke My Foods</span>
                        </button>
                      </div>
                    )}

                    {/* 4. Matched Food has 0 or Unknown Calories */}
                    {item.matchedFood && item.hasInvalidFoodCalories && (
                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-rose-500/30 text-xs text-rose-300 flex items-start space-x-2">
                        <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                        <span>
                          Kalori per 100g untuk <strong>{item.matchedFood.name}</strong> belum
                          diketahui atau bernilai 0 di My Foods. Konversi tidak dapat dilakukan.
                        </span>
                      </div>
                    )}

                    {/* 5. Complete Nutrition Preview (Name, Grams, Calories, Protein, Fat, Carbs) */}
                    {item.isMatched && item.matchedFood && (
                      <div className="space-y-2.5 pt-1">
                        {/* Value & Unit Switcher Control */}
                        <div className="flex items-center justify-between gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                          <span className="text-xs text-slate-400">Input jumlah &amp; satuan:</span>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              data-testid={`quicklog-input-val-${idx}`}
                              value={item.inputValue || ''}
                              onChange={(e) => handleInputValueChange(idx, e.target.value)}
                              className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-right text-xs font-bold text-white focus:outline-none focus:border-emerald-500 tabular-nums"
                            />
                            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                              <button
                                type="button"
                                data-testid={`quicklog-switch-gram-${idx}`}
                                onClick={() => handleSelectUnitMode(idx, 'grams')}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  item.unitMode === 'grams'
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                gram
                              </button>
                              <button
                                type="button"
                                data-testid={`quicklog-switch-kkal-${idx}`}
                                onClick={() => handleSelectUnitMode(idx, 'calories')}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                                  item.unitMode === 'calories'
                                    ? 'bg-sky-500 text-slate-950'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                kkal
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Detailed Preview Grid: Berat (g), Kalori (kkal), Protein, Lemak, Karbohidrat */}
                        <div
                          data-testid={`quicklog-metrics-grid-${idx}`}
                          className="grid grid-cols-2 gap-2 text-xs"
                        >
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between">
                            <span className="text-slate-400">Berat:</span>
                            <span
                              data-testid={`quicklog-preview-grams-${idx}`}
                              className="font-extrabold text-white tabular-nums"
                            >
                              {formatQuickLogNumberID(item.grams)} g
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between">
                            <span className="text-slate-400">Kalori:</span>
                            <span
                              data-testid={`quicklog-preview-calories-${idx}`}
                              className="font-extrabold text-emerald-400 tabular-nums"
                            >
                              {formatQuickLogNumberID(item.calculatedCalories)} kkal
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800/80">
                            <span className="text-[10px] text-slate-400 block">Protein</span>
                            <span
                              data-testid={`quicklog-preview-protein-${idx}`}
                              className="font-bold text-emerald-300 tabular-nums"
                            >
                              {item.calculatedProtein !== null
                                ? `${formatQuickLogNumberID(item.calculatedProtein)} g`
                                : 'Belum diketahui'}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800/80">
                            <span className="text-[10px] text-slate-400 block">Lemak</span>
                            <span
                              data-testid={`quicklog-preview-fat-${idx}`}
                              className="font-bold text-amber-300 tabular-nums"
                            >
                              {item.calculatedFat !== null
                                ? `${formatQuickLogNumberID(item.calculatedFat)} g`
                                : 'Belum diketahui'}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800/80">
                            <span className="text-[10px] text-slate-400 block">Karbohidrat</span>
                            <span
                              data-testid={`quicklog-preview-carbs-${idx}`}
                              className="font-bold text-sky-300 tabular-nums"
                            >
                              {item.calculatedCarbs !== null
                                ? `${formatQuickLogNumberID(item.calculatedCarbs)} g`
                                : 'Belum diketahui'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer with Total & Confirm Button */}
            <div className="pt-3 border-t border-slate-800 mt-1 space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400">Total Kalori Akan Disimpan:</span>
                <span
                  data-testid="quicklog-total-calories-preview"
                  className="text-base font-black text-emerald-400 tabular-nums"
                >
                  {formatQuickLogNumberID(totalCaloriesPreview)} kkal
                </span>
              </div>

              {!canConfirmSave && (
                <p className="text-[11px] text-amber-300 px-1">
                  Selesaikan pemilihan satuan/makanan atau hapus item yang tidak ditemukan sebelum
                  menyimpan.
                </p>
              )}

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="button"
                  data-testid="quicklog-confirm-save-btn"
                  disabled={!canConfirmSave}
                  onClick={() => saveItemsToLog(previewItems)}
                  className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 text-sm font-black hover:bg-emerald-400 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Check size={18} strokeWidth={3} />
                  <span>Simpan ke Log</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
