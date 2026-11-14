import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { SheetNote, createEmptyChart, createEmptySheet } from '../types';
import ChordDiagram from './ChordDiagram';
import FloatingKeyboard from './FloatingKeyboard';
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
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
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

  const getInputValue = (): string => {
    if (!activeInput) return '';
    switch (activeInput.type) {
      case 'sheetTitle': return currentSheet.title;
      case 'note': {
        const n = currentSheet.notes.find(n => n.id === activeInput.noteId);
        return n?.text || '';
      }
    }
  };

  const getInputLabel = (): string => {
    if (!activeInput) return 'Click a field to edit';
    switch (activeInput.type) {
      case 'sheetTitle': return 'Sheet Title';
      case 'note': return 'Note Text';
    }
  };

  const handleKeyboardInput = useCallback(
    (value: string) => {
      if (!activeInput) return;
      switch (activeInput.type) {
        case 'sheetTitle':
          updateSheet({ title: currentSheet.title + value });
          break;
        case 'note': {
          const notes = currentSheet.notes.map(n =>
            n.id === activeInput.noteId ? { ...n, text: n.text + value } : n
          );
          updateSheet({ notes });
          break;
        }
      }
    },
    [activeInput, currentSheet, updateSheet]
  );

  const handleBackspace = useCallback(() => {
    if (!activeInput) return;
    switch (activeInput.type) {
      case 'sheetTitle':
        updateSheet({ title: currentSheet.title.slice(0, -1) });
        break;
      case 'note': {
        const notes = currentSheet.notes.map(n =>
          n.id === activeInput.noteId ? { ...n, text: n.text.slice(0, -1) } : n
        );
        updateSheet({ notes });
        break;
      }
    }
  }, [activeInput, currentSheet, updateSheet]);

  const handleSpace = useCallback(() => {
    handleKeyboardInput(' ');
  }, [handleKeyboardInput]);

  // Slot drag & drop (reorder)
  const handleSlotDragStart = (slotIndex: number) => { setDraggingSlot(slotIndex); };
  const handleSlotDragOver = (e: React.DragEvent, targetIndex: number) => { e.preventDefault(); setDragOverSlot(targetIndex); };
  const handleSlotDragLeave = () => { setDragOverSlot(null); };
  const handleSlotDrop = (targetIndex: number) => {
    if (draggingSlot === null || draggingSlot === targetIndex) { setDraggingSlot(null); setDragOverSlot(null); return; }
    const slots = [...currentSheet.slots];
    const temp = slots[draggingSlot];
    slots[draggingSlot] = slots[targetIndex];
    slots[targetIndex] = temp;
    updateSheet({ slots });
    setDraggingSlot(null);
    setDragOverSlot(null);
  };
  const handleSlotDragEnd = () => { setDraggingSlot(null); setDragOverSlot(null); };

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

  const handleNoteDragStart = (noteId: string, e: React.MouseEvent) => {
    const note = currentSheet.notes.find(n => n.id === noteId);
    if (!note || !sheetRef.current) return;
    const rect = sheetRef.current.getBoundingClientRect();
    setDraggingNote(noteId);
    setDragOffset({ x: e.clientX - rect.left - note.x, y: e.clientY - rect.top - note.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNote || !sheetRef.current) return;
    const rect = sheetRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 50, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(rect.height - 30, e.clientY - rect.top - dragOffset.y));
    const notes = currentSheet.notes.map(n => n.id === draggingNote ? { ...n, x, y } : n);
    updateSheet({ notes });
  };

  const handleMouseUp = () => { setDraggingNote(null); };

  const handleExportPDF = async () => { await exportSheetToPDF(currentSheet, charts, theme); };

  // Save options: Overwrite or Save New Copy
  const handleSaveOverwrite = () => {
    dispatch({ type: 'SAVE_SHEET' });
    setShowSaveOptions(false);
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
    }
  };

  // Double-click slot chart to open in editor
  const handleSlotDoubleClick = (chartId: string) => {
    dispatch({ type: 'LOAD_CHART', id: chartId });
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeInput) return;
      if (e.key === 'Backspace') { e.preventDefault(); handleBackspace(); }
      else if (e.key === ' ') { e.preventDefault(); handleSpace(); }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); handleKeyboardInput(e.key); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeInput, handleBackspace, handleSpace, handleKeyboardInput]);

  const displayTitle = titleCase === 'normal' ? currentSheet.title : applyCase(currentSheet.title, titleCase);

  return (
    <div className="lesson-sheet-composer">
      <div className="composer-toolbar">
        <button className="btn btn-secondary toolbar-nav" onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' })}>
          Back to Editor
        </button>
        <button className="btn btn-secondary toolbar-nav" onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'library' })}>
          Library
        </button>
        <button className="btn btn-secondary" onClick={addNote}>Add Note</button>
        <button className="btn btn-primary" onClick={handleSaveToLibrary}>Save to Library</button>
        <button className="btn btn-primary" onClick={handleExportPDF}>Export PDF</button>
      </div>

      <div className="composer-scroll-area">
        <div
          ref={sheetRef}
          className="sheet-page"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Header */}
          <div className="sheet-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              className={`sheet-title-field ${activeInput?.type === 'sheetTitle' ? 'active' : ''}`}
              onClick={() => setActiveInput({ type: 'sheetTitle' })}
            >
              {displayTitle || 'Click to add title'}
              {activeInput?.type === 'sheetTitle' && <span className="cursor-blink">|</span>}
            </div>
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
              const isDragOver = dragOverSlot === i && draggingSlot !== i;
              const isSelected = selectedSlots.has(i);
              return (
                <div
                  key={i}
                  className={`sheet-slot ${draggingSlot === i ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'drag-over' : ''}`}
                  draggable={!!chartId}
                  onDragStart={() => handleSlotDragStart(i)}
                  onDragOver={e => handleSlotDragOver(e, i)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={() => handleSlotDrop(i)}
                  onDragEnd={handleSlotDragEnd}
                  onClick={e => handleSlotClick(i, e)}
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
          {currentSheet.notes.map(note => (
            <div
              key={note.id}
              className={`sheet-note ${activeInput?.type === 'note' && activeInput.noteId === note.id ? 'active' : ''}`}
              style={{ left: note.x, top: note.y, position: 'absolute' }}
              onMouseDown={e => handleNoteDragStart(note.id, e)}
              onClick={() => setActiveInput({ type: 'note', noteId: note.id })}
            >
              <span className="note-text">
                {note.text || 'Click to edit'}
                {activeInput?.type === 'note' && activeInput.noteId === note.id && <span className="cursor-blink">|</span>}
              </span>
              <button className="note-delete" onClick={e => { e.stopPropagation(); deleteNote(note.id); }}>
                {'\u00D7'}
              </button>
            </div>
          ))}

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

      {/* Floating keyboard */}
      <FloatingKeyboard
        inputLabel={getInputLabel()}
        inputValue={getInputValue()}
        isActive={!!activeInput}
        onInput={handleKeyboardInput}
        onBackspace={handleBackspace}
        onSpace={handleSpace}
      />
    </div>
  );
}
