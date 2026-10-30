/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  X,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CalendarDays,
  ArrowLeftRight,
  Check,
  Calculator,
  RotateCcw,
  Utensils,
  Sparkles,
  Camera,
} from 'lucide-react';
import { DailyLogItem, DailyTargets, FoodItem } from '../types';
import { QuickLogBar } from './QuickLogBar';
import { HoldToDeleteButton } from './HoldToDeleteButton';
import {
  calculateMacrosForGrams,
  formatOneDecimalDot,
  formatQuickLogNumberID,
  getLocalTodayStr,
  solveOptimalPortions,
} from '../utils/nutrition';

interface HomeViewProps {
  selectedDate: string;
  foods: FoodItem[];
  dailyLogs: DailyLogItem[];
  targets: DailyTargets;
  lockPastDays: boolean;
  directSave: boolean;
  onAddLogs: (newLogs: Omit<DailyLogItem, 'id'>[]) => void;
  onUpdateLog: (log: DailyLogItem) => void;
  onDeleteLog: (id: string) => void;
  onOpenAddFoodModal: (prefillName?: string) => void;
  onOpenMyFoods: () => void;
  onOpenPhotoScan?: () => void;
  onOpenTools?: () => void;
  onOpenSettings?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  selectedDate,
  foods,
  dailyLogs,
  targets,
  lockPastDays,
  directSave,
  onAddLogs,
  onUpdateLog,
  onDeleteLog,
  onOpenAddFoodModal,
  onOpenMyFoods,
  onOpenPhotoScan,
  onOpenTools,
  onOpenSettings,
}) => {
  const todayStr = getLocalTodayStr();
  const isPastDate = selectedDate < todayStr;
  const [overrideLock, setOverrideLock] = useState(false);
  const isLocked = isPastDate && lockPastDays && !overrideLock;

  // Local modals for direct in-Home logging
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [manualModalTab, setManualModalTab] = useState<'database' | 'estimate' | 'portion'>('database');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyLogItem | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [manualGrams, setManualGrams] = useState<number>(100);

  // Hitung Porsi (Portion Solver) State
  const [portionSearch, setPortionSearch] = useState('');
  const [portionSelectedIds, setPortionSelectedIds] = useState<string[]>([]);
  const [portionGramsMap, setPortionGramsMap] = useState<Record<string, number>>({});

  // Food List Hidden Toggle State
  const [isFoodListHidden, setIsFoodListHidden] = useState<boolean>(false);

  // Target Display Mode: 'consumed' vs 'remaining' (matching CONSUMED ⇄ toggle)
  const [targetDisplayMode, setTargetDisplayMode] = useState<'consumed' | 'remaining'>('consumed');

  // Estimate Fields (inside Pilih Makanan -> Estimasi tab)
  const [estimateName, setEstimateName] = useState('Makan di Luar');
  const [estimateCalories, setEstimateCalories] = useState<number | ''>(550);
  const [estimateProtein, setEstimateProtein] = useState<number | ''>('');
  const [estimateFat, setEstimateFat] = useState<number | ''>('');
  const [estimateCarbs, setEstimateCarbs] = useState<number | ''>('');

  // Inline feedback banner
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const showTempNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleSaveEstimate = () => {
    if (typeof estimateCalories !== 'number' || estimateCalories <= 0) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    onAddLogs([
      {
        foodName: estimateName.trim() || 'Makan di Luar (Estimasi)',
        grams: 1,
        calories: estimateCalories,
        protein: typeof estimateProtein === 'number' && !isNaN(estimateProtein) ? estimateProtein : null,
        fat: typeof estimateFat === 'number' && !isNaN(estimateFat) ? estimateFat : null,
        carbs: typeof estimateCarbs === 'number' && !isNaN(estimateCarbs) ? estimateCarbs : null,
        isEstimate: true,
        time: timeStr,
        date: selectedDate,
      },
    ]);
    setShowManualAddModal(false);
    setEstimateName('Makan di Luar');
    setEstimateCalories(550);
    setEstimateProtein('');
    setEstimateFat('');
    setEstimateCarbs('');
  };

  // Filter logs for selected date, sorted by time
  const logsForDate = dailyLogs
    .filter((log) => log.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Compute totals (accumulate at full precision, round only for display)
  const rawTotalCalories = logsForDate.reduce((sum, item) => sum + item.calories, 0);
  const totalCalories = Math.round(rawTotalCalories * 10) / 10;

  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  for (const item of logsForDate) {
    if (item.protein !== null) totalProtein += item.protein;
    if (item.fat !== null) totalFat += item.fat;
    if (item.carbs !== null) totalCarbs += item.carbs;
  }

  totalProtein = Math.round(totalProtein * 10) / 10;
  totalFat = Math.round(totalFat * 10) / 10;
  totalCarbs = Math.round(totalCarbs * 10) / 10;

  // Synchronized 1-decimal target values matching Pengaturan display
  const targetCaloriesRounded = Math.round((targets.calories || 0) * 10) / 10;
  const targetProteinRounded = Math.round((targets.protein || 0) * 10) / 10;
  const targetFatRounded = Math.round((targets.fat || 0) * 10) / 10;
  const targetCarbsRounded = Math.round((targets.carbs || 0) * 10) / 10;

  const remainingCalories = Math.round((targetCaloriesRounded - totalCalories) * 10) / 10;
  const remainingProtein = Math.round((targetProteinRounded - totalProtein) * 10) / 10;
  const remainingFat = Math.round((targetFatRounded - totalFat) * 10) / 10;
  const remainingCarbs = Math.round((targetCarbsRounded - totalCarbs) * 10) / 10;

  const proteinPercent = Math.min(
    100,
    Math.round((totalProtein / (targetProteinRounded || 1)) * 100)
  );
  const fatPercent = Math.min(100, Math.round((totalFat / (targetFatRounded || 1)) * 100));
  const carbsPercent = Math.min(100, Math.round((totalCarbs / (targetCarbsRounded || 1)) * 100));

  const recomputeOptimalPortions = (ids: string[]) => {
    const picked = ids
      .map((id) => foods.find((f) => f.id === id))
      .filter((f): f is FoodItem => Boolean(f));
    if (picked.length === 0) {
      setPortionGramsMap({});
      return;
    }
    const solved = solveOptimalPortions(picked, {
      calories: Math.max(0, remainingCalories),
      protein: Math.max(0, remainingProtein),
      fat: Math.max(0, remainingFat),
      carbs: Math.max(0, remainingCarbs),
    });
    const nextMap: Record<string, number> = {};
    for (const item of solved) {
      nextMap[item.food.id] = item.grams;
    }
    setPortionGramsMap(nextMap);
  };

  const handleTogglePortionFood = (foodId: string) => {
    const exists = portionSelectedIds.includes(foodId);
    const nextIds = exists
      ? portionSelectedIds.filter((id) => id !== foodId)
      : [...portionSelectedIds, foodId];
    setPortionSelectedIds(nextIds);
    recomputeOptimalPortions(nextIds);
  };

  const handleSaveCalculatedPortions = () => {
    const picked = portionSelectedIds
      .map((id) => foods.find((f) => f.id === id))
      .filter((f): f is FoodItem => Boolean(f));
    if (picked.length === 0) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newLogs: Omit<DailyLogItem, 'id'>[] = [];
    for (const f of picked) {
      const g = portionGramsMap[f.id] || 0;
      if (g > 0) {
        const macros = calculateMacrosForGrams(f, g);
        newLogs.push({
          foodId: f.id,
          foodName: f.name,
          grams: g,
          calories: macros.calories,
          protein: macros.protein,
          fat: macros.fat,
          carbs: macros.carbs,
          time: timeStr,
          date: selectedDate,
        });
      }
    }

    if (newLogs.length > 0) {
      onAddLogs(newLogs);
      setShowManualAddModal(false);
      setPortionSelectedIds([]);
      setPortionGramsMap({});
      showTempNotice(`${newLogs.length} makanan hasil hitung porsi dicatat.`);
    }
  };

  const handleOpenManualAdd = (initialTab: 'database' | 'estimate' | 'portion' = 'database') => {
    setSelectedFood(null);
    setManualGrams(100);
    setManualSearch('');
    setPortionSearch('');
    setManualModalTab(initialTab);
    if (initialTab === 'portion' && portionSelectedIds.length > 0) {
      recomputeOptimalPortions(portionSelectedIds);
    }
    setShowManualAddModal(true);
  };

  const handleConfirmManualAdd = () => {
    if (!selectedFood || manualGrams <= 0) return;

    const macros = calculateMacrosForGrams(selectedFood, manualGrams);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    onAddLogs([
      {
        foodId: selectedFood.id,
        foodName: selectedFood.name,
        grams: manualGrams,
        calories: macros.calories,
        protein: macros.protein,
        fat: macros.fat,
        carbs: macros.carbs,
        time: timeStr,
        date: selectedDate,
      },
    ]);

    setShowManualAddModal(false);
  };

  const clickTrackerRef = useRef<{
    id: string | null;
    count: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({
    id: null,
    count: 0,
    timer: null,
  });

  useEffect(() => {
    return () => {
      if (clickTrackerRef.current.timer) {
        clearTimeout(clickTrackerRef.current.timer);
      }
    };
  }, []);

  const handleStartEdit = (log: DailyLogItem) => {
    if (isLocked) return;
    setEditingItem({ ...log });
    setShowEditModal(true);
  };

  const handleFoodCardClick = (log: DailyLogItem) => {
    if (isLocked) return;

    const tracker = clickTrackerRef.current;
    if (tracker.timer) {
      clearTimeout(tracker.timer);
      tracker.timer = null;
    }

    if (tracker.id === log.id) {
      tracker.count += 1;
    } else {
      tracker.id = log.id;
      tracker.count = 1;
    }

    if (tracker.count >= 3) {
      tracker.id = null;
      tracker.count = 0;
      setShowEditModal(false);
      onUpdateLog({
        ...log,
        isEaten: !log.isEaten,
      });
      return;
    }

    const currentCount = tracker.count;
    tracker.timer = setTimeout(
      () => {
        if (currentCount === 1) {
          handleStartEdit(log);
        }
        clickTrackerRef.current = { id: null, count: 0, timer: null };
      },
      currentCount === 1 ? 320 : 420
    );
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    if (editingItem.isEstimate) {
      onUpdateLog(editingItem);
      setShowEditModal(false);
      setEditingItem(null);
      return;
    }

    const matched = foods.find((f) => f.id === editingItem.foodId || f.name === editingItem.foodName);
    if (matched) {
      const macros = calculateMacrosForGrams(matched, editingItem.grams);
      onUpdateLog({
        ...editingItem,
        calories: macros.calories,
        protein: macros.protein,
        fat: macros.fat,
        carbs: macros.carbs,
      });
    } else {
      onUpdateLog(editingItem);
    }

    setShowEditModal(false);
    setEditingItem(null);
  };

  const filteredFoods = foods.filter((f) => {
    if (!manualSearch.trim()) return true;
    const q = manualSearch.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.aliases.some((a) => a.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 pb-24 pt-3 px-4 max-w-md mx-auto">
      {/* Lock Banner if Past Date */}
      {isPastDate && lockPastDays && (
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            {isLocked ? (
              <Lock size={14} className="text-amber-400" />
            ) : (
              <Unlock size={14} className="text-emerald-400" />
            )}
            <span>{isLocked ? 'Catatan hari lampau dikunci' : 'Edit hari lampau terbuka'}</span>
          </div>
          <button
            onClick={() => setOverrideLock(!overrideLock)}
            className="text-xs font-bold text-emerald-400 hover:underline"
          >
            {isLocked ? 'Buka' : 'Kunci'}
          </button>
        </div>
      )}

      {/* 1. Tampilan Utama Model TARGETS / CONSUMED (Sinkron dengan Pengaturan) */}
      <div
        data-testid="home-targets-card"
        className="p-4 rounded-2xl bg-[#151922] border border-slate-800/90 shadow-lg space-y-3.5"
      >
        {/* Header: TARGETS > on left, CONSUMED ⇄ on right */}
        <div className="flex items-center justify-between pb-0.5">
          <button
            type="button"
            onClick={() => onOpenSettings?.()}
            className="flex items-center space-x-2 hover:opacity-80 active:scale-95 transition-all"
            title="Buka Pengaturan Target Kalori & Makro Otomatis"
          >
            <CalendarDays size={17} className="text-slate-200" />
            <span className="text-sm font-extrabold tracking-wider text-white uppercase">
              TARGETS
            </span>
            <ChevronRight size={16} className="text-emerald-400 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={() =>
              setTargetDisplayMode((prev) => (prev === 'consumed' ? 'remaining' : 'consumed'))
            }
            className="flex items-center space-x-2 text-sm font-extrabold tracking-wider text-white uppercase hover:text-emerald-300 active:scale-95 transition-all"
            title="Klik untuk ganti tampilan Consumed (Dimakan) / Remaining (Sisa)"
          >
            <span>{targetDisplayMode === 'consumed' ? 'CONSUMED' : 'REMAINING'}</span>
            <ArrowLeftRight size={16} className="text-emerald-400 stroke-[2.5]" />
          </button>
        </div>

        {/* 4 Rows: Energy, Protein, Net Carbs, Fat */}
        <div className="space-y-3">
          {/* Energy */}
          {(() => {
            const targetVal = targetCaloriesRounded;
            const displayVal =
              targetDisplayMode === 'consumed'
                ? totalCalories
                : Math.max(0, remainingCalories);
            const rawPct = targetVal > 0 ? Math.round((displayVal / targetVal) * 100) : 0;
            const barWidth = Math.min(
              100,
              Math.max(0, Math.round((totalCalories / (targetVal || 1)) * 100))
            );

            return (
              <div className="space-y-1.5" data-testid="home-target-energy">
                <div className="flex items-baseline justify-between text-[15px] leading-snug">
                  <div className="text-slate-100">
                    <span className="font-bold text-white">Energy</span>
                    <span>
                      - {formatOneDecimalDot(displayVal)} / {formatOneDecimalDot(targetVal)} kcal
                    </span>
                  </div>
                  <span className="text-slate-100 font-medium">{rawPct}%</span>
                </div>
                <div className="h-3 w-full bg-[#2a2f3d] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      remainingCalories >= 0 ? 'bg-emerald-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Protein */}
          {(() => {
            const targetVal = targetProteinRounded;
            const displayVal =
              targetDisplayMode === 'consumed'
                ? totalProtein
                : Math.max(0, remainingProtein);
            const rawPct = targetVal > 0 ? Math.round((displayVal / targetVal) * 100) : 0;
            const barWidth = Math.min(100, Math.max(0, proteinPercent));

            return (
              <div className="space-y-1.5" data-testid="home-target-protein">
                <div className="flex items-baseline justify-between text-[15px] leading-snug">
                  <div className="text-slate-100">
                    <span className="font-bold text-white">Protein</span>
                    <span>
                      - {formatOneDecimalDot(displayVal)} / {formatOneDecimalDot(targetVal)} g
                    </span>
                  </div>
                  <span className="text-slate-100 font-medium">{rawPct}%</span>
                </div>
                <div className="h-3 w-full bg-[#2a2f3d] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Net Carbs */}
          {(() => {
            const targetVal = targetCarbsRounded;
            const displayVal =
              targetDisplayMode === 'consumed'
                ? totalCarbs
                : Math.max(0, remainingCarbs);
            const rawPct = targetVal > 0 ? Math.round((displayVal / targetVal) * 100) : 0;
            const barWidth = Math.min(100, Math.max(0, carbsPercent));

            return (
              <div className="space-y-1.5" data-testid="home-target-carbs">
                <div className="flex items-baseline justify-between text-[15px] leading-snug">
                  <div className="text-slate-100">
                    <span className="font-bold text-white">Net Carbs</span>
                    <span>
                      - {formatOneDecimalDot(displayVal)} / {formatOneDecimalDot(targetVal)} g
                    </span>
                  </div>
                  <span className="text-slate-100 font-medium">{rawPct}%</span>
                </div>
                <div className="h-3 w-full bg-[#2a2f3d] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Fat */}
          {(() => {
            const targetVal = targetFatRounded;
            const displayVal =
              targetDisplayMode === 'consumed'
                ? totalFat
                : Math.max(0, remainingFat);
            const rawPct = targetVal > 0 ? Math.round((displayVal / targetVal) * 100) : 0;
            const barWidth = Math.min(100, Math.max(0, fatPercent));

            return (
              <div className="space-y-1.5" data-testid="home-target-fat">
                <div className="flex items-baseline justify-between text-[15px] leading-snug">
                  <div className="text-slate-100">
                    <span className="font-bold text-white">Fat</span>
                    <span>
                      - {formatOneDecimalDot(displayVal)} / {formatOneDecimalDot(targetVal)} g
                    </span>
                  </div>
                  <span className="text-slate-100 font-medium">{rawPct}%</span>
                </div>
                <div className="h-3 w-full bg-[#2a2f3d] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 2. Kolom "Catat makan" besar + 3 akses di bawahnya: Pilih MyFood, Estimasi Luar, Hitung Porsi */}
      <div className="space-y-2">
        <label className="text-[18px] font-bold text-white block px-0.5">
          Catat makan
        </label>

        <QuickLogBar
          foods={foods}
          selectedDate={selectedDate}
          onAddLogs={onAddLogs}
          onOpenAddFoodModal={onOpenAddFoodModal}
          directSave={directSave}
        />

        {/* 4 Tombol di bawah Catat makan: Pilih MyFood, Scan Foto, Estimasi Luar, Hitung Porsi */}
        <div
          data-testid="quick-actions-row"
          className="grid grid-cols-4 gap-1.5 pt-1 text-[11px] font-semibold"
        >
          <button
            type="button"
            data-testid="quick-btn-myfood"
            disabled={isLocked}
            onClick={() => handleOpenManualAdd('database')}
            className="py-2 px-1 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 hover:border-emerald-500/50 hover:text-emerald-400 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center space-x-1 whitespace-nowrap"
          >
            <Utensils size={12} className="text-emerald-400 shrink-0" />
            <span>MyFood</span>
          </button>

          <button
            type="button"
            data-testid="quick-btn-photo"
            disabled={isLocked}
            onClick={() => onOpenPhotoScan?.()}
            className="py-2 px-1 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 hover:border-emerald-500/50 hover:text-emerald-400 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center space-x-1 whitespace-nowrap"
          >
            <Camera size={12} className="text-emerald-400 shrink-0" />
            <span>Scan Foto</span>
          </button>

          <button
            type="button"
            data-testid="quick-btn-estimate"
            disabled={isLocked}
            onClick={() => handleOpenManualAdd('estimate')}
            className="py-2 px-1 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 hover:border-amber-500/50 hover:text-amber-400 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center space-x-1 whitespace-nowrap"
          >
            <Sparkles size={12} className="text-amber-400 shrink-0" />
            <span>Estimasi</span>
          </button>

          <button
            type="button"
            data-testid="quick-btn-portion"
            disabled={isLocked}
            onClick={() => handleOpenManualAdd('portion')}
            className="py-2 px-1 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 hover:border-sky-500/50 hover:text-sky-400 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center space-x-1 whitespace-nowrap"
          >
            <Calculator size={12} className="text-sky-400 shrink-0" />
            <span>Porsi</span>
          </button>
        </div>

        {statusNotice && (
          <div className="px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-1.5">
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}
      </div>

      {/* 3. Makanan Hari Ini (Ketuk untuk mengedit) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-[18px] font-bold text-white">
            Makanan hari ini{' '}
            <span className="text-sm font-normal text-slate-400">({logsForDate.length})</span>
          </h3>

          {logsForDate.length > 0 && (
            <button
              type="button"
              onClick={() => setIsFoodListHidden(!isFoodListHidden)}
              className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 flex items-center space-x-1 text-xs font-semibold"
            >
              {isFoodListHidden ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{isFoodListHidden ? 'Tampilkan' : 'Sembunyikan'}</span>
            </button>
          )}
        </div>

        {isFoodListHidden && logsForDate.length > 0 ? (
          <div
            onClick={() => setIsFoodListHidden(false)}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400 cursor-pointer hover:border-slate-700"
          >
            <span>{logsForDate.length} makanan disembunyikan ({totalCalories} kkal)</span>
            <span className="text-emerald-400 font-bold">Buka</span>
          </div>
        ) : logsForDate.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center">
            <p className="text-sm text-slate-400">Belum ada makanan dicatat hari ini.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logsForDate.map((log) => {
              const isEaten = Boolean(log.isEaten);
              return (
                <div
                  key={log.id}
                  data-testid={`food-log-card-${log.id}`}
                  data-eaten={isEaten ? 'true' : 'false'}
                  onClick={() => handleFoodCardClick(log)}
                  className={`p-3.5 rounded-2xl border active:scale-[0.99] transition-all cursor-pointer select-none flex items-center justify-between ${
                    isEaten
                      ? 'bg-yellow-500/15 border-yellow-400/70 hover:border-yellow-300 shadow-sm shadow-yellow-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    {isEaten && (
                      <div
                        data-testid={`food-eaten-badge-${log.id}`}
                        className="text-[10px] font-bold text-yellow-300 leading-tight mb-0.5 tracking-wide"
                      >
                        Sudah dimakan
                      </div>
                    )}
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`text-[17px] font-semibold truncate ${
                          isEaten ? 'text-yellow-100' : 'text-white'
                        }`}
                      >
                        {log.foodName}
                      </span>
                      {log.isEstimate ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-semibold shrink-0">
                          Estimasi
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-semibold shrink-0 ${
                            isEaten ? 'text-yellow-200/80' : 'text-slate-400'
                          }`}
                        >
                          {formatQuickLogNumberID(log.grams)} g
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs mt-0.5 ${
                        isEaten ? 'text-yellow-200/75' : 'text-slate-400'
                      }`}
                    >
                      P {log.protein !== null ? formatQuickLogNumberID(log.protein) : '-'} · L{' '}
                      {log.fat !== null ? formatQuickLogNumberID(log.fat) : '-'} · K{' '}
                      {log.carbs !== null ? formatQuickLogNumberID(log.carbs) : '-'} g
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="text-right">
                      <span
                        className={`text-base font-bold block ${
                          isEaten ? 'text-yellow-300' : 'text-emerald-400'
                        }`}
                      >
                        {formatQuickLogNumberID(log.calories)} kkal
                      </span>
                      <span
                        className={`text-[10px] ${
                          isEaten ? 'text-yellow-200/70' : 'text-slate-500'
                        }`}
                      >
                        {log.time}
                      </span>
                    </div>
                    {!isLocked && (
                      <HoldToDeleteButton
                        onConfirmDelete={() => {
                          onDeleteLog(log.id);
                          showTempNotice(`"${log.foodName}" dihapus.`);
                        }}
                        iconSize={15}
                        className={`p-2 rounded-lg ${
                          isEaten
                            ? 'text-yellow-200/70 hover:text-rose-400 hover:bg-yellow-500/20'
                            : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'
                        }`}
                        title="Tahan 3 detik untuk menghapus makanan"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Pilih MyFood + Estimasi Luar + Hitung Porsi */}
      {showManualAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0f172a] border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] flex flex-col shadow-2xl safe-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setManualModalTab('database')}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all ${
                    manualModalTab === 'database'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Pilih MyFood
                </button>
                <button
                  type="button"
                  onClick={() => setManualModalTab('estimate')}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all ${
                    manualModalTab === 'estimate'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Estimasi Luar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualModalTab('portion');
                    if (portionSelectedIds.length > 0) {
                      recomputeOptimalPortions(portionSelectedIds);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1 ${
                    manualModalTab === 'portion'
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <Calculator size={12} />
                  <span>Hitung Porsi</span>
                </button>
              </div>
              <button
                onClick={() => setShowManualAddModal(false)}
                aria-label="Tutup modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {manualModalTab === 'database' ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="open-manage-myfoods-btn"
                    onClick={() => {
                      setShowManualAddModal(false);
                      onOpenMyFoods();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-xs font-bold text-emerald-400 flex items-center justify-between transition-all"
                  >
                    <span>Kelola Database ({foods.length})</span>
                    <ChevronRight size={14} />
                  </button>
                  {onOpenTools && (
                    <button
                      type="button"
                      data-testid="open-smart-tools-btn"
                      onClick={() => {
                        setShowManualAddModal(false);
                        onOpenTools();
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/40 text-xs font-bold text-sky-400 flex items-center space-x-1.5 transition-all shrink-0"
                    >
                      <Calculator size={13} />
                      <span>Resep & Alat</span>
                    </button>
                  )}
                </div>

                <div className="mt-2 relative">
                  <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    placeholder="Cari makanan di My Foods..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto mt-2.5 space-y-1.5 max-h-56 pr-1">
                  {filteredFoods.length === 0 ? (
                    <div className="p-5 text-center text-xs text-slate-400 border border-slate-800 rounded-xl space-y-2">
                      <p>
                        {foods.length === 0
                          ? 'Database My Foods masih kosong.'
                          : `Makanan "${manualSearch}" belum ada di My Foods.`}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowManualAddModal(false);
                          onOpenAddFoodModal(manualSearch);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs inline-flex items-center space-x-1"
                      >
                        <Plus size={14} />
                        <span>Tambah Makanan Baru</span>
                      </button>
                    </div>
                  ) : (
                    filteredFoods.map((f) => {
                      const isSelected = selectedFood?.id === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFood(f)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500 text-white'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{f.name}</span>
                            <span className="text-xs font-bold text-emerald-400">
                              {f.calories} kkal / 100g
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            P {f.protein !== null ? f.protein : '-'} · L{' '}
                            {f.fat !== null ? f.fat : '-'} · K{' '}
                            {f.carbs !== null ? f.carbs : '-'} g
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {selectedFood && (
                  <div
                    data-testid="selected-food-preview-box"
                    className="mt-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Berat {selectedFood.name} (gram)
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          {[50, 100, 150, 200].map((presetG) => (
                            <button
                              key={presetG}
                              type="button"
                              onClick={() => setManualGrams(presetG)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                                manualGrams === presetG
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              {presetG}g
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="3000"
                        data-testid="myfood-grams-input"
                        value={manualGrams}
                        onChange={(e) => setManualGrams(parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-right text-base font-bold text-white focus:outline-none focus:border-emerald-500 tabular-nums"
                      />
                    </div>

                    {manualGrams > 0 &&
                      (() => {
                        const previewMacros = calculateMacrosForGrams(selectedFood, manualGrams);
                        const afterCalories =
                          Math.round((remainingCalories - previewMacros.calories) * 10) / 10;
                        const afterProtein =
                          Math.round(
                            (remainingProtein - (previewMacros.protein ?? 0)) * 10
                          ) / 10;
                        const afterFat =
                          Math.round((remainingFat - (previewMacros.fat ?? 0)) * 10) / 10;
                        const afterCarbs =
                          Math.round((remainingCarbs - (previewMacros.carbs ?? 0)) * 10) / 10;
                        const isCalOver = afterCalories < 0;

                        return (
                          <div className="pt-2 border-t border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">Nutrisi porsi ini ({manualGrams}g):</span>
                              <span className="font-bold text-emerald-400 tabular-nums">
                                {previewMacros.calories} kkal{' '}
                                <span className="text-slate-300 font-semibold">
                                  · P {previewMacros.protein ?? '-'}g · L {previewMacros.fat ?? '-'}g · K{' '}
                                  {previewMacros.carbs ?? '-'}g
                                </span>
                              </span>
                            </div>

                            {/* Indikator Sisa Kalori & Makro Setelah Makan Ini */}
                            <div
                              data-testid="remaining-after-food-preview"
                              className={`p-2.5 rounded-xl border text-xs ${
                                isCalOver
                                  ? 'bg-rose-950/30 border-rose-500/40'
                                  : 'bg-slate-950/90 border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-slate-300">
                                  Sisa target setelah makan ini:
                                </span>
                                <span
                                  className={`text-xs font-extrabold tabular-nums ${
                                    isCalOver ? 'text-rose-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {isCalOver
                                    ? `Kelebihan ${formatOneDecimalDot(Math.abs(afterCalories))} kkal`
                                    : `${formatOneDecimalDot(afterCalories)} kkal`}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 text-[11px] tabular-nums pt-1 border-t border-slate-800/80">
                                <div>
                                  <span className="text-slate-400">Protein: </span>
                                  <strong
                                    className={
                                      afterProtein < 0 ? 'text-amber-300' : 'text-emerald-400'
                                    }
                                  >
                                    {formatOneDecimalDot(afterProtein)}g
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Lemak: </span>
                                  <strong
                                    className={afterFat < 0 ? 'text-rose-400' : 'text-amber-400'}
                                  >
                                    {formatOneDecimalDot(afterFat)}g
                                  </strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Karbo: </span>
                                  <strong
                                    className={afterCarbs < 0 ? 'text-rose-400' : 'text-sky-400'}
                                  >
                                    {formatOneDecimalDot(afterCarbs)}g
                                  </strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                )}

                <div className="mt-4 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowManualAddModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={!selectedFood || manualGrams <= 0}
                    onClick={handleConfirmManualAdd}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold disabled:opacity-40"
                  >
                    Simpan
                  </button>
                </div>
              </>
            ) : manualModalTab === 'estimate' ? (
              /* Tab Estimasi Makan di Luar */
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Nama Makanan / Menu</label>
                  <input
                    type="text"
                    value={estimateName}
                    onChange={(e) => setEstimateName(e.target.value)}
                    placeholder="Contoh: Makan Siang di Luar"
                    className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-amber-400">Estimasi Kalori (kkal)</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={estimateCalories}
                    onChange={(e) =>
                      setEstimateCalories(e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                    }
                    className="w-full mt-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-lg font-black text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block">Protein (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={estimateProtein}
                      onChange={(e) =>
                        setEstimateProtein(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      placeholder="Opsional"
                      className="w-full mt-1 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block">Lemak (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={estimateFat}
                      onChange={(e) =>
                        setEstimateFat(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      placeholder="Opsional"
                      className="w-full mt-1 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block">Karbo (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={estimateCarbs}
                      onChange={(e) =>
                        setEstimateCarbs(e.target.value === '' ? '' : parseFloat(e.target.value))
                      }
                      placeholder="Opsional"
                      className="w-full mt-1 px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowManualAddModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={typeof estimateCalories !== 'number' || estimateCalories <= 0}
                    onClick={handleSaveEstimate}
                    className="flex-1 py-3 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold disabled:opacity-40"
                  >
                    Simpan Estimasi
                  </button>
                </div>
              </div>
            ) : (
              /* Tab Hitung Porsi (Pilih makananmu, lalu hitung gram yang mendekati sisa kalori dan makro) */
              <div className="mt-3 flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto pr-0.5">
                {/* Sisa Target Box */}
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                      Sisa Target Hari Ini
                    </span>
                    {portionSelectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => recomputeOptimalPortions(portionSelectedIds)}
                        className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center space-x-1"
                      >
                        <RotateCcw size={11} />
                        <span>Hitung Ulang Optimal</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Kalori</span>
                      <span className="text-xs font-black text-white">
                        {Math.max(0, remainingCalories)}{' '}
                        <span className="text-[10px] font-normal text-slate-400">kkal</span>
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Protein</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {Math.max(0, remainingProtein)}g
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Lemak</span>
                      <span className="text-xs font-bold text-amber-400">
                        {Math.max(0, remainingFat)}g
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Karbo</span>
                      <span className="text-xs font-bold text-sky-400">
                        {Math.max(0, remainingCarbs)}g
                      </span>
                    </div>
                  </div>
                </div>

                {/* Search & Multi-select foods */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    1. Pilih makanan yang ingin dimakan (bisa pilih lebih dari 1):
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={portionSearch}
                      onChange={(e) => setPortionSearch(e.target.value)}
                      placeholder="Cari makanan untuk dihitung porsinya..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {foods
                      .filter((f) => {
                        if (!portionSearch.trim()) return true;
                        const q = portionSearch.toLowerCase();
                        return (
                          f.name.toLowerCase().includes(q) ||
                          f.aliases.some((a) => a.toLowerCase().includes(q))
                        );
                      })
                      .map((f) => {
                        const isChecked = portionSelectedIds.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleTogglePortionFood(f.id)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                              isChecked
                                ? 'bg-sky-500/15 border-sky-500 text-white'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-bold text-white truncate">{f.name}</div>
                              <div className="text-[11px] text-slate-400">
                                {f.calories} kkal · P {f.protein ?? '-'} · L {f.fat ?? '-'} · K{' '}
                                {f.carbs ?? '-'}g /100g
                              </div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                                isChecked
                                  ? 'bg-sky-500 border-sky-400 text-slate-950'
                                  : 'border-slate-700 bg-slate-950'
                              }`}
                            >
                              {isChecked && <Check size={13} strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Calculated Portion Results */}
                {portionSelectedIds.length > 0 && (() => {
                  const selectedItems = portionSelectedIds
                    .map((id) => foods.find((f) => f.id === id))
                    .filter((f): f is FoodItem => Boolean(f));

                  let sumCal = 0;
                  let sumProt = 0;
                  let sumFat = 0;
                  let sumCarbs = 0;

                  for (const f of selectedItems) {
                    const g = portionGramsMap[f.id] || 0;
                    const m = calculateMacrosForGrams(f, g);
                    sumCal += m.calories;
                    sumProt += m.protein || 0;
                    sumFat += m.fat || 0;
                    sumCarbs += m.carbs || 0;
                  }

                  sumProt = Math.round(sumProt * 10) / 10;
                  sumFat = Math.round(sumFat * 10) / 10;
                  sumCarbs = Math.round(sumCarbs * 10) / 10;

                  const calDiff = Math.round((sumCal - Math.max(0, remainingCalories)) * 10) / 10;

                  return (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-sky-500/40 space-y-2.5">
                      <span className="text-xs font-bold text-sky-400 block">
                        2. Rekomendasi Gram Mendekati Sisa Kalori & Makro:
                      </span>

                      <div className="space-y-2">
                        {selectedItems.map((f) => {
                          const g = portionGramsMap[f.id] ?? 0;
                          const m = calculateMacrosForGrams(f, g);
                          return (
                            <div
                              key={f.id}
                              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate">
                                  {f.name}
                                </div>
                                <div className="text-[11px] text-emerald-400 font-semibold">
                                  {m.calories} kkal{' '}
                                  <span className="text-slate-400 font-normal">
                                    (P {m.protein ?? '-'} · L {m.fat ?? '-'} · K {m.carbs ?? '-'}g)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  max="2000"
                                  value={g}
                                  onChange={(e) =>
                                    setPortionGramsMap({
                                      ...portionGramsMap,
                                      [f.id]: Math.max(0, parseInt(e.target.value) || 0),
                                    })
                                  }
                                  className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right text-xs font-black text-white focus:outline-none focus:border-sky-500"
                                />
                                <span className="text-xs font-bold text-slate-400">g</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total Summary of Calculated Portion */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Total Porsi Ini:</span>
                          <span className="font-bold text-white">
                            P {sumProt}g · L {sumFat}g · K {sumCarbs}g
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-400 block">
                            {sumCal} kkal
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Selisih: {calDiff > 0 ? `+${calDiff}` : calDiff} kkal dari sisa
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-1 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowManualAddModal(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={portionSelectedIds.length === 0}
                    onClick={handleSaveCalculatedPortions}
                    className="flex-1 py-3 rounded-xl bg-sky-500 text-slate-950 text-sm font-bold disabled:opacity-40"
                  >
                    Catat Porsi Ini
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Ketuk makanan hari ini untuk mengedit */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">{editingItem.foodName}</h3>
                <p className="text-xs text-slate-400">Edit porsi atau waktu makan</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {editingItem.isEstimate ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Nama Makanan</label>
                    <input
                      type="text"
                      value={editingItem.foodName}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          foodName: e.target.value,
                        })
                      }
                      className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-amber-400">Kalori (kkal)</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={editingItem.calories}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          calories: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-base font-bold text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Protein (g)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editingItem.protein ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            protein: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="-"
                        className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Lemak (g)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editingItem.fat ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            fat: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="-"
                        className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Karbo (g)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editingItem.carbs ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            carbs: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="-"
                        className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white text-center"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-300">Berat (gram)</label>
                  <input
                    type="number"
                    min="1"
                    max="3000"
                    value={editingItem.grams}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        grams: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-base font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300">Waktu</label>
                <input
                  type="time"
                  value={editingItem.time}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      time: e.target.value,
                    })
                  }
                  className="w-full mt-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center space-x-2">
              <HoldToDeleteButton
                onConfirmDelete={() => {
                  onDeleteLog(editingItem.id);
                  setShowEditModal(false);
                  setEditingItem(null);
                  showTempNotice(`"${editingItem.foodName}" dihapus.`);
                }}
                iconSize={16}
                className="py-3 px-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-400 text-xs font-bold hover:bg-rose-950/70"
                title="Tahan 3 detik untuk menghapus"
              />
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
