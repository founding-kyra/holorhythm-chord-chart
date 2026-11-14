export type NutThickness = 'thin' | 'thick';
export type RingStyle = 'single' | 'double';
export type ThemeMode = 'light' | 'dark';

export interface ChartMarker {
  id: string;
  stringIndex: number; // 0-5 (E=0, A=1, D=2, G=3, B=4, e=5)
  fretIndex: number;   // 1-5
  label: string;
  ringStyle: RingStyle;
}

export interface ChartConnector {
  id: string;
  fromMarkerId: string;
  toMarkerId: string;
}

export interface ChartData {
  id: string;
  title: string;
  nutThickness: NutThickness;
  startFret: number;  // legacy single fret number (0 = none). Superseded by fretLabels once a chart is edited.
  /** One optional fret number per row on the left (rows 1-5). Each dot holds its own number. */
  fretLabels?: string[];
  topIndicators: [string, string, string, string, string, string];
  markers: ChartMarker[];
  connectors: ChartConnector[];
  bottomNoteLabels: [string, string, string, string, string, string];
  bottomIntervalLabels: [string, string, string, string, string, string];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SheetNote {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface SheetData {
  id: string;
  title: string;
  slots: (string | null)[];  // 16 slots, each chartId or null
  notes: SheetNote[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TrashedChart {
  chart: ChartData;
  trashedAt: number;
}

export interface TrashedSheet {
  sheet: SheetData;
  trashedAt: number;
}

/**
 * The fret number shown beside each of the five rows ('' = none).
 * Charts saved before per-dot numbers existed had one number (startFret) shown on the first row
 * when the nut was thin; that's still honoured until the chart is edited.
 */
export function getFretLabels(chart: ChartData): string[] {
  if (chart.fretLabels) {
    return Array.from({ length: 5 }, (_, i) => chart.fretLabels![i] ?? '');
  }
  const legacy = chart.nutThickness === 'thin' && chart.startFret > 0 ? String(chart.startFret) : '';
  return [legacy, '', '', '', ''];
}

export function createEmptyChart(): ChartData {
  return {
    id: crypto.randomUUID(),
    title: '',
    nutThickness: 'thick',
    startFret: 0,
    topIndicators: ['', '', '', '', '', ''],
    markers: [],
    connectors: [],
    bottomNoteLabels: ['', '', '', '', '', ''],
    bottomIntervalLabels: ['', '', '', '', '', ''],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createEmptySheet(): SheetData {
  return {
    id: crypto.randomUUID(),
    title: '',
    slots: Array(16).fill(null),
    notes: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
