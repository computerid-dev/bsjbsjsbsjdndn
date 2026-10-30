import test from 'node:test';
import assert from 'node:assert/strict';

// Simulasi localStorage + window sederhana untuk lingkungan Node
class MemoryStorage {
  private map = new Map<string, string>();
  quota = Infinity;
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) {
    const total = [...this.map.entries()].reduce((n, [kk, vv]) => n + (kk === k ? 0 : kk.length + vv.length), 0);
    if (total + k.length + v.length > this.quota) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const ls = new MemoryStorage();
const events: string[] = [];
(globalThis as any).localStorage = ls;
(globalThis as any).window = {
  dispatchEvent: (e: any) => { events.push(e.type); return true; },
};
(globalThis as any).CustomEvent = class { type: string; detail: any; constructor(t: string, i?: any) { this.type = t; this.detail = i?.detail; } };

const storage = await import('./storage.ts');

const sampleLog = (id: string) => ({ id, date: '2026-10-30', foodName: 'Nasi', calories: 200 }) as any;

test('tombol pemulihan bawaan tidak lagi menghapus data diam-diam: restore selalu membuat cadangan "pre-restore"', () => {
  ls.clear();
  storage.saveStoredLogs([sampleLog('a'), sampleLog('b'), sampleLog('c')]);
  storage.restoreBackupData(storage.USER_PROVIDED_BACKUP); // data bawaan punya dailyLogs: []
  assert.equal(storage.getStoredLogs().length, 0); // data memang tertimpa (sesuai perintah restore)...
  const snaps = storage.getAutoSnapshots();
  assert.equal(snaps.length, 1); // ...tapi ada cadangan sebelum ditimpa
  assert.equal(snaps[0].reason, 'pre-restore');
  assert.equal(snaps[0].dailyLogs, 3);
  storage.restoreBackupData(snaps[0].data); // bisa dikembalikan
  assert.equal(storage.getStoredLogs().length, 3);
});

test('cadangan harian: maksimal 1 per hari dan tidak dibuat saat data kosong', () => {
  ls.clear();
  storage.maybeDailyAutoSnapshot();
  assert.equal(storage.getAutoSnapshots().length, 0); // data kosong -> tidak dibuat
  storage.saveStoredLogs([sampleLog('a')]);
  storage.maybeDailyAutoSnapshot();
  storage.maybeDailyAutoSnapshot();
  const daily = storage.getAutoSnapshots().filter((s) => s.reason === 'daily');
  assert.equal(daily.length, 1);
});

test('JSON korup diamankan ke kunci __corrupt, tidak hilang begitu saja', () => {
  ls.clear();
  ls.setItem('kaloriku_logs_v1', '[{"id":"a"'); // JSON terpotong
  assert.deepEqual(storage.getStoredLogs(), []);
  assert.equal(ls.getItem('kaloriku_logs_v1__corrupt'), '[{"id":"a"');
});

test('gagal simpan (penyimpanan penuh) memicu event peringatan', () => {
  ls.clear();
  events.length = 0;
  ls.quota = 10;
  storage.saveStoredLogs([sampleLog('a')]);
  assert.ok(events.includes(storage.STORAGE_ERROR_EVENT));
  ls.quota = Infinity;
});

test('createBackupJson tetap menghasilkan backup valid yang bisa divalidasi ulang', () => {
  ls.clear();
  storage.saveStoredLogs([sampleLog('a')]);
  const json = storage.createBackupJson();
  const v = storage.validateBackupFile(json);
  assert.equal(v.isValid, true);
  assert.equal(v.itemCounts?.dailyLogs, 1);
});
