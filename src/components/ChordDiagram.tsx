import React from 'react';
import { ChartData, ChartMarker } from '../types';

interface ChordDiagramProps {
  chart: ChartData;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  interactive?: boolean;
  selectedMarkerId?: string | null;
  focusedInput?: { type: string; index?: number } | null;
  onCellClick?: (stringIndex: number, fretIndex: number) => void;
  onMarkerClick?: (markerId: string) => void;
  onNutClick?: () => void;
  onTopIndicatorClick?: (stringIndex: number) => void;
  onBottomNoteLabelClick?: (stringIndex: number) => void;
  onBottomIntervalLabelClick?: (stringIndex: number) => void;
  onConnectorClick?: (connectorId: string) => void;
  selectedConnectorId?: string | null;
  onStartFretClick?: (fretIndex: number) => void;
  onMarkerDragStart?: (markerId: string) => void;
  onMarkerDrop?: (stringIndex: number, fretIndex: number) => void;
  draggingMarker?: string | null;
  svgRef?: React.Ref<SVGSVGElement>;
}

const NUM_STRINGS = 6;
const NUM_FRETS = 5;

const VB_W = 200;
const VB_H = 280;

export default function ChordDiagram({
  chart,
  width = 320,
  height = 460,
  theme = 'light',
  interactive = false,
  selectedMarkerId,
  focusedInput,
  onCellClick,
  onMarkerClick,
  onNutClick,
  onTopIndicatorClick,
  onBottomNoteLabelClick,
  onBottomIntervalLabelClick,
  onConnectorClick,
  selectedConnectorId,
  onStartFretClick,
  onMarkerDragStart,
  onMarkerDrop,
  draggingMarker,
  svgRef,
}: ChordDiagramProps) {
  const fg = theme === 'dark' ? '#ffffff' : '#000000';
  const bg = theme === 'dark' ? '#1a1a1a' : '#ffffff';
  const accent = '#4CAF50';

  const padTop = 42;
  const padBottom = 42;
  const padLR = 28;
  const gridW = VB_W - padLR * 2;
  const gridH = VB_H - padTop - padBottom;
  const cellW = gridW / (NUM_STRINGS - 1);
  const cellH = gridH / NUM_FRETS;
  const markerR = Math.min(cellW, cellH) * 0.40;
  const editorDotR = 4;

  const getMarkerAt = (s: number, f: number): ChartMarker | undefined =>
    chart.markers.find(m => m.stringIndex === s && m.fretIndex === f);

  const isFieldFocused = (type: string, index?: number): boolean => {
    if (!focusedInput) return false;
    if (focusedInput.type !== type) return false;
    if (index !== undefined && focusedInput.index !== index) return false;
    return true;
  };

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ userSelect: 'none', display: 'block' }}
    >
      <rect width={VB_W} height={VB_H} fill={bg} rx="4" />

      {/* ── Title ── */}
      {chart.title && (
        <text
          x={VB_W / 2}
          y={16}
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontSize="18"
          fontWeight="700"
          fill={fg}
        >
          {chart.title}
        </text>
      )}

      {/* ── Top indicators (X / O) ── */}
      {chart.topIndicators.map((ind, i) => {
        const x = padLR + i * cellW;
        const hasValue = ind && ind.trim().length > 0;
        const isFocused = isFieldFocused('topIndicator', i);
        return (
          <g key={`top-${i}`}>
            {hasValue && (
              <text x={x} y={padTop - 6} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="700" fill={isFocused ? accent : fg}>
                {ind.toUpperCase()}
              </text>
            )}
            {interactive && !hasValue && (
              <circle cx={x} cy={padTop - 10} r={editorDotR} fill={isFocused ? accent : fg} opacity={isFocused ? 0.7 : 0.2} />
            )}
            {interactive && (
              <rect x={x - cellW / 2} y={padTop - 22} width={cellW} height={20} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onTopIndicatorClick?.(i)} />
            )}
          </g>
        );
      })}

      {/* ── Nut line ── */}
      <line x1={padLR} y1={padTop} x2={padLR + gridW} y2={padTop} stroke={fg} strokeWidth={chart.nutThickness === 'thick' ? 3.5 : 1} strokeLinecap="square" style={{ cursor: interactive ? 'pointer' : 'default' }} onClick={() => interactive && onNutClick?.()} />
      {interactive && (
        <rect x={padLR} y={padTop - 5} width={gridW} height={10} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onNutClick?.()} />
      )}

      {/* ── Fret Number (shown when nut is thin and startFret > 0) ── */}
      {chart.nutThickness === 'thin' && (chart.startFret || 0) > 0 && (
        <text
          x={padLR - 10}
          y={padTop + cellH * 0.5}
          textAnchor="end"
          dominantBaseline="central"
          fontFamily="Inter, sans-serif"
          fontSize="11"
          fontWeight="700"
          fill={isFieldFocused('startFret', chart.startFret) ? accent : fg}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onClick={() => interactive && onStartFretClick?.(chart.startFret)}
        >
          {chart.startFret}
        </text>
      )}

      {/* ── Editor-only: grey dots on EACH fret row (left side) ── */}
      {interactive && Array.from({ length: NUM_FRETS }, (_, f) => {
        const fretIndex = f + 1;
        const y = padTop + (fretIndex - 0.5) * cellH;
        const isActive = chart.nutThickness === 'thin' && chart.startFret === fretIndex;
        const isFocused = isFieldFocused('startFret', fretIndex);
        return (
          <g key={`fret-dot-${f}`}>
            {!isActive && (
              <circle cx={padLR - 14} cy={y} r={editorDotR} fill={isFocused ? accent : fg} opacity={isFocused ? 0.7 : 0.15} />
            )}
            {isActive && (
              <circle cx={padLR - 14} cy={y} r={editorDotR + 1} fill={accent} opacity={0.8} />
            )}
            <rect x={0} y={padTop + f * cellH} width={padLR - 4} height={cellH} fill="transparent" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onStartFretClick?.(fretIndex); }} />
          </g>
        );
      })}

      {/* ── Fret lines ── */}
      {Array.from({ length: NUM_FRETS }, (_, f) => (
        <line key={`fret-${f}`} x1={padLR} y1={padTop + (f + 1) * cellH} x2={padLR + gridW} y2={padTop + (f + 1) * cellH} stroke={fg} strokeWidth={0.8} strokeLinecap="square" />
      ))}

      {/* ── String lines ── */}
      {Array.from({ length: NUM_STRINGS }, (_, s) => (
        <line key={`string-${s}`} x1={padLR + s * cellW} y1={padTop} x2={padLR + s * cellW} y2={padTop + gridH} stroke={fg} strokeWidth={0.8} strokeLinecap="square" />
      ))}

      {/* ── Cell hit targets (editor only) ── */}
      {interactive && Array.from({ length: NUM_STRINGS }, (_, s) =>
        Array.from({ length: NUM_FRETS }, (_, f) => {
          const fretIndex = f + 1;
          const existing = getMarkerAt(s, fretIndex);
          if (existing) return null;
          const x = padLR + s * cellW - cellW / 2;
          const y = padTop + f * cellH;
          return (
            <rect key={`cell-${s}-${fretIndex}`} x={Math.max(0, x)} y={y} width={cellW} height={cellH} fill="transparent"
              style={{ cursor: draggingMarker ? 'crosshair' : 'pointer' }}
              onClick={() => { if (draggingMarker) { onMarkerDrop?.(s, fretIndex); } else { onCellClick?.(s, fretIndex); } }}
            />
          );
        })
      )}

      {/* ── Connectors / barre lines ── */}
      {chart.connectors.map(conn => {
        const from = chart.markers.find(m => m.id === conn.fromMarkerId);
        const to = chart.markers.find(m => m.id === conn.toMarkerId);
        if (!from || !to) return null;
        const x1 = padLR + from.stringIndex * cellW;
        const y1 = padTop + (from.fretIndex - 0.5) * cellH;
        const x2 = padLR + to.stringIndex * cellW;
        const y2 = padTop + (to.fretIndex - 0.5) * cellH;
        const isConnSelected = selectedConnectorId === conn.id;
        return (
          <g key={conn.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isConnSelected ? accent : fg} strokeWidth={isConnSelected ? 4 : 3.5} strokeLinecap="round" />
            {interactive && (
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} strokeLinecap="round" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onConnectorClick?.(conn.id); }} />
            )}
          </g>
        );
      })}

      {/* ── Markers ── */}
      {chart.markers.map(marker => {
        const cx = padLR + marker.stringIndex * cellW;
        const cy = padTop + (marker.fretIndex - 0.5) * cellH;
        const isSelected = selectedMarkerId === marker.id;
        const isDragging = draggingMarker === marker.id;
        const strokeColor = isSelected ? accent : fg;
        const strokeW = isSelected ? 2 : 1.3;
        const hasLabel = marker.label && marker.label.trim().length > 0;

        return (
          <g key={marker.id}
            style={{ cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default', opacity: isDragging ? 0.5 : 1 }}
            onClick={(e) => { e.stopPropagation(); if (interactive) onMarkerClick?.(marker.id); }}
            onMouseDown={(e) => { if (interactive && e.button === 0) { e.stopPropagation(); onMarkerDragStart?.(marker.id); } }}
          >
            {hasLabel ? (
              <>
                <circle cx={cx} cy={cy} r={markerR} fill={bg} stroke={strokeColor} strokeWidth={strokeW} />
                {marker.ringStyle === 'double' && (
                  <circle cx={cx} cy={cy} r={markerR * 0.72} fill={bg} stroke={strokeColor} strokeWidth={strokeW * 0.8} />
                )}
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700" fill={fg}>
                  {marker.label}
                </text>
              </>
            ) : (
              <>
                <circle cx={cx} cy={cy} r={markerR} fill={isSelected ? accent : fg} stroke={isSelected ? accent : 'none'} strokeWidth={isSelected ? 2 : 0} />
                {marker.ringStyle === 'double' && (
                  <circle cx={cx} cy={cy} r={markerR * 0.72} fill={isSelected ? accent : fg} stroke={bg} strokeWidth={1} />
                )}
              </>
            )}
            {interactive && <circle cx={cx} cy={cy} r={markerR + 4} fill="transparent" />}
          </g>
        );
      })}

      {/* ── Bottom note labels ── */}
      {chart.bottomNoteLabels.map((label, i) => {
        const x = padLR + i * cellW;
        const y = padTop + gridH + 16;
        const hasValue = label && label.trim().length > 0;
        const isFocused = isFieldFocused('bottomNote', i);
        return (
          <g key={`bnl-${i}`}>
            {hasValue && <text x={x} y={y} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill={isFocused ? accent : fg} opacity={isFocused ? 1 : 0.5}>{label}</text>}
            {interactive && !hasValue && <circle cx={x} cy={y - 3} r={editorDotR - 1} fill={isFocused ? accent : fg} opacity={isFocused ? 0.7 : 0.15} />}
            {interactive && <rect x={x - cellW / 2} y={y - 10} width={cellW} height={16} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onBottomNoteLabelClick?.(i)} />}
          </g>
        );
      })}

      {/* ── Bottom interval labels ── */}
      {chart.bottomIntervalLabels.map((label, i) => {
        const x = padLR + i * cellW;
        const y = padTop + gridH + 30;
        const hasValue = label && label.trim().length > 0;
        const isFocused = isFieldFocused('bottomInterval', i);
        return (
          <g key={`bil-${i}`}>
            {hasValue && <text x={x} y={y} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="600" fill={isFocused ? accent : fg}>{label}</text>}
            {interactive && !hasValue && <circle cx={x} cy={y - 3} r={editorDotR - 1} fill={isFocused ? accent : fg} opacity={isFocused ? 0.7 : 0.15} />}
            {interactive && <rect x={x - cellW / 2} y={y - 10} width={cellW} height={16} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onBottomIntervalLabelClick?.(i)} />}
          </g>
        );
      })}
    </svg>
  );
}
