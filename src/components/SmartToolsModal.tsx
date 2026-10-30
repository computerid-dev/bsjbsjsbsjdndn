/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Wrench,
  Flame,
  ChefHat,
  Package,
  DollarSign,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { FoodItem, DailyLogItem, DailyTargets, Recipe } from '../types';
import {
  calculateCookedNutrition,
  calculateMacrosForGrams,
  verifyAtwater,
} from '../utils/nutrition';

interface SmartToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  foods: FoodItem[];
  dailyLogs: DailyLogItem[];
  targets: DailyTargets;
  selectedDate: string;
  onAddLogs: (logs: Omit<DailyLogItem, 'id'>[]) => void;
  onSaveNewFood: (foodData: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateFoodStock: (foodId: string, deltaGrams: number) => void;
}

export const SmartToolsModal: React.FC<SmartToolsModalProps> = ({
  isOpen,
  onClose,
  foods,
  dailyLogs,
  targets,
  selectedDate,
  onAddLogs,
  onSaveNewFood,
  onUpdateFoodStock,
}) => {
  const [activeTool, setActiveTool] = useState<
    'raw_cooked' | 'recipe' | 'inventory' | 'protein_cost' | 'audit'
  >('raw_cooked');
  const [toolMessage, setToolMessage] = useState<string | null>(null);

  // Raw vs Cooked Calculator State
  const [selectedRawFoodId, setSelectedRawFoodId] = useState<string>(foods[0]?.id || '');
  const [rawWeight, setRawWeight] = useState<number | ''>(200);
  const [cookedWeight, setCookedWeight] = useState<number | ''>(150);
  const [cookedFoodName, setCookedFoodName] = useState<string>('');

  const activeRawFoodId = foods.some((f) => f.id === selectedRawFoodId)
    ? selectedRawFoodId
    : foods[0]?.id || '';
  const selectedRawFood = foods.find((f) => f.id === activeRawFoodId);
  const cookedCalculation =
    selectedRawFood && typeof rawWeight === 'number' && typeof cookedWeight === 'number'
      ? calculateCookedNutrition(rawWeight, cookedWeight, selectedRawFood)
      : null;

  // Recipe Builder State
  const [recipeName, setRecipeName] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<
    Array<{ foodId: string; grams: number }>
  >([]);
  const [recipeCookedWeight, setRecipeCookedWeight] = useState<number | ''>(500);

  // Tool 4: Recipe Math
  const totalRawCaloriesInRecipe = recipeIngredients.reduce((sum, item) => {
    const f = foods.find((x) => x.id === item.foodId);
    return sum + (f ? (f.calories * item.grams) / 100 : 0);
  }, 0);

  const totalRawProteinInRecipe = recipeIngredients.reduce((sum, item) => {
    const f = foods.find((x) => x.id === item.foodId);
    return sum + (f && f.protein !== null ? (f.protein * item.grams) / 100 : 0);
  }, 0);

  const totalRawFatInRecipe = recipeIngredients.reduce((sum, item) => {
    const f = foods.find((x) => x.id === item.foodId);
    return sum + (f && f.fat !== null ? (f.fat * item.grams) / 100 : 0);
  }, 0);

  const totalRawCarbsInRecipe = recipeIngredients.reduce((sum, item) => {
    const f = foods.find((x) => x.id === item.foodId);
    return sum + (f && f.carbs !== null ? (f.carbs * item.grams) / 100 : 0);
  }, 0);

  const recipeCaloriesPer100g =
    typeof recipeCookedWeight === 'number' && recipeCookedWeight > 0
      ? Math.round((totalRawCaloriesInRecipe / recipeCookedWeight) * 100)
      : 0;

  const recipeProteinPer100g =
    typeof recipeCookedWeight === 'number' && recipeCookedWeight > 0
      ? Math.round((totalRawProteinInRecipe / recipeCookedWeight) * 100 * 10) / 10
      : null;

  const recipeFatPer100g =
    typeof recipeCookedWeight === 'number' && recipeCookedWeight > 0
      ? Math.round((totalRawFatInRecipe / recipeCookedWeight) * 100 * 10) / 10
      : null;

  const recipeCarbsPer100g =
    typeof recipeCookedWeight === 'number' && recipeCookedWeight > 0
      ? Math.round((totalRawCarbsInRecipe / recipeCookedWeight) * 100 * 10) / 10
      : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0f172a] border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] flex flex-col shadow-2xl safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <Wrench size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Smart Tools & Kalkulator</h3>
              <p className="text-xs text-slate-400">Alat bantu akurasi nutrisi luring</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tools Horizontal Tabs */}
        <div className="flex space-x-1.5 overflow-x-auto py-2.5 my-1 scrollbar-none">
          {[
            { id: 'raw_cooked', label: 'Mentah/Matang', icon: Flame },
            { id: 'recipe', label: 'Resep Masakan', icon: ChefHat },
            { id: 'inventory', label: 'Stok Dapur', icon: Package },
            { id: 'protein_cost', label: 'Biaya Protein', icon: DollarSign },
            { id: 'audit', label: 'Audit Nutrisi', icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTool(tab.id as any);
                  setToolMessage(null);
                }}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tool Content Area */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
          {toolMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>{toolMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToolMessage(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* TOOL 2: Raw vs Cooked Calculator */}
          {activeTool === 'raw_cooked' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-white">Pilih Bahan Mentah di Database</span>
                <select
                  value={activeRawFoodId}
                  onChange={(e) => setSelectedRawFoodId(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.calories} kkal/100g)
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400">Berat Mentah (g)</label>
                    <input
                      type="number"
                      min="1"
                      value={rawWeight}
                      onChange={(e) =>
                        setRawWeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full mt-0.5 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Berat Matang (g)</label>
                    <input
                      type="number"
                      min="1"
                      value={cookedWeight}
                      onChange={(e) =>
                        setCookedWeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      className="w-full mt-0.5 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {cookedCalculation && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">
                      Nilai Nutrisi Makanan Matang (Per 100g)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Penyusutan: {cookedCalculation.shrinkagePercent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Kalori</span>
                      <span className="text-xs font-black text-emerald-400">
                        {cookedCalculation.cookedCaloriesPer100g}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Protein</span>
                      <span className="text-xs font-bold text-white">
                        {cookedCalculation.cookedProteinPer100g !== null
                          ? `${cookedCalculation.cookedProteinPer100g}g`
                          : '-'}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Lemak</span>
                      <span className="text-xs font-bold text-white">
                        {cookedCalculation.cookedFatPer100g !== null
                          ? `${cookedCalculation.cookedFatPer100g}g`
                          : '-'}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Karbo</span>
                      <span className="text-xs font-bold text-white">
                        {cookedCalculation.cookedCarbsPer100g !== null
                          ? `${cookedCalculation.cookedCarbsPer100g}g`
                          : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex space-x-2">
                    <input
                      type="text"
                      value={cookedFoodName}
                      onChange={(e) => setCookedFoodName(e.target.value)}
                      placeholder={`Nama (mis: ${selectedRawFood?.name} Matang)`}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const finalName =
                          cookedFoodName.trim() || `${selectedRawFood?.name} (Matang)`;
                        onSaveNewFood({
                          name: finalName,
                          aliases: [`${selectedRawFood?.name} matang`],
                          calories: cookedCalculation.cookedCaloriesPer100g,
                          protein: cookedCalculation.cookedProteinPer100g,
                          fat: cookedCalculation.cookedFatPer100g,
                          carbs: cookedCalculation.cookedCarbsPer100g,
                          source: 'Kalkulator Matang',
                          notes: `Yield factor: ${cookedCalculation.yieldFactor}`,
                        });
                        setCookedFoodName('');
                        setToolMessage(`Makanan "${finalName}" berhasil disimpan ke My Foods!`);
                      }}
                      className="px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl active:scale-95"
                    >
                      Simpan ke DB
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TOOL 3: Recipe Builder */}
          {activeTool === 'recipe' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Nama Resep</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="Contoh: Sup Ayam Makaroni Keluarga"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                />
              </div>

              {/* Ingredients List */}
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Bahan-Bahan Resep</span>
                  <button
                    onClick={() => {
                      if (foods.length > 0) {
                        setRecipeIngredients([
                          ...recipeIngredients,
                          { foodId: foods[0].id, grams: 100 },
                        ]);
                      }
                    }}
                    className="text-xs text-emerald-400 font-bold hover:text-emerald-300"
                  >
                    + Tambah Bahan
                  </button>
                </div>

                {recipeIngredients.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-2 text-center">
                    Belum ada bahan ditambahkan. Klik "+ Tambah Bahan" di atas.
                  </p>
                ) : (
                  recipeIngredients.map((item, idx) => {
                    return (
                      <div key={idx} className="flex items-center space-x-2">
                        <select
                          value={item.foodId}
                          onChange={(e) => {
                            const updated = [...recipeIngredients];
                            updated[idx].foodId = e.target.value;
                            setRecipeIngredients(updated);
                          }}
                          className="flex-1 p-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                        >
                          {foods.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min="1"
                          value={item.grams}
                          onChange={(e) => {
                            const updated = [...recipeIngredients];
                            updated[idx].grams = parseFloat(e.target.value) || 0;
                            setRecipeIngredients(updated);
                          }}
                          className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-right text-white font-bold"
                        />
                        <span className="text-xs text-slate-400">g</span>

                        <button
                          onClick={() =>
                            setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))
                          }
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Berat Masakan Setelah Matang:</span>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="1"
                      value={recipeCookedWeight}
                      onChange={(e) =>
                        setRecipeCookedWeight(
                          e.target.value === '' ? '' : parseFloat(e.target.value)
                        )
                      }
                      className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-right text-white font-bold"
                    />
                    <span className="text-xs text-slate-400">g</span>
                  </div>
                </div>
              </div>

              {/* Recipe Nutrition Result per 100g */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Hasil Nutrisi Per 100g:</span>
                  <span className="text-sm font-black text-emerald-400">
                    {recipeCaloriesPer100g} kkal
                  </span>
                  <span className="text-xs text-slate-300 ml-2">
                    P: {recipeProteinPer100g ?? '-'}g • L: {recipeFatPer100g ?? '-'}g • K:{' '}
                    {recipeCarbsPer100g ?? '-'}g
                  </span>
                </div>

                <button
                  disabled={!recipeName.trim() || recipeIngredients.length === 0}
                  onClick={() => {
                    const savedName = recipeName.trim();
                    onSaveNewFood({
                      name: savedName,
                      aliases: [savedName.toLowerCase()],
                      calories: recipeCaloriesPer100g,
                      protein: recipeProteinPer100g,
                      fat: recipeFatPer100g,
                      carbs: recipeCarbsPer100g,
                      source: 'Recipe Builder',
                      notes: `Total hasil masakan: ${recipeCookedWeight}g`,
                    });
                    setToolMessage(`Resep "${savedName}" berhasil disimpan ke My Foods!`);
                    setRecipeName('');
                    setRecipeIngredients([]);
                  }}
                  className="px-3 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl active:scale-95 disabled:opacity-40"
                >
                  Simpan Resep
                </button>
              </div>
            </div>
          )}

          {/* TOOL 4: Inventory Manager */}
          {activeTool === 'inventory' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Kelola Stok Bahan di Dapur</span>
                <span>Otomatis berkurang saat dicatat</span>
              </div>

              <div className="space-y-2">
                {foods
                  .filter((f) => f.stockGrams !== null && f.stockGrams !== undefined)
                  .map((food) => (
                    <div
                      key={food.id}
                      className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{food.name}</div>
                        <div
                          className={`text-xs font-black mt-0.5 ${
                            (food.stockGrams || 0) < 200 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {food.stockGrams} gram tersisa
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onUpdateFoodStock(food.id, -200)}
                          className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 active:scale-95"
                        >
                          -200g
                        </button>
                        <button
                          onClick={() => onUpdateFoodStock(food.id, 250)}
                          className="px-2 py-1 bg-slate-800 text-emerald-400 rounded-lg text-xs hover:bg-slate-700 active:scale-95 font-bold"
                        >
                          +250g
                        </button>
                        <button
                          onClick={() => onUpdateFoodStock(food.id, 500)}
                          className="px-2 py-1 bg-slate-800 text-emerald-400 rounded-lg text-xs hover:bg-slate-700 active:scale-95 font-bold"
                        >
                          +500g
                        </button>
                      </div>
                    </div>
                  ))}

                {foods.filter((f) => f.stockGrams !== null && f.stockGrams !== undefined).length ===
                  0 && (
                  <div className="p-5 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                    Belum ada makanan dengan stok terlacak. Edit makanan di menu My Foods dan isi
                    kolom "Stok Awal".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOOL 5: Protein Budget Optimizer */}
          {activeTool === 'protein_cost' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Peringkat makanan pribadi dari biaya rupiah per gram protein termurah:
              </p>

              <div className="space-y-2">
                {foods
                  .filter((f) => f.pricePerKg && (f.protein || 0) > 0)
                  .map((f) => {
                    const pricePer100g = (f.pricePerKg || 0) / 10;
                    const costPerGramProtein = Math.round(pricePer100g / (f.protein || 1));
                    return {
                      ...f,
                      costPerGramProtein,
                    };
                  })
                  .sort((a, b) => a.costPerGramProtein - b.costPerGramProtein)
                  .map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-sky-400">#{idx + 1}</span>
                          <span className="text-xs font-bold text-white">{item.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {item.protein}g protein per 100g (Rp{' '}
                          {(item.pricePerKg || 0).toLocaleString('id-ID')}/kg)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400">
                          Rp {item.costPerGramProtein}
                        </span>
                        <span className="text-[10px] text-slate-500 block">/ gram protein</span>
                      </div>
                    </div>
                  ))}

                {foods.filter((f) => f.pricePerKg && (f.protein || 0) > 0).length === 0 && (
                  <div className="p-5 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                    Belum ada makanan yang memiliki data harga per kg. Buka My Foods lalu isi kolom
                    "Harga Beli".
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOOL 6: Nutrition Verification & Duplicate Audit */}
          {activeTool === 'audit' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300">
                Audit Konsistensi Database ({foods.length} makanan)
              </span>

              <div className="space-y-2">
                {foods.map((food) => {
                  const check = verifyAtwater(food.calories, food.protein, food.fat, food.carbs);
                  return (
                    <div
                      key={food.id}
                      className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{food.name}</span>
                        {check.isConsistent ? (
                          <span className="text-emerald-400 font-semibold flex items-center space-x-1 text-[11px]">
                            <CheckCircle2 size={12} />
                            <span>Konsisten</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold flex items-center space-x-1 text-[11px]">
                            <AlertTriangle size={12} />
                            <span>Selisih {check.differencePercent}%</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{check.message}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
