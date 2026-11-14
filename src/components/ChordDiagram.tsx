import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Called when a dot is dragged onto an empty spot. */
  onMarkerMove?: (markerId: string, stringIndex: number, fretIndex: number) => void;
  /** Called when a dot is dragged onto another dot (join them, e.g. for a barre). */
  onMarkerJoin?: (fromMarkerId: string, toMarkerId: string) => void;
  svgRef?: React.Ref<SVGSVGElement>;
}

const NUM_STRINGS = 6;
const NUM_FRETS = 5;

const VB_W = 200;
const VB_H = 280;

interface DragState {
  id: string;
  startX: number;
  startY: number;
  active: boolean;
  px: number;
  py: number;
  joinId: string | null;
  cell: { s: number; f: number } | null;
}

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
  onMarkerMove,
  onMarkerJoin,
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
  // Editor-only tap dots (not drawn in exports). Big enough for a fingertip.
  const editorDotR = 6;

  const getMarkerAt = (s: number, f: number): ChartMarker | undefined =>
    chart.markers.find(m => m.stringIndex === s && m.fretIndex === f);

  // ── Drag a dot: onto an empty spot to move it, onto another dot to join them ──
  const localSvg = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const setSvgRefs = useCallback((el: SVGSVGElement | null) => {
    localSvg.current = el;
    if (typeof svgRef === 'function') svgRef(el);
    else if (svgRef) (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = el;
  }, [svgRef]);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = localSvg.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const resolveDropTarget = (px: number, py: number, originId: string) => {
    const inGrid = px >= padLR - cellW / 2 && px <= padLR + gridW + cellW / 2 && py >= padTop && py <= padTop + gridH;
    if (!inGrid) return { joinId: null, cell: null };
    const s = Math.max(0, Math.min(NUM_STRINGS - 1, Math.round((px - padLR) / cellW)));
    const f = Math.max(1, Math.min(NUM_FRETS, Math.floor((py - padTop) / cellH) + 1));
    const occupant = getMarkerAt(s, f);
    if (occupant && occupant.id !== originId) return { joinId: occupant.id, cell: null };
    return { joinId: null, cell: { s, f } };
  };

  const startMarkerDrag = (e: React.PointerEvent, marker: ChartMarker) => {
    if (!interactive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { id: marker.id, startX: e.clientX, startY: e.clientY, active: false, px: 0, py: 0, joinId: null, cell: null };

    const onMove = (ev: PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;
      // Small movements are still a tap (select the dot), not a drag.
      if (!st.active && Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY) < 6) return;
      const p = toSvgPoint(ev.clientX, ev.clientY);
      if (!p) return;
      const next = { ...st, active: true, px: p.x, py: p.y, ...resolveDropTarget(p.x, p.y, st.id) };
      dragRef.current = next;
      setDrag(next);
    };
    // Stop the page scrolling while a dot is being dragged on a touch screen.
    const onTouchMove = (ev: TouchEvent) => {
      if (dragRef.current?.active && ev.cancelable) ev.preventDefault();
    };
    const finish = (ev: PointerEvent) => {
      const st = dragRef.current;
      cleanup();
      if (!st?.active || ev.type === 'pointercancel') return;
      // The browser sends a click after a drag; ignore it so the dot isn't re-selected.
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 60);
      if (st.joinId) onMarkerJoin?.(st.id, st.joinId);
      else if (st.cell) {
        const origin = chart.markers.find(m => m.id === st.id);
        if (origin && (origin.stringIndex !== st.cell.s || origin.fretIndex !== st.cell.f)) {
          onMarkerMove?.(st.id, st.cell.s, st.cell.f);
        }
      }
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('touchmove', onTouchMove);
      dragRef.current = null;
      cleanupRef.current = null;
      setDrag(null);
    };
    cleanupRef.current?.();
    cleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
  };

  const draggedMarker = drag?.active ? chart.markers.find(m => m.id === drag.id) : undefined;
  const joinTarget = drag?.active && drag.joinId ? chart.markers.find(m => m.id === drag.joinId) : undefined;
  const markerCenter = (m: ChartMarker) => ({
    x: padLR + m.stringIndex * cellW,
    y: padTop + (m.fretIndex - 0.5) * cellH,
  });

  const isFieldFocused = (type: string, index?: number): boolean => {
    if (!focusedInput) return false;
    if (focusedInput.type !== type) return false;
    if (index !== undefined && focusedInput.index !== index) return false;
    return true;
  };

  return (
    <svg
      ref={setSvgRefs}
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
              <circle cx={x} cy={padTop - 19} r={editorDotR} fill={isFocused ? accent : fg} opacity={isFocused ? 0.8 : 0.28} />
            )}
            {interactive && (
              <rect x={x - cellW / 2} y={padTop - 36} width={cellW} height={30} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onTopIndicatorClick?.(i)} />
            )}
          </g>
        );
      })}

      {/* ── Nut line ── */}
      <line x1={padLR} y1={padTop} x2={padLR + gridW} y2={padTop} stroke={fg} strokeWidth={chart.nutThickness === 'thick' ? 3.5 : 1} strokeLinecap="square" style={{ cursor: interactive ? 'pointer' : 'default' }} onClick={() => interactive && onNutClick?.()} />
      {interactive && (
        <rect x={padLR} y={padTop - 4} width={gridW} height={8} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onNutClick?.()} />
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

      {/* ── Editor-only: dots on each fret row (left side). Tap one, then type the fret number. ── */}
      {interactive && Array.from({ length: NUM_FRETS }, (_, f) => {
        const fretIndex = f + 1;
        const y = padTop + (fretIndex - 0.5) * cellH;
        const numberShownHere = fretIndex === 1 && chart.nutThickness === 'thin' && (chart.startFret || 0) > 0;
        const isFocused = isFieldFocused('startFret', fretIndex);
        return (
          <g key={`fret-dot-${f}`}>
            {!numberShownHere && (
              <circle cx={padLR - 15} cy={y} r={editorDotR} fill={isFocused ? accent : fg} opacity={isFocused ? 0.8 : 0.25} />
            )}
            <rect x={0} y={padTop + f * cellH} width={padLR - 2} height={cellH} fill="transparent" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onStartFretClick?.(fretIndex); }} />
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
              style={{ cursor: 'pointer' }}
              onClick={() => onCellClick?.(s, fretIndex)}
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

      {/* ── Join preview: a line from the dragged dot to the dot it will join ── */}
      {draggedMarker && joinTarget && (
        <line
          x1={markerCenter(draggedMarker).x} y1={markerCenter(draggedMarker).y}
          x2={markerCenter(joinTarget).x} y2={markerCenter(joinTarget).y}
          stroke={accent} strokeWidth={4} strokeLinecap="round" opacity={0.85}
        />
      )}

      {/* ── Markers ── */}
      {chart.markers.map(marker => {
        const cx = padLR + marker.stringIndex * cellW;
        const cy = padTop + (marker.fretIndex - 0.5) * cellH;
        const isSelected = selectedMarkerId === marker.id;
        const isDragging = drag?.active === true && drag.id === marker.id;
        const strokeColor = isSelected ? accent : fg;
        const strokeW = isSelected ? 2 : 1.3;
        const hasLabel = marker.label && marker.label.trim().length > 0;

        return (
          <g key={marker.id}
            style={{ cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default', opacity: isDragging ? 0.3 : 1, touchAction: interactive ? 'none' : undefined }}
            onClick={(e) => { e.stopPropagation(); if (interactive && !suppressClick.current) onMarkerClick?.(marker.id); }}
            onPointerDown={(e) => { if (interactive) { e.stopPropagation(); startMarkerDrag(e, marker); } }}
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

      {/* ── Drag feedback: ring on the dot you'll join, or a ghost dot where this one will land ── */}
      {draggedMarker && joinTarget && (
        <circle cx={markerCenter(joinTarget).x} cy={markerCenter(joinTarget).y} r={markerR + 3.5} fill="none" stroke={accent} strokeWidth={2.5} pointerEvents="none" />
      )}
      {draggedMarker && drag && !joinTarget && (
        drag.cell ? (
          <g pointerEvents="none">
            <rect x={padLR + drag.cell.s * cellW - cellW / 2} y={padTop + (drag.cell.f - 1) * cellH} width={cellW} height={cellH} fill={accent} opacity={0.12} />
            <circle cx={padLR + drag.cell.s * cellW} cy={padTop + (drag.cell.f - 0.5) * cellH} r={markerR} fill={accent} opacity={0.85} />
          </g>
        ) : (
          <circle cx={drag.px} cy={drag.py} r={markerR} fill={accent} opacity={0.35} pointerEvents="none" />
        )
      )}

      {/* ── Bottom note labels ── */}
      {chart.bottomNoteLabels.map((label, i) => {
        const x = padLR + i * cellW;
        const y = padTop + gridH + 16;
        const hasValue = label && label.trim().length > 0;
        const isFocused = isFieldFocused('bottomNote', i);
        return (
          <g key={`bnl-${i}`}>
            {hasValue && <text x={x} y={y} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill={isFocused ? accent : fg} opacity={isFocused ? 1 : 0.5}>{label}</text>}
            {interactive && !hasValue && <circle cx={x} cy={y - 3} r={4.5} fill={isFocused ? accent : fg} opacity={isFocused ? 0.8 : 0.28} />}
            {interactive && <rect x={x - cellW / 2} y={y - 10} width={cellW} height={14} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onBottomNoteLabelClick?.(i)} />}
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
            {interactive && !hasValue && <circle cx={x} cy={y - 3} r={4.5} fill={isFocused ? accent : fg} opacity={isFocused ? 0.8 : 0.28} />}
            {interactive && <rect x={x - cellW / 2} y={y - 10} width={cellW} height={14} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onBottomIntervalLabelClick?.(i)} />}
          </g>
        );
      })}
    </svg>
  );
}
