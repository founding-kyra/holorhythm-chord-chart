import { ChartData, SheetData, TrashedChart, TrashedSheet } from '../types';

const CHARTS_KEY = 'holorhythm_charts';
const SHEETS_KEY = 'holorhythm_sheets';
const TRASH_KEY = 'holorhythm_trash';
const TRASH_SHEETS_KEY = 'holorhythm_trash_sheets';

export function loadCharts(): ChartData[] {
  try {
    const raw = localStorage.getItem(CHARTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCharts(charts: ChartData[]) {
  localStorage.setItem(CHARTS_KEY, JSON.stringify(charts));
}

export function loadSheets(): SheetData[] {
  try {
    const raw = localStorage.getItem(SHEETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSheets(sheets: SheetData[]) {
  localStorage.setItem(SHEETS_KEY, JSON.stringify(sheets));
}

export function loadTrash(): TrashedChart[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTrash(trash: TrashedChart[]) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

export function loadTrashedSheets(): TrashedSheet[] {
  try {
    const raw = localStorage.getItem(TRASH_SHEETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTrashedSheets(trash: TrashedSheet[]) {
  localStorage.setItem(TRASH_SHEETS_KEY, JSON.stringify(trash));
}
