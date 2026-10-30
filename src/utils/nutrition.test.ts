import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyAtwater,
  calculate7DayWeightStats,
  calculateAutoMacrosFromWeight,
  parseFlexiblePositiveNumber,
  formatOneDecimalID,
  resolveTargetForDate,
  getLatestWeightEntry,
  calculateWeightGoalProjection,
  normalizePhotoNutritionResult,
  scalePhotoNutritionByGrams,
  parseNutritionTextToCoreMacros,
  parseQuickLogText,
  computeQuickLogItemMetrics,
  formatQuickLogNumberID,
} from './nutrition.ts';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TARGETS,
  verifyLockPassword,
  resetLockPassword,
  recordTargetHistorySnapshot,
} from './storage.ts';
import { FoodItem } from '../types/index.ts';

test('verifyAtwater correctly identifies consistent calorie vs macro values', () => {
  // 20g protein (80 kcal), 5g fat (45 kcal), 10g carbs (40 kcal) = 165 kcal
  const result = verifyAtwater(165, 20, 5, 10);
  assert.equal(result.isConsistent, true);
  assert.equal(result.estimatedCalories, 165);
});

test('verifyAtwater handles partial/unknown macros without treating them as zero proof', () => {
  // Unknown carbs and fat, only protein known
  const result = verifyAtwater(200, 25, null, null);
  assert.equal(result.isConsistent, true);
  assert.match(result.message, /sebagian/i);
});

test('verifyAtwater flags severe discrepancies exceeding 20% tolerance', () => {
  // Stated: 100 kcal, but macros: 50g fat = 450 kcal
  const result = verifyAtwater(100, 0, 50, 0);
  assert.equal(result.isConsistent, false);
  assert.ok(result.differencePercent !== null && result.differencePercent > 20);
});

test('DEFAULT_SETTINGS enforces lockNutritionData, lockNutritionTargets, and default lockPassword', () => {
  assert.equal(DEFAULT_SETTINGS.lockNutritionData, true);
  assert.equal(DEFAULT_SETTINGS.lockNutritionTargets, true);
  assert.equal(DEFAULT_SETTINGS.lockPassword, '1234');
});

test('verifyLockPassword and resetLockPassword validate and reset password properly', () => {
  assert.equal(verifyLockPassword('1234', DEFAULT_SETTINGS), true);
  assert.equal(verifyLockPassword('wrong', DEFAULT_SETTINGS), false);

  const customSettings = resetLockPassword(DEFAULT_SETTINGS, '9988');
  assert.equal(verifyLockPassword('9988', customSettings), true);
  assert.equal(verifyLockPassword('1234', customSettings), false);

  const resetToDefault = resetLockPassword(customSettings, '1234');
  assert.equal(verifyLockPassword('1234', resetToDefault), true);
});

test('DEFAULT_TARGETS contains valid target values with 1900 kcal default', () => {
  assert.equal(DEFAULT_TARGETS.calories, 1900);
  assert.ok(DEFAULT_TARGETS.protein > 0);
  assert.ok(DEFAULT_TARGETS.fat > 0);
  assert.ok(DEFAULT_TARGETS.carbs > 0);
});

test('calculate7DayWeightStats formats 7-day average with recorded day count and weekly trend vs prior 7 days', () => {
  const statsSingle = calculate7DayWeightStats(
    [{ id: '1', date: '2026-10-29', weightKg: 68.8 }],
    '2026-10-29'
  );
  assert.equal(statsSingle.avgWeightKg, 68.8);
  assert.equal(statsSingle.recordedDaysCount, 1);
  assert.equal(statsSingle.formattedSummary, '68,8 kg. 1/7 hari tercatat');
  assert.equal(statsSingle.weeklyDiffKg, null);

  // With prior week data (e.g. 2026-10-20 had 69.2 kg -> current week 68.8 kg = -0.4 kg)
  const statsWithPrevWeek = calculate7DayWeightStats(
    [
      { id: 'w_prev', date: '2026-10-20', weightKg: 69.2 },
      { id: 'w_curr', date: '2026-10-29', weightKg: 68.8 },
    ],
    '2026-10-29'
  );
  assert.equal(statsWithPrevWeek.prevAvgWeightKg, 69.2);
  assert.equal(statsWithPrevWeek.weeklyDiffKg, -0.4);
  assert.equal(statsWithPrevWeek.formattedWeeklyTrend, '▼ -0,4 kg vs 7 hari lalu');

  const statsEmpty = calculate7DayWeightStats([], '2026-10-29');
  assert.equal(statsEmpty.avgWeightKg, null);
  assert.equal(statsEmpty.recordedDaysCount, 0);
  assert.equal(statsEmpty.formattedSummary, '-- (0/7 hari tercatat)');
});

test('Mandatory Test: weight 70 kg, target 2000 kcal -> protein ~123,5 g, fat 46,3 g, carbs 272,4 g with full precision', () => {
  const res = calculateAutoMacrosFromWeight('2000', 70);
  assert.equal(res.isValid, true);
  assert.equal(res.hasWeight, true);
  assert.equal(res.isNegativeCarbs, false);
  assert.equal(res.error, null);

  // Full precision checks:
  // 70 * 2.2046226218 = 154.323583526 lbs
  assert.ok(res.weightLbs !== null && Math.abs(res.weightLbs - 154.323583526) < 1e-9);
  // protein = 0.8 * 154.323583526 = 123.4588668208 g
  assert.ok(res.proteinGrams !== null && Math.abs(res.proteinGrams - 123.4588668208) < 1e-9);
  // fat = 0.3 * 154.323583526 = 46.2970750578 g
  assert.ok(res.fatGrams !== null && Math.abs(res.fatGrams - 46.2970750578) < 1e-9);
  // carbs = [2000 - (123.4588668208 * 4) - (46.2970750578 * 9)] / 4 = 272.37271429915 g
  assert.ok(res.carbsGrams !== null && Math.abs(res.carbsGrams - 272.37271429915) < 1e-9);

  // Rounded display (1 decimal):
  assert.equal(formatOneDecimalID(res.proteinGrams!), '123,5');
  assert.equal(formatOneDecimalID(res.fatGrams!), '46,3');
  assert.equal(formatOneDecimalID(res.carbsGrams!), '272,4');
});

test('Decimal comma and dot support + live calorie changes', () => {
  const commaRes = calculateAutoMacrosFromWeight('1887,5', 70);
  const dotRes = calculateAutoMacrosFromWeight('1887.5', 70);
  assert.equal(commaRes.isValid, true);
  assert.equal(dotRes.isValid, true);
  assert.equal(commaRes.calories, 1887.5);
  assert.equal(dotRes.calories, 1887.5);
  assert.equal(commaRes.carbsGrams, dotRes.carbsGrams);
  // [1887.5 - 910.5091428034] / 4 = 244.24771429915 -> "244,2"
  assert.equal(formatOneDecimalID(commaRes.carbsGrams!), '244,2');
});

test('Negative carbs detection blocks validation and provides warning message', () => {
  // For 70 kg, protein+fat calories = 910.50914 kcal. At 800 kcal, carbs = -27.6272857 g
  const lowCalRes = calculateAutoMacrosFromWeight('800', 70);
  assert.equal(lowCalRes.isValid, false);
  assert.equal(lowCalRes.isNegativeCarbs, true);
  assert.ok(lowCalRes.carbsGrams !== null && lowCalRes.carbsGrams < 0);
  assert.equal(formatOneDecimalID(lowCalRes.carbsGrams!), '-27,6');
  assert.match(lowCalRes.error || '', /karbohidrat negatif/i);
});

test('Rejects empty, zero, negative, non-numeric inputs, and missing reference weight', () => {
  assert.equal(parseFlexiblePositiveNumber('').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('   ').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('0').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('0,0').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('-500').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('-12,5').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('abc').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('2000kcal').isValid, false);
  assert.equal(parseFlexiblePositiveNumber('12,3,4').isValid, false);

  const noWeightRes = calculateAutoMacrosFromWeight('2000', null);
  assert.equal(noWeightRes.isValid, false);
  assert.equal(noWeightRes.hasWeight, false);
  assert.match(noWeightRes.error || '', /belum ada berat badan/i);
});

test('Repeated saves and historical target immutability across target & weight changes', () => {
  const calc1 = calculateAutoMacrosFromWeight('2000', 70);
  let history = recordTargetHistorySnapshot([], {
    effectiveDate: '2026-10-28',
    calories: calc1.calories!,
    protein: calc1.proteinGrams!,
    fat: calc1.fatGrams!,
    carbs: calc1.carbsGrams!,
    referenceWeightKg: 70,
    referenceWeightDate: '2026-10-28',
    referenceWeightLbs: calc1.weightLbs!,
  });
  assert.equal(history.length, 1);

  // Repeated save with identical parameters does not duplicate row
  history = recordTargetHistorySnapshot(history, {
    effectiveDate: '2026-10-28',
    calories: calc1.calories!,
    protein: calc1.proteinGrams!,
    fat: calc1.fatGrams!,
    carbs: calc1.carbsGrams!,
    referenceWeightKg: 70,
    referenceWeightDate: '2026-10-28',
    referenceWeightLbs: calc1.weightLbs!,
  });
  assert.equal(history.length, 1);

  // Next day: weight changes to 68.8 kg and target changes to 1900 kcal
  const calc2 = calculateAutoMacrosFromWeight('1900', 68.8);
  history = recordTargetHistorySnapshot(history, {
    effectiveDate: '2026-10-29',
    calories: calc2.calories!,
    protein: calc2.proteinGrams!,
    fat: calc2.fatGrams!,
    carbs: calc2.carbsGrams!,
    referenceWeightKg: 68.8,
    referenceWeightDate: '2026-10-29',
    referenceWeightLbs: calc2.weightLbs!,
  });
  assert.equal(history.length, 2);

  // Verify old target on 2026-10-28 is completely unchanged (70 kg, 2000 kcal)
  const resolvedOld = resolveTargetForDate('2026-10-28', DEFAULT_TARGETS, history);
  assert.equal(resolvedOld.calories, 2000);
  assert.equal(resolvedOld.referenceWeightKg, 70);
  assert.equal(formatOneDecimalID(resolvedOld.protein), '123,5');
  assert.equal(formatOneDecimalID(resolvedOld.fat), '46,3');
  assert.equal(formatOneDecimalID(resolvedOld.carbs), '272,4');

  // Verify new target on 2026-10-29 uses the 2026-10-29 snapshot (68.8 kg, 1900 kcal)
  const resolvedNew = resolveTargetForDate('2026-10-29', DEFAULT_TARGETS, history);
  assert.equal(resolvedNew.calories, 1900);
  assert.equal(resolvedNew.referenceWeightKg, 68.8);

  // Latest weight helper picks newest date
  const latestW = getLatestWeightEntry([
    { id: 'w1', date: '2026-10-28', weightKg: 70 },
    { id: 'w2', date: '2026-10-29', weightKg: 68.8 },
  ]);
  assert.equal(latestW?.weightKg, 68.8);
});

test('resolveTargetForDate synchronizes legacy/unsaved targets with weightHistory so Home and Pengaturan always match', () => {
  const legacyTargets = {
    calories: 2000,
    protein: 140,
    fat: 55,
    carbs: 210,
    macroMode: 'auto_bodyweight' as const,
  };
  const synced = resolveTargetForDate(
    '2026-10-29',
    legacyTargets,
    [],
    [{ id: 'w1', date: '2026-10-29', weightKg: 70 }]
  );
  assert.equal(synced.calories, 2000);
  assert.equal(synced.referenceWeightKg, 70);
  assert.equal(formatOneDecimalID(synced.protein), '123,5');
  assert.equal(formatOneDecimalID(synced.fat), '46,3');
  assert.equal(formatOneDecimalID(synced.carbs), '272,4');
});

test('calculateWeightGoalProjection computes remaining kg, progress, and realistic ETA from 7-day trend', () => {
  // Losing weight: current 68.8 kg, goal 65.0 kg -> remaining -3.8 kg (3.8 kg to lose), weeklyDiff -0.4 kg/week -> ~9.5 weeks
  const cutting = calculateWeightGoalProjection(68.8, 65.0, -0.4, 70.0);
  assert.equal(cutting.hasGoal, true);
  assert.equal(cutting.absRemainingKg, 3.8);
  assert.equal(cutting.direction, 'lose');
  assert.equal(cutting.estimatedWeeks, 9.5);
  assert.match(cutting.formattedRemaining, /Sisa 3,8 kg lagi ke 65 kg/);
  assert.match(cutting.formattedEta, /~9,5 minggu lagi/);

  // Goal reached within 0.1 kg
  const reached = calculateWeightGoalProjection(65.05, 65.0, -0.3, 70.0);
  assert.equal(reached.isGoalReached, true);
  assert.equal(reached.progressPercent, 100);
});

test('Photo Tracking: normalizePhotoNutritionResult and scalePhotoNutritionByGrams strictly calculate Calories, Protein, Carb, and Fat', () => {
  const raw = {
    isReadable: true,
    foodName: 'Dada Ayam Panggang',
    portionGrams: 150,
    calories: 248,
    protein: 46.5,
    carbs: 0,
    fat: 5.4,
    basis: 'portion',
  };

  const normalized = normalizePhotoNutritionResult(raw);
  assert.ok(normalized);
  assert.equal(normalized.foodName, 'Dada Ayam Panggang');
  assert.equal(normalized.portionGrams, 150);
  assert.equal(normalized.calories, 248);
  assert.equal(normalized.protein, 46.5);
  assert.equal(normalized.carbs, 0);
  assert.equal(normalized.fat, 5.4);

  // Scale to 300g (2x)
  const scaled = scalePhotoNutritionByGrams(normalized, 300);
  assert.equal(scaled.grams, 300);
  assert.equal(scaled.calories, 496);
  assert.equal(scaled.protein, 93);
  assert.equal(scaled.carbs, 0);
  assert.equal(scaled.fat, 10.8);
  assert.equal(scaled.per100g.calories, 165);
  assert.equal(scaled.per100g.protein, 31);
  assert.equal(scaled.per100g.fat, 3.6);
});

test('Photo Tracking: parseNutritionTextToCoreMacros extracts strictly Calories, Protein, Carb, and Fat', () => {
  const sampleText = `Informasi Nilai Gizi
Takaran Saji: 40g
Energi Total: 160 kkal
Protein: 12g
Karbohidrat Total: 20g
Lemak Total: 3,5g
Natrium: 120mg`;

  const parsed = parseNutritionTextToCoreMacros(sampleText);
  assert.ok(parsed);
  assert.equal(parsed.portionGrams, 40);
  assert.equal(parsed.calories, 160);
  assert.equal(parsed.protein, 12);
  assert.equal(parsed.carbs, 20);
  assert.equal(parsed.fat, 3.5);
});

test('Quick Log: supports gram and calorie inputs from My Foods with full precision (French fries 200g = 280 kkal, 200 kkal = ~142,9 g)', () => {
  // Stored food where 200g = 280 kkal -> per 100g: 140 kkal, P 3.5g, L 7g, K 18g
  const myFoods: FoodItem[] = [
    {
      id: 'ff-1',
      name: 'French fries',
      aliases: ['kentang goreng'],
      calories: 140,
      protein: 3.5,
      fat: 7,
      carbs: 18,
      createdAt: '2026-10-29',
      updatedAt: '2026-10-29',
    },
  ];

  // 1. Input gram: "French fries 200g"
  const gramRes = parseQuickLogText('French fries 200g', myFoods);
  assert.equal(gramRes.items.length, 1);
  const gramItem = gramRes.items[0];
  assert.equal(gramItem.isMatched, true);
  assert.equal(gramItem.isEstimate, false);
  assert.equal(gramItem.unitMode, 'grams');
  assert.equal(gramItem.grams, 200);
  assert.equal(gramItem.calculatedCalories, 280);
  assert.equal(gramItem.calculatedProtein, 7);
  assert.equal(gramItem.calculatedFat, 14);
  assert.equal(gramItem.calculatedCarbs, 36);

  // 2. Input kalori: "French fries 200 kkal" (also test "kcal" and "kalori")
  for (const unit of ['kkal', 'kcal', 'kalori']) {
    const calRes = parseQuickLogText(`French fries 200 ${unit}`, myFoods);
    assert.equal(calRes.items.length, 1);
    const calItem = calRes.items[0];
    assert.equal(calItem.isMatched, true);
    assert.equal(calItem.isEstimate, false); // Never diverted to Estimate!
    assert.equal(calItem.unitMode, 'calories');
    assert.equal(calItem.calculatedCalories, 200);

    // Full precision: 200 / 140 * 100 = 142.85714285714286 g
    const expectedGrams = (200 / 140) * 100;
    assert.ok(Math.abs(calItem.grams - expectedGrams) < 1e-12);
    assert.equal(formatQuickLogNumberID(calItem.grams), '142,9');

    // Macros scaled from full-precision grams:
    // P: 3.5 * 142.85714285714286 / 100 = 5
    // L: 7 * 142.85714285714286 / 100 = 10
    // K: 18 * 142.85714285714286 / 100 = 25.714285714285715 -> displays "25,7"
    assert.ok(calItem.calculatedProtein !== null && Math.abs(calItem.calculatedProtein - 5) < 1e-12);
    assert.ok(calItem.calculatedFat !== null && Math.abs(calItem.calculatedFat - 10) < 1e-12);
    assert.ok(
      calItem.calculatedCarbs !== null &&
        Math.abs(calItem.calculatedCarbs - (18 * expectedGrams) / 100) < 1e-12
    );
    assert.equal(formatQuickLogNumberID(calItem.calculatedCarbs!), '25,7');
  }
});

test('Quick Log: handles missing unit, multiple matching foods, unknown macros (null), and zero/missing food calories', () => {
  const foodsList: FoodItem[] = [
    {
      id: 'f1',
      name: 'French fries Original',
      aliases: [],
      calories: 140,
      protein: 3.5,
      fat: null, // Unknown fat
      carbs: 18,
      createdAt: '2026-10-29',
      updatedAt: '2026-10-29',
    },
    {
      id: 'f2',
      name: 'French fries Spicy',
      aliases: [],
      calories: 160,
      protein: 4,
      fat: 8,
      carbs: 20,
      createdAt: '2026-10-29',
      updatedAt: '2026-10-29',
    },
    {
      id: 'f3',
      name: 'Saus Spesial',
      aliases: [],
      calories: 0, // Zero calories -> cannot convert
      protein: null,
      fat: null,
      carbs: null,
      createdAt: '2026-10-29',
      updatedAt: '2026-10-29',
    },
  ];

  // 1. Multiple matching foods ("French fries 200 kkal") -> asks user to choose food
  const multiRes = parseQuickLogText('French fries 200 kkal', foodsList);
  assert.equal(multiRes.items.length, 1);
  assert.equal(multiRes.items[0].needsFoodSelection, true);
  assert.equal(multiRes.items[0].candidateFoods.length, 2);
  assert.equal(multiRes.items[0].isMatched, false);

  // Once user picks f1 ("French fries Original"), fat remains null (unknown)
  const resolvedF1 = computeQuickLogItemMetrics({
    queryText: multiRes.items[0].queryText,
    inputValue: multiRes.items[0].inputValue,
    unitMode: multiRes.items[0].unitMode,
    matchedFood: foodsList[0],
    candidateFoods: multiRes.items[0].candidateFoods,
  });
  assert.equal(resolvedF1.isMatched, true);
  assert.equal(resolvedF1.calculatedFat, null);
  assert.equal(formatQuickLogNumberID(resolvedF1.grams), '142,9');

  // 2. Missing unit ("French fries Spicy 200") -> asks user to choose gram or kkal
  const noUnitRes = parseQuickLogText('French fries Spicy 200', foodsList);
  assert.equal(noUnitRes.items.length, 1);
  assert.equal(noUnitRes.items[0].unitMode, 'missing_unit');
  assert.equal(noUnitRes.items[0].needsUnitSelection, true);
  assert.equal(noUnitRes.items[0].isMatched, false);

  // 3. Zero calories ("Saus Spesial 100 kkal") -> refuses to fabricate conversion
  const zeroCalRes = parseQuickLogText('Saus Spesial 100 kkal', foodsList);
  assert.equal(zeroCalRes.items.length, 1);
  assert.equal(zeroCalRes.items[0].hasInvalidFoodCalories, true);
  assert.equal(zeroCalRes.items[0].isMatched, false);
  assert.equal(zeroCalRes.items[0].grams, 0);

  // 4. Food not found ("Burger 300 kkal") -> does not fabricate or turn into Estimate
  const notFoundRes = parseQuickLogText('Burger 300 kkal', foodsList);
  assert.equal(notFoundRes.items.length, 1);
  assert.equal(notFoundRes.items[0].isMatched, false);
  assert.equal(notFoundRes.items[0].isEstimate, false);
  assert.equal(notFoundRes.items[0].grams, 0);
});




