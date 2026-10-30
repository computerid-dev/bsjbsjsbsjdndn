/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Settings, Flame, WifiOff, Download, Upload } from 'lucide-react';
import { useOnlineStatus } from '../utils/useOnlineStatus';
import { getLocalTodayStr, shiftLocalDateStr } from '../utils/nutrition';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  streak: number;
  onOpenSettings: () => void;
  onExportBackup?: () => void;
  onImportBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDate,
  onDateChange,
  streak,
  onOpenSettings,
  onExportBackup,
  onImportBackup,
}) => {
  const isOffline = !useOnlineStatus();
  const todayStr = getLocalTodayStr();
  const isToday = selectedDate === todayStr;

  const handlePrevDay = () => {
    onDateChange(shiftLocalDateStr(selectedDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(shiftLocalDateStr(selectedDate, 1));
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onDateChange(e.target.value);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    if (dateStr === todayStr) {
      return 'Hari Ini';
    }
    if (dateStr === shiftLocalDateStr(todayStr, -1)) {
      return 'Kemarin';
    }
    if (dateStr === shiftLocalDateStr(todayStr, 1)) {
      return 'Besok';
    }

    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    return d.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <header className="shrink-0 z-30 bg-[#0b0f19] border-b border-slate-800/80 px-4 py-2.5 safe-top touch-none">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Date Selector Navigation */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handlePrevDay}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 active:scale-95 transition-all"
            title="Hari Sebelumnya"
            aria-label="Hari Sebelumnya"
          >
            <ChevronLeft size={22} />
          </button>

          <label className="relative flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 active:scale-95 transition-all">
            <Calendar size={16} className="text-emerald-400" />
            <span className="text-base font-bold text-white">
              {formatDateDisplay(selectedDate)}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDatePick}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>

          <button
            onClick={handleNextDay}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 active:scale-95 transition-all"
            title="Hari Berikutnya"
            aria-label="Hari Berikutnya"
          >
            <ChevronRight size={22} />
          </button>

          {!isToday && (
            <button
              onClick={() => onDateChange(todayStr)}
              className="ml-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 active:scale-95"
            >
              Hari Ini
            </button>
          )}
        </div>

        {/* Right: Offline badge / Streak / Settings ⚙️ */}
        <div className="flex items-center space-x-2">
          {isOffline && (
            <div
              className="flex items-center space-x-1 px-2 py-1 rounded-xl bg-amber-950/60 border border-amber-700/60 text-amber-300 text-xs font-semibold"
              title="Mode Offline Aktif - Data tersimpan di perangkat"
            >
              <WifiOff size={13} />
              <span>Offline</span>
            </div>
          )}

          {streak > 0 && (
            <div
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 text-xs font-bold"
              title={`${streak} hari berturut-turut mencatat`}
            >
              <Flame size={14} className="fill-amber-400 text-amber-500" />
              <span>{streak}</span>
            </div>
          )}

          {onExportBackup && (
            <button
              onClick={onExportBackup}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:text-white hover:border-slate-700 active:scale-95 transition-all"
              title="Cadangkan Data (Export)"
              aria-label="Cadangkan Data (Export)"
            >
              <Download size={17} />
            </button>
          )}

          {onImportBackup && (
            <button
              onClick={onImportBackup}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-sky-400 hover:text-white hover:border-slate-700 active:scale-95 transition-all"
              title="Pulihkan Data (Import)"
              aria-label="Pulihkan Data (Import)"
            >
              <Upload size={17} />
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 active:scale-95 transition-all"
            title="Pengaturan"
            aria-label="Pengaturan"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
