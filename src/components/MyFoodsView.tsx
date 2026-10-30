/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus,
  Search,
  FileText,
  ArrowUpDown,
  Tag,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Package,
  X,
  Database,
  Info,
  Lock,
  Unlock,
  ArrowLeft,
} from 'lucide-react';
import { FoodItem } from '../types';
import { verifyAtwater } from '../utils/nutrition';
import { HoldToDeleteButton } from './HoldToDeleteButton';

interface MyFoodsViewProps {
  foods: FoodItem[];
  onOpenAddModal: (prefillName?: string) => void;
  onOpenEditModal: (food: FoodItem) => void;
  onDeleteFood: (id: string) => void;
  onOpenImportModal: () => void;
  onOpenTools?: () => void;
  onUpdateFoodStock: (foodId: string, deltaGrams: number) => void;
  isNutritionLocked?: boolean;
  isNutritionUnlockedSession?: boolean;
  onRelockNutritionSession?: () => void;
  onBackToHome?: () => void;
}

export const MyFoodsView: React.FC<MyFoodsViewProps> = ({
  foods,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteFood,
  onOpenImportModal,
  onOpenTools,
  onUpdateFoodStock,
  isNutritionLocked = true,
  isNutritionUnlockedSession = false,
  onRelockNutritionSession,
  onBackToHome,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'calories' | 'protein'>('name');
  const [selectedFoodDetail, setSelectedFoodDetail] = useState<FoodItem | null>(null);

  // Derive live food item from `foods` prop so stock updates reflect immediately
  const activeFoodDetail = selectedFoodDetail
    ? foods.find((f) => f.id === selectedFoodDetail.id) || null
    : null;

  const toggleSort = () => {
    if (sortBy === 'name') setSortBy('calories');
    else if (sortBy === 'calories') setSortBy('protein');
    else setSortBy('name');
  };

  const sortLabels = {
    name: 'A–Z',
    calories: 'Kalori ↓',
    protein: 'Protein ↓',
  };

  const filteredFoods = foods
    .filter((f) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        f.aliases.some((a) => a.toLowerCase().includes(q)) ||
        (f.notes && f.notes.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'calories') return b.calories - a.calories;
      if (sortBy === 'protein') return (b.protein || 0) - (a.protein || 0);
      return 0;
    });

  const isEffectiveLocked = isNutritionLocked && !isNutritionUnlockedSession;

  return (
    <div className="space-y-3 pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* Top Header: Title, Count & Sort */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2.5">
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition-all"
              title="Kembali ke Home"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">My Foods</h2>
            <p className="text-xs text-slate-400">{filteredFoods.length} makanan pribadi</p>
          </div>
        </div>

        <button
          onClick={toggleSort}
          className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 active:scale-95 transition-all"
          title="Ubah urutan daftar"
        >
          <ArrowUpDown size={13} className="text-emerald-400" />
          <span>{sortLabels[sortBy]}</span>
        </button>
      </div>

      {/* Action Buttons: Tambah, Scan/Import & Resep/Alat */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => onOpenAddModal()}
          className="py-2.5 px-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 active:scale-95 transition-all flex items-center justify-center space-x-1 shadow-md shadow-emerald-500/20"
        >
          <Plus size={14} strokeWidth={3} />
          <span>Tambah</span>
        </button>

        <button
          onClick={onOpenImportModal}
          className="py-2.5 px-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 hover:border-slate-700 active:scale-95 transition-all flex items-center justify-center space-x-1"
        >
          <FileText size={13} className="text-emerald-400 shrink-0" />
          <span>Scan / Teks</span>
        </button>

        {onOpenTools && (
          <button
            onClick={onOpenTools}
            className="py-2.5 px-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-sky-400 hover:border-slate-700 active:scale-95 transition-all flex items-center justify-center space-x-1"
          >
            <Package size={13} className="text-sky-400 shrink-0" />
            <span>Resep & Alat</span>
          </button>
        )}
      </div>

      {/* Large Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari makanan..."
          className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
        />
      </div>

      {/* Nutrition Lock Status Banner (Read-Only when locked; no unlock button in My Foods) */}
      {isNutritionLocked && (
        isEffectiveLocked ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Lock size={12} className="text-amber-400 shrink-0" />
              <span>Nutrisi Terkunci (Buka hanya di Pengaturan dengan Sandi)</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-[11px] text-emerald-300">
            <span className="flex items-center space-x-1.5">
              <Unlock size={12} className="text-emerald-400 shrink-0" />
              <span>Sesi Edit Nutrisi Terbuka (via Pengaturan)</span>
            </span>
            <button
              type="button"
              onClick={() => onRelockNutritionSession?.()}
              className="text-[11px] text-slate-300 font-bold hover:text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700"
            >
              Kunci Kembali
            </button>
          </div>
        )
      )}

      {/* Empty State (without duplicate Tambah/Import buttons) */}
      {foods.length === 0 ? (
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2.5 mt-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Database size={24} />
          </div>
          <h3 className="text-base font-bold text-white">Database Makanan Kosong</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Gunakan tombol <strong>Tambah</strong> atau <strong>Import Teks</strong> di atas untuk menambahkan makanan pribadi Anda.
          </p>
        </div>
      ) : (
        /* Compact List: 6-9 foods visible per screen */
        <div className="space-y-1.5 pt-1">
          {filteredFoods.map((food) => {
            const atwater = verifyAtwater(food.calories, food.protein, food.fat, food.carbs);

            return (
              <div
                key={food.id}
                onClick={() => setSelectedFoodDetail(food)}
                className="p-3 rounded-2xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between"
              >
                {/* Left: Food Name & Clean Neutral Macros */}
                <div className="flex-1 mr-3 min-w-0">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="text-sm font-bold text-white truncate tracking-wide">
                      {food.name}
                    </span>
                    {food.prepState && food.prepState !== 'lainnya' && (
                      <span className="text-[10px] text-slate-400 bg-slate-800/90 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {food.prepState === 'mentah' ? 'Mentah' : 'Matang'}
                      </span>
                    )}
                    {!atwater.isConsistent && (
                      <span
                        className="text-amber-400 shrink-0"
                        title={`Selisih Atwater ${atwater.differencePercent}%`}
                      >
                        <AlertTriangle size={13} />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-normal mt-0.5">
                    P {food.protein !== null ? food.protein : '-'} · L{' '}
                    {food.fat !== null ? food.fat : '-'} · K {food.carbs !== null ? food.carbs : '-'}{' '}
                    g
                  </div>
                </div>

                {/* Right: Calories per 100g */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-emerald-400 tracking-tight">
                    {food.calories} kkal
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">per 100 g</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL / SHEET (Opened on Tap) */}
      {activeFoodDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f172a] border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] flex flex-col shadow-2xl safe-bottom">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex-1 mr-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {activeFoodDetail.name}
                </h3>
                <div className="flex items-center space-x-2 mt-0.5">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-base font-black text-emerald-400">
                      {activeFoodDetail.calories} kkal
                    </span>
                    <span className="text-xs text-slate-400">/ 100 gram</span>
                  </div>
                  {activeFoodDetail.prepState && (
                    <span className="text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md font-medium border border-slate-700/60">
                      {activeFoodDetail.prepState === 'mentah'
                        ? 'Mentah'
                        : activeFoodDetail.prepState === 'matang'
                        ? 'Matang'
                        : 'Lainnya'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedFoodDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1">
              {/* Macro Detail Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Protein</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {activeFoodDetail.protein !== null ? `${activeFoodDetail.protein}g` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Lemak</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {activeFoodDetail.fat !== null ? `${activeFoodDetail.fat}g` : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Karbohidrat</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {activeFoodDetail.carbs !== null ? `${activeFoodDetail.carbs}g` : '-'}
                  </span>
                </div>
              </div>

              {/* Atwater 4-4-9 Consistency Check Details */}
              {(() => {
                const atwater = verifyAtwater(
                  activeFoodDetail.calories,
                  activeFoodDetail.protein,
                  activeFoodDetail.fat,
                  activeFoodDetail.carbs
                );

                return (
                  <div
                    className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                      atwater.isConsistent
                        ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                        : 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-bold">
                      {atwater.isConsistent ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <AlertTriangle size={14} className="text-amber-400" />
                      )}
                      <span>Pemeriksaan Kesesuaian Kalori (Atwater 4-4-9)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {atwater.message}
                    </p>
                    <p className="text-[10px] text-slate-500 italic pt-0.5 border-t border-slate-800/60">
                      *Catatan: Rumus ini hanya menguji perkiraan keselarasan angka makro terhadap kalori tertera, bukan pembuktian akurasi uji lab.
                    </p>
                  </div>
                );
              })()}

              {/* Aliases Section */}
              {activeFoodDetail.aliases && activeFoodDetail.aliases.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                  <div className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                    <Tag size={13} className="text-emerald-400" />
                    <span>Alias / Nama Alternatif</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeFoodDetail.aliases.map((alias, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-200 text-xs border border-slate-700/70"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock Inventory (Only if tracked or allows quick correction) */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package size={15} className="text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block">Stok Dapur</span>
                    <span className="text-[11px] text-slate-400">
                      {activeFoodDetail.stockGrams !== null && activeFoodDetail.stockGrams !== undefined
                        ? `${activeFoodDetail.stockGrams} gram tersedia`
                        : 'Belum diatur'}
                    </span>
                  </div>
                </div>

                {activeFoodDetail.stockGrams !== null && activeFoodDetail.stockGrams !== undefined ? (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onUpdateFoodStock(activeFoodDetail.id, -100)}
                      className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700 active:scale-95"
                    >
                      -100g
                    </button>
                    <button
                      onClick={() => onUpdateFoodStock(activeFoodDetail.id, 100)}
                      className="px-2 py-1 bg-slate-800 text-emerald-400 rounded-lg text-xs font-bold hover:bg-slate-700 active:scale-95"
                    >
                      +100g
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onUpdateFoodStock(activeFoodDetail.id, 250)}
                    className="px-2.5 py-1 bg-slate-800 text-xs text-emerald-400 rounded-lg hover:bg-slate-700 font-semibold"
                  >
                    + Set 250g
                  </button>
                )}
              </div>

              {/* Source & Notes */}
              {(activeFoodDetail.source || activeFoodDetail.notes || activeFoodDetail.pricePerKg) && (
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs text-slate-400">
                  {activeFoodDetail.source && (
                    <div>
                      Sumber: <span className="text-slate-200 font-medium">{activeFoodDetail.source}</span>
                    </div>
                  )}
                  {activeFoodDetail.pricePerKg && (
                    <div>
                      Harga: <span className="text-slate-200 font-medium">Rp {activeFoodDetail.pricePerKg.toLocaleString('id-ID')}/kg</span>
                    </div>
                  )}
                  {activeFoodDetail.notes && (
                    <div>
                      Catatan: <span className="text-slate-200 font-medium">{activeFoodDetail.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Modal Actions: Edit & Delete */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              {isEffectiveLocked && (
                <div className="px-3 py-2 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-center space-x-2">
                  <Lock size={13} className="text-amber-400 shrink-0" />
                  <span>
                    Nutrisi & penghapusan dikunci. Anda tetap dapat mengedit nama/alias/stok, atau buka kunci nutrisi di <strong>Pengaturan</strong> menggunakan sandi.
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetFood = activeFoodDetail;
                    setSelectedFoodDetail(null);
                    onOpenEditModal(targetFood);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center space-x-1.5"
                >
                  <Edit2 size={13} />
                  <span>{isEffectiveLocked ? 'Edit Nama & Alias' : 'Edit Nutrisi & Alias'}</span>
                </button>

                <HoldToDeleteButton
                  disabled={isEffectiveLocked}
                  onConfirmDelete={() => {
                    onDeleteFood(activeFoodDetail.id);
                    setSelectedFoodDetail(null);
                  }}
                  label="Hapus"
                  iconSize={14}
                  className="py-2.5 px-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-bold hover:bg-rose-950/60"
                  title={
                    isEffectiveLocked
                      ? 'Buka kunci di Pengaturan untuk menghapus makanan'
                      : 'Tahan 3 detik untuk menghapus makanan'
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
