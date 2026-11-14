import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { SheetNote, createEmptyChart, createEmptySheet } from '../types';
import ChordDiagram from './ChordDiagram';
import { beginPointerDrag, justDragged } from '../utils/pointerDrag';
import { exportSheetToPDF } from '../utils/pdfExport';

type SheetInputTarget =
  | { type: 'sheetTitle' }
  | { type: 'note'; noteId: string };

type TitleCase = 'normal' | 'upper' | 'lower' | 'title';

const BLANK_CHART = createEmptyChart();

function applyCase(text: string, caseType: TitleCase): string {
  switch (caseType) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    default: return text;
  }
}

export default function LessonSheetComposer() {
  const { state, dispatch } = useApp();
  const { currentSheet, charts, theme } = state;
  const [activeInput, setActiveInput] = useState<SheetInputTarget | null>(null);
  // A chart being dragged to another square: where it started, where the finger/mouse is, and which square it's over
  const [slotDrag, setSlotDrag] = useState<{ from: number; x: number; y: number; over: number | null } | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [titleCase, setTitleCase] = useState<TitleCase>('normal');
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const sheetRef = useRef<HTMLDivElement>(null);

  // Charts sorted most recent first for the picker
  const sortedCharts = useMemo(() =>
    [...charts].sort((a, b) => b.updatedAt - a.updatedAt),
    [charts]
  );

  const updateSheet = useCallback(
    (updates: Partial<typeof currentSheet>) => {
      dispatch({ type: 'UPDATE_CURRENT_SHEET', sheet: updates });
    },
    [dispatch]
  );

  const setTitle = (title: string) => updateSheet({ title });
  const setNoteText = (noteId: string, text: string) =>
    updateSheet({ notes: currentSheet.notes.map(n => n.id === noteId ? { ...n, text } : n) });

  // ♭ ♯ Δ ø buttons: insert a symbol at the cursor of whichever text field is being edited
  const insertSymbol = (symbol: string) => {
    const el = inputRef.current;
    if (!el || !activeInput) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + symbol + el.value.slice(end);
    if (activeInput.type === 'sheetTitle') setTitle(next);
    else setNoteText(activeInput.noteId, next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + symbol.length, start + symbol.length); });
  };

  // Drag a chart to another square (mouse, or touch: press and hold, then drag). Swaps the two squares.
  const slotAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-slot]') as HTMLElement | null;
    return el ? Number(el.dataset.slot) : null;
  };

  const startSlotDrag = (e: React.PointerEvent, index: number) => {
    if (!currentSheet.slots[index]) return;
    if ((e.target as HTMLElement).closest('.slot-remove')) return;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let scrollTimer: ReturnType<typeof setInterval> | undefined;

    const stopScrolling = () => { if (scrollTimer) clearInterval(scrollTimer); scrollTimer = undefined; };
    // Keep the sheet scrolling while the chart is held near an edge, so it can be carried across a wide sheet
    const autoScroll = () => {
      const area = scrollAreaRef.current;
      if (!area) return;
      const r = area.getBoundingClientRect();
      const edge = 56;
      const dx = lastX < r.left + edge ? -14 : lastX > r.right - edge ? 14 : 0;
      const dy = lastY < r.top + edge ? -14 : lastY > r.bottom - edge ? 14 : 0;
      if (dx || dy) {
        area.scrollBy(dx, dy);
        setSlotDrag(d => d && { ...d, over: slotAt(lastX, lastY) });
      }
    };

    beginPointerDrag(e, {
      onStart: (x, y) => {
        lastX = x; lastY = y;
        setSlotDrag({ from: index, x, y, over: slotAt(x, y) });
        scrollTimer = setInterval(autoScroll, 30);
      },
      onMove: (x, y) => {
        lastX = x; lastY = y;
        setSlotDrag({ from: index, x, y, over: slotAt(x, y) });
      },
      onEnd: (x, y) => {
        stopScrolling();
        const target = slotAt(x, y);
        setSlotDrag(null);
        if (target === null || target === index) return;
        const slots = [...currentSheet.slots];
        [slots[index], slots[target]] = [slots[target], slots[index]];
        updateSheet({ slots });
      },
      onCancel: () => { stopScrolling(); setSlotDrag(null); },
    });
  };

  const removeFromSlot = (index: number) => {
    const slots = [...currentSheet.slots];
    slots[index] = null;
    updateSheet({ slots });
  };

  // Multi-select with Ctrl/Cmd+click
  const handleSlotClick = (index: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedSlots);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setSelectedSlots(next);
    } else {
      setSelectedSlots(new Set());
    }
  };

  // Copy selected slots (Ctrl/Cmd+C)
  const handleCopyPaste = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedSlots.size > 0) {
      // Store selected chart IDs in a session variable
      const ids = Array.from(selectedSlots).map(i => currentSheet.slots[i]).filter(Boolean);
      (window as any).__holorhythm_clipboard = ids;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      const ids = (window as any).__holorhythm_clipboard;
      if (ids && ids.length > 0) {
        const slots = [...currentSheet.slots];
        let placed = 0;
        for (let i = 0; i < 16 && placed < ids.length; i++) {
          if (slots[i] === null) {
            slots[i] = ids[placed];
            placed++;
          }
        }
        if (placed > 0) updateSheet({ slots });
      }
    }
  }, [selectedSlots, currentSheet, updateSheet]);

  useEffect(() => {
    window.addEventListener('keydown', handleCopyPaste);
    return () => window.removeEventListener('keydown', handleCopyPaste);
  }, [handleCopyPaste]);

  // Picker: add chart to a specific slot
  const handlePickChart = (chartId: string) => {
    if (pickerSlot === null) return;
    const slots = [...currentSheet.slots];
    slots[pickerSlot] = chartId;
    updateSheet({ slots });
    setPickerSlot(null);
  };

  const addNote = () => {
    const newNote: SheetNote = { id: crypto.randomUUID(), x: 100, y: 300, text: '' };
    updateSheet({ notes: [...currentSheet.notes, newNote] });
    setActiveInput({ type: 'note', noteId: newNote.id });
  };

  const deleteNote = (noteId: string) => {
    const notes = currentSheet.notes.filter(n => n.id !== noteId);
    updateSheet({ notes });
    if (activeInput?.type === 'note' && activeInput.noteId === noteId) setActiveInput(null);
  };

  // Move a note: mouse drag, or press and hold then drag on touch
  const startNoteDrag = (e: React.PointerEvent, noteId: string) => {
    if ((e.target as HTMLElement).closest('input, .note-delete')) return;
    const note = currentSheet.notes.find(n => n.id === noteId);
    const sheet = sheetRef.current;
    if (!note || !sheet) return;
    const rect = sheet.getBoundingClientRect();
    const offX = e.clientX - rect.left - note.x;
    const offY = e.clientY - rect.top - note.y;
    const place = (x: number, y: number) => {
      const r = sheet.getBoundingClientRect();
      const nx = Math.max(0, Math.min(r.width - 50, x - r.left - offX));
      const ny = Math.max(0, Math.min(r.height - 30, y - r.top - offY));
      updateSheet({ notes: currentSheet.notes.map(n => n.id === noteId ? { ...n, x: nx, y: ny } : n) });
    };
    beginPointerDrag(e, { onStart: place, onMove: place, onEnd: () => {} });
  };

  const handleExportPDF = async () => { await exportSheetToPDF(currentSheet, charts, theme); };

  // Save options: Overwrite or Save New Copy
  const handleSaveOverwrite = () => {
    dispatch({ type: 'SAVE_SHEET' });
    setShowSaveOptions(false);
    dispatch({ type: 'SHOW_TOAST', message: 'Saved' });
  };

  const handleSaveNewCopy = () => {
    // Create a new sheet with a new ID, copying current content
    const newSheet = {
      ...currentSheet,
      id: crypto.randomUUID(),
      title: currentSheet.title ? `${currentSheet.title} (Copy)` : 'Untitled Sheet (Copy)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'SET_CURRENT_SHEET', sheet: newSheet });
    dispatch({ type: 'SAVE_SHEET' });
    setShowSaveOptions(false);
    // Navigate to library so saved sheet is not "active" anymore
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'library' });
    dispatch({ type: 'SHOW_TOAST', message: 'Saved as a new copy' });
  };

  const handleSaveToLibrary = () => {
    // Check if this sheet already exists in library
    const existsInLibrary = state.sheets.some(s => s.id === currentSheet.id);
    if (existsInLibrary) {
      setShowSaveOptions(true);
    } else {
      // First save — just save and go to library
      dispatch({ type: 'SAVE_SHEET' });
      dispatch({ type: 'SET_ACTIVE_VIEW', view: 'library' });
      dispatch({ type: 'SHOW_TOAST', message: 'Saved to library' });
    }
  };

  // Double-click slot chart to open in editor
  const handleSlotDoubleClick = (chartId: string) => {
    dispatch({ type: 'LOAD_CHART', id: chartId });
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' });
  };



  const displayTitle = titleCase === 'normal' ? currentSheet.title : applyCase(currentSheet.title, titleCase);

  return (
    <div className="lesson-sheet-composer">
      <div className="composer-toolbar">
        <button className="btn btn-secondary" onClick={addNote}>Add Note</button>
        <button className="btn btn-primary" onClick={handleSaveToLibrary}>Save to Library</button>
        <button className="btn btn-primary" onClick={handleExportPDF}>Export PDF</button>
      </div>

      {activeInput && (
        <div className="symbol-strip" aria-label="Music symbols">
          <span className="symbol-strip-label">Symbols</span>
          {['\u266D', '\u266F', '\u0394', '\u00F8'].map(sym => (
            <button
              key={sym}
              className="symbol-btn"
              // pointerdown + preventDefault keeps the text field focused so the phone keyboard stays open
              onPointerDown={e => { e.preventDefault(); insertSymbol(sym); }}
            >
              {sym}
            </button>
          ))}
        </div>
      )}

      <div className="composer-scroll-area" ref={scrollAreaRef}>
        <div
          ref={sheetRef}
          className="sheet-page"
        >
          {/* Header */}
          <div className="sheet-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {activeInput?.type === 'sheetTitle' ? (
              // A real text field, so your phone's own keyboard opens and you can type a song name
              <input
                ref={el => { inputRef.current = el; }}
                className="sheet-title-input"
                type="text"
                value={currentSheet.title}
                placeholder="Song / lesson title"
                autoFocus
                autoCapitalize="words"
                enterKeyHint="done"
                onChange={e => setTitle(e.target.value)}
                onBlur={() => setActiveInput(null)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            ) : (
              <div className="sheet-title-field" onClick={() => setActiveInput({ type: 'sheetTitle' })}>
                {displayTitle || 'Click to add title'}
              </div>
            )}
            {/* Title case toggle */}
            <div className="title-case-toggle">
              <button className={`case-btn ${titleCase === 'normal' ? 'active' : ''}`} onClick={() => setTitleCase('normal')}>Aa</button>
              <button className={`case-btn ${titleCase === 'upper' ? 'active' : ''}`} onClick={() => setTitleCase('upper')}>AA</button>
              <button className={`case-btn ${titleCase === 'lower' ? 'active' : ''}`} onClick={() => setTitleCase('lower')}>aa</button>
              <button className={`case-btn ${titleCase === 'title' ? 'active' : ''}`} onClick={() => setTitleCase('title')}>Tt</button>
            </div>
          </div>

          {/* 4x4 Grid */}
          <div className="sheet-grid">
            {currentSheet.slots.map((chartId, i) => {
              const chart = chartId ? charts.find(c => c.id === chartId) : null;
              const isDragOver = slotDrag !== null && slotDrag.over === i && slotDrag.from !== i;
              const isBeingDragged = slotDrag?.from === i;
              const isSelected = selectedSlots.has(i);
              return (
                <div
                  key={i}
                  data-slot={i}
                  className={`sheet-slot ${chart ? 'has-chart' : ''} ${isBeingDragged ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'drag-over' : ''}`}
                  onPointerDown={e => startSlotDrag(e, i)}
                  onContextMenu={e => { if (chart) e.preventDefault(); }}
                  onClick={e => { if (!justDragged()) handleSlotClick(i, e); }}
                >
                  {isDragOver && <div className="drag-indicator-bar" />}

                  {chart ? (
                    <div className="slot-chart" onDoubleClick={() => handleSlotDoubleClick(chart.id)}>
                      <ChordDiagram chart={chart} width={176} height={230} theme={theme} />
                      <button className="slot-remove" onClick={(e) => { e.stopPropagation(); removeFromSlot(i); }}>
                        {'\u00D7'}
                      </button>
                    </div>
                  ) : (
                    /* Empty slot: show "+" button to pick from library */
                    <button className="slot-add-btn" onClick={() => setPickerSlot(i)} title="Add chord chart">
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Movable notes */}
          {currentSheet.notes.map(note => {
            const editing = activeInput?.type === 'note' && activeInput.noteId === note.id;
            return (
              <div
                key={note.id}
                className={`sheet-note ${editing ? 'active' : ''}`}
                style={{ left: note.x, top: note.y, position: 'absolute' }}
                onPointerDown={e => startNoteDrag(e, note.id)}
                onClick={() => { if (!justDragged()) setActiveInput({ type: 'note', noteId: note.id }); }}
              >
                {editing ? (
                  // A real text field, so your phone's own keyboard opens
                  <input
                    ref={el => { inputRef.current = el; }}
                    className="note-input"
                    type="text"
                    value={note.text}
                    placeholder="Type a note"
                    size={Math.max(10, note.text.length + 1)}
                    autoFocus
                    enterKeyHint="done"
                    onChange={e => setNoteText(note.id, e.target.value)}
                    onBlur={() => setActiveInput(null)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                ) : (
                  <span className="note-text">{note.text || 'Tap to edit'}</span>
                )}
                <button className="note-delete" onClick={e => { e.stopPropagation(); deleteNote(note.id); }}>
                  {'\u00D7'}
                </button>
              </div>
            );
          })}

          {/* Footer */}
          <div className="sheet-footer">HOLORHYTHM.ORG &copy; 2026</div>
        </div>
      </div>

      {/* Chart Picker Popup */}
      {pickerSlot !== null && (
        <div className="chart-picker-overlay" onClick={() => setPickerSlot(null)}>
          <div className="chart-picker" onClick={e => e.stopPropagation()}>
            <div className="chart-picker-header">
              <h3>Select Chord Chart</h3>
              <button className="btn btn-sm" onClick={() => setPickerSlot(null)}>{'\u00D7'}</button>
            </div>
            {sortedCharts.length === 0 ? (
              <div className="empty-state">No charts in library. Create one in the editor.</div>
            ) : (
              <div className="chart-picker-grid">
                {sortedCharts.map(chart => (
                  <div key={chart.id} className="chart-picker-item" onClick={() => handlePickChart(chart.id)}>
                    <ChordDiagram chart={chart} width={120} height={168} theme={theme} />
                    <span className="picker-title">{chart.title || 'Untitled'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Options Dialog */}
      {showSaveOptions && (
        <div className="dialog-overlay" onClick={() => setShowSaveOptions(false)}>
          <div className="save-options-dialog" onClick={e => e.stopPropagation()}>
            <h3>Save Lesson Sheet</h3>
            <button className="save-option-btn" onClick={handleSaveOverwrite}>
              <strong>Overwrite Current</strong>
              <span>Save changes to the existing sheet in library</span>
            </button>
            <button className="save-option-btn" onClick={handleSaveNewCopy}>
              <strong>Save as New Copy</strong>
              <span>Create a new sheet in library with these contents</span>
            </button>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowSaveOptions(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* The chart you're dragging, following your finger or mouse */}
      {slotDrag && (() => {
        const dragged = charts.find(c => c.id === currentSheet.slots[slotDrag.from]);
        return dragged ? (
          <div className="slot-ghost" style={{ left: slotDrag.x, top: slotDrag.y }}>
            <ChordDiagram chart={dragged} width={110} height={144} theme={theme} />
          </div>
        ) : null;
      })()}
    </div>
  );
}
