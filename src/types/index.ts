/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FoodItem {
  id: string;
  name: string;
  aliases: string[];
  calories: number; // kcal per 100g
  protein: number | null; // g per 100g, null if unknown
  fat: number | null; // g per 100g, null if unknown
  carbs: number | null; // g per 100g, null if unknown
  servingUnit?: string; // default: 'g'
  servingSize?: number; // default: 100
  pricePerKg?: number | null; // IDR per kg for Protein Budget Optimizer
  stockGrams?: number | null; // available grams in inventory
  prepState?: 'mentah' | 'matang' | 'lainnya'; // Status bahan: mentah, matang, atau lainnya
  notes?: string;
  source?: string; // e.g., 'Label Kemasan', 'Tabel Komposisi Pangan', 'Resep', 'Estimasi'
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogItem {
  id: string;
  foodId?: string; // reference id (optional)
  foodName: string; // stored snapshot
  grams: number;
  calories: number; // calculated snapshot
  protein: number | null; // calculated snapshot
  fat: number | null; // calculated snapshot
  carbs: number | null; // calculated snapshot
  mealTime?: string;
  time: string; // HH:mm
  date: string; // YYYY-MM-DD
  notes?: string;
  isEstimate?: boolean;
  isEaten?: boolean;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  macroMode: 'auto_bodyweight' | 'manual' | 'auto_carb';
  effectiveDate?: string; // YYYY-MM-DD (tanggal berlaku)
  referenceWeightKg?: number; // berat acuan (kg)
  referenceWeightDate?: string; // YYYY-MM-DD
  referenceWeightLbs?: number; // berat acuan (lbs)
  savedAt?: string;
}

export interface TargetHistoryEntry {
  id: string;
  effectiveDate: string; // YYYY-MM-DD
  savedAt: string; // ISO string
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  referenceWeightKg: number;
  referenceWeightDate?: string;
  referenceWeightLbs: number;
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  notes?: string;
}

export interface FavoriteMealItem {
  foodId?: string;
  foodName: string;
  grams: number;
  mealTime?: string;
}

export interface FavoriteMeal {
  id: string;
  name: string;
  items: FavoriteMealItem[];
  totalCalories: number;
  totalProtein: number | null;
  totalFat: number | null;
  totalCarbs: number | null;
}

export interface RecipeIngredient {
  foodId: string;
  foodName: string;
  grams: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  cookedWeightGrams: number;
  servings?: number;
  notes?: string;
  createdAt: string;
}

export interface AppSettings {
  quickLogDirectSave: boolean; // default: false (show preview first)
  lockPastDays: boolean; // default: false
  autoDeductInventory: boolean; // default: true
  lockNutritionData: boolean; // default: true (Kunci Nutrisi My Foods)
  lockNutritionTargets: boolean; // default: true (Kunci Target Kalori & Makronutrien)
  lockPassword?: string; // default: '1234' (Sandi untuk membuka kunci di Pengaturan)
  targetWeightKg?: number | null; // Target Berat Badan (Goal Weight in kg)
  lastBackupDate: string | null;
  backupReminderDays: number;
}

export interface BackupData {
  version: number;
  exportDate: string;
  foods: FoodItem[];
  dailyLogs: DailyLogItem[];
  weightHistory: WeightEntry[];
  recipes: Recipe[];
  favoriteMeals: FavoriteMeal[];
  targets: DailyTargets;
  targetHistory?: TargetHistoryEntry[];
  settings: AppSettings;
}

