import jsPDF from 'jspdf';
import { SheetData, ChartData, createEmptyChart } from '../types';
import { renderChartToSVG } from './svgExport';
import { SYMBOL_CHARS, SYMBOL_FONT_NAME, SYMBOL_FONT_REGULAR_B64, SYMBOL_FONT_BOLD_B64 } from './symbolFont';

const LETTER_W_PT = 612;  // 8.5"
const LETTER_H_PT = 792;  // 11"
const MARGIN = 36;         // 0.5"
const COLS = 4;
const ROWS = 4;

// The SVG viewBox aspect ratio: 200/280 = 5:7
const CHART_ASPECT = 200 / 280;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Make the symbol font available to jsPDF (and svg2pdf, which draws chart text through it). */
function registerSymbolFont(doc: jsPDF): void {
  doc.addFileToVFS('HRSymbols-Regular.ttf', SYMBOL_FONT_REGULAR_B64);
  doc.addFont('HRSymbols-Regular.ttf', SYMBOL_FONT_NAME, 'normal');
  doc.addFileToVFS('HRSymbols-Bold.ttf', SYMBOL_FONT_BOLD_B64);
  doc.addFont('HRSymbols-Bold.ttf', SYMBOL_FONT_NAME, 'bold');
}

/** Split text into runs: symbols that Helvetica lacks, and everything else. */
function splitSymbolRuns(text: string): { text: string; symbol: boolean }[] {
  const runs: { text: string; symbol: boolean }[] = [];
  for (const ch of text) {
    const symbol = SYMBOL_CHARS.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.symbol === symbol) last.text += ch;
    else runs.push({ text: ch, symbol });
  }
  return runs;
}

/**
 * Chart text is drawn by svg2pdf with Helvetica, which has no flat, sharp or delta glyph
 * (they used to be swapped for "b" / "#", and delta came out as a quote mark).
 *
 * Here each label that contains one of those symbols is split into runs, and the runs are
 * placed one after another. Symbols use the embedded symbol font; everything else keeps the
 * same font, size, colour and weight it had. Widths are measured with the PDF's own font
 * metrics, because svg2pdf measures with the browser, which doesn't know the embedded font.
 */
function useSymbolFontForSymbols(svgEl: Element, doc: jsPDF): void {
  const savedFont = doc.getFont();
  const savedSize = doc.getFontSize();

  svgEl.querySelectorAll('text').forEach(textEl => {
    const content = textEl.textContent || '';
    if (!SYMBOL_CHARS.test(content)) return;

    const fontSize = parseFloat(textEl.getAttribute('font-size') || '10') || 10;
    const attr = textEl.getAttribute('font-weight') || '400';
    const weight = attr === 'bold' ? 700 : attr === 'normal' ? 400 : parseInt(attr, 10) || 400;
    // svg2pdf draws Helvetica bold only at weight 700, and finds the symbol font at 400 or 700
    const helveticaStyle = weight >= 700 ? 'bold' : 'normal';
    const symbolStyle = weight >= 600 ? 'bold' : 'normal';
    const symbolWeight = weight >= 600 ? '700' : '400';

    const runs = splitSymbolRuns(content);
    doc.setFontSize(fontSize);
    const widths = runs.map(r => {
      doc.setFont(r.symbol ? SYMBOL_FONT_NAME : 'helvetica', r.symbol ? symbolStyle : helveticaStyle);
      return doc.getTextWidth(r.text);
    });
    const total = widths.reduce((a, b) => a + b, 0);

    const x = parseFloat(textEl.getAttribute('x') || '0') || 0;
    const anchor = textEl.getAttribute('text-anchor') || 'start';
    let cursor = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;

    runs.forEach((run, i) => {
      const piece = textEl.cloneNode(false) as Element; // keeps y, size, colour, opacity, baseline...
      // svg2pdf trims leading spaces, so skip over them ourselves
      const lead = run.text.match(/^\s*/)?.[0] ?? '';
      let leadWidth = 0;
      if (lead) {
        doc.setFont(run.symbol ? SYMBOL_FONT_NAME : 'helvetica', run.symbol ? symbolStyle : helveticaStyle);
        leadWidth = doc.getTextWidth(lead);
      }
      piece.setAttribute('x', String(cursor + leadWidth));
      piece.setAttribute('text-anchor', 'start');
      if (run.symbol) {
        piece.setAttribute('font-family', SYMBOL_FONT_NAME);
        piece.setAttribute('font-weight', symbolWeight);
      }
      piece.textContent = run.text.trim();
      if (run.text.trim()) textEl.parentNode?.insertBefore(piece, textEl);
      cursor += widths[i];
    });
    textEl.parentNode?.removeChild(textEl);
  });

  doc.setFont(savedFont.fontName, savedFont.fontStyle);
  doc.setFontSize(savedSize);
}

/** doc.text(), but draws flat / sharp / delta with the symbol font. Handles left and centered text. */
function drawText(doc: jsPDF, text: string, x: number, y: number, opts: { bold?: boolean; align?: 'left' | 'center' } = {}): void {
  const style = opts.bold ? 'bold' : 'normal';
  if (!SYMBOL_CHARS.test(text)) {
    doc.setFont('helvetica', style);
    doc.text(text, x, y, opts.align === 'center' ? { align: 'center' } : undefined);
    return;
  }
  const runs = splitSymbolRuns(text);
  const widthOf = (r: { text: string; symbol: boolean }) => {
    doc.setFont(r.symbol ? SYMBOL_FONT_NAME : 'helvetica', style);
    return doc.getTextWidth(r.text);
  };
  const total = runs.reduce((sum, r) => sum + widthOf(r), 0);
  let cursor = opts.align === 'center' ? x - total / 2 : x;
  for (const r of runs) {
    doc.setFont(r.symbol ? SYMBOL_FONT_NAME : 'helvetica', style);
    doc.text(r.text, cursor, y);
    cursor += doc.getTextWidth(r.text);
  }
  doc.setFont('helvetica', style);
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

  registerSymbolFont(doc);

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
    drawText(doc, sheet.title, LETTER_W_PT / 2, headerY, { bold: true, align: 'center' });
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

      // Draw flat / sharp / delta with the embedded symbol font so they survive intact
      useSymbolFontForSymbols(svgEl, doc);

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
    drawText(doc, note.text, nx, ny);
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
