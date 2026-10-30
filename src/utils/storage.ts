/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FoodItem,
  DailyLogItem,
  DailyTargets,
  TargetHistoryEntry,
  WeightEntry,
  FavoriteMeal,
  Recipe,
  AppSettings,
  BackupData,
} from '../types';

const STORAGE_KEYS = {
  FOODS: 'kaloriku_foods_v1',
  LOGS: 'kaloriku_logs_v1',
  TARGETS: 'kaloriku_targets_v1',
  TARGET_HISTORY: 'kaloriku_target_history_v1',
  WEIGHT: 'kaloriku_weight_v1',
  RECIPES: 'kaloriku_recipes_v1',
  FAVORITES: 'kaloriku_favorites_v1',
  SETTINGS: 'kaloriku_settings_v1',
};

export const USER_PROVIDED_BACKUP: BackupData = {
  version: 1,
  exportDate: '2026-10-29T23:58:44.551Z',
  foods: [
    {
      id: 'food_french_fries_01',
      name: 'French fries',
      aliases: ['kentang goreng', 'french fry', 'kentang'],
      calories: 140, // 280 kkal per 200g = 140 kkal per 100g
      protein: 3.4,
      fat: 15.0,
      carbs: 41.0,
      servingUnit: 'g',
      servingSize: 100,
      notes: 'Kentang goreng (200g = 280 kkal)',
      createdAt: '2026-10-29T23:58:44.551Z',
      updatedAt: '2026-10-29T23:58:44.551Z',
    },
  ],
  dailyLogs: [],
  weightHistory: [
    {
      id: 'w_2026-10-28',
      date: '2026-10-28',
      weightKg: 68.8,
    },
    {
      id: 'w_2026-10-29',
      date: '2026-10-29',
      weightKg: 68.8,
    },
    {
      id: 'w_2026-10-30',
      date: '2026-10-30',
      weightKg: 68.5,
    },
  ],
  recipes: [],
  favoriteMeals: [],
  targets: {
    calories: 1900,
    protein: 120.81331967464001,
    fat: 45.30499487799,
    carbs: 252.2504418498825,
    macroMode: 'auto_bodyweight',
    effectiveDate: '2026-10-30',
    referenceWeightKg: 68.5,
    referenceWeightDate: '2026-10-30',
    referenceWeightLbs: 151.0166495933,
    savedAt: '2026-10-29T23:58:40.100Z',
  },
  targetHistory: [
    {
      id: 'th_1793269688778_87gf',
      effectiveDate: '2026-10-29',
      savedAt: '2026-10-29T10:28:08.777Z',
      calories: 1900,
      protein: 121.342429103872,
      fat: 45.503410913951996,
      carbs: 251.27489633973602,
      referenceWeightKg: 68.8,
      referenceWeightDate: '2026-10-29',
      referenceWeightLbs: 151.67803637984,
    },
    {
      id: 'th_1793285600362_o8de',
      effectiveDate: '2026-10-28',
      savedAt: '2026-10-29T14:53:20.362Z',
      calories: 1900,
      protein: 121.342429103872,
      fat: 45.503410913951996,
      carbs: 251.27489633973602,
      referenceWeightKg: 68.8,
      referenceWeightDate: '2026-10-29',
      referenceWeightLbs: 151.67803637984,
    },
    {
      id: 'th_1793286587764_iyh4',
      effectiveDate: '2026-10-29',
      savedAt: '2026-10-29T15:09:47.764Z',
      calories: 1900,
      protein: 121.342429103872,
      fat: 45.503410913951996,
      carbs: 251.27489633973602,
      referenceWeightKg: 68.8,
      referenceWeightDate: '2026-10-29',
      referenceWeightLbs: 151.67803637984,
    },
    {
      id: 'th_1793308216523_prsl',
      effectiveDate: '2026-10-30',
      savedAt: '2026-10-29T21:10:16.522Z',
      calories: 1900,
      protein: 120.81331967464001,
      fat: 45.30499487799,
      carbs: 252.2504418498825,
      referenceWeightKg: 68.5,
      referenceWeightDate: '2026-10-30',
      referenceWeightLbs: 151.0166495933,
    },
  ],
  settings: {
    quickLogDirectSave: false,
    lockPastDays: false,
    autoDeductInventory: true,
    lockNutritionData: true,
    lockNutritionTargets: true,
    lockPassword: '1234',
    targetWeightKg: null,
    lastBackupDate: '2026-10-29T23:58:44.552Z',
    backupReminderDays: 7,
  },
};

export const DEFAULT_TARGETS: DailyTargets = USER_PROVIDED_BACKUP.targets;

export const DEFAULT_SETTINGS: AppSettings = USER_PROVIDED_BACKUP.settings;

// Safe JSON parser
// Jika data rusak (JSON korup), salinan mentahnya diamankan dulu ke kunci "__corrupt"
// supaya tidak langsung tertimpa data kosong saat aplikasi menyimpan berikutnya.
function safeParse<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw || raw === 'undefined' || raw === 'null') return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    try {
      if (raw) localStorage.setItem(`${key}__corrupt`, raw);
    } catch {
      // abaikan: penyimpanan penuh atau tidak tersedia
    }
    return fallback;
  }
}

export const STORAGE_ERROR_EVENT = 'kaloriku:storage-error';

// Mengembalikan true jika berhasil disimpan. Jika gagal (misalnya penyimpanan penuh
// atau diblokir), memicu event agar UI bisa memberi peringatan, bukan diam-diam hilang.
function safeSave<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`Error saving ${key} to storage:`, err);
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key } }));
      }
    } catch {
      // abaikan
    }
    return false;
  }
}

// FOODS: Initially seeded with user foods or empty
export function getStoredFoods(): FoodItem[] {
  const stored = safeParse<FoodItem[]>(STORAGE_KEYS.FOODS, []);
  if (stored.length === 0 && USER_PROVIDED_BACKUP.foods.length > 0) {
    return USER_PROVIDED_BACKUP.foods;
  }
  return stored;
}

export function saveStoredFoods(foods: FoodItem[]): void {
  safeSave(STORAGE_KEYS.FOODS, foods);
}

// DAILY LOGS
export function getStoredLogs(): DailyLogItem[] {
  return safeParse<DailyLogItem[]>(STORAGE_KEYS.LOGS, []);
}

export function saveStoredLogs(logs: DailyLogItem[]): void {
  safeSave(STORAGE_KEYS.LOGS, logs);
}

// TARGETS
export function getStoredTargets(): DailyTargets {
  return safeParse<DailyTargets>(STORAGE_KEYS.TARGETS, DEFAULT_TARGETS);
}

export function saveStoredTargets(targets: DailyTargets): void {
  safeSave(STORAGE_KEYS.TARGETS, targets);
}

// TARGET HISTORY (Immutable historical snapshots of effective date & reference weight)
export function getStoredTargetHistory(): TargetHistoryEntry[] {
  const stored = safeParse<TargetHistoryEntry[]>(STORAGE_KEYS.TARGET_HISTORY, []);
  const fallback = USER_PROVIDED_BACKUP.targetHistory || [];
  if (stored.length === 0 && fallback.length > 0) {
    return fallback;
  }
  return stored;
}

export function saveStoredTargetHistory(history: TargetHistoryEntry[]): void {
  safeSave(STORAGE_KEYS.TARGET_HISTORY, history);
}

/**
 * Appends a new target snapshot to targetHistory without mutating previous target history entries.
 * If the very last entry has the exact same effectiveDate, calories, and referenceWeightKg (e.g. repeated click on Save with identical inputs),
 * it preserves the existing entry id/timestamp rather than creating redundant duplicate rows.
 */
export function recordTargetHistorySnapshot(
  existingHistory: TargetHistoryEntry[],
  snapshot: Omit<TargetHistoryEntry, 'id' | 'savedAt'> & { id?: string; savedAt?: string }
): TargetHistoryEntry[] {
  const safeHistory = Array.isArray(existingHistory) ? [...existingHistory] : [];
  const last = safeHistory[safeHistory.length - 1];

  if (
    last &&
    last.effectiveDate === snapshot.effectiveDate &&
    Math.abs(last.calories - snapshot.calories) < 1e-9 &&
    Math.abs(last.referenceWeightKg - snapshot.referenceWeightKg) < 1e-9
  ) {
    return safeHistory;
  }

  const newEntry: TargetHistoryEntry = {
    id: snapshot.id || 'th_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    effectiveDate: snapshot.effectiveDate,
    savedAt: snapshot.savedAt || new Date().toISOString(),
    calories: snapshot.calories,
    protein: snapshot.protein,
    fat: snapshot.fat,
    carbs: snapshot.carbs,
    referenceWeightKg: snapshot.referenceWeightKg,
    referenceWeightDate: snapshot.referenceWeightDate,
    referenceWeightLbs: snapshot.referenceWeightLbs,
  };

  return [...safeHistory, newEntry];
}

// WEIGHT
export function getStoredWeights(): WeightEntry[] {
  const stored = safeParse<WeightEntry[]>(STORAGE_KEYS.WEIGHT, []);
  if (stored.length === 0 && USER_PROVIDED_BACKUP.weightHistory.length > 0) {
    return USER_PROVIDED_BACKUP.weightHistory;
  }
  return stored;
}

export function saveStoredWeights(weights: WeightEntry[]): void {
  safeSave(STORAGE_KEYS.WEIGHT, weights);
}

// RECIPES
export function getStoredRecipes(): Recipe[] {
  return safeParse<Recipe[]>(STORAGE_KEYS.RECIPES, []);
}

export function saveStoredRecipes(recipes: Recipe[]): void {
  safeSave(STORAGE_KEYS.RECIPES, recipes);
}

// FAVORITES
export function getStoredFavorites(): FavoriteMeal[] {
  return safeParse<FavoriteMeal[]>(STORAGE_KEYS.FAVORITES, []);
}

export function saveStoredFavorites(favs: FavoriteMeal[]): void {
  safeSave(STORAGE_KEYS.FAVORITES, favs);
}

// SETTINGS
export function getStoredSettings(): AppSettings {
  const settings = safeParse<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    lockNutritionData: settings.lockNutritionData !== undefined ? settings.lockNutritionData : true,
    lockNutritionTargets: settings.lockNutritionTargets !== undefined ? settings.lockNutritionTargets : true,
    lockPassword: settings.lockPassword && settings.lockPassword.trim().length > 0 ? settings.lockPassword : '1234',
  };
}

export function saveStoredSettings(settings: AppSettings): void {
  safeSave(STORAGE_KEYS.SETTINGS, settings);
}

export function verifyLockPassword(inputPassword: string, settings: AppSettings): boolean {
  const currentPassword = settings.lockPassword && settings.lockPassword.trim().length > 0
    ? settings.lockPassword
    : '1234';
  return inputPassword === currentPassword;
}

export function resetLockPassword(settings: AppSettings, newPassword = '1234'): AppSettings {
  const cleanPassword = newPassword.trim().length >= 4 ? newPassword.trim() : '1234';
  return {
    ...settings,
    lockPassword: cleanPassword,
    lockNutritionData: true,
    lockNutritionTargets: true,
  };
}

// Susun data backup dari isi penyimpanan saat ini (tanpa efek samping)
export function buildBackupData(): BackupData {
  return {
    version: 1,
    exportDate: new Date().toISOString(),
    foods: getStoredFoods(),
    dailyLogs: getStoredLogs(),
    weightHistory: getStoredWeights(),
    recipes: getStoredRecipes(),
    favoriteMeals: getStoredFavorites(),
    targets: getStoredTargets(),
    targetHistory: getStoredTargetHistory(),
    settings: getStoredSettings(),
  };
}

// EXPORT BACKUP
export function createBackupJson(): string {
  const backup = buildBackupData();
  const nowIso = new Date().toISOString();
  backup.settings = { ...backup.settings, lastBackupDate: nowIso };

  // Update last backup date in settings
  saveStoredSettings({
    ...getStoredSettings(),
    lastBackupDate: nowIso,
  });

  return JSON.stringify(backup, null, 2);
}

// CADANGAN OTOMATIS (di dalam penyimpanan perangkat)
// - "daily": maksimal 1 per hari, simpan 3 terbaru
// - "pre-restore": diambil otomatis sebelum data ditimpa oleh restore
export interface AutoSnapshot {
  id: string;
  createdAt: string;
  reason: 'daily' | 'pre-restore';
  foods: number;
  dailyLogs: number;
  weights: number;
  data: BackupData;
}

const AUTO_SNAPSHOT_KEY = 'kaloriku_auto_snapshots_v1';
const MAX_DAILY_SNAPSHOTS = 3;
const MAX_PRE_RESTORE_SNAPSHOTS = 2;

export function getAutoSnapshots(): AutoSnapshot[] {
  const list = safeParse<AutoSnapshot[]>(AUTO_SNAPSHOT_KEY, []);
  return Array.isArray(list) ? list.filter((x) => x && x.data && x.createdAt) : [];
}

function isBackupEmpty(b: BackupData): boolean {
  return (
    (b.dailyLogs?.length || 0) === 0 &&
    (b.recipes?.length || 0) === 0 &&
    (b.favoriteMeals?.length || 0) === 0
  );
}

export function saveAutoSnapshot(reason: AutoSnapshot['reason']): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const data = buildBackupData();
    // Jangan menimpa cadangan bagus dengan data kosong
    if (reason === 'daily' && isBackupEmpty(data)) return false;

    const nowIso = new Date().toISOString();
    const existing = getAutoSnapshots();
    const entry: AutoSnapshot = {
      id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: nowIso,
      reason,
      foods: data.foods.length,
      dailyLogs: data.dailyLogs.length,
      weights: data.weightHistory.length,
      data,
    };

    const daily = existing.filter((x) => x.reason === 'daily');
    const pre = existing.filter((x) => x.reason === 'pre-restore');
    let nextDaily = daily;
    let nextPre = pre;
    if (reason === 'daily') {
      nextDaily = [entry, ...daily].slice(0, MAX_DAILY_SNAPSHOTS);
    } else {
      nextPre = [entry, ...pre].slice(0, MAX_PRE_RESTORE_SNAPSHOTS);
    }
    const merged = [...nextPre, ...nextDaily].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    return safeSave(AUTO_SNAPSHOT_KEY, merged);
  } catch (err) {
    console.error('Gagal membuat cadangan otomatis:', err);
    return false;
  }
}

// Dipanggil saat aplikasi dibuka: buat cadangan harian jika hari ini belum ada
export function maybeDailyAutoSnapshot(): void {
  const todayKey = new Date().toISOString().split('T')[0];
  const alreadyToday = getAutoSnapshots().some(
    (x) => x.reason === 'daily' && x.createdAt.startsWith(todayKey)
  );
  if (!alreadyToday) saveAutoSnapshot('daily');
}

// RESTORE BACKUP WITH VALIDATION
export interface ValidationResult {
  isValid: boolean;
  message: string;
  itemCounts?: {
    foods: number;
    dailyLogs: number;
    weightEntries: number;
    recipes: number;
    favoriteMeals: number;
  };
  parsedData?: BackupData;
}

export function validateBackupFile(fileContent: string): ValidationResult {
  try {
    const cleanContent = fileContent.trim().replace(/^\uFEFF/, '');
    const data = JSON.parse(cleanContent) as Partial<BackupData>;

    if (!data || typeof data !== 'object') {
      return { isValid: false, message: 'Format file tidak valid (bukan JSON objek).' };
    }

    const safeFoods = Array.isArray(data.foods) ? data.foods : [];
    const safeDailyLogs = Array.isArray(data.dailyLogs) ? data.dailyLogs : [];
    const safeWeights = Array.isArray(data.weightHistory) ? data.weightHistory : [];
    const safeRecipes = Array.isArray(data.recipes) ? data.recipes : [];
    const safeFavorites = Array.isArray(data.favoriteMeals) ? data.favoriteMeals : [];
    const safeTargetHistory = Array.isArray(data.targetHistory) ? data.targetHistory : [];
    const safeTargets = data.targets && typeof data.targets === 'object' ? data.targets : DEFAULT_TARGETS;
    const safeSettings = data.settings && typeof data.settings === 'object' ? data.settings : DEFAULT_SETTINGS;

    const validatedFoods: FoodItem[] = [];
    for (const f of safeFoods) {
      if (f && typeof f === 'object' && typeof (f as any).name === 'string' && typeof (f as any).calories === 'number') {
        const anyF = f as any;
        validatedFoods.push({
          id: anyF.id || 'food_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: anyF.name.trim(),
          aliases: Array.isArray(anyF.aliases) ? anyF.aliases : [],
          calories: anyF.calories,
          protein: typeof anyF.protein === 'number' ? anyF.protein : null,
          fat: typeof anyF.fat === 'number' ? anyF.fat : null,
          carbs: typeof anyF.carbs === 'number' ? anyF.carbs : null,
          servingUnit: typeof anyF.servingUnit === 'string' ? anyF.servingUnit : 'g',
          servingSize: typeof anyF.servingSize === 'number' ? anyF.servingSize : (typeof anyF.servingSizeGrams === 'number' ? anyF.servingSizeGrams : 100),
          notes: anyF.notes || '',
          stockGrams: typeof anyF.stockGrams === 'number' ? anyF.stockGrams : (typeof anyF.inventoryGrams === 'number' ? anyF.inventoryGrams : null),
          createdAt: anyF.createdAt || new Date().toISOString(),
          updatedAt: anyF.updatedAt || new Date().toISOString(),
        });
      }
    }

    const safeData: BackupData = {
      version: data.version || 1,
      exportDate: data.exportDate || new Date().toISOString(),
      foods: validatedFoods,
      dailyLogs: safeDailyLogs,
      weightHistory: safeWeights,
      recipes: safeRecipes,
      favoriteMeals: safeFavorites,
      targets: safeTargets,
      targetHistory: safeTargetHistory,
      settings: safeSettings,
    };

    const itemCounts = {
      foods: safeData.foods.length,
      dailyLogs: safeData.dailyLogs.length,
      weightEntries: safeData.weightHistory.length,
      recipes: safeData.recipes.length,
      favoriteMeals: safeData.favoriteMeals.length,
    };

    return {
      isValid: true,
      message: 'Validasi berhasil! File backup kompatibel.',
      itemCounts,
      parsedData: safeData,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown parse error';
    return {
      isValid: false,
      message: `Gagal membaca file JSON: ${errorMessage}`,
    };
  }
}

export function restoreBackupData(backup: BackupData): void {
  // Pengaman: simpan kondisi data saat ini sebelum ditimpa, supaya bisa dibatalkan
  saveAutoSnapshot('pre-restore');
  if (Array.isArray(backup.foods)) saveStoredFoods(backup.foods);
  if (Array.isArray(backup.dailyLogs)) saveStoredLogs(backup.dailyLogs);
  if (Array.isArray(backup.weightHistory)) saveStoredWeights(backup.weightHistory);
  if (Array.isArray(backup.recipes)) saveStoredRecipes(backup.recipes);
  if (Array.isArray(backup.favoriteMeals)) saveStoredFavorites(backup.favoriteMeals);
  if (backup.targets) saveStoredTargets(backup.targets);
  if (Array.isArray(backup.targetHistory)) saveStoredTargetHistory(backup.targetHistory);
  if (backup.settings) saveStoredSettings(backup.settings);
}

export function restoreUserProvidedBackup(): void {
  restoreBackupData(USER_PROVIDED_BACKUP);
}
