/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createBackupJson } from '../utils/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copiedBackup: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    copiedBackup: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copiedBackup: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }
    } catch (err) {
      console.warn('Error clearing caches:', err);
    }
    window.location.reload();
  };

  private handleCopyBackup = () => {
    try {
      const backupStr = createBackupJson();
      navigator.clipboard.writeText(backupStr);
      this.setState({ copiedBackup: true });
      setTimeout(() => this.setState({ copiedBackup: false }), 3000);
    } catch (err) {
      console.error('Failed to copy backup:', err);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center text-3xl">
              ⚠️
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Terjadi Kendala Tampilan
              </h1>
              <p className="text-sm text-slate-400">
                Aplikasi mengalami masalah saat memuat data. Tenang, data makanan dan riwayat Anda tetap tersimpan aman.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl text-left overflow-auto max-h-28 text-xs font-mono text-red-300">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-slate-950 font-semibold rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
              >
                Muat Ulang Aplikasi
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-slate-300 font-medium rounded-2xl transition text-sm"
              >
                Segarkan Cache &amp; Buka Kembali
              </button>

              <button
                type="button"
                onClick={this.handleCopyBackup}
                className="w-full py-2.5 px-4 bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-xl transition"
              >
                {this.state.copiedBackup ? '✓ Data Cadangan Berhasil Disalin!' : 'Salin Data Cadangan (Backup)'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
