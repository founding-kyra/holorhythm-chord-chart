import jsPDF from 'jspdf';
import { SheetData, ChartData, createEmptyChart } from '../types';
import { renderChartToSVG } from './svgExport';

const LETTER_W_PT = 612;  // 8.5"
const LETTER_H_PT = 792;  // 11"
const MARGIN = 36;         // 0.5"
const COLS = 4;
const ROWS = 4;

// The SVG viewBox aspect ratio: 200/280 = 5:7
const CHART_ASPECT = 200 / 280;

// Musical symbol mapping: Unicode → ASCII-safe fallback for fonts that lack these glyphs
const SYMBOL_MAP: Record<string, string> = {
  '\u266D': 'b',     // ♭ → b
  '\u266F': '#',     // ♯ → #
  '\u0394': 'Δ',     // Δ (keep, usually in Helvetica)
  '\u00F8': 'ø',     // ø (keep, usually in Helvetica)
  '\u2014': '-',     // em dash → hyphen
};

/**
 * Replace musical Unicode symbols with font-safe equivalents in SVG text nodes.
 * svg2pdf.js uses the PDF's built-in Helvetica which lacks ♭ and ♯ glyphs.
 * We replace them with ASCII equivalents that render correctly.
 */
function replaceMusicalSymbols(svgEl: Element): void {
  svgEl.querySelectorAll('text').forEach(textEl => {
    let content = textEl.textContent || '';
    for (const [unicode, replacement] of Object.entries(SYMBOL_MAP)) {
      content = content.split(unicode).join(replacement);
    }
    textEl.textContent = content;
  });
}

export async function exportSheetToPDF(
  sheet: SheetData,
  charts: ChartData[],
  theme: 'light' | 'dark' = 'light'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const fg = theme === 'dark' ? '#ffffff' : '#000000';
  const bg = theme === 'dark' ? '#000000' : '#ffffff';

  doc.setFillColor(bg);
  doc.rect(0, 0, LETTER_W_PT, LETTER_H_PT, 'F');

  // Header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(fg);

  let headerY = MARGIN + 14;
  if (sheet.title) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(sheet.title, LETTER_W_PT / 2, headerY, { align: 'center' });
    headerY += 28;
  }

  // Grid area
  const gridTop = headerY + 6;
  const gridBottom = LETTER_H_PT - MARGIN - 28;
  const gridLeft = MARGIN;
  const gridRight = LETTER_W_PT - MARGIN;
  const slotW = (gridRight - gridLeft) / COLS;
  const slotH = (gridBottom - gridTop) / ROWS;

  // Chart size within each slot — 15% bigger (less gutter): reduced padding from 12 to 2
  const maxChartW = slotW - 2;
  const maxChartH = slotH - 2;
  let chartW: number, chartH: number;
  if (maxChartW / maxChartH > CHART_ASPECT) {
    chartH = maxChartH;
    chartW = chartH * CHART_ASPECT;
  } else {
    chartW = maxChartW;
    chartH = chartW / CHART_ASPECT;
  }

  // Blank chart template for empty slots
  const blankChart = createEmptyChart();

  for (let i = 0; i < 16; i++) {
    const chartId = sheet.slots[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = gridLeft + col * slotW + (slotW - chartW) / 2;
    const cy = gridTop + row * slotH + (slotH - chartH) / 2;

    const chart = chartId ? charts.find(c => c.id === chartId) : null;
    const svgChart = chart || blankChart;
    const svgStr = renderChartToSVG(svgChart, { width: chartW, height: chartH, theme });

    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgStr, 'image/svg+xml');
      const svgEl = svgDoc.documentElement;

      // Replace musical Unicode symbols with font-safe ASCII equivalents
      replaceMusicalSymbols(svgEl);

      // Blank placeholders: full 100% opacity black lines (no reduced opacity)

      const { svg2pdf } = await import('svg2pdf.js');
      await svg2pdf(svgEl, doc, { x: cx, y: cy, width: chartW, height: chartH });
    } catch {
      // Fallback: rasterize
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = await loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = chartW * 3;
      canvas.height = chartH * 3;
      const ctx2 = canvas.getContext('2d')!;
      ctx2.scale(3, 3);
      ctx2.drawImage(img, 0, 0, chartW, chartH);
      const dataUrl = canvas.toDataURL('image/png');
      doc.addImage(dataUrl, 'PNG', cx, cy, chartW, chartH);
      URL.revokeObjectURL(url);
    }
  }

  // Notes
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(fg);
  for (const note of sheet.notes) {
    const nx = (note.x / 816) * (LETTER_W_PT - MARGIN * 2) + MARGIN;
    const ny = (note.y / 1056) * (LETTER_H_PT - MARGIN * 2) + MARGIN;
    doc.text(note.text, nx, ny);
  }

  // Footer
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(fg);
  doc.text(
    'HOLORHYTHM.ORG \u00A9 2026',
    LETTER_W_PT / 2,
    LETTER_H_PT - MARGIN + 12,
    { align: 'center' }
  );

  // Filename: use sheet title if available
  const filename = sheet.title && sheet.title.trim()
    ? `${sheet.title.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.pdf`
    : 'chord_sheet.pdf';
  doc.save(filename);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
