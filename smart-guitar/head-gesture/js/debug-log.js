'use strict';
// DebugLog：偵錯日誌環狀緩衝。
// 記錄：Timestamp / Raw Roll / Filtered Roll / Gesture State / Page / Trigger Event / Inference Time。
// 不儲存任何攝影機影像。可匯出 JSON 或 CSV。

const CSV_HEADERS = ['timestamp', 'raw_roll_deg', 'filtered_roll_deg', 'rel_roll_deg', 'state', 'page', 'event', 'inference_ms'];

export class DebugLog {
  constructor(maxEntries = 600) {
    this.maxEntries = maxEntries;
    this.entries = [];
  }

  add(entry) {
    this.entries.push({
      timestamp: entry.timestamp ?? new Date().toISOString(),
      raw_roll_deg: round2(entry.rawRollDeg),
      filtered_roll_deg: round2(entry.filteredRollDeg),
      rel_roll_deg: round2(entry.relRollDeg),
      state: entry.state ?? '',
      page: entry.page ?? '',
      event: entry.event ?? '',
      inference_ms: round2(entry.inferenceMs),
    });
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  get count() { return this.entries.length; }

  clear() { this.entries = []; }

  toJSON() { return JSON.stringify(this.entries, null, 2); }

  toCSV() {
    const lines = [CSV_HEADERS.join(',')];
    for (const e of this.entries) {
      lines.push(CSV_HEADERS.map(h => csvCell(e[h])).join(','));
    }
    return lines.join('\n');
  }
}

function round2(v) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : '';
}

function csvCell(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
