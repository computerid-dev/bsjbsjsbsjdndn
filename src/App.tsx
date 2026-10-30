/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FoodItem,
  DailyLogItem,
  DailyTargets,
  TargetHistoryEntry,
  WeightEntry,
  Recipe,
  FavoriteMeal,
  AppSettings,
} from './types';
import {
  getStoredFoods,
  saveStoredFoods,
  getStoredLogs,
  saveStoredLogs,
  getStoredTargets,
  saveStoredTargets,
  getStoredTargetHistory,
  saveStoredTargetHistory,
  getStoredWeights,
  saveStoredWeights,
  getStoredRecipes,
  saveStoredRecipes,
  getStoredFavorites,
  saveStoredFavorites,
  getStoredSettings,
  saveStoredSettings,
  createBackupJson,
} from './utils/storage';
import {
  calculateStreak,
  getLocalTodayStr,
  resolveTargetForDate,
  calculateAutoMacrosFromWeight,
  getLatestWeightEntry,
} from './utils/nutrition';
import {
  recordTargetHistorySnapshot,
  maybeDailyAutoSnapshot,
  STORAGE_ERROR_EVENT,
} from './utils/storage';
import { Header } from './components/Header';
import { Navbar, ActiveTab } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { MyFoodsView } from './components/MyFoodsView';
import { ProgressView } from './components/ProgressView';
import { ManualFoodModal } from './components/ManualFoodModal';
import { NutritionImportModal } from './components/NutritionImportModal';
import { SmartToolsModal } from './components/SmartToolsModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  // Core application state loaded from local storage
  const [foods, setFoods] = useState<FoodItem[]>(() => getStoredFoods());
  const [dailyLogs, setDailyLogs] = useState<DailyLogItem[]>(() => getStoredLogs());
  const [targets, setTargets] = useState<DailyTargets>(() => getStoredTargets());
  const [targetHistory, setTargetHistory] = useState<TargetHistoryEntry[]>(() =>
    getStoredTargetHistory()
  );
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(() => getStoredWeights());
  const [, setRecipes] = useState<Recipe[]>(() => getStoredRecipes());
  const [, setFavoriteMeals] = useState<FavoriteMeal[]>(() => getStoredFavorites());
  const [settings, setSettings] = useState<AppSettings>(() => getStoredSettings());

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [phoneToday, setPhoneToday] = useState<string>(() => getLocalTodayStr());
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalTodayStr());

  // Modals state
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [prefillFoodName, setPrefillFoodName] = useState<string>('');
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNutritionUnlockedSession, setIsNutritionUnlockedSession] = useState(false);

  // Pengaman data: minta penyimpanan permanen (agar tidak dibersihkan otomatis oleh browser),
  // buat cadangan harian otomatis, dan tampilkan peringatan jika penyimpanan gagal.
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        navigator.storage.persist().catch(() => undefined);
      }
    } catch {
      // abaikan: tidak didukung di perangkat ini
    }
    try {
      maybeDailyAutoSnapshot();
    } catch (err) {
      console.error('Cadangan harian gagal:', err);
    }
    const onStorageError = () => setStorageWarning(true);
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
  }, []);

  // Sync with phone's local date automatically on midnight rollover or when app wakes up
  useEffect(() => {
    const syncPhoneDate = () => {
      const currentLocalToday = getLocalTodayStr();
      setPhoneToday((prevPhoneToday) => {
        if (currentLocalToday !== prevPhoneToday) {
          setSelectedDate((prevSelected) =>
            prevSelected === prevPhoneToday ? currentLocalToday : prevSelected
          );
          return currentLocalToday;
        }
        return prevPhoneToday;
      });
    };

    const timer = setInterval(syncPhoneDate, 10000);
    window.addEventListener('focus', syncPhoneDate);
    document.addEventListener('visibilitychange', syncPhoneDate);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', syncPhoneDate);
      document.removeEventListener('visibilitychange', syncPhoneDate);
    };
  }, []);

  // Automatically synchronize active target macros with latest weight while keeping older targetHistory snapshots immutable
  useEffect(() => {
    const latestW = getLatestWeightEntry(weightHistory);
    if (!latestW || latestW.weightKg <= 0) return;

    const needsSyncWithLatestWeight =
      targetHistory.length === 0 ||
      typeof targets.referenceWeightKg !== 'number' ||
      targets.referenceWeightKg <= 0 ||
      Math.abs(targets.referenceWeightKg - latestW.weightKg) > 1e-6;

    if (needsSyncWithLatestWeight) {
      const auto = calculateAutoMacrosFromWeight(targets.calories, latestW.weightKg);
      if (
        auto.isValid &&
        auto.calories !== null &&
        auto.proteinGrams !== null &&
        auto.fatGrams !== null &&
        auto.carbsGrams !== null &&
        auto.weightKg !== null &&
        auto.weightLbs !== null
      ) {
        const effDate = latestW.date || getLocalTodayStr();
        const nowIso = new Date().toISOString();
        const syncedTargets: DailyTargets = {
          calories: auto.calories,
          protein: auto.proteinGrams,
          fat: auto.fatGrams,
          carbs: auto.carbsGrams,
          macroMode: 'auto_bodyweight',
          effectiveDate: effDate,
          referenceWeightKg: auto.weightKg,
          referenceWeightDate: latestW.date,
          referenceWeightLbs: auto.weightLbs,
          savedAt: nowIso,
        };
        const syncedHistory = recordTargetHistorySnapshot(targetHistory, {
          effectiveDate: effDate,
          savedAt: nowIso,
          calories: auto.calories,
          protein: auto.proteinGrams,
          fat: auto.fatGrams,
          carbs: auto.carbsGrams,
          referenceWeightKg: auto.weightKg,
          referenceWeightDate: latestW.date,
          referenceWeightLbs: auto.weightLbs,
        });
        setTargets(syncedTargets);
        saveStoredTargets(syncedTargets);
        setTargetHistory(syncedHistory);
        saveStoredTargetHistory(syncedHistory);
      }
    }
  }, [weightHistory, targets, targetHistory]);

  // Native App Lock: Disable pull-to-refresh, keyboard refresh (F5 / Ctrl+R / Cmd+R), pinch-zoom, and web context menus
  useEffect(() => {
    let touchStartY = 0;

    const findScrollableAncestor = (target: EventTarget | null): HTMLElement | null => {
      let el = target instanceof HTMLElement ? target : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollableY =
          (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
        if (isScrollableY) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Block multi-touch pinch-to-zoom so the UI stays fixed like a native app
      if (e.touches.length > 1) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY;
      const scrollable = findScrollableAncestor(e.target);

      // If swiping vertically on a non-scrollable element (e.g. Header, Navbar, or short screen), block browser pull-to-refresh / bounce
      if (!scrollable) {
        if (Math.abs(deltaY) > 2 && e.cancelable) {
          e.preventDefault();
        }
        return;
      }

      // If pulling down while already at the very top of the scroll container, block browser pull-to-refresh
      if (deltaY > 0 && scrollable.scrollTop <= 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        return;
      }

      // If pulling up while already at the very bottom of the scroll container, block overscroll bounce
      if (
        deltaY < 0 &&
        scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1
      ) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isF5 = e.key === 'F5' || e.code === 'F5';
      const isCtrlOrCmdR = (e.ctrlKey || e.metaKey) && key === 'r';
      if (isF5 || isCtrlOrCmdR) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleGestureStart = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('gesturestart', handleGestureStart);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('gesturestart', handleGestureStart);
    };
  }, []);

  // Compute streak
  const streak = calculateStreak(dailyLogs, phoneToday);

  // ADD LOGS (with snapshot calculation & optional auto-deduct inventory)
  const handleAddLogs = useCallback(
    (newLogs: Omit<DailyLogItem, 'id'>[]) => {
      const createdLogs: DailyLogItem[] = newLogs.map((log) => ({
        ...log,
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      }));

      const updatedLogs = [...dailyLogs, ...createdLogs];
      setDailyLogs(updatedLogs);
      saveStoredLogs(updatedLogs);

      // Auto deduct inventory if enabled (sums all matching items in newLogs)
      if (settings.autoDeductInventory) {
        let foodsChanged = false;
        const updatedFoods = foods.map((f) => {
          const matchedLogs = newLogs.filter(
            (l) => !l.isEstimate && (l.foodId === f.id || l.foodName === f.name)
          );
          if (matchedLogs.length > 0 && f.stockGrams !== null && f.stockGrams !== undefined) {
            const totalUsedGrams = matchedLogs.reduce((sum, item) => sum + item.grams, 0);
            foodsChanged = true;
            return {
              ...f,
              stockGrams: Math.max(0, f.stockGrams - totalUsedGrams),
            };
          }
          return f;
        });

        if (foodsChanged) {
          setFoods(updatedFoods);
          saveStoredFoods(updatedFoods);
        }
      }
    },
    [dailyLogs, foods, settings.autoDeductInventory]
  );

  // UPDATE LOG
  const handleUpdateLog = useCallback(
    (updatedLog: DailyLogItem) => {
      const updated = dailyLogs.map((l) => (l.id === updatedLog.id ? updatedLog : l));
      setDailyLogs(updated);
      saveStoredLogs(updated);
    },
    [dailyLogs]
  );

  // DELETE LOG
  const handleDeleteLog = useCallback(
    (logId: string) => {
      const updated = dailyLogs.filter((l) => l.id !== logId);
      setDailyLogs(updated);
      saveStoredLogs(updated);
    },
    [dailyLogs]
  );

  // SAVE OR UPDATE FOOD IN MY FOODS
  const handleSaveFood = useCallback(
    (foodData: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string) => {
      const now = new Date().toISOString();
      if (existingId) {
        // Edit existing
        const updated = foods.map((f) => {
          if (f.id === existingId) {
            return {
              ...f,
              ...foodData,
              updatedAt: now,
            };
          }
          return f;
        });
        setFoods(updated);
        saveStoredFoods(updated);
      } else {
        // Add new
        const newFood: FoodItem = {
          ...foodData,
          id: 'food_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          createdAt: now,
          updatedAt: now,
        };
        const updated = [newFood, ...foods];
        setFoods(updated);
        saveStoredFoods(updated);
      }
    },
    [foods]
  );

  // DELETE FOOD FROM DATABASE
  const handleDeleteFood = useCallback(
    (foodId: string) => {
      const updated = foods.filter((f) => f.id !== foodId);
      setFoods(updated);
      saveStoredFoods(updated);
    },
    [foods]
  );

  // UPDATE FOOD STOCK
  const handleUpdateFoodStock = useCallback(
    (foodId: string, deltaGrams: number) => {
      const updated = foods.map((f) => {
        if (f.id === foodId) {
          const cur = f.stockGrams ?? 0;
          return {
            ...f,
            stockGrams: Math.max(0, cur + deltaGrams),
            updatedAt: new Date().toISOString(),
          };
        }
        return f;
      });
      setFoods(updated);
      saveStoredFoods(updated);
    },
    [foods]
  );

  // WEIGHT ACTIONS (Strictly once per day - cannot overwrite existing day's record)
  const handleAddWeight = useCallback(
    (weight: number, date: string, notes?: string) => {
      const alreadyExists = weightHistory.some((w) => w.date === date);
      if (alreadyExists) {
        return;
      }
      const newEntry: WeightEntry = {
        id: 'wt_' + Date.now(),
        date,
        weightKg: weight,
        notes,
      };
      const updated = [...weightHistory, newEntry];
      setWeightHistory(updated);
      saveStoredWeights(updated);
    },
    [weightHistory]
  );

  const handleDeleteWeight = useCallback(
    (id: string) => {
      const updated = weightHistory.filter((w) => w.id !== id);
      setWeightHistory(updated);
      saveStoredWeights(updated);
    },
    [weightHistory]
  );

  // RESTORE COMPLETE REFRESH
  const handleDataRestored = useCallback(() => {
    setFoods(getStoredFoods());
    setDailyLogs(getStoredLogs());
    setTargets(getStoredTargets());
    setTargetHistory(getStoredTargetHistory());
    setWeightHistory(getStoredWeights());
    setRecipes(getStoredRecipes());
    setFavoriteMeals(getStoredFavorites());
    setSettings(getStoredSettings());
  }, []);

  const handleExportBackup = useCallback(() => {
    try {
      const json = createBackupJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KaloriKu_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
    }
  }, []);

  // Resolve target effective on the currently selected date without mutating older history
  const activeTargetForSelectedDate = resolveTargetForDate(
    selectedDate,
    targets,
    targetHistory,
    weightHistory
  );

  return (
    <div
      data-testid="native-app-shell"
      className="fixed inset-0 h-[100dvh] w-full overflow-hidden overscroll-none bg-[#07090e] text-slate-100 flex flex-col font-sans select-none antialiased"
    >
      {storageWarning && (
        <div
          role="alert"
          className="shrink-0 bg-amber-500/15 border-b border-amber-500/40 text-amber-200 text-[11px] leading-snug px-3 py-2 flex items-start justify-between space-x-2"
        >
          <span>
            Penyimpanan perangkat penuh atau diblokir, sebagian data mungkin tidak tersimpan.
            Segera unduh backup di Pengaturan, lalu kosongkan ruang penyimpanan atau izinkan
            penyimpanan untuk aplikasi ini.
          </span>
          <button
            type="button"
            onClick={() => setStorageWarning(false)}
            className="shrink-0 font-bold text-amber-100 px-1"
            aria-label="Tutup peringatan"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header */}
      <Header
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        streak={streak}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportBackup={handleExportBackup}
        onImportBackup={() => setIsSettingsOpen(true)}
      />

      {/* Main View Router (Internal Native Scroll Container - prevents document pull-to-refresh) */}
      <main
        data-testid="app-scroll-container"
        className="flex-1 w-full max-w-md mx-auto overflow-y-auto overflow-x-hidden overscroll-none"
      >
        {activeTab === 'home' && (
          <HomeView
            selectedDate={selectedDate}
            foods={foods}
            dailyLogs={dailyLogs}
            targets={activeTargetForSelectedDate}
            lockPastDays={settings.lockPastDays}
            directSave={settings.quickLogDirectSave}
            onAddLogs={handleAddLogs}
            onUpdateLog={handleUpdateLog}
            onDeleteLog={handleDeleteLog}
            onOpenAddFoodModal={(prefill) => {
              setPrefillFoodName(prefill || '');
              setEditingFood(null);
              setIsAddFoodOpen(true);
            }}
            onOpenMyFoods={() => setActiveTab('foods')}
            onOpenPhotoScan={() => setIsImportOpen(true)}
            onOpenTools={() => setIsToolsOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeTab === 'foods' && (
          <MyFoodsView
            foods={foods}
            onOpenAddModal={(prefill) => {
              setPrefillFoodName(prefill || '');
              setEditingFood(null);
              setIsAddFoodOpen(true);
            }}
            onOpenEditModal={(food) => {
              setEditingFood(food);
              setIsAddFoodOpen(true);
            }}
            onDeleteFood={handleDeleteFood}
            onOpenImportModal={() => setIsImportOpen(true)}
            onOpenTools={() => setIsToolsOpen(true)}
            onUpdateFoodStock={handleUpdateFoodStock}
            isNutritionLocked={settings.lockNutritionData}
            isNutritionUnlockedSession={isNutritionUnlockedSession}
            onRelockNutritionSession={() => setIsNutritionUnlockedSession(false)}
            onBackToHome={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            weightHistory={weightHistory}
            dailyLogs={dailyLogs}
            targets={activeTargetForSelectedDate}
            settings={settings}
            onAddWeight={handleAddWeight}
            onDeleteWeight={handleDeleteWeight}
            onUpdateSettings={(s) => {
              setSettings(s);
              saveStoredSettings(s);
            }}
          />
        )}
      </main>

      {/* Bottom Android Navigation Bar */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* MODALS */}
      {/* 1. Add / Edit Food Modal */}
      <ManualFoodModal
        isOpen={isAddFoodOpen}
        onClose={() => {
          setIsAddFoodOpen(false);
          setEditingFood(null);
          setPrefillFoodName('');
        }}
        onSave={handleSaveFood}
        editingFood={editingFood}
        existingFoods={foods}
        prefillName={prefillFoodName}
        isNutritionLocked={settings.lockNutritionData && !isNutritionUnlockedSession}
        onRelockSession={() => setIsNutritionUnlockedSession(false)}
      />

      {/* 2. Smart Nutrition Import & Photo Scan Modal */}
      <NutritionImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSaveFood={handleSaveFood}
        onAddLogs={handleAddLogs}
        selectedDate={selectedDate}
        initialMode="photo"
      />

      {/* 3. Smart Tools Modal */}
      <SmartToolsModal
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        foods={foods}
        dailyLogs={dailyLogs}
        targets={activeTargetForSelectedDate}
        selectedDate={selectedDate}
        onAddLogs={handleAddLogs}
        onSaveNewFood={handleSaveFood}
        onUpdateFoodStock={handleUpdateFoodStock}
      />

      {/* 4. Settings & Backup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        targets={activeTargetForSelectedDate}
        targetHistory={targetHistory}
        weightHistory={weightHistory}
        effectiveDate={selectedDate}
        settings={settings}
        foodsCount={foods.length}
        onOpenMyFoods={() => setActiveTab('foods')}
        onOpenImportModal={() => setIsImportOpen(true)}
        onOpenTools={() => setIsToolsOpen(true)}
        onUpdateTargets={(t, updatedHistory) => {
          setTargets(t);
          saveStoredTargets(t);
          if (updatedHistory) {
            setTargetHistory(updatedHistory);
            saveStoredTargetHistory(updatedHistory);
          }
        }}
        onAddWeight={handleAddWeight}
        onUpdateSettings={(s) => {
          setSettings(s);
          saveStoredSettings(s);
        }}
        onDataRestored={handleDataRestored}
        isNutritionUnlockedSession={isNutritionUnlockedSession}
        onUnlockNutritionSession={() => setIsNutritionUnlockedSession(true)}
        onRelockNutritionSession={() => setIsNutritionUnlockedSession(false)}
      />
    </div>
  );
}
