/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FoodItem, DailyLogItem, WeightEntry, DailyTargets, TargetHistoryEntry } from '../types';

/**
 * Calculate macros for a given gram weight based on 100g food values.
 * Preserves null when unknown (does NOT assume zero).
 */
export function calculateMacrosForGrams(food: FoodItem, grams: number) {
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: food.protein !== null ? Math.round(food.protein * factor * 10) / 10 : null,
    fat: food.fat !== null ? Math.round(food.fat * factor * 10) / 10 : null,
    carbs: food.carbs !== null ? Math.round(food.carbs * factor * 10) / 10 : null,
  };
}

/**
 * Atwater factor verification (4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat).
 * Returns estimated calories, difference, and whether it's within standard tolerance (~15%).
 */
export function verifyAtwater(
  calories: number,
  protein: number | null,
  fat: number | null,
  carbs: number | null
): {
  estimatedCalories: number | null;
  differencePercent: number | null;
  isConsistent: boolean;
  message: string;
} {
  if (protein === null || fat === null || carbs === null) {
    return {
      estimatedCalories: null,
      differencePercent: null,
      isConsistent: true,
      message: 'Sebagian data makro belum diisi. Verifikasi Atwater dilewati.',
    };
  }

  const calculated = Math.round(protein * 4 + carbs * 4 + fat * 9);
  if (calories <= 0) {
    return {
      estimatedCalories: calculated,
      differencePercent: null,
      isConsistent: calculated === 0,
      message: calculated > 10 ? 'Kalori tercatat 0 namun memiliki nilai makro.' : 'Konsisten.',
    };
  }

  const diff = Math.abs(calculated - calories);
  const diffPercent = Math.round((diff / calories) * 100);
  const isConsistent = diffPercent <= 15;

  let message = `Estimasi 4-4-9: ${calculated} kkal (selisih ${diffPercent}%).`;
  if (!isConsistent) {
    message += ` Perhatian: Kalori tertera (${calories} kkal) berbeda signifikan dari hitungan makro (${calculated} kkal).`;
  } else {
    message += ' Data nutrisi konsisten.';
  }

  return {
    estimatedCalories: calculated,
    differencePercent: diffPercent,
    isConsistent,
    message,
  };
}

/**
 * Convert nutrition from serving size (e.g. 35g) to 100g reference.
 */
export function convertServingTo100g(
  servingGrams: number,
  calories: number,
  protein: number | null,
  fat: number | null,
  carbs: number | null
) {
  if (servingGrams <= 0) return { calories: 0, protein: null, fat: null, carbs: null };
  const multiplier = 100 / servingGrams;
  return {
    calories: Math.round(calories * multiplier),
    protein: protein !== null ? Math.round(protein * multiplier * 10) / 10 : null,
    fat: fat !== null ? Math.round(fat * multiplier * 10) / 10 : null,
    carbs: carbs !== null ? Math.round(carbs * multiplier * 10) / 10 : null,
  };
}

/**
 * Raw vs Cooked Calculator
 * Given raw weight, cooked weight, and raw nutrition per 100g,
 * calculate the nutrition density per 100g of the COOKED food.
 */
export function calculateCookedNutrition(
  rawWeightGrams: number,
  cookedWeightGrams: number,
  rawFood: Pick<FoodItem, 'calories' | 'protein' | 'fat' | 'carbs'>
) {
  if (cookedWeightGrams <= 0 || rawWeightGrams <= 0) {
    return null;
  }
  // Total raw nutrients
  const totalCalories = (rawFood.calories * rawWeightGrams) / 100;
  const totalProtein = rawFood.protein !== null ? (rawFood.protein * rawWeightGrams) / 100 : null;
  const totalFat = rawFood.fat !== null ? (rawFood.fat * rawWeightGrams) / 100 : null;
  const totalCarbs = rawFood.carbs !== null ? (rawFood.carbs * rawWeightGrams) / 100 : null;

  // Nutrients per 100g cooked
  const factor = 100 / cookedWeightGrams;
  const shrinkagePercent = Math.round(((rawWeightGrams - cookedWeightGrams) / rawWeightGrams) * 100);

  return {
    cookedCaloriesPer100g: Math.round(totalCalories * factor),
    cookedProteinPer100g: totalProtein !== null ? Math.round(totalProtein * factor * 10) / 10 : null,
    cookedFatPer100g: totalFat !== null ? Math.round(totalFat * factor * 10) / 10 : null,
    cookedCarbsPer100g: totalCarbs !== null ? Math.round(totalCarbs * factor * 10) / 10 : null,
    shrinkagePercent,
    yieldFactor: Math.round((cookedWeightGrams / rawWeightGrams) * 100) / 100,
  };
}

/**
 * Formats a number for Quick Log & Daily Log display (rounds only for display to at most 1 decimal place,
 * using Indonesian comma ',' for non-integers, e.g. 200 -> "200", 142.85714 -> "142,9").
 */
export function formatQuickLogNumberID(val: number): string {
  if (!Number.isFinite(val)) return '0';
  const rounded = Math.round(val * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(1).replace('.', ',');
}

export type QuickLogUnitMode = 'grams' | 'calories' | 'missing_unit';

/**
 * Smart Quick Log Item
 * Supports both gram input ("French fries 200g") and calorie input ("French fries 200 kkal")
 * strictly against the user's My Foods database with full floating-point precision.
 */
export interface ParsedQuickLogItem {
  queryText: string;
  inputValue: number;
  unitMode: QuickLogUnitMode;
  matchedFood: FoodItem | null;
  candidateFoods: FoodItem[];
  needsUnitSelection: boolean;
  needsFoodSelection: boolean;
  hasInvalidFoodCalories: boolean;
  grams: number;
  calculatedCalories: number;
  calculatedProtein: number | null;
  calculatedFat: number | null;
  calculatedCarbs: number | null;
  isMatched: boolean;
  isEstimate?: boolean;
}

/**
 * Finds all matching foods in My Foods for a given query string.
 */
export function findCandidateFoodsInMyFoods(queryText: string, foods: FoodItem[]): FoodItem[] {
  const normalizedQuery = queryText.toLowerCase().trim();
  if (!normalizedQuery) return [];

  // 1. Forward substring/exact match on food name or alias
  const forwardMatches = foods.filter((f) => {
    const foodNameNorm = f.name.toLowerCase().trim();
    if (foodNameNorm.includes(normalizedQuery)) return true;
    return f.aliases.some((alias) => alias.toLowerCase().trim().includes(normalizedQuery));
  });

  if (forwardMatches.length > 0) {
    return forwardMatches;
  }

  // 2. Fallback reverse inclusion if query contains a food's full name/alias
  return foods.filter((f) => {
    const foodNameNorm = f.name.toLowerCase().trim();
    if (foodNameNorm.length >= 2 && normalizedQuery.includes(foodNameNorm)) return true;
    return f.aliases.some((alias) => {
      const aliasNorm = alias.toLowerCase().trim();
      return aliasNorm.length >= 2 && normalizedQuery.includes(aliasNorm);
    });
  });
}

/**
 * Computes full-precision grams, calories, and macros for a Quick Log item.
 * - Input gram:
 *   Calories = (caloriesPer100g * grams) / 100
 *   Macro = (macroPer100g * grams) / 100
 * - Input kalori:
 *   Gram = (requestedCalories / caloriesPer100g) * 100
 *   Macro = (macroPer100g * calculatedGrams) / 100
 * Unknown macros (null) remain null.
 * If food is missing or food.calories <= 0, no conversion is fabricated.
 */
export function computeQuickLogItemMetrics(params: {
  queryText: string;
  inputValue: number;
  unitMode: QuickLogUnitMode;
  matchedFood: FoodItem | null;
  candidateFoods: FoodItem[];
}): ParsedQuickLogItem {
  const { queryText, inputValue, unitMode, matchedFood, candidateFoods } = params;
  const safeInput = Number.isFinite(inputValue) && inputValue > 0 ? inputValue : 0;
  const needsFoodSelection = candidateFoods.length > 1 && !matchedFood;
  const needsUnitSelection = unitMode === 'missing_unit';

  if (!matchedFood || safeInput <= 0) {
    return {
      queryText,
      inputValue: safeInput,
      unitMode,
      matchedFood: null,
      candidateFoods,
      needsUnitSelection,
      needsFoodSelection,
      hasInvalidFoodCalories: false,
      grams: 0,
      calculatedCalories: 0,
      calculatedProtein: null,
      calculatedFat: null,
      calculatedCarbs: null,
      isMatched: false,
      isEstimate: false,
    };
  }

  const foodCaloriesPer100g = matchedFood.calories;
  const hasValidFoodCalories =
    typeof foodCaloriesPer100g === 'number' &&
    Number.isFinite(foodCaloriesPer100g) &&
    foodCaloriesPer100g > 0;

  if (!hasValidFoodCalories) {
    return {
      queryText,
      inputValue: safeInput,
      unitMode,
      matchedFood,
      candidateFoods,
      needsUnitSelection,
      needsFoodSelection: false,
      hasInvalidFoodCalories: true,
      grams: 0,
      calculatedCalories: 0,
      calculatedProtein: null,
      calculatedFat: null,
      calculatedCarbs: null,
      isMatched: false,
      isEstimate: false,
    };
  }

  if (needsUnitSelection) {
    return {
      queryText,
      inputValue: safeInput,
      unitMode,
      matchedFood,
      candidateFoods,
      needsUnitSelection: true,
      needsFoodSelection: false,
      hasInvalidFoodCalories: false,
      grams: 0,
      calculatedCalories: 0,
      calculatedProtein: null,
      calculatedFat: null,
      calculatedCarbs: null,
      isMatched: false,
      isEstimate: false,
    };
  }

  if (unitMode === 'grams') {
    const grams = safeInput;
    const calculatedCalories = (foodCaloriesPer100g * grams) / 100;
    const calculatedProtein =
      matchedFood.protein !== null && Number.isFinite(matchedFood.protein)
        ? (matchedFood.protein * grams) / 100
        : null;
    const calculatedFat =
      matchedFood.fat !== null && Number.isFinite(matchedFood.fat)
        ? (matchedFood.fat * grams) / 100
        : null;
    const calculatedCarbs =
      matchedFood.carbs !== null && Number.isFinite(matchedFood.carbs)
        ? (matchedFood.carbs * grams) / 100
        : null;

    return {
      queryText,
      inputValue: safeInput,
      unitMode: 'grams',
      matchedFood,
      candidateFoods,
      needsUnitSelection: false,
      needsFoodSelection: false,
      hasInvalidFoodCalories: false,
      grams,
      calculatedCalories,
      calculatedProtein,
      calculatedFat,
      calculatedCarbs,
      isMatched: true,
      isEstimate: false,
    };
  }

  // unitMode === 'calories'
  // Rumus:
  // - Gram = kalori yang diminta ÷ kalori per 100 g × 100
  // - Setiap makro = makro per 100 g × gram hasil perhitungan ÷ 100
  const grams = (safeInput / foodCaloriesPer100g) * 100;
  const calculatedCalories = safeInput;
  const calculatedProtein =
    matchedFood.protein !== null && Number.isFinite(matchedFood.protein)
      ? (matchedFood.protein * grams) / 100
      : null;
  const calculatedFat =
    matchedFood.fat !== null && Number.isFinite(matchedFood.fat)
      ? (matchedFood.fat * grams) / 100
      : null;
  const calculatedCarbs =
    matchedFood.carbs !== null && Number.isFinite(matchedFood.carbs)
      ? (matchedFood.carbs * grams) / 100
      : null;

  return {
    queryText,
    inputValue: safeInput,
    unitMode: 'calories',
    matchedFood,
    candidateFoods,
    needsUnitSelection: false,
    needsFoodSelection: false,
    hasInvalidFoodCalories: false,
    grams,
    calculatedCalories,
    calculatedProtein,
    calculatedFat,
    calculatedCarbs,
    isMatched: true,
    isEstimate: false,
  };
}

function classifyUnitToken(rawUnit: string | undefined): QuickLogUnitMode | 'invalid_unit' {
  if (!rawUnit || !rawUnit.trim()) return 'missing_unit';
  const norm = rawUnit.toLowerCase().trim();
  if (norm === 'g' || norm === 'gr' || norm === 'gram' || norm === 'grams') {
    return 'grams';
  }
  if (norm === 'kkal' || norm === 'kcal' || norm === 'kalori') {
    return 'calories';
  }
  return 'invalid_unit';
}

export function parseQuickLogText(
  inputText: string,
  foods: FoodItem[]
): {
  items: ParsedQuickLogItem[];
  unmatchedQueries: string[];
} {
  const cleanInput = inputText.trim();
  if (!cleanInput) return { items: [], unmatchedQueries: [] };

  const segments: Array<{
    nameQuery: string;
    inputValue: number;
    unitMode: QuickLogUnitMode;
  }> = [];

  // Split by explicit comma, semicolon, or newline first
  const chunks = cleanInput
    .split(/[,;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  // Inside each chunk, tokenize chained "<food name> <number> [unit]" patterns
  const chainedPattern =
    /([a-zA-Z\u00C0-\u024F\s\(\)\-\.\/&']+?)\s*(\d+(?:[.,]\d+)?)\s*(?:(grams|gram|gr|g|kalori|kkal|kcal)\b)?(?=\s*$|\s+[a-zA-Z\u00C0-\u024F])/gi;

  for (const chunk of chunks) {
    let matchedInChunk = false;
    let match: RegExpExecArray | null;
    chainedPattern.lastIndex = 0;

    while ((match = chainedPattern.exec(chunk)) !== null) {
      const rawName = match[1].replace(/^[,\s]+|[,\s]+$/g, '').trim();
      const rawVal = parseFloat(match[2].replace(',', '.'));
      const rawUnit = match[3];
      const unitMode = classifyUnitToken(rawUnit);

      if (rawName && Number.isFinite(rawVal) && rawVal > 0 && unitMode !== 'invalid_unit') {
        segments.push({
          nameQuery: rawName,
          inputValue: rawVal,
          unitMode,
        });
        matchedInChunk = true;
      }
    }

    if (!matchedInChunk) {
      const fallbackMatch = chunk.match(
        /^(.+?)\s+(\d+(?:[.,]\d+)?)(?:\s*(grams|gram|gr|g|kalori|kkal|kcal))?$/i
      );
      if (fallbackMatch) {
        const rawName = fallbackMatch[1].trim();
        const rawVal = parseFloat(fallbackMatch[2].replace(',', '.'));
        const unitMode = classifyUnitToken(fallbackMatch[3]);
        if (rawName && Number.isFinite(rawVal) && rawVal > 0 && unitMode !== 'invalid_unit') {
          segments.push({
            nameQuery: rawName,
            inputValue: rawVal,
            unitMode,
          });
        }
      }
    }
  }

  const results: ParsedQuickLogItem[] = [];
  const unmatched: string[] = [];

  for (const seg of segments) {
    const candidateFoods = findCandidateFoodsInMyFoods(seg.nameQuery, foods);
    const singleMatchedFood = candidateFoods.length === 1 ? candidateFoods[0] : null;

    const item = computeQuickLogItemMetrics({
      queryText: seg.nameQuery,
      inputValue: seg.inputValue,
      unitMode: seg.unitMode,
      matchedFood: singleMatchedFood,
      candidateFoods,
    });

    results.push(item);
    if (candidateFoods.length === 0) {
      unmatched.push(seg.nameQuery);
    }
  }

  return { items: results, unmatchedQueries: unmatched };
}

/**
 * Duplicate Detector
 * Detects whether an existing food is similar in name or aliases
 */
export function detectSimilarFood(
  candidateName: string,
  foods: FoodItem[],
  excludeId?: string
): FoodItem | null {
  const norm = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm) return null;

  for (const f of foods) {
    if (excludeId && f.id === excludeId) continue;
    const fNorm = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (fNorm === norm) return f;

    // Check aliases
    for (const a of f.aliases) {
      const aNorm = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (aNorm === norm) return f;
    }
  }
  return null;
}

/**
 * Smart Remaining Macro Calculator
 * Finds combinations of 1 or 2 foods in the user's DB to fill remaining calories & macros
 */
export interface MacroSuggestion {
  foods: Array<{
    food: FoodItem;
    grams: number;
    calories: number;
    protein: number | null;
  }>;
  totalCalories: number;
  totalProtein: number;
  calorieDifference: number;
  proteinDifference: number;
}

export function suggestRemainingFoods(
  foods: FoodItem[],
  remainingCalories: number,
  remainingProtein: number,
  toleranceCalories = 100
): MacroSuggestion[] {
  if (foods.length === 0 || remainingCalories <= 20) return [];

  const suggestions: MacroSuggestion[] = [];

  // Filter foods that have calories > 0
  const validFoods = foods.filter((f) => f.calories > 0);

  // Single food solution
  for (const food of validFoods) {
    const idealGrams = Math.round((remainingCalories / food.calories) * 100);
    if (idealGrams >= 20 && idealGrams <= 500) {
      const macros = calculateMacrosForGrams(food, idealGrams);
      const calDiff = Math.abs(macros.calories - remainingCalories);
      const protDiff = Math.abs((macros.protein || 0) - remainingProtein);

      if (calDiff <= toleranceCalories * 1.5) {
        suggestions.push({
          foods: [{ food, grams: idealGrams, calories: macros.calories, protein: macros.protein }],
          totalCalories: macros.calories,
          totalProtein: macros.protein || 0,
          calorieDifference: calDiff,
          proteinDifference: protDiff,
        });
      }
    }
  }

  // Two foods combination (e.g. 1 carb source + 1 protein source)
  const proteinRich = validFoods.filter((f) => (f.protein || 0) >= 12);
  const others = validFoods.filter((f) => (f.protein || 0) < 12);

  if (proteinRich.length > 0 && others.length > 0 && remainingCalories > 150) {
    for (const pFood of proteinRich.slice(0, 5)) {
      for (const oFood of others.slice(0, 5)) {
        // Allocate ~50% calories to each or targeted to protein
        const pGrams = Math.round(((remainingProtein / ((pFood.protein || 10) / 100)) * 0.7));
        const pMacros = calculateMacrosForGrams(pFood, Math.max(30, Math.min(300, pGrams)));
        const remCalAfterP = remainingCalories - pMacros.calories;

        if (remCalAfterP > 30) {
          const oGrams = Math.round((remCalAfterP / oFood.calories) * 100);
          if (oGrams >= 30 && oGrams <= 400) {
            const oMacros = calculateMacrosForGrams(oFood, oGrams);
            const totalCal = pMacros.calories + oMacros.calories;
            const totalProt = (pMacros.protein || 0) + (oMacros.protein || 0);

            suggestions.push({
              foods: [
                { food: pFood, grams: pMacros.calories ? Math.max(30, Math.min(300, pGrams)) : 100, calories: pMacros.calories, protein: pMacros.protein },
                { food: oFood, grams: oGrams, calories: oMacros.calories, protein: oMacros.protein }
              ],
              totalCalories: totalCal,
              totalProtein: Math.round(totalProt * 10) / 10,
              calorieDifference: Math.abs(totalCal - remainingCalories),
              proteinDifference: Math.abs(totalProt - remainingProtein),
            });
          }
        }
      }
    }
  }

  // Sort by smallest calorie & protein difference
  suggestions.sort((a, b) => a.calorieDifference * 0.6 + a.proteinDifference * 3 - (b.calorieDifference * 0.6 + b.proteinDifference * 3));
  return suggestions.slice(0, 5);
}


/**
 * Returns YYYY-MM-DD according to the user's local device clock (phone timezone),
 * avoiding UTC offset issues from toISOString().
 */
export function getLocalTodayStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Shifts a YYYY-MM-DD local date string by deltaDays in local time.
 */
export function shiftLocalDateStr(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return getLocalTodayStr();
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
  return getLocalTodayStr(d);
}

/**
 * Formats a YYYY-MM-DD string into readable Indonesian date (e.g. "Rabu, 28 Okt 2026")
 */
export function formatDateID(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Optimal Portion Calculator ("Hitung Porsi")
 * Given a list of user-selected foods and remaining daily calories & macros,
 * computes the optimal gram weight for each selected food that best approaches
 * the remaining calories, protein, fat, and carbs.
 */
export interface PortionSolutionItem {
  food: FoodItem;
  grams: number;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export function solveOptimalPortions(
  selectedFoods: FoodItem[],
  remaining: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  }
): PortionSolutionItem[] {
  if (selectedFoods.length === 0) return [];

  const remCal = Math.max(0, remaining.calories);
  const remProt = Math.max(0, remaining.protein);
  const remFat = Math.max(0, remaining.fat);
  const remCarbs = Math.max(0, remaining.carbs);

  const n = selectedFoods.length;

  // If remaining calories & macros are 0 or negative, default to 50g per item
  if (remCal <= 10 && remProt <= 2 && remFat <= 2 && remCarbs <= 2) {
    return selectedFoods.map((food) => {
      const g = 50;
      const m = calculateMacrosForGrams(food, g);
      return { food, grams: g, ...m };
    });
  }

  // Initialize grams by splitting remaining calories equally across selected foods
  const gramsArr = selectedFoods.map((f) => {
    if (f.calories <= 0) return 100;
    const initG = Math.round(((remCal / n) / f.calories) * 100);
    return Math.max(15, Math.min(600, initG));
  });

  const computeLoss = (gList: number[]) => {
    let totCal = 0;
    let totProt = 0;
    let totFat = 0;
    let totCarbs = 0;
    let hasProt = false;
    let hasFat = false;
    let hasCarbs = false;

    for (let i = 0; i < n; i++) {
      const f = selectedFoods[i];
      const factor = gList[i] / 100;
      totCal += f.calories * factor;
      if (f.protein !== null) {
        totProt += f.protein * factor;
        hasProt = true;
      }
      if (f.fat !== null) {
        totFat += f.fat * factor;
        hasFat = true;
      }
      if (f.carbs !== null) {
        totCarbs += f.carbs * factor;
        hasCarbs = true;
      }
    }

    const calDiff = totCal - remCal;
    // Extra penalty if total calories exceed remaining calories
    const calOverPenalty = calDiff > 0 ? calDiff * calDiff * 1.5 : 0;
    let loss = 2.8 * calDiff * calDiff + calOverPenalty;

    if (hasProt) {
      const protKcalDiff = (totProt - remProt) * 4;
      loss += 2.0 * protKcalDiff * protKcalDiff;
    }
    if (hasFat) {
      const fatKcalDiff = (totFat - remFat) * 9;
      loss += 1.1 * fatKcalDiff * fatKcalDiff;
    }
    if (hasCarbs) {
      const carbsKcalDiff = (totCarbs - remCarbs) * 4;
      loss += 1.1 * carbsKcalDiff * carbsKcalDiff;
    }

    // Small balance regularizer so identical/similar foods share weight reasonably
    const avgG = gList.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) {
      const d = gList[i] - avgG;
      loss += 0.02 * d * d;
    }

    return loss;
  };

  // Coordinate pattern search with decreasing step sizes (50g -> 20g -> 10g -> 5g -> 1g)
  const steps = [50, 20, 10, 5, 1];
  let currentLoss = computeLoss(gramsArr);

  for (const step of steps) {
    let improved = true;
    let iter = 0;
    while (improved && iter < 80) {
      improved = false;
      iter++;
      for (let i = 0; i < n; i++) {
        for (const dir of [1, -1]) {
          const candidateG = gramsArr[i] + dir * step;
          if (candidateG < 5 || candidateG > 1000) continue;
          const prevG = gramsArr[i];
          gramsArr[i] = candidateG;
          const newLoss = computeLoss(gramsArr);
          if (newLoss + 1e-6 < currentLoss) {
            currentLoss = newLoss;
            improved = true;
          } else {
            gramsArr[i] = prevG;
          }
        }
      }
    }
  }

  return selectedFoods.map((food, idx) => {
    const g = Math.max(5, Math.round(gramsArr[idx]));
    const macros = calculateMacrosForGrams(food, g);
    return {
      food,
      grams: g,
      calories: macros.calories,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
    };
  });
}

/**
 * Consecutive day logging streak
 */
export function calculateStreak(dailyLogs: DailyLogItem[], todayDateString: string): number {
  if (dailyLogs.length === 0) return 0;

  const datesWithLogs = new Set(dailyLogs.map((l) => l.date));
  let streak = 0;
  let checkDateStr = todayDateString;

  if (!datesWithLogs.has(checkDateStr)) {
    // Check yesterday in local time
    checkDateStr = shiftLocalDateStr(todayDateString, -1);
  }

  while (true) {
    if (datesWithLogs.has(checkDateStr)) {
      streak++;
      checkDateStr = shiftLocalDateStr(checkDateStr, -1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Formats a weight number in Indonesian decimal format (e.g. 68.8 -> "68,8")
 */
export function formatWeightID(weightKg: number): string {
  const rounded = Math.round(weightKg * 10) / 10;
  return rounded.toLocaleString('id-ID', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Calculates 7-day weight average and recorded day count for the 7-day window [today - 6 days .. today],
 * plus comparison against the previous 7-day window [today - 13 days .. today - 7 days].
 */
export function calculate7DayWeightStats(
  weightHistory: WeightEntry[],
  todayDateString: string
): {
  avgWeightKg: number | null;
  recordedDaysCount: number;
  totalWindowDays: number;
  formattedSummary: string;
  prevAvgWeightKg: number | null;
  prevRecordedDaysCount: number;
  weeklyDiffKg: number | null;
  formattedWeeklyTrend: string;
} {
  const startWindowStr = shiftLocalDateStr(todayDateString, -6);
  const prevEndWindowStr = shiftLocalDateStr(todayDateString, -7);
  const prevStartWindowStr = shiftLocalDateStr(todayDateString, -13);

  const byDateCurrent = new Map<string, WeightEntry>();
  const byDatePrev = new Map<string, WeightEntry>();

  for (const w of weightHistory) {
    if (w.date >= startWindowStr && w.date <= todayDateString) {
      byDateCurrent.set(w.date, w);
    } else if (w.date >= prevStartWindowStr && w.date <= prevEndWindowStr) {
      byDatePrev.set(w.date, w);
    }
  }

  const entries = Array.from(byDateCurrent.values());
  const recordedDaysCount = entries.length;
  const totalWindowDays = 7;

  const prevEntries = Array.from(byDatePrev.values());
  const prevRecordedDaysCount = prevEntries.length;
  const prevAvgWeightKg =
    prevRecordedDaysCount > 0
      ? Math.round(
          (prevEntries.reduce((acc, item) => acc + item.weightKg, 0) / prevRecordedDaysCount) * 10
        ) / 10
      : null;

  if (recordedDaysCount === 0) {
    return {
      avgWeightKg: null,
      recordedDaysCount: 0,
      totalWindowDays,
      formattedSummary: `-- (0/${totalWindowDays} hari tercatat)`,
      prevAvgWeightKg,
      prevRecordedDaysCount,
      weeklyDiffKg: null,
      formattedWeeklyTrend: 'Belum ada data 7 hari lalu',
    };
  }

  const sum = entries.reduce((acc, item) => acc + item.weightKg, 0);
  const avgWeightKg = Math.round((sum / recordedDaysCount) * 10) / 10;
  const formattedAvg = formatWeightID(avgWeightKg);

  let weeklyDiffKg: number | null = null;
  let formattedWeeklyTrend = 'Belum ada data 7 hari lalu';

  if (prevAvgWeightKg !== null) {
    weeklyDiffKg = Math.round((avgWeightKg - prevAvgWeightKg) * 10) / 10;
    if (weeklyDiffKg < 0) {
      formattedWeeklyTrend = `▼ ${formatWeightID(weeklyDiffKg)} kg vs 7 hari lalu`;
    } else if (weeklyDiffKg > 0) {
      formattedWeeklyTrend = `▲ +${formatWeightID(weeklyDiffKg)} kg vs 7 hari lalu`;
    } else {
      formattedWeeklyTrend = 'Stabil (0 kg vs 7 hari lalu)';
    }
  }

  return {
    avgWeightKg,
    recordedDaysCount,
    totalWindowDays,
    formattedSummary: `${formattedAvg} kg. ${recordedDaysCount}/${totalWindowDays} hari tercatat`,
    prevAvgWeightKg,
    prevRecordedDaysCount,
    weeklyDiffKg,
    formattedWeeklyTrend,
  };
}

/**
 * Calculates Goal Weight distance (remaining kg), progress percentage, and realistic ETA based on 7-day trend
 */
export function calculateWeightGoalProjection(
  currentWeightKg: number | null,
  targetWeightKg: number | null | undefined,
  weeklyDiffKg: number | null,
  startWeightKg?: number | null
): {
  hasGoal: boolean;
  targetWeightKg: number | null;
  remainingKg: number | null;
  absRemainingKg: number | null;
  isGoalReached: boolean;
  direction: 'lose' | 'gain' | 'maintain' | null;
  estimatedWeeks: number | null;
  progressPercent: number | null;
  formattedRemaining: string;
  formattedEta: string;
} {
  if (typeof targetWeightKg !== 'number' || !Number.isFinite(targetWeightKg) || targetWeightKg <= 0) {
    return {
      hasGoal: false,
      targetWeightKg: null,
      remainingKg: null,
      absRemainingKg: null,
      isGoalReached: false,
      direction: null,
      estimatedWeeks: null,
      progressPercent: null,
      formattedRemaining: 'Target berat badan belum diatur',
      formattedEta: 'Atur target berat badan untuk melihat estimasi waktu',
    };
  }

  const roundedTarget = Math.round(targetWeightKg * 10) / 10;
  const formattedTarget = formatWeightID(roundedTarget);

  if (typeof currentWeightKg !== 'number' || !Number.isFinite(currentWeightKg) || currentWeightKg <= 0) {
    return {
      hasGoal: true,
      targetWeightKg: roundedTarget,
      remainingKg: null,
      absRemainingKg: null,
      isGoalReached: false,
      direction: null,
      estimatedWeeks: null,
      progressPercent: null,
      formattedRemaining: `Target: ${formattedTarget} kg`,
      formattedEta: 'Catat berat badan terlebih dahulu untuk menghitung sisa kg & estimasi waktu',
    };
  }

  const rawDiff = targetWeightKg - currentWeightKg;
  const remainingKg = Math.round(rawDiff * 10) / 10;
  const absRemainingKg = Math.abs(remainingKg);
  const isGoalReached = absRemainingKg <= 0.1;

  const direction: 'lose' | 'gain' | 'maintain' =
    isGoalReached ? 'maintain' : remainingKg < 0 ? 'lose' : 'gain';

  // Calculate progress percentage if startWeightKg is known and distinct from target
  let progressPercent: number | null = null;
  if (isGoalReached) {
    progressPercent = 100;
  } else if (typeof startWeightKg === 'number' && startWeightKg > 0) {
    const totalSpan = Math.abs(targetWeightKg - startWeightKg);
    if (totalSpan > 0.1) {
      const covered =
        direction === 'lose'
          ? startWeightKg - currentWeightKg
          : currentWeightKg - startWeightKg;
      progressPercent = Math.min(99, Math.max(0, Math.round((covered / totalSpan) * 100)));
    }
  }

  if (isGoalReached) {
    return {
      hasGoal: true,
      targetWeightKg: roundedTarget,
      remainingKg: 0,
      absRemainingKg: 0,
      isGoalReached: true,
      direction: 'maintain',
      estimatedWeeks: 0,
      progressPercent: 100,
      formattedRemaining: `Target ${formattedTarget} kg tercapai!`,
      formattedEta: 'Selamat! Berat badan Anda sudah berada di target.',
    };
  }

  const formattedAbsRemaining = formatWeightID(absRemainingKg);
  const formattedRemaining =
    direction === 'lose'
      ? `Sisa ${formattedAbsRemaining} kg lagi ke ${formattedTarget} kg (turun)`
      : `Sisa ${formattedAbsRemaining} kg lagi ke ${formattedTarget} kg (naik)`;

  let estimatedWeeks: number | null = null;
  let formattedEta = 'Catat berat badan rutin untuk melihat estimasi waktu';

  if (weeklyDiffKg !== null) {
    const isMovingTowardGoal =
      (direction === 'lose' && weeklyDiffKg < -0.05) ||
      (direction === 'gain' && weeklyDiffKg > 0.05);

    if (isMovingTowardGoal) {
      const ratePerWeek = Math.abs(weeklyDiffKg);
      estimatedWeeks = Math.round((absRemainingKg / ratePerWeek) * 10) / 10;
      const formattedRate = formatWeightID(weeklyDiffKg);
      if (estimatedWeeks <= 1) {
        formattedEta = `Estimasi ≤ 1 minggu lagi (laju ${formattedRate} kg/minggu)`;
      } else {
        const formattedWeeks = formatWeightID(estimatedWeeks);
        formattedEta = `Estimasi ~${formattedWeeks} minggu lagi (laju ${
          weeklyDiffKg > 0 ? `+${formattedRate}` : formattedRate
        } kg/minggu)`;
      }
    } else if (Math.abs(weeklyDiffKg) <= 0.05) {
      formattedEta = 'Tren 7 hari stabil — sesuaikan kalori untuk mulai bergerak ke target';
    } else {
      formattedEta =
        direction === 'lose'
          ? 'Tren 7 hari sedang naik — jaga defisit kalori untuk estimasi waktu turun'
          : 'Tren 7 hari sedang turun — tambah surplus kalori untuk estimasi waktu naik';
    }
  }

  return {
    hasGoal: true,
    targetWeightKg: roundedTarget,
    remainingKg,
    absRemainingKg,
    isGoalReached,
    direction,
    estimatedWeeks,
    progressPercent,
    formattedRemaining,
    formattedEta,
  };
}

export const KG_TO_LBS = 2.2046226218;

/**
 * Formats a number to exactly 1 decimal place for display using Indonesian comma (e.g. 123.4588 -> "123,5")
 */
export function formatOneDecimalID(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return rounded.toFixed(1).replace('.', ',');
}

/**
 * Formats a number to 1 decimal place with dot (e.g. 123.4588 -> "123.5")
 */
export function formatOneDecimalDot(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return rounded.toFixed(1);
}

/**
 * Parses positive numeric input supporting both comma (,) and dot (.) decimals.
 * Rejects empty strings, whitespace-only, non-numbers, zero, and negative values.
 */
export function parseFlexiblePositiveNumber(rawInput: string | number): {
  isValid: boolean;
  value: number | null;
  error: string | null;
} {
  if (typeof rawInput === 'number') {
    if (!Number.isFinite(rawInput)) {
      return { isValid: false, value: null, error: 'Input harus berupa angka yang valid.' };
    }
    if (rawInput <= 0) {
      return {
        isValid: false,
        value: null,
        error: 'Nilai harus lebih besar dari 0 (tidak boleh nol atau negatif).',
      };
    }
    return { isValid: true, value: rawInput, error: null };
  }

  const trimmed = String(rawInput ?? '').trim();
  if (!trimmed) {
    return { isValid: false, value: null, error: 'Input kalori tidak boleh kosong.' };
  }

  // Only allow optional sign, digits, and at most one decimal separator ('.' or ',')
  if (!/^[+-]?\d+([.,]\d+)?$/.test(trimmed)) {
    return {
      isValid: false,
      value: null,
      error: 'Input tidak valid. Masukkan angka yang benar (mendukung desimal koma atau titik).',
    };
  }

  const normalized = trimmed.replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return { isValid: false, value: null, error: 'Input harus berupa angka yang valid.' };
  }

  if (parsed <= 0) {
    return {
      isValid: false,
      value: null,
      error: 'Nilai kalori harus lebih besar dari 0 (tidak boleh nol atau negatif).',
    };
  }

  return { isValid: true, value: parsed, error: null };
}

export interface AutoMacroCalculationResult {
  isValid: boolean;
  hasWeight: boolean;
  isNegativeCarbs: boolean;
  error: string | null;
  calories: number | null;
  weightKg: number | null;
  weightLbs: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  carbsGrams: number | null;
  proteinCalories: number | null;
  fatCalories: number | null;
  carbsCalories: number | null;
  minRequiredCalories: number | null;
}

/**
 * Calculates full-precision automatic macros from daily calories and reference weight (kg):
 * - weightLbs = weightKg * 2.2046226218
 * - protein = 0.8 * weightLbs
 * - fat = 0.3 * weightLbs
 * - carbs = (calories - (protein * 4) - (fat * 9)) / 4
 */
export function calculateAutoMacrosFromWeight(
  caloriesInput: string | number,
  weightKgInput: number | null | undefined
): AutoMacroCalculationResult {
  const hasValidWeight =
    typeof weightKgInput === 'number' && Number.isFinite(weightKgInput) && weightKgInput > 0;

  if (!hasValidWeight) {
    const calCheck = parseFlexiblePositiveNumber(caloriesInput);
    return {
      isValid: false,
      hasWeight: false,
      isNegativeCarbs: false,
      error: 'Belum ada berat badan acuan. Silakan isi berat badan Anda terlebih dahulu.',
      calories: calCheck.value,
      weightKg: null,
      weightLbs: null,
      proteinGrams: null,
      fatGrams: null,
      carbsGrams: null,
      proteinCalories: null,
      fatCalories: null,
      carbsCalories: null,
      minRequiredCalories: null,
    };
  }

  const weightKg = weightKgInput;
  const weightLbs = weightKg * KG_TO_LBS;
  const proteinGrams = 0.8 * weightLbs;
  const fatGrams = 0.3 * weightLbs;
  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatGrams * 9;
  const minRequiredCalories = proteinCalories + fatCalories;

  const calParsed = parseFlexiblePositiveNumber(caloriesInput);
  if (!calParsed.isValid || calParsed.value === null) {
    return {
      isValid: false,
      hasWeight: true,
      isNegativeCarbs: false,
      error: calParsed.error,
      calories: null,
      weightKg,
      weightLbs,
      proteinGrams,
      fatGrams,
      carbsGrams: null,
      proteinCalories,
      fatCalories,
      carbsCalories: null,
      minRequiredCalories,
    };
  }

  const calories = calParsed.value;
  const carbsCalories = calories - proteinCalories - fatCalories;
  const carbsGrams = carbsCalories / 4;

  if (carbsGrams < 0) {
    return {
      isValid: false,
      hasWeight: true,
      isNegativeCarbs: true,
      error: `Peringatan: Sisa kalori menghasilkan karbohidrat negatif (${formatOneDecimalID(
        carbsGrams
      )} g). Kalori minimal untuk berat ${formatOneDecimalID(
        weightKg
      )} kg adalah ${formatOneDecimalID(minRequiredCalories)} kkal.`,
      calories,
      weightKg,
      weightLbs,
      proteinGrams,
      fatGrams,
      carbsGrams,
      proteinCalories,
      fatCalories,
      carbsCalories,
      minRequiredCalories,
    };
  }

  return {
    isValid: true,
    hasWeight: true,
    isNegativeCarbs: false,
    error: null,
    calories,
    weightKg,
    weightLbs,
    proteinGrams,
    fatGrams,
    carbsGrams,
    proteinCalories,
    fatCalories,
    carbsCalories,
    minRequiredCalories,
  };
}

/**
 * Returns the most recent weight entry from weightHistory (sorted by date descending, then latest entry).
 */
export function getLatestWeightEntry(weightHistory: WeightEntry[]): WeightEntry | null {
  if (!Array.isArray(weightHistory) || weightHistory.length === 0) return null;
  const indexed = weightHistory.map((item, idx) => ({ item, idx }));
  indexed.sort((a, b) => {
    const cmp = b.item.date.localeCompare(a.item.date);
    if (cmp !== 0) return cmp;
    return b.idx - a.idx;
  });
  return indexed[0].item;
}

/**
 * Resolves the effective target for a given date from targetHistory without mutating older target snapshots.
 * If no targetHistory snapshot exists yet and a reference weight is available (either on currentTargets or in weightHistory),
 * automatically computes the synchronized macro targets from calories and weight.
 */
export function resolveTargetForDate(
  dateStr: string,
  currentTargets: DailyTargets,
  targetHistory: TargetHistoryEntry[],
  weightHistory?: WeightEntry[]
): DailyTargets {
  if (!Array.isArray(targetHistory) || targetHistory.length === 0) {
    const latestWeight = weightHistory ? getLatestWeightEntry(weightHistory) : null;
    const refWeightKg =
      typeof currentTargets.referenceWeightKg === 'number' && currentTargets.referenceWeightKg > 0
        ? currentTargets.referenceWeightKg
        : latestWeight?.weightKg ?? null;

    if (refWeightKg !== null && refWeightKg > 0) {
      const auto = calculateAutoMacrosFromWeight(currentTargets.calories, refWeightKg);
      if (
        auto.isValid &&
        auto.calories !== null &&
        auto.proteinGrams !== null &&
        auto.fatGrams !== null &&
        auto.carbsGrams !== null &&
        auto.weightKg !== null &&
        auto.weightLbs !== null
      ) {
        return {
          ...currentTargets,
          calories: auto.calories,
          protein: auto.proteinGrams,
          fat: auto.fatGrams,
          carbs: auto.carbsGrams,
          macroMode: 'auto_bodyweight',
          effectiveDate: currentTargets.effectiveDate || dateStr,
          referenceWeightKg: auto.weightKg,
          referenceWeightDate:
            currentTargets.referenceWeightDate || latestWeight?.date || dateStr,
          referenceWeightLbs: auto.weightLbs,
        };
      }
    }
    return currentTargets;
  }

  const indexed = targetHistory.map((entry, idx) => ({ entry, idx }));
  indexed.sort((a, b) => {
    const cmp = a.entry.effectiveDate.localeCompare(b.entry.effectiveDate);
    if (cmp !== 0) return cmp;
    return a.idx - b.idx;
  });

  const matching = indexed.filter((item) => item.entry.effectiveDate <= dateStr);
  const chosen =
    matching.length > 0 ? matching[matching.length - 1].entry : indexed[0].entry;

  return {
    calories: chosen.calories,
    protein: chosen.protein,
    fat: chosen.fat,
    carbs: chosen.carbs,
    macroMode: 'auto_bodyweight',
    effectiveDate: chosen.effectiveDate,
    referenceWeightKg: chosen.referenceWeightKg,
    referenceWeightDate: chosen.referenceWeightDate,
    referenceWeightLbs: chosen.referenceWeightLbs,
    savedAt: chosen.savedAt,
  };
}

export interface PhotoNutritionResult {
  foodName: string;
  portionGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  basis: 'portion' | 'per100g';
  confidenceNote?: string;
}

/**
 * Normalizes and validates raw photo nutrition extraction output so it strictly
 * contains accurate Calories, Protein, Carbs, and Fat values.
 */
export function normalizePhotoNutritionResult(raw: unknown): PhotoNutritionResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.isReadable === false) {
    return null;
  }

  const toNonNegNumber = (val: unknown): number => {
    if (typeof val === 'number' && Number.isFinite(val)) {
      return Math.max(0, val);
    }
    if (typeof val === 'string') {
      const cleaned = val.replace(',', '.').replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleaned);
      if (Number.isFinite(parsed)) return Math.max(0, parsed);
    }
    return 0;
  };

  const rawProtein = Math.round(toNonNegNumber(obj.protein) * 10) / 10;
  const rawCarbs = Math.round(toNonNegNumber(obj.carbs) * 10) / 10;
  const rawFat = Math.round(toNonNegNumber(obj.fat) * 10) / 10;
  let rawCalories = Math.round(toNonNegNumber(obj.calories));

  const atwaterEstimate = Math.round(rawProtein * 4 + rawCarbs * 4 + rawFat * 9);

  // If calories were missing/0 but macros were read, derive from Atwater 4-4-9
  if (rawCalories <= 0 && atwaterEstimate > 0) {
    rawCalories = atwaterEstimate;
  }

  if (rawCalories <= 0 && rawProtein <= 0 && rawCarbs <= 0 && rawFat <= 0) {
    return null;
  }

  const rawGrams = toNonNegNumber(obj.portionGrams);
  const portionGrams = rawGrams > 0 ? Math.round(rawGrams * 10) / 10 : 100;

  const rawName = typeof obj.foodName === 'string' ? obj.foodName.trim() : '';
  const foodName = rawName.length > 0 ? rawName : 'Makanan dari Foto';

  const basis: 'portion' | 'per100g' =
    obj.basis === 'per100g' || Math.abs(portionGrams - 100) < 0.01 ? 'per100g' : 'portion';

  const confidenceNote =
    typeof obj.confidenceNote === 'string' && obj.confidenceNote.trim().length > 0
      ? obj.confidenceNote.trim()
      : undefined;

  return {
    foodName,
    portionGrams,
    calories: rawCalories,
    protein: rawProtein,
    carbs: rawCarbs,
    fat: rawFat,
    basis,
    confidenceNote,
  };
}

/**
 * Scales a scanned PhotoNutritionResult to any target gram weight and also returns
 * normalized per-100g values for saving to MyFood.
 */
export function scalePhotoNutritionByGrams(
  base: PhotoNutritionResult,
  targetGrams: number
): {
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
} {
  const safeBaseGrams = base.portionGrams > 0 ? base.portionGrams : 100;
  const safeTargetGrams = targetGrams > 0 ? targetGrams : safeBaseGrams;
  const ratio = safeTargetGrams / safeBaseGrams;
  const per100Ratio = 100 / safeBaseGrams;

  return {
    grams: Math.round(safeTargetGrams * 10) / 10,
    calories: Math.round(base.calories * ratio),
    protein: Math.round(base.protein * ratio * 10) / 10,
    carbs: Math.round(base.carbs * ratio * 10) / 10,
    fat: Math.round(base.fat * ratio * 10) / 10,
    per100g: {
      calories: Math.round(base.calories * per100Ratio),
      protein: Math.round(base.protein * per100Ratio * 10) / 10,
      carbs: Math.round(base.carbs * per100Ratio * 10) / 10,
      fat: Math.round(base.fat * per100Ratio * 10) / 10,
    },
  };
}

/**
 * Parses nutrition label text or app screenshot text into strictly the 4 core macros:
 * Calories, Protein, Carbs, and Fat (plus serving grams and food name).
 */
export function parseNutritionTextToCoreMacros(rawText: string): PhotoNutritionResult | null {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  // Serving size
  let portionGrams = 100;
  const servingMatch = text.match(
    /(?:takaran saji|serving size|ukuran sajian|sajian|porsi|berat)[\s:]*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram|ml)\b/i
  );
  if (servingMatch) {
    portionGrams = parseFloat(servingMatch[1].replace(',', '.')) || 100;
  }

  // Calories
  let calories = 0;
  const calLabelMatch = text.match(
    /(?:energi total|total energi|energi|kalori|calories|energy)[\s:]*(\d+(?:[.,]\d+)?)\s*(?:kkal|kcal|kal)?/i
  );
  const calUnitMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kkal|kcal)\b/i);
  if (calLabelMatch) {
    calories = Math.round(parseFloat(calLabelMatch[1].replace(',', '.')) || 0);
  } else if (calUnitMatch) {
    calories = Math.round(parseFloat(calUnitMatch[1].replace(',', '.')) || 0);
  }

  // Protein
  let protein = 0;
  const protMatch =
    text.match(/protein[\s:]*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)?/i) ||
    text.match(/\bP\s*(\d+(?:[.,]\d+)?)\b/i);
  if (protMatch) {
    protein = Math.round((parseFloat(protMatch[1].replace(',', '.')) || 0) * 10) / 10;
  }

  // Fat
  let fat = 0;
  const fatMatch =
    text.match(/(?:lemak total|total fat|lemak|fat)[\s:]*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)?/i) ||
    text.match(/\b(?:L|F)\s*(\d+(?:[.,]\d+)?)\b/i);
  if (fatMatch) {
    fat = Math.round((parseFloat(fatMatch[1].replace(',', '.')) || 0) * 10) / 10;
  }

  // Carbs
  let carbs = 0;
  const carbsMatch =
    text.match(
      /(?:karbohidrat total|total carbohydrate|karbohidrat|karbo|carbohydrates|carbs|carb)[\s:]*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)?/i
    ) || text.match(/\b(?:K|C)\s*(\d+(?:[.,]\d+)?)\b/i);
  if (carbsMatch) {
    carbs = Math.round((parseFloat(carbsMatch[1].replace(',', '.')) || 0) * 10) / 10;
  }

  return normalizePhotoNutritionResult({
    isReadable: true,
    foodName: 'Makanan',
    portionGrams,
    calories,
    protein,
    carbs,
    fat,
    basis: portionGrams === 100 ? 'per100g' : 'portion',
  });
}





