/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Scale,
  Calendar,
  Flame,
  TrendingUp,
  AlertTriangle,
  Check,
  X,
  Lock,
  Target,
} from 'lucide-react';
import { DailyLogItem, WeightEntry, DailyTargets, AppSettings } from '../types';
import {
  getLocalTodayStr,
  shiftLocalDateStr,
  formatDateID,
  formatWeightID,
  calculate7DayWeightStats,
  calculateWeightGoalProjection,
  parseFlexiblePositiveNumber,
} from '../utils/nutrition';

interface ProgressViewProps {
  weightHistory: WeightEntry[];
  dailyLogs: DailyLogItem[];
  targets: DailyTargets;
  settings: AppSettings;
  onAddWeight: (weight: number, date: string, notes?: string) => void;
  onDeleteWeight: (id: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  weightHistory,
  dailyLogs,
  targets,
  settings,
  onAddWeight,
  onUpdateSettings,
}) => {
  const [phoneTodayStr, setPhoneTodayStr] = useState<string>(() => getLocalTodayStr());
  const [newWeight, setNewWeight] = useState<number | ''>('');
  const [weightNotes, setWeightNotes] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Goal Weight inline editor state
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [goalInput, setGoalInput] = useState<string>(() =>
    settings.targetWeightKg ? formatWeightID(settings.targetWeightKg) : ''
  );
  const [goalError, setGoalError] = useState<string | null>(null);

  // Automatically shift date according to the phone's local clock (midnight rollover / wake up)
  useEffect(() => {
    const syncDateWithPhone = () => {
      const current = getLocalTodayStr();
      setPhoneTodayStr((prev) => (prev !== current ? current : prev));
    };

    const timer = setInterval(syncDateWithPhone, 10000);
    window.addEventListener('focus', syncDateWithPhone);
    document.addEventListener('visibilitychange', syncDateWithPhone);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', syncDateWithPhone);
      document.removeEventListener('visibilitychange', syncDateWithPhone);
    };
  }, []);

  // Sorted weights by date descending
  const sortedWeightsDesc = [...weightHistory].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = sortedWeightsDesc[0];
  const existingTodayWeight = weightHistory.find((w) => w.date === phoneTodayStr);

  // 7-day average calculation with recorded day count (e.g. "68,8 kg. 1/7 hari tercatat")
  const weightStats7Days = calculate7DayWeightStats(weightHistory, phoneTodayStr);

  // Weight change overall
  const sortedWeightsAsc = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const oldestWeight = sortedWeightsAsc[0];
  const totalWeightDiff =
    latestWeight && oldestWeight && latestWeight.id !== oldestWeight.id
      ? Math.round((latestWeight.weightKg - oldestWeight.weightKg) * 10) / 10
      : null;

  // Goal Weight projection (remaining kg, progress %, and realistic ETA based on 7-day trend)
  const goalProjection = calculateWeightGoalProjection(
    latestWeight ? latestWeight.weightKg : null,
    settings.targetWeightKg,
    weightStats7Days.weeklyDiffKg,
    oldestWeight ? oldestWeight.weightKg : null
  );

  const handleSaveGoalWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFlexiblePositiveNumber(goalInput);
    if (!parsed.isValid || parsed.value === null || parsed.value < 20 || parsed.value > 300) {
      setGoalError('Masukkan target berat badan yang valid (20 – 300 kg).');
      return;
    }
    const roundedGoal = Math.round(parsed.value * 10) / 10;
    onUpdateSettings({
      ...settings,
      targetWeightKg: roundedGoal,
    });
    setGoalError(null);
    setIsEditingGoal(false);
  };

  const handleClearGoalWeight = () => {
    onUpdateSettings({
      ...settings,
      targetWeightKg: null,
    });
    setGoalInput('');
    setGoalError(null);
    setIsEditingGoal(false);
  };

  const handleRequestSaveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const currentPhoneDate = getLocalTodayStr();
    setPhoneTodayStr(currentPhoneDate);
    if (weightHistory.some((w) => w.date === currentPhoneDate)) return;
    if (typeof newWeight !== 'number' || newWeight <= 0) return;
    setShowConfirmModal(true);
  };

  const handleConfirmSaveWeight = () => {
    const currentPhoneDate = getLocalTodayStr();
    setPhoneTodayStr(currentPhoneDate);
    if (weightHistory.some((w) => w.date === currentPhoneDate)) {
      setShowConfirmModal(false);
      return;
    }
    if (typeof newWeight !== 'number' || newWeight <= 0) return;
    onAddWeight(newWeight, currentPhoneDate, weightNotes.trim() || undefined);
    setNewWeight('');
    setWeightNotes('');
    setShowConfirmModal(false);
  };

  // Target calories for chart line (defaults to 1.900 kkal or user's configured target)
  const targetLineCalories = targets.calories > 0 ? targets.calories : 1900;
  const formattedTargetCalories = (Math.round(targetLineCalories * 10) / 10).toLocaleString(
    'id-ID',
    { maximumFractionDigits: 1 }
  );

  // Past 7 days history (both weight & calorie intake) using local phone date
  const last7Days: Array<{
    date: string;
    display: string;
    shortDate: string;
    calories: number;
    hasLogs: boolean;
    target: number;
    weightKg: number | null;
  }> = [];

  for (let i = 6; i >= 0; i--) {
    const dStr = shiftLocalDateStr(phoneTodayStr, -i);
    const parts = dStr.split('-').map(Number);
    const dObj = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    const logs = dailyLogs.filter((l) => l.date === dStr);
    const hasLogs = logs.length > 0;
    const totalCal = logs.reduce((s, it) => s + it.calories, 0);
    const dayLabel = dObj.toLocaleDateString('id-ID', { weekday: 'narrow' });
    const dayNum = String(parts[2] || 1).padStart(2, '0');
    const monthNum = String(parts[1] || 1).padStart(2, '0');
    const shortDate = `${dayNum}/${monthNum}`;
    const weightEntry = weightHistory.find((w) => w.date === dStr);

    last7Days.push({
      date: dStr,
      display: dayLabel,
      shortDate,
      calories: totalCal,
      hasLogs,
      target: targetLineCalories,
      weightKg: weightEntry ? weightEntry.weightKg : null,
    });
  }

  const maxCalorieInChart = Math.max(
    targetLineCalories * 1.25,
    ...last7Days.map((d) => d.calories),
    2300
  );
  const targetLineBottomPercent = Math.min(
    92,
    Math.max(10, Math.round((targetLineCalories / maxCalorieInChart) * 100))
  );

  // Weight Trend Chart domain calculation
  const recordedWeightsIn7Days = last7Days
    .map((d, idx) => (d.weightKg !== null ? { idx, weightKg: d.weightKg, day: d } : null))
    .filter((item): item is { idx: number; weightKg: number; day: (typeof last7Days)[number] } => item !== null);

  const chartDomainWeights = [
    ...recordedWeightsIn7Days.map((w) => w.weightKg),
    ...(goalProjection.hasGoal && goalProjection.targetWeightKg !== null
      ? [goalProjection.targetWeightKg]
      : []),
  ];

  const minWeightInChart =
    chartDomainWeights.length > 0
      ? Math.floor(Math.min(...chartDomainWeights) - 1.5)
      : 60;
  const maxWeightInChart =
    chartDomainWeights.length > 0
      ? Math.ceil(Math.max(...chartDomainWeights) + 1.5)
      : 75;
  const weightRange = Math.max(1, maxWeightInChart - minWeightInChart);

  const getWeightYPercent = (weightKg: number) => {
    // Returns SVG Y coordinate in [18..76] range (top=18, bottom=76)
    const normalized = (weightKg - minWeightInChart) / weightRange;
    return Math.round((76 - normalized * 58) * 10) / 10;
  };

  const getWeightXPercent = (idx: number) => {
    // 7 columns: centers at (idx + 0.5) / 7 * 100
    return Math.round((((idx + 0.5) / 7) * 100) * 10) / 10;
  };

  const polylinePoints = recordedWeightsIn7Days
    .map((pt) => `${getWeightXPercent(pt.idx)},${getWeightYPercent(pt.weightKg)}`)
    .join(' ');

  return (
    <div className="space-y-4 pb-24 pt-2 px-4 max-w-md mx-auto">
      {/* Weight Summary Banner */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Scale size={16} className="text-emerald-400" />
            <span>Berat Badan</span>
          </span>
          <span className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1">
            <Calendar size={12} />
            <span>{formatDateID(phoneTodayStr)}</span>
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-3xl font-black text-white tracking-tight tabular-nums">
              {latestWeight ? formatWeightID(latestWeight.weightKg) : '--'}
              <span className="text-sm font-semibold text-slate-400 ml-1">kg</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Berat Terkini</div>
          </div>

          <div className="text-right">
            <div
              data-testid="avg-7day-weight-summary"
              className="text-base font-bold text-slate-100 tabular-nums"
            >
              {weightStats7Days.formattedSummary}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Rata-rata 7 Hari
              {weightStats7Days.recordedDaysCount > 0 && weightStats7Days.recordedDaysCount < 7 && (
                <span className="block text-[10px] text-amber-400/90">
                  Belum menggambarkan 1 minggu penuh
                </span>
              )}
              <span
                data-testid="weekly-weight-trend-diff"
                className={`block text-[11px] font-semibold mt-0.5 tabular-nums ${
                  weightStats7Days.weeklyDiffKg === null
                    ? 'text-slate-500'
                    : weightStats7Days.weeklyDiffKg < 0
                    ? 'text-emerald-400'
                    : weightStats7Days.weeklyDiffKg > 0
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}
              >
                {weightStats7Days.formattedWeeklyTrend}
              </span>
            </div>
          </div>

          {totalWeightDiff !== null && (
            <div className="text-right">
              <div
                className={`text-lg font-bold tabular-nums ${
                  totalWeightDiff < 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {totalWeightDiff > 0
                  ? `+${formatWeightID(totalWeightDiff)}`
                  : formatWeightID(totalWeightDiff)}{' '}
                kg
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Perubahan Total</div>
            </div>
          )}
        </div>

        {/* Target Berat Badan (Goal Weight) & Estimasi Waktu Tercapai */}
        <div
          data-testid="goal-weight-card"
          className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 min-w-0">
              <Target size={14} className="text-sky-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200 truncate">
                Target Berat Badan
              </span>
              {goalProjection.hasGoal && goalProjection.targetWeightKg !== null && !isEditingGoal && (
                <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-[11px] font-bold text-sky-300 tabular-nums shrink-0">
                  {formatWeightID(goalProjection.targetWeightKg)} kg
                </span>
              )}
            </div>

            {!isEditingGoal && (
              <button
                type="button"
                data-testid="edit-goal-weight-btn"
                onClick={() => {
                  setGoalInput(
                    settings.targetWeightKg ? formatWeightID(settings.targetWeightKg) : ''
                  );
                  setGoalError(null);
                  setIsEditingGoal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-sky-400 shrink-0 transition-all"
              >
                {goalProjection.hasGoal ? 'Ubah' : '+ Atur Target'}
              </button>
            )}
          </div>

          {isEditingGoal ? (
            <form onSubmit={handleSaveGoalWeight} className="space-y-2 pt-1">
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="goal-weight-input"
                    value={goalInput}
                    onChange={(e) => {
                      setGoalInput(e.target.value);
                      if (goalError) setGoalError(null);
                    }}
                    placeholder="Contoh: 63,0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400">kg</span>
                </div>
                <button
                  type="submit"
                  data-testid="save-goal-weight-btn"
                  className="px-3.5 py-2 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold hover:bg-sky-400 active:scale-95 shrink-0"
                >
                  Simpan
                </button>
                {goalProjection.hasGoal && (
                  <button
                    type="button"
                    onClick={handleClearGoalWeight}
                    className="px-2.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/25 shrink-0"
                  >
                    Hapus
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingGoal(false);
                    setGoalError(null);
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-semibold hover:text-white shrink-0"
                >
                  Batal
                </button>
              </div>
              {goalError && <p className="text-[11px] text-rose-400">{goalError}</p>}
            </form>
          ) : goalProjection.hasGoal ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span
                  data-testid="goal-weight-remaining"
                  className={`font-bold tabular-nums ${
                    goalProjection.isGoalReached ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {goalProjection.formattedRemaining}
                </span>
                {goalProjection.progressPercent !== null && (
                  <span className="text-[11px] font-bold text-sky-400 tabular-nums">
                    {goalProjection.progressPercent}%
                  </span>
                )}
              </div>

              {goalProjection.progressPercent !== null && (
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${goalProjection.progressPercent}%` }}
                  />
                </div>
              )}

              <p
                data-testid="goal-weight-eta"
                className="text-[11px] text-slate-400 tabular-nums"
              >
                {goalProjection.formattedEta}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Belum ada target berat badan. Ketuk <strong className="text-sky-400">+ Atur Target</strong> untuk melihat sisa kg dan estimasi waktu tercapai.
            </p>
          )}
        </div>

        {/* Weight Form: Strictly 1x per day */}
        <div className="pt-3 border-t border-slate-800/80">
          {existingTodayWeight ? (
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
                  <Check size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Berat hari ini tercatat: {formatWeightID(existingTodayWeight.weightKg)} kg
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Hanya 1x tambah per hari. Buka kembali besok ({shiftLocalDateStr(phoneTodayStr, 1)}).
                  </span>
                </div>
              </div>
              <Lock size={14} className="text-slate-500 shrink-0 ml-2" />
            </div>
          ) : (
            <form onSubmit={handleRequestSaveWeight} className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>
                  Tanggal otomatis sesuai HP: <strong className="text-slate-200">{phoneTodayStr}</strong>
                </span>
                <span className="text-emerald-400 font-semibold">Maks. 1x / hari</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="300"
                    value={newWeight}
                    onChange={(e) =>
                      setNewWeight(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="Catat berat badan hari ini (kg)..."
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">kg</span>
                </div>

                <button
                  type="submit"
                  disabled={typeof newWeight !== 'number' || newWeight <= 0}
                  className="py-2.5 px-4 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 active:scale-95 disabled:opacity-40 shrink-0"
                >
                  Simpan
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 7-Day Weight Trend Chart (Placed BEFORE Calorie Intake Chart) */}
      <div
        data-testid="weight-trend-chart-card"
        className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp size={16} className="text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Grafik Tren Berat Badan
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {weightStats7Days.recordedDaysCount}/7 hari tercatat
          </span>
        </div>

        <div className="relative pt-2 pb-1">
          {/* SVG Line & Points Layer */}
          <div className="relative h-28 w-full border-b border-slate-800">
            <svg
              viewBox="0 0 100 90"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
            >
              {/* Subtle horizontal guide lines */}
              <line
                x1="0"
                y1="25"
                x2="100"
                y2="25"
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="2 2"
                strokeWidth="0.6"
              />
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="2 2"
                strokeWidth="0.6"
              />
              <line
                x1="0"
                y1="75"
                x2="100"
                y2="75"
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="2 2"
                strokeWidth="0.6"
              />

              {/* Connecting trend line when >= 2 points exist */}
              {recordedWeightsIn7Days.length >= 2 && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />
              )}
            </svg>

            {/* Dashed Goal Weight Line on Weight Trend Chart */}
            {goalProjection.hasGoal && goalProjection.targetWeightKg !== null && (
              <div
                data-testid="weight-goal-line"
                className="absolute left-0 right-0 border-t border-dashed border-sky-400/75 pointer-events-none z-20 flex items-center justify-start pl-1"
                style={{
                  top: `${Math.round((getWeightYPercent(goalProjection.targetWeightKg) / 90) * 100)}%`,
                }}
              >
                <span className="text-[9px] font-bold text-sky-300 bg-slate-950/95 border border-sky-500/40 px-1.5 py-0.5 rounded -translate-y-1/2 tabular-nums whitespace-nowrap">
                  Target {formatWeightID(goalProjection.targetWeightKg)} kg
                </span>
              </div>
            )}

            {/* 7 Day Columns for Weight Points & Values */}
            <div className="relative z-10 h-full flex items-end justify-between px-1">
              {last7Days.map((day) => {
                const hasWeight = day.weightKg !== null;
                const yPct = hasWeight ? getWeightYPercent(day.weightKg!) : 50;
                const topPct = Math.round((yPct / 90) * 100);

                return (
                  <div
                    key={day.date}
                    className="flex-1 relative h-full flex flex-col items-center justify-end"
                  >
                    {hasWeight ? (
                      <div
                        className="absolute flex flex-col items-center -translate-y-1/2"
                        style={{ top: `${topPct}%` }}
                      >
                        <span className="text-[10px] font-bold text-emerald-300 bg-slate-950/90 border border-emerald-500/40 px-1.5 py-0.5 rounded-md mb-1 tabular-nums whitespace-nowrap">
                          {formatWeightID(day.weightKg!)}
                        </span>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20" />
                      </div>
                    ) : (
                      <div className="mb-3 flex flex-col items-center">
                        <span
                          className="text-xs font-bold text-slate-600 select-none"
                          title="Belum ada catatan berat badan"
                        >
                          -
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-Axis Day & Date Labels */}
          <div className="flex items-center justify-between px-1 pt-1.5">
            {last7Days.map((day) => {
              const isTodayCol = day.date === phoneTodayStr;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <span
                    className={`text-[11px] font-bold leading-tight ${
                      isTodayCol ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    {day.display}
                  </span>
                  <span
                    className={`text-[9px] tabular-nums leading-tight ${
                      isTodayCol ? 'text-emerald-400/90 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {day.shortDate}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7-Day Calorie Intake Bar Chart */}
      <div
        data-testid="calorie-intake-chart-card"
        className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <Flame size={16} className="text-amber-400 shrink-0" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate">
              Asupan Kalori 7 Hari
            </h3>
          </div>
          <span className="text-[11px] text-amber-400 font-semibold tabular-nums whitespace-nowrap shrink-0">
            Target: {formattedTargetCalories} kkal
          </span>
        </div>

        {/* Rata-rata Kalori 7 Hari (hanya menghitung hari yang ada catatan makan) */}
        {(() => {
          const loggedDays = last7Days.filter((d) => d.hasLogs);
          const loggedCount = loggedDays.length;
          const avgCalories =
            loggedCount > 0
              ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedCount)
              : null;
          const diffFromTarget =
            avgCalories !== null ? Math.round(avgCalories - targetLineCalories) : null;

          return (
            <div
              data-testid="avg-7day-calorie-summary"
              className="px-3 py-2 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between text-xs"
            >
              <div>
                <span className="text-slate-400">Rata-rata 7 hari: </span>
                <strong className="text-white tabular-nums">
                  {avgCalories !== null ? `${avgCalories.toLocaleString('id-ID')} kkal` : '--'}
                </strong>
                <span className="text-[11px] text-slate-500 ml-1 tabular-nums">
                  ({loggedCount}/7 hari tercatat)
                </span>
              </div>
              {diffFromTarget !== null && (
                <span
                  className={`text-[11px] font-bold tabular-nums ${
                    diffFromTarget <= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {diffFromTarget > 0
                    ? `+${diffFromTarget.toLocaleString('id-ID')}`
                    : diffFromTarget.toLocaleString('id-ID')}{' '}
                  kkal vs target
                </span>
              )}
            </div>
          );
        })()}

        {/* CSS Bar Chart with Target Line & Dates */}
        <div className="pt-2">
          <div className="relative h-36 flex items-end justify-between pt-6 pb-1 px-1 border-b border-slate-800">
            {/* Horizontal Target Line (e.g. 1.900 kkal) */}
            <div
              data-testid="calorie-target-line"
              className="absolute left-0 right-0 border-t-2 border-dashed border-amber-400/75 pointer-events-none z-20 flex items-center justify-end pr-1"
              style={{ bottom: `${targetLineBottomPercent}%` }}
            >
              <span className="text-[9px] font-bold text-amber-300 bg-slate-950/95 border border-amber-500/40 px-1.5 py-0.5 rounded -translate-y-1/2 tabular-nums whitespace-nowrap">
                Target {formattedTargetCalories} kkal
              </span>
            </div>

            {last7Days.map((day, idx) => {
              const heightPercent = day.hasLogs
                ? Math.min(100, Math.round((day.calories / maxCalorieInChart) * 100))
                : 0;
              const isOver = day.hasLogs && day.calories > targetLineCalories;

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-end h-full px-1 relative z-10"
                >
                  {day.hasLogs && (
                    <span
                      className={`text-[10px] font-bold mb-1 tabular-nums ${
                        isOver ? 'text-rose-400' : 'text-slate-300'
                      }`}
                    >
                      {day.calories.toLocaleString('id-ID')}
                    </span>
                  )}
                  <div className="w-full max-w-[28px] bg-slate-800/50 rounded-t-lg overflow-hidden h-full flex items-end justify-center">
                    {day.hasLogs ? (
                      <div
                        className={`w-full rounded-t-lg transition-all duration-300 ${
                          isOver ? 'bg-rose-500' : 'bg-emerald-400'
                        }`}
                        style={{ height: `${Math.max(4, heightPercent)}%` }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-end justify-center pb-2">
                        <span
                          className="text-xs font-bold text-slate-500 select-none"
                          title="Hari tanpa catatan makan"
                        >
                          -
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* X-Axis Day + Date (Tanggal) Labels */}
          <div className="flex items-center justify-between px-1 pt-1.5">
            {last7Days.map((day) => {
              const isTodayBar = day.date === phoneTodayStr;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <span
                    className={`text-[11px] font-bold leading-tight ${
                      isTodayBar ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    {day.display}
                  </span>
                  <span
                    className={`text-[9px] tabular-nums leading-tight ${
                      isTodayBar ? 'text-emerald-400/90 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {day.shortDate}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 px-0.5">
            <span>Tanda &quot;-&quot; = Hari tanpa catatan (bukan 0 kkal)</span>
            <span className="text-amber-400/90">-- Garis Target {formattedTargetCalories} kkal</span>
          </div>
        </div>
      </div>

      {/* Weight Log Table (Permanent - Cannot be deleted) */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Riwayat Timbangan Harian ({weightHistory.length} catatan)
          </h3>
          <span className="text-[10px] text-slate-500 flex items-center space-x-1">
            <Lock size={11} />
            <span>Permanen (1x/Hari)</span>
          </span>
        </div>

        {weightHistory.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            Belum ada catatan berat badan. Masukkan berat badan pertama Anda di atas.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {sortedWeightsDesc.map((w) => (
              <div
                key={w.id}
                className="py-2.5 px-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <Calendar size={13} className="text-slate-500" />
                  <span className="font-semibold text-slate-300">{w.date}</span>
                  {w.notes && <span className="text-slate-500 text-[11px]">({w.notes})</span>}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white tabular-nums">
                    {formatWeightID(w.weightKg)} kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL PERINGATAN KONFIRMASI BERAT BADAN */}
      {showConfirmModal && typeof newWeight === 'number' && !existingTodayWeight && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-amber-500/40 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cek Sebelum Konfirmasi</h3>
                  <p className="text-xs text-slate-400">{formatDateID(phoneTodayStr)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
              <span className="text-xs text-slate-400 block">Berat Badan Hari Ini:</span>
              <div className="text-3xl font-black text-emerald-400 tabular-nums">
                {formatWeightID(newWeight)}{' '}
                <span className="text-base font-bold text-slate-400">kg</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200 leading-relaxed">
              <strong>Peringatan Penting:</strong> Berat badan hanya dapat dicatat <strong>1 kali sehari</strong> dan bersifat <strong>permanen</strong> (tidak dapat diubah atau dihapus). Pastikan angka di atas sudah benar.
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700"
              >
                Cek Lagi / Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveWeight}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 flex items-center justify-center space-x-1"
              >
                <Check size={15} strokeWidth={2.5} />
                <span>Ya, Konfirmasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

