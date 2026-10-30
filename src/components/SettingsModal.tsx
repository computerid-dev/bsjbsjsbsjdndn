/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Settings,
  Download,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Unlock,
  Target,
  KeyRound,
  Scale,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import {
  DailyTargets,
  TargetHistoryEntry,
  WeightEntry,
  AppSettings,
  BackupData,
} from '../types';
import {
  createBackupJson,
  validateBackupFile,
  restoreBackupData,
  getAutoSnapshots,
  USER_PROVIDED_BACKUP,
  verifyLockPassword,
  resetLockPassword,
  recordTargetHistorySnapshot,
  type AutoSnapshot,
} from '../utils/storage';
import {
  getLocalTodayStr,
  calculateAutoMacrosFromWeight,
  getLatestWeightEntry,
  parseFlexiblePositiveNumber,
  formatOneDecimalID,
} from '../utils/nutrition';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: DailyTargets;
  targetHistory: TargetHistoryEntry[];
  weightHistory: WeightEntry[];
  effectiveDate: string;
  settings: AppSettings;
  foodsCount: number;
  isNutritionUnlockedSession?: boolean;
  onUnlockNutritionSession?: () => void;
  onRelockNutritionSession?: () => void;
  onOpenMyFoods: () => void;
  onOpenImportModal: () => void;
  onOpenTools: () => void;
  onUpdateTargets: (targets: DailyTargets, updatedHistory?: TargetHistoryEntry[]) => void;
  onAddWeight: (weight: number, date: string, notes?: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onDataRestored: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  targets,
  targetHistory,
  weightHistory,
  effectiveDate,
  settings,
  isNutritionUnlockedSession = false,
  onUnlockNutritionSession,
  onRelockNutritionSession,
  onUpdateTargets,
  onAddWeight,
  onUpdateSettings,
  onDataRestored,
}) => {
  // Local form state for Automatic Calorie & Macro Target
  const [caloriesInput, setCaloriesInput] = useState<string>(() => String(targets.calories));
  const [initialWeightInput, setInitialWeightInput] = useState<string>('');
  const [initialWeightError, setInitialWeightError] = useState<string | null>(null);
  const [showTargetHistory, setShowTargetHistory] = useState<boolean>(false);

  // Settings preferences
  const [quickLogDirectSave, setQuickLogDirectSave] = useState(settings.quickLogDirectSave);
  const [lockPastDays, setLockPastDays] = useState(settings.lockPastDays);
  const [autoDeductInventory, setAutoDeductInventory] = useState(settings.autoDeductInventory);
  const [lockNutritionData, setLockNutritionData] = useState(settings.lockNutritionData ?? true);
  const [lockNutritionTargets, setLockNutritionTargets] = useState(
    settings.lockNutritionTargets ?? true
  );

  // Single unified password prompt state
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Change / Reset Password State
  const [passwordPanelMode, setPasswordPanelMode] = useState<'none' | 'change' | 'reset'>('none');
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetNewPasswordInput, setResetNewPasswordInput] = useState('1234');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Restore inline confirmation state
  const [pendingRestoreData, setPendingRestoreData] = useState<{
    parsedData: BackupData;
    summary: string;
  } | null>(null);
  const [pasteJsonInput, setPasteJsonInput] = useState('');
  const [showPasteJson, setShowPasteJson] = useState(false);
  const [autoSnapshots, setAutoSnapshots] = useState<AutoSnapshot[]>([]);

  // Muat daftar cadangan otomatis setiap modal dibuka / setelah ada perubahan status
  useEffect(() => {
    if (isOpen) setAutoSnapshots(getAutoSnapshots());
  }, [isOpen, statusMessage]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync local form state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCaloriesInput(
        Number.isInteger(targets.calories)
          ? String(targets.calories)
          : String(Math.round(targets.calories * 10) / 10).replace('.', ',')
      );
      setInitialWeightInput('');
      setInitialWeightError(null);
      setQuickLogDirectSave(settings.quickLogDirectSave);
      setLockPastDays(settings.lockPastDays);
      setAutoDeductInventory(settings.autoDeductInventory);
      setLockNutritionData(settings.lockNutritionData ?? true);
      setLockNutritionTargets(settings.lockNutritionTargets ?? true);
      setIsPasswordPromptOpen(false);
      setPasswordError(null);
      setStatusMessage(null);
    }
  }, [isOpen, targets.calories, settings]);

  if (!isOpen) return null;

  const currentSavedPassword =
    settings.lockPassword && settings.lockPassword.trim().length > 0
      ? settings.lockPassword
      : '1234';
  const isDefaultPassword = currentSavedPassword === '1234';

  const isSessionUnlocked = Boolean(isNutritionUnlockedSession);

  // Latest reference weight from weightHistory
  const latestWeightEntry = getLatestWeightEntry(weightHistory);
  const referenceWeightKg = latestWeightEntry ? latestWeightEntry.weightKg : null;

  // Live full-precision calculation preview whenever caloriesInput or referenceWeightKg changes
  const autoPreview = calculateAutoMacrosFromWeight(caloriesInput, referenceWeightKg);

  const handleTogglePreference = (
    key: 'quickLogDirectSave' | 'lockPastDays' | 'autoDeductInventory',
    nextVal: boolean
  ) => {
    if (key === 'quickLogDirectSave') setQuickLogDirectSave(nextVal);
    if (key === 'lockPastDays') setLockPastDays(nextVal);
    if (key === 'autoDeductInventory') setAutoDeductInventory(nextVal);

    onUpdateSettings({
      ...settings,
      quickLogDirectSave: key === 'quickLogDirectSave' ? nextVal : quickLogDirectSave,
      lockPastDays: key === 'lockPastDays' ? nextVal : lockPastDays,
      autoDeductInventory: key === 'autoDeductInventory' ? nextVal : autoDeductInventory,
      lockNutritionData,
      lockNutritionTargets,
    });
  };

  const handleSaveInitialWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFlexiblePositiveNumber(initialWeightInput);
    if (!parsed.isValid || parsed.value === null) {
      setInitialWeightError(
        parsed.error ||
          'Berat badan tidak valid. Masukkan angka lebih dari 0 (misal 70 atau 68,8).'
      );
      return;
    }
    const todayDate = getLocalTodayStr();
    onAddWeight(parsed.value, todayDate, 'Berat acuan dari Pengaturan');

    const effDate = effectiveDate || todayDate;
    const nowIso = new Date().toISOString();
    const immediatePreview = calculateAutoMacrosFromWeight(caloriesInput, parsed.value);
    if (
      immediatePreview.isValid &&
      immediatePreview.calories !== null &&
      immediatePreview.proteinGrams !== null &&
      immediatePreview.fatGrams !== null &&
      immediatePreview.carbsGrams !== null &&
      immediatePreview.weightKg !== null &&
      immediatePreview.weightLbs !== null
    ) {
      const nextTargets: DailyTargets = {
        calories: immediatePreview.calories,
        protein: immediatePreview.proteinGrams,
        fat: immediatePreview.fatGrams,
        carbs: immediatePreview.carbsGrams,
        macroMode: 'auto_bodyweight',
        effectiveDate: effDate,
        referenceWeightKg: immediatePreview.weightKg,
        referenceWeightDate: todayDate,
        referenceWeightLbs: immediatePreview.weightLbs,
        savedAt: nowIso,
      };
      const nextHistory = recordTargetHistorySnapshot(targetHistory, {
        effectiveDate: effDate,
        savedAt: nowIso,
        calories: immediatePreview.calories,
        protein: immediatePreview.proteinGrams,
        fat: immediatePreview.fatGrams,
        carbs: immediatePreview.carbsGrams,
        referenceWeightKg: immediatePreview.weightKg,
        referenceWeightDate: todayDate,
        referenceWeightLbs: immediatePreview.weightLbs,
      });
      onUpdateTargets(nextTargets, nextHistory);
    }

    setInitialWeightInput('');
    setInitialWeightError(null);
    setStatusMessage(
      `Berat acuan ${formatOneDecimalID(parsed.value)} kg disimpan & target disinkronkan.`
    );
  };

  const applyAndSaveAutoTargets = (): boolean => {
    if (
      !autoPreview.isValid ||
      autoPreview.calories === null ||
      autoPreview.proteinGrams === null ||
      autoPreview.fatGrams === null ||
      autoPreview.carbsGrams === null ||
      autoPreview.weightKg === null ||
      autoPreview.weightLbs === null
    ) {
      return false;
    }

    const effDate = effectiveDate || getLocalTodayStr();
    const nowIso = new Date().toISOString();

    const nextTargets: DailyTargets = {
      calories: autoPreview.calories,
      protein: autoPreview.proteinGrams,
      fat: autoPreview.fatGrams,
      carbs: autoPreview.carbsGrams,
      macroMode: 'auto_bodyweight',
      effectiveDate: effDate,
      referenceWeightKg: autoPreview.weightKg,
      referenceWeightDate: latestWeightEntry?.date || effDate,
      referenceWeightLbs: autoPreview.weightLbs,
      savedAt: nowIso,
    };

    const nextHistory = recordTargetHistorySnapshot(targetHistory, {
      effectiveDate: effDate,
      savedAt: nowIso,
      calories: autoPreview.calories,
      protein: autoPreview.proteinGrams,
      fat: autoPreview.fatGrams,
      carbs: autoPreview.carbsGrams,
      referenceWeightKg: autoPreview.weightKg,
      referenceWeightDate: latestWeightEntry?.date || effDate,
      referenceWeightLbs: autoPreview.weightLbs,
    });

    onUpdateTargets(nextTargets, nextHistory);
    return true;
  };

  const handleSaveTargetForm = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = applyAndSaveAutoTargets();
    if (
      ok &&
      autoPreview.calories !== null &&
      autoPreview.proteinGrams !== null &&
      autoPreview.fatGrams !== null &&
      autoPreview.carbsGrams !== null
    ) {
      setStatusMessage(
        `Target disimpan (${formatOneDecimalID(autoPreview.calories)} kkal · P ${formatOneDecimalID(
          autoPreview.proteinGrams
        )}g · L ${formatOneDecimalID(autoPreview.fatGrams)}g · K ${formatOneDecimalID(
          autoPreview.carbsGrams
        )}g).`
      );
    }
  };

  const openUnifiedPasswordPrompt = () => {
    setIsPasswordPromptOpen(true);
    setPasswordInput('');
    setPasswordError(null);
  };

  const handleVerifyPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyLockPassword(passwordInput, settings)) {
      setPasswordError('Sandi salah. Gunakan Reset Sandi jika lupa.');
      return;
    }

    onUnlockNutritionSession?.();
    setStatusMessage('Kunci Sandi dibuka untuk edit Nutrisi My Foods.');
    setIsPasswordPromptOpen(false);
    setPasswordInput('');
    setPasswordError(null);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyLockPassword(oldPasswordInput, settings)) {
      setPasswordError('Sandi lama tidak sesuai.');
      return;
    }
    if (newPasswordInput.trim().length < 4) {
      setPasswordError('Sandi baru minimal 4 karakter.');
      return;
    }
    const updated: AppSettings = {
      ...settings,
      lockPassword: newPasswordInput.trim(),
    };
    onUpdateSettings(updated);
    setPasswordPanelMode('none');
    setOldPasswordInput('');
    setNewPasswordInput('');
    setPasswordError(null);
    setStatusMessage('Sandi kunci berhasil diperbarui.');
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      setPasswordError('Ketik kata RESET dengan benar untuk mereset sandi.');
      return;
    }
    const cleanNew =
      resetNewPasswordInput.trim().length >= 4 ? resetNewPasswordInput.trim() : '1234';
    const updated = resetLockPassword(settings, cleanNew);
    onUpdateSettings(updated);
    setLockNutritionData(true);
    setLockNutritionTargets(true);
    setPasswordPanelMode('none');
    setResetConfirmText('');
    setPasswordError(null);
    setStatusMessage(`Sandi berhasil direset menjadi "${cleanNew}".`);
  };

  const handleSaveSettingsAndClose = () => {
    if (referenceWeightKg !== null) {
      if (!autoPreview.isValid) {
        return;
      }
      applyAndSaveAutoTargets();
    }
    onUpdateSettings({
      ...settings,
      quickLogDirectSave,
      lockPastDays,
      autoDeductInventory,
      lockNutritionData,
      lockNutritionTargets,
    });
    onClose();
  };

  const handleExportBackup = () => {
    const jsonStr = createBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = getLocalTodayStr();
    link.href = url;
    link.download = `KaloriKu_Backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onUpdateSettings({
      ...settings,
      lastBackupDate: new Date().toISOString(),
    });
    setStatusMessage('File backup JSON berhasil diunduh.');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const validation = validateBackupFile(content);

      if (!validation.isValid || !validation.parsedData) {
        setStatusMessage(`Gagal membaca backup: ${validation.message}`);
        return;
      }

      const { itemCounts } = validation;
      setPendingRestoreData({
        parsedData: validation.parsedData,
        summary: `${itemCounts?.foods} makanan, ${itemCounts?.dailyLogs} catatan harian, ${itemCounts?.weightEntries} catatan berat badan`,
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteJsonSubmit = () => {
    if (!pasteJsonInput.trim()) return;
    const validation = validateBackupFile(pasteJsonInput);
    if (!validation.isValid || !validation.parsedData) {
      setStatusMessage(`Gagal membaca teks JSON: ${validation.message}`);
      return;
    }
    const { itemCounts } = validation;
    setPendingRestoreData({
      parsedData: validation.parsedData,
      summary: `${itemCounts?.foods} makanan, ${itemCounts?.dailyLogs} catatan harian, ${itemCounts?.weightEntries} catatan berat badan, target ${validation.parsedData.targets?.calories || 1900} kkal`,
    });
    setShowPasteJson(false);
    setPasteJsonInput('');
  };

  const lastBackupDisplay = settings.lastBackupDate
    ? new Date(settings.lastBackupDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Belum pernah';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0f172a] border-t sm:border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] flex flex-col shadow-2xl safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Settings size={19} className="text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Pengaturan</h3>
              <p className="text-[11px] text-slate-400">
                Target kalori, keamanan &amp; cadangan data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-3.5 py-3 pr-1">
          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* 1. Target Kalori & Makro Otomatis */}
          <div
            data-testid="auto-target-section"
            className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Target size={15} className="text-emerald-400 shrink-0" />
                <span>Target Kalori &amp; Makro</span>
              </span>
              {latestWeightEntry && autoPreview.weightKg !== null && (
                <div
                  data-testid="reference-weight-box"
                  className="text-[11px] text-slate-400 flex items-center space-x-1 tabular-nums"
                >
                  <Scale size={12} className="text-emerald-400 shrink-0" />
                  <span>
                    Acuan:{' '}
                    <strong className="text-white">
                      {formatOneDecimalID(autoPreview.weightKg)} kg
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Prompt Isi Berat Badan (hanya tampil jika belum ada berat badan) */}
            {(!latestWeightEntry || autoPreview.weightKg === null) && (
              <form
                onSubmit={handleSaveInitialWeight}
                data-testid="missing-weight-prompt"
                className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2"
              >
                <div className="flex items-start space-x-2 text-xs text-amber-200">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Isi berat badan terlebih dahulu agar Protein, Lemak, dan Karbohidrat dihitung
                    otomatis.
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      data-testid="initial-weight-input"
                      value={initialWeightInput}
                      onChange={(e) => {
                        setInitialWeightInput(e.target.value);
                        setInitialWeightError(null);
                      }}
                      placeholder="Berat (kg), misal 70"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400">kg</span>
                  </div>
                  <button
                    type="submit"
                    data-testid="save-initial-weight-btn"
                    className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 shrink-0"
                  >
                    Simpan Berat
                  </button>
                </div>
                {initialWeightError && (
                  <p className="text-xs text-rose-400 font-medium">{initialWeightError}</p>
                )}
              </form>
            )}

            {/* Form Kalori Harian + Preview Makro Otomatis */}
            <form onSubmit={handleSaveTargetForm} className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <label
                    htmlFor="auto-target-calories-input"
                    className="text-xs font-bold text-white block"
                  >
                    Target Kalori Harian
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Makro otomatis dari berat badan
                  </span>
                </div>
                <div className="flex items-baseline space-x-1.5">
                  <input
                    id="auto-target-calories-input"
                    data-testid="auto-target-calories-input"
                    type="text"
                    inputMode="decimal"
                    value={caloriesInput}
                    onChange={(e) => setCaloriesInput(e.target.value)}
                    placeholder="1900"
                    className="w-24 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-right text-base font-black text-emerald-400 focus:outline-none focus:border-emerald-500 tabular-nums"
                  />
                  <span className="text-xs font-semibold text-slate-400">kkal</span>
                </div>
              </div>

              {/* 3 Kolom Preview Makro */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 block">Protein</span>
                  <span
                    data-testid="preview-protein-val"
                    className="text-sm font-bold text-emerald-400 tabular-nums block mt-0.5"
                  >
                    {autoPreview.proteinGrams !== null
                      ? `${formatOneDecimalID(autoPreview.proteinGrams)} g`
                      : '--'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">0,8g × lbs</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 block">Lemak</span>
                  <span
                    data-testid="preview-fat-val"
                    className="text-sm font-bold text-amber-400 tabular-nums block mt-0.5"
                  >
                    {autoPreview.fatGrams !== null
                      ? `${formatOneDecimalID(autoPreview.fatGrams)} g`
                      : '--'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">0,3g × lbs</span>
                </div>

                <div
                  className={`p-2.5 rounded-xl bg-slate-950 border ${
                    autoPreview.isNegativeCarbs
                      ? 'border-rose-500/60 bg-rose-950/20'
                      : 'border-slate-800'
                  }`}
                >
                  <span className="text-[10px] font-semibold text-slate-400 block">Karbohidrat</span>
                  <span
                    data-testid="preview-carbs-val"
                    className={`text-sm font-bold tabular-nums block mt-0.5 ${
                      autoPreview.isNegativeCarbs ? 'text-rose-400' : 'text-sky-400'
                    }`}
                  >
                    {autoPreview.carbsGrams !== null
                      ? `${formatOneDecimalID(autoPreview.carbsGrams)} g`
                      : '--'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Sisa kkal ÷ 4</span>
                </div>
              </div>

              {autoPreview.hasWeight && !autoPreview.isValid && autoPreview.error && (
                <div
                  data-testid="auto-target-warning"
                  className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-start space-x-2 text-xs text-rose-200"
                >
                  <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>{autoPreview.error}</span>
                </div>
              )}

              <button
                type="submit"
                data-testid="save-auto-target-btn"
                disabled={!autoPreview.isValid}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-40 transition-all"
              >
                Simpan Target
              </button>
            </form>

            {/* Ringkasan Target Aktif & Riwayat Collapsible */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium flex items-center space-x-1">
                  <History size={12} className="text-emerald-400" />
                  <span>Aktif:</span>
                </span>
                <span
                  data-testid="saved-active-target-summary"
                  className="text-slate-200 font-bold tabular-nums"
                >
                  {formatOneDecimalID(targets.calories)} kkal · P{' '}
                  {formatOneDecimalID(targets.protein)}g · L {formatOneDecimalID(targets.fat)}g · K{' '}
                  {formatOneDecimalID(targets.carbs)}g
                </span>
              </div>

              {targetHistory.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowTargetHistory(!showTargetHistory)}
                    className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 pt-0.5"
                  >
                    <span>Riwayat Target ({targetHistory.length} tersimpan)</span>
                    {showTargetHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {showTargetHistory && (
                    <div
                      data-testid="target-history-list"
                      className="mt-1.5 max-h-24 overflow-y-auto space-y-1 pr-0.5"
                    >
                      {[...targetHistory].reverse().map((item) => (
                        <div
                          key={item.id}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px] tabular-nums"
                        >
                          <div>
                            <span className="font-bold text-slate-200">{item.effectiveDate}</span>
                            <span className="text-slate-400 ml-1">
                              ({formatOneDecimalID(item.referenceWeightKg)} kg)
                            </span>
                          </div>
                          <div className="text-right text-slate-300">
                            <span className="font-bold text-emerald-400">
                              {formatOneDecimalID(item.calories)} kkal
                            </span>{' '}
                            · P {formatOneDecimalID(item.protein)} · L{' '}
                            {formatOneDecimalID(item.fat)} · K {formatOneDecimalID(item.carbs)}g
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Keamanan Kunci & Preferensi */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <KeyRound size={15} className="text-amber-400" />
                <span>Keamanan &amp; Preferensi</span>
              </span>
              {isDefaultPassword && (
                <span className="text-[11px] text-amber-400 font-semibold">
                  Sandi: 1234
                </span>
              )}
            </div>

            {/* Unified Lock Row */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  {!isSessionUnlocked ? (
                    <Lock size={13} className="text-amber-400 shrink-0" />
                  ) : (
                    <Unlock size={13} className="text-emerald-400 shrink-0" />
                  )}
                  <span>
                    Kunci Edit MyFoods: {!isSessionUnlocked ? 'Terkunci' : 'Terbuka'}
                  </span>
                </span>
                <div className="flex items-center space-x-2 mt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordPanelMode(passwordPanelMode === 'change' ? 'none' : 'change');
                      setPasswordError(null);
                    }}
                    className="text-slate-400 hover:text-white underline"
                  >
                    Ubah Sandi
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordPanelMode(passwordPanelMode === 'reset' ? 'none' : 'reset');
                      setPasswordError(null);
                    }}
                    className="text-amber-400/90 hover:text-amber-300 underline"
                  >
                    Reset Sandi
                  </button>
                </div>
              </div>

              {!isSessionUnlocked ? (
                <button
                  type="button"
                  onClick={openUnifiedPasswordPrompt}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold shrink-0 hover:bg-amber-400"
                >
                  Buka Kunci
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLockNutritionData(true);
                    setLockNutritionTargets(true);
                    onRelockNutritionSession?.();
                    setStatusMessage('Edit Nutrisi My Foods dikunci kembali.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold shrink-0 border border-slate-700"
                >
                  Kunci Lagi
                </button>
              )}
            </div>

            {/* Password Verification Prompt Box */}
            {isPasswordPromptOpen && (
              <form
                onSubmit={handleVerifyPasswordSubmit}
                className="p-3 rounded-xl bg-slate-950 border border-amber-500/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    Masukkan Sandi Kunci
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordPromptOpen(false);
                      setPasswordError(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(null);
                    }}
                    placeholder="Ketik sandi..."
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"
                  >
                    Buka
                  </button>
                </div>
                {passwordError && <p className="text-xs text-rose-400">{passwordError}</p>}
              </form>
            )}

            {/* Panel: Ubah Sandi */}
            {passwordPanelMode === 'change' && (
              <form
                onSubmit={handleChangePassword}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
              >
                <span className="text-xs font-bold text-white block">Ubah Sandi Kunci</span>
                <input
                  type="password"
                  value={oldPasswordInput}
                  onChange={(e) => setOldPasswordInput(e.target.value)}
                  placeholder="Sandi saat ini"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Sandi baru (minimal 4 karakter)"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                {passwordError && <p className="text-xs text-rose-400">{passwordError}</p>}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setPasswordPanelMode('none')}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold"
                  >
                    Simpan Sandi
                  </button>
                </div>
              </form>
            )}

            {/* Panel: Reset Sandi */}
            {passwordPanelMode === 'reset' && (
              <form
                onSubmit={handleResetPassword}
                className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2"
              >
                <span className="text-xs font-bold text-amber-300 block">
                  Reset Sandi Kunci (Jika Lupa Sandi)
                </span>
                <p className="text-[11px] text-slate-400">
                  Ketik <strong>RESET</strong> dan masukkan sandi baru:
                </p>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Ketik RESET"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <input
                  type="text"
                  value={resetNewPasswordInput}
                  onChange={(e) => setResetNewPasswordInput(e.target.value)}
                  placeholder="Sandi baru (minimal 4 karakter)"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                {passwordError && <p className="text-xs text-rose-400">{passwordError}</p>}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setPasswordPanelMode('none')}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                  >
                    Konfirmasi Reset
                  </button>
                </div>
              </form>
            )}

            {/* Clean Toggle Switches */}
            <div className="pt-1 divide-y divide-slate-800/70">
              <label className="py-2 flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-300">Kunci catatan hari lampau</span>
                <input
                  type="checkbox"
                  checked={lockPastDays}
                  onChange={(e) => handleTogglePreference('lockPastDays', e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 w-4 h-4 accent-emerald-500"
                />
              </label>

              <label className="pt-2 flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-300">
                  Auto-potong stok dapur saat mencatat
                </span>
                <input
                  type="checkbox"
                  checked={autoDeductInventory}
                  onChange={(e) =>
                    handleTogglePreference('autoDeductInventory', e.target.checked)
                  }
                  className="rounded bg-slate-800 border-slate-700 text-emerald-500 w-4 h-4 accent-emerald-500"
                />
              </label>
            </div>
          </div>

          {/* 3. Backup & Restore Data (Tanpa Tombol Reset Seluruh Data) */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck size={15} className="text-emerald-400" />
                <span>Backup &amp; Restore</span>
              </span>
              <span className="text-[11px] text-slate-400">Terakhir: {lastBackupDisplay}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="py-2.5 px-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-white text-xs font-bold flex items-center justify-center space-x-1 transition active:scale-95"
                title="Unduh seluruh data ke file JSON"
              >
                <Download size={13} className="text-emerald-400 shrink-0" />
                <span>Unduh</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center space-x-1 transition active:scale-95"
                title="Pilih file backup JSON dari perangkat"
              >
                <Upload size={13} className="text-sky-400 shrink-0" />
                <span>Pilih File</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPasteJson((prev) => !prev)}
                className="py-2.5 px-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center space-x-1 transition active:scale-95"
                title="Tempel teks JSON cadangan"
              >
                <FileText size={13} className="text-amber-400 shrink-0" />
                <span>Tempel</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json,text/plain,*/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Opsi lanjutan: pemulihan data bawaan (disembunyikan agar tidak tertekan tidak sengaja) */}
            <details className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
              <summary className="cursor-pointer list-none flex items-center justify-between text-[11px] font-semibold text-slate-400 [&::-webkit-details-marker]:hidden">
                <span>Opsi lanjutan: pulihkan data bawaan</span>
                <ChevronDown size={13} className="text-slate-500" />
              </summary>
              <div className="pt-2 space-y-2">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Mengganti SEMUA data dengan data bawaan 30 Okt. Akan ada konfirmasi dan
                  cadangan otomatis sebelum data diganti.
                </p>
              <button
                type="button"
                onClick={() => {
                  // Wajib konfirmasi: tombol ini MENIMPA seluruh data dengan data bawaan 30 Okt
                  setPendingRestoreData({
                    parsedData: USER_PROVIDED_BACKUP,
                    summary: `PERHATIAN: semua data saat ini (termasuk catatan harian) akan DIGANTI dengan data bawaan 30 Okt: ${USER_PROVIDED_BACKUP.foods.length} makanan, ${USER_PROVIDED_BACKUP.dailyLogs.length} catatan harian, ${USER_PROVIDED_BACKUP.weightHistory.length} catatan berat badan, target ${USER_PROVIDED_BACKUP.targets.calories} kkal.`,
                  });
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 text-emerald-300 text-xs font-bold flex items-center justify-center space-x-1.5 transition"
              >
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Pulihkan Data 30 Okt (Target 1.900 kkal &amp; French Fries)</span>
              </button>
              </div>
            </details>

            {/* Input Tempel JSON Teks */}
            {showPasteJson && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Tempel Teks JSON Backup:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasteJson(false);
                      setPasteJsonInput('');
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  value={pasteJsonInput}
                  onChange={(e) => setPasteJsonInput(e.target.value)}
                  placeholder='Tempel isi file JSON di sini (misal {"version": 1, ...})'
                  rows={4}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <button
                  type="button"
                  onClick={handlePasteJsonSubmit}
                  disabled={!pasteJsonInput.trim()}
                  className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 text-xs font-bold transition"
                >
                  Periksa &amp; Pulihkan
                </button>
              </div>
            )}

            {/* Konfirmasi Restore Aktif */}
            {pendingRestoreData && (
              <div className="p-3.5 rounded-xl bg-slate-950 border-2 border-emerald-500/60 shadow-lg space-y-2.5 text-xs animate-in fade-in">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <CheckCircle2 size={16} />
                  <span>Konfirmasi Pemulihan Data (Restore):</span>
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  {pendingRestoreData.summary}
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Data yang ada sekarang akan diganti. Sebelum itu, aplikasi otomatis menyimpan
                  cadangan kondisi saat ini sehingga bisa dikembalikan lewat daftar
                  &quot;Cadangan Otomatis&quot; di bawah.
                </p>
                <div className="flex space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPendingRestoreData(null)}
                    className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      restoreBackupData(pendingRestoreData.parsedData);
                      setPendingRestoreData(null);
                      onDataRestored();
                      setStatusMessage('Data berhasil dipulihkan lengkap ke aplikasi!');
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold shadow transition"
                  >
                    Ya, Pulihkan Sekarang
                  </button>
                </div>
              </div>
            )}

            {/* Cadangan Otomatis (di dalam perangkat) */}
            <details className="pt-2.5 border-t border-slate-800/80">
              <summary className="cursor-pointer list-none flex items-center justify-between text-xs font-bold text-slate-300 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center space-x-1.5">
                  <History size={14} className="text-amber-400 shrink-0" />
                  <span>Cadangan Otomatis ({autoSnapshots.length})</span>
                </span>
                <ChevronDown size={14} className="text-slate-500" />
              </summary>
              <div className="pt-2 space-y-1.5">
                {autoSnapshots.length === 0 ? (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Belum ada cadangan otomatis. Cadangan dibuat sekali sehari setelah ada
                    catatan harian. Tetap unduh file backup secara berkala ya.
                  </p>
                ) : (
                  autoSnapshots.map((snap) => (
                    <button
                      key={snap.id}
                      type="button"
                      onClick={() =>
                        setPendingRestoreData({
                          parsedData: snap.data,
                          summary: `Cadangan ${
                            snap.reason === 'daily' ? 'harian' : 'sebelum restore'
                          } ${new Date(snap.createdAt).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}: ${snap.foods} makanan, ${snap.dailyLogs} catatan harian, ${snap.weights} catatan berat badan.`,
                        })
                      }
                      className="w-full text-left py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 active:scale-95 text-[11px] text-slate-200 transition"
                    >
                      <span className="font-bold">
                        {snap.reason === 'daily' ? 'Harian' : 'Sebelum restore'}
                      </span>{' '}
                      ·{' '}
                      {new Date(snap.createdAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {snap.dailyLogs} catatan
                    </button>
                  ))
                )}
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleSaveSettingsAndClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
          >
            Selesai &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
