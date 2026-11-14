import React, { createContext, useContext, useReducer, useEffect, useRef, useState } from 'react';
import { ChartData, SheetData, TrashedChart, TrashedSheet, ThemeMode, createEmptyChart, createEmptySheet } from '../types';
import { Library, ConflictError, UnauthorizedError, loadLibrary, saveLibrary } from './StorageService';
import { useAuth } from './AuthContext';
import { createDefaultExampleChart } from '../utils/defaults';

const SAVE_DEBOUNCE_MS = 500;

interface AppState {
  theme: ThemeMode;
  isLoading: boolean;
  loadError: string | null;
  /** Set when a save was rejected or failed; the UI shows a banner. */
  saveError: { message: string; conflict: boolean } | null;
  charts: ChartData[];
  sheets: SheetData[];
  trashedCharts: TrashedChart[];
  trashedSheets: TrashedSheet[];
  currentChart: ChartData;
  currentSheet: SheetData;
  activeView: 'editor' | 'library' | 'composer';
  selectedMarkerId: string | null;
  focusedInputId: string | null;
}

type Action =
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'HYDRATE'; charts: ChartData[]; sheets: SheetData[]; trashedCharts: TrashedChart[]; trashedSheets: TrashedSheet[] }
  | { type: 'HYDRATE_ERROR'; error: string }
  | { type: 'SAVE_ERROR'; message: string; conflict: boolean }
  | { type: 'SAVE_OK' }
  | { type: 'RETRY_HYDRATE' }
  | { type: 'SET_CURRENT_CHART'; chart: ChartData }
  | { type: 'UPDATE_CURRENT_CHART'; chart: Partial<ChartData> }
  | { type: 'SAVE_CHART' }
  | { type: 'LOAD_CHART'; id: string }
  | { type: 'DELETE_CHART'; id: string }
  | { type: 'TRASH_CHART'; id: string }
  | { type: 'RESTORE_CHART'; id: string }
  | { type: 'PERMANENT_DELETE_CHART'; id: string }
  | { type: 'EMPTY_TRASH' }
  | { type: 'SET_CURRENT_SHEET'; sheet: SheetData }
  | { type: 'UPDATE_CURRENT_SHEET'; sheet: Partial<SheetData> }
  | { type: 'SAVE_SHEET' }
  | { type: 'LOAD_SHEET'; id: string }
  | { type: 'DELETE_SHEET'; id: string }
  | { type: 'SET_ACTIVE_VIEW'; view: 'editor' | 'library' | 'composer' }
  | { type: 'SET_SELECTED_MARKER'; id: string | null }
  | { type: 'SET_FOCUSED_INPUT'; id: string | null }
  | { type: 'NEW_CHART' }
  | { type: 'NEW_SHEET' }
  | { type: 'TRASH_SHEET'; id: string }
  | { type: 'RESTORE_SHEET'; id: string }
  | { type: 'PERMANENT_DELETE_SHEET'; id: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'HYDRATE':
      return {
        ...state,
        charts: action.charts,
        sheets: action.sheets,
        trashedCharts: action.trashedCharts,
        trashedSheets: action.trashedSheets,
        isLoading: false,
        loadError: null,
      };

    case 'HYDRATE_ERROR':
      return { ...state, isLoading: false, loadError: action.error };

    case 'SAVE_ERROR':
      return { ...state, saveError: { message: action.message, conflict: action.conflict } };

    case 'SAVE_OK':
      return state.saveError ? { ...state, saveError: null } : state;

    case 'RETRY_HYDRATE':
      return { ...state, isLoading: true, loadError: null };

    case 'SET_CURRENT_CHART':
      return { ...state, currentChart: action.chart, selectedMarkerId: null };

    case 'UPDATE_CURRENT_CHART':
      return {
        ...state,
        currentChart: { ...state.currentChart, ...action.chart, updatedAt: Date.now() },
      };

    case 'SAVE_CHART': {
      const existing = state.charts.findIndex(c => c.id === state.currentChart.id);
      const updated = { ...state.currentChart, updatedAt: Date.now() };
      const charts = existing >= 0
        ? state.charts.map(c => c.id === updated.id ? updated : c)
        : [...state.charts, updated];
      return { ...state, charts, currentChart: updated };
    }

    case 'LOAD_CHART': {
      const chart = state.charts.find(c => c.id === action.id);
      if (!chart) return state;
      return { ...state, currentChart: { ...chart }, selectedMarkerId: null, activeView: 'editor' };
    }

    case 'DELETE_CHART': {
      const charts = state.charts.filter(c => c.id !== action.id);
      return { ...state, charts };
    }

    case 'TRASH_CHART': {
      const chartToTrash = state.charts.find(c => c.id === action.id);
      if (!chartToTrash) return state;
      const charts = state.charts.filter(c => c.id !== action.id);
      const trashedCharts = [...state.trashedCharts, { chart: chartToTrash, trashedAt: Date.now() }];
      return { ...state, charts, trashedCharts };
    }

    case 'RESTORE_CHART': {
      const trashItem = state.trashedCharts.find(t => t.chart.id === action.id);
      if (!trashItem) return state;
      const trashedCharts = state.trashedCharts.filter(t => t.chart.id !== action.id);
      const charts = [...state.charts, trashItem.chart];
      return { ...state, charts, trashedCharts };
    }

    case 'PERMANENT_DELETE_CHART': {
      const trashedCharts = state.trashedCharts.filter(t => t.chart.id !== action.id);
      return { ...state, trashedCharts };
    }

    case 'EMPTY_TRASH':
      return { ...state, trashedCharts: [], trashedSheets: [] };

    case 'NEW_CHART':
      return { ...state, currentChart: createEmptyChart(), selectedMarkerId: null, activeView: 'editor' };

    case 'SET_CURRENT_SHEET':
      return { ...state, currentSheet: action.sheet };

    case 'UPDATE_CURRENT_SHEET':
      return {
        ...state,
        currentSheet: { ...state.currentSheet, ...action.sheet, updatedAt: Date.now() },
      };

    case 'SAVE_SHEET': {
      const existing = state.sheets.findIndex(s => s.id === state.currentSheet.id);
      const updated = { ...state.currentSheet, updatedAt: Date.now() };
      const sheets = existing >= 0
        ? state.sheets.map(s => s.id === updated.id ? updated : s)
        : [...state.sheets, updated];
      return { ...state, sheets, currentSheet: updated };
    }

    case 'LOAD_SHEET': {
      const sheet = state.sheets.find(s => s.id === action.id);
      if (!sheet) return state;
      return { ...state, currentSheet: { ...sheet }, activeView: 'composer' };
    }

    case 'DELETE_SHEET': {
      const sheets = state.sheets.filter(s => s.id !== action.id);
      return { ...state, sheets };
    }

    case 'NEW_SHEET':
      return { ...state, currentSheet: createEmptySheet(), activeView: 'composer' };

    case 'TRASH_SHEET': {
      const sheetToTrash = state.sheets.find(s => s.id === action.id);
      if (!sheetToTrash) return state;
      const sheets = state.sheets.filter(s => s.id !== action.id);
      const trashedSheets = [...state.trashedSheets, { sheet: sheetToTrash, trashedAt: Date.now() }];
      return { ...state, sheets, trashedSheets };
    }

    case 'RESTORE_SHEET': {
      const trashItem = state.trashedSheets.find(t => t.sheet.id === action.id);
      if (!trashItem) return state;
      const trashedSheets = state.trashedSheets.filter(t => t.sheet.id !== action.id);
      const sheets = [...state.sheets, trashItem.sheet];
      return { ...state, sheets, trashedSheets };
    }

    case 'PERMANENT_DELETE_SHEET': {
      const trashedSheets = state.trashedSheets.filter(t => t.sheet.id !== action.id);
      return { ...state, trashedSheets };
    }

    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.view };

    case 'SET_SELECTED_MARKER':
      return { ...state, selectedMarkerId: action.id };

    case 'SET_FOCUSED_INPUT':
      return { ...state, focusedInputId: action.id };

    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  retryHydrate: () => void;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    theme: (localStorage.getItem('holorhythm_theme') as ThemeMode) || 'light',
    isLoading: true,
    loadError: null,
    saveError: null,
    charts: [],
    sheets: [],
    trashedCharts: [],
    trashedSheets: [],
    currentChart: createEmptyChart(),
    currentSheet: createEmptySheet(),
    activeView: 'editor',
    selectedMarkerId: null,
    focusedInputId: null,
  });

  const { signOut } = useAuth();

  // Version of the library this tab last loaded/saved, and what that content looked like.
  // Used so a save is skipped when nothing changed, and rejected if someone else saved first.
  const versionRef = useRef(0);
  const lastSavedRef = useRef('');
  // Set after a conflict: stop saving so this tab can't overwrite the newer library.
  const blockedRef = useRef(false);

  // Load the shared library once after login (and again on retry).
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { library, version } = await loadLibrary();
        if (cancelled) return;

        const loaded: Library = {
          charts: library?.charts ?? [],
          sheets: library?.sheets ?? [],
          trashedCharts: library?.trashedCharts ?? [],
          trashedSheets: library?.trashedSheets ?? [],
        };
        versionRef.current = version;
        lastSavedRef.current = JSON.stringify(loaded);
        blockedRef.current = false;

        const hasExample = loaded.charts.some(c => c.title === 'C7#5');
        const charts = hasExample ? loaded.charts : [createDefaultExampleChart(), ...loaded.charts];

        dispatch({ type: 'HYDRATE', ...loaded, charts });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          signOut();
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load your library.';
        dispatch({ type: 'HYDRATE_ERROR', error: message });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const retryHydrate = () => {
    dispatch({ type: 'RETRY_HYDRATE' });
    setReloadToken(t => t + 1);
  };

  // Debounced persistence — avoid a write on every keystroke. Saves run one at a time
  // so each one uses the version number the previous one returned.
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (state.isLoading || state.loadError) return;
    const library: Library = {
      charts: state.charts,
      sheets: state.sheets,
      trashedCharts: state.trashedCharts,
      trashedSheets: state.trashedSheets,
    };

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveChain.current = saveChain.current.then(async () => {
        const json = JSON.stringify(library);
        if (blockedRef.current || json === lastSavedRef.current) return;
        try {
          versionRef.current = await saveLibrary(library, versionRef.current);
          lastSavedRef.current = json;
          dispatch({ type: 'SAVE_OK' });
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            signOut();
          } else if (err instanceof ConflictError) {
            blockedRef.current = true;
            dispatch({ type: 'SAVE_ERROR', message: err.message, conflict: true });
          } else {
            const message = err instanceof Error ? err.message : 'Could not save your changes.';
            dispatch({ type: 'SAVE_ERROR', message, conflict: false });
          }
        }
      });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.charts, state.sheets, state.trashedCharts, state.trashedSheets, state.isLoading, state.loadError]);

  useEffect(() => {
    localStorage.setItem('holorhythm_theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  return (
    <AppContext.Provider value={{ state, dispatch, retryHydrate }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
