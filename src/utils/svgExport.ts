/**
 * Generates a standalone SVG string from the chart diagram for export/PDF.
 * Uses the SAME fixed 200x280 viewBox as the React component
 * so the output is pixel-identical at every size.
 */
import { ChartData, getFretLabels } from '../types';

const NUM_STRINGS = 6;
const NUM_FRETS = 5;
const VB_W = 200;
const VB_H = 280;

export function renderChartToSVG(
  chart: ChartData,
  opts: { width?: number; height?: number; theme?: 'light' | 'dark' } = {}
): string {
  const { width = 200, height = 280, theme = 'light' } = opts;
  const fg = theme === 'dark' ? '#ffffff' : '#000000';
  const bg = theme === 'dark' ? '#000000' : '#ffffff';

  const padTop = 42;
  const padBottom = 42;
  const padLR = 28;
  const gridW = VB_W - padLR * 2;
  const gridH = VB_H - padTop - padBottom;
  const cellW = gridW / (NUM_STRINGS - 1);
  const cellH = gridH / NUM_FRETS;
  const markerR = Math.min(cellW, cellH) * 0.40;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet">`;
  svg += `<rect width="${VB_W}" height="${VB_H}" fill="${bg}"/>`;

  // Title
  if (chart.title) {
    svg += `<text x="${VB_W / 2}" y="16" text-anchor="middle" font-family="Inter,sans-serif" font-size="18" font-weight="700" fill="${fg}">${esc(chart.title)}</text>`;
  }

  // Top indicators
  for (let i = 0; i < NUM_STRINGS; i++) {
    const x = padLR + i * cellW;
    const ind = chart.topIndicators[i];
    if (ind && ind.trim()) {
      svg += `<text x="${x}" y="${padTop - 6}" text-anchor="middle" font-family="Inter,sans-serif" font-size="12" font-weight="700" fill="${fg}">${esc(ind.toUpperCase())}</text>`;
    }
  }

  // Nut line
  const nutW = chart.nutThickness === 'thick' ? 3.5 : 1;
  svg += `<line x1="${padLR}" y1="${padTop}" x2="${padLR + gridW}" y2="${padTop}" stroke="${fg}" stroke-width="${nutW}" stroke-linecap="square"/>`;

  // Fret numbers: each row on the left can hold its own number
  getFretLabels(chart).forEach((label, f) => {
    if (!label) return;
    svg += `<text x="${padLR - 8}" y="${padTop + (f + 0.5) * cellH}" dy="0.35em" text-anchor="end" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="${fg}">${label}</text>`;
  });

  // Fret lines
  for (let f = 1; f <= NUM_FRETS; f++) {
    const y = padTop + f * cellH;
    svg += `<line x1="${padLR}" y1="${y}" x2="${padLR + gridW}" y2="${y}" stroke="${fg}" stroke-width="0.8" stroke-linecap="square"/>`;
  }

  // String lines
  for (let s = 0; s < NUM_STRINGS; s++) {
    const x = padLR + s * cellW;
    svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + gridH}" stroke="${fg}" stroke-width="0.8" stroke-linecap="square"/>`;
  }

  // Connectors
  for (const conn of chart.connectors) {
    const from = chart.markers.find(m => m.id === conn.fromMarkerId);
    const to = chart.markers.find(m => m.id === conn.toMarkerId);
    if (from && to) {
      const x1 = padLR + from.stringIndex * cellW;
      const y1 = padTop + (from.fretIndex - 0.5) * cellH;
      const x2 = padLR + to.stringIndex * cellW;
      const y2 = padTop + (to.fretIndex - 0.5) * cellH;
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fg}" stroke-width="3.5" stroke-linecap="round"/>`;
    }
  }

  // Markers — use dy="0.35em" instead of dominant-baseline for PDF compatibility
  for (const marker of chart.markers) {
    const cx = padLR + marker.stringIndex * cellW;
    const cy = padTop + (marker.fretIndex - 0.5) * cellH;
    const hasLabel = marker.label && marker.label.trim().length > 0;

    if (hasLabel) {
      // Outlined circle with label
      svg += `<circle cx="${cx}" cy="${cy}" r="${markerR}" fill="${bg}" stroke="${fg}" stroke-width="1.3"/>`;
      if (marker.ringStyle === 'double') {
        svg += `<circle cx="${cx}" cy="${cy}" r="${markerR * 0.72}" fill="${bg}" stroke="${fg}" stroke-width="1"/>`;
      }
      // Use dy="0.35em" for vertical centering (more reliable than dominant-baseline in PDF)
      svg += `<text x="${cx}" y="${cy}" dy="0.35em" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="${fg}">${esc(marker.label)}</text>`;
    } else {
      // Solid filled dot
      svg += `<circle cx="${cx}" cy="${cy}" r="${markerR}" fill="${fg}"/>`;
      if (marker.ringStyle === 'double') {
        svg += `<circle cx="${cx}" cy="${cy}" r="${markerR * 0.72}" fill="${fg}" stroke="${bg}" stroke-width="1"/>`;
      }
    }
  }

  // Bottom note labels (50% opacity)
  for (let i = 0; i < NUM_STRINGS; i++) {
    const x = padLR + i * cellW;
    const label = chart.bottomNoteLabels[i];
    if (label && label.trim()) {
      svg += `<text x="${x}" y="${padTop + gridH + 16}" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="${fg}" opacity="0.5">${esc(label)}</text>`;
    }
  }

  // Bottom interval labels
  for (let i = 0; i < NUM_STRINGS; i++) {
    const x = padLR + i * cellW;
    const label = chart.bottomIntervalLabels[i];
    if (label && label.trim()) {
      svg += `<text x="${x}" y="${padTop + gridH + 30}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="600" fill="${fg}">${esc(label)}</text>`;
    }
  }

  svg += `</svg>`;
  return svg;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
