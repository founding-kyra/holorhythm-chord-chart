import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store/AppContext';
import { ChartMarker } from '../types';
import ChordDiagram from './ChordDiagram';
import FloatingKeyboard from './FloatingKeyboard';
import { PlusIcon, SaveIcon } from './Icons';
import { useIsPhone } from '../utils/useIsPhone';

type InputTarget =
  | { type: 'title' }
  | { type: 'topIndicator'; index: number }
  | { type: 'markerLabel'; markerId: string }
  | { type: 'bottomNote'; index: number }
  | { type: 'bottomInterval'; index: number }
  | { type: 'startFret'; fretIndex: number };

export default function ChartEditor() {
  const { state, dispatch } = useApp();
  const { currentChart, theme, selectedMarkerId } = state;
  const [activeInput, setActiveInput] = useState<InputTarget | null>(null);
  const [connectMode, setConnectMode] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  // Text cursor position inside the active field (null = at the end)
  const [caret, setCaret] = useState<number | null>(null);
  const isPhone = useIsPhone();
  // On phones New / Save live as icon buttons in the app header instead of taking a row.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setHeaderSlot(document.getElementById('header-actions')); }, []);

  // A newly selected field starts with the cursor at the end
  useEffect(() => { setCaret(null); }, [activeInput]);

  const updateChart = useCallback(
    (updates: Partial<typeof currentChart>) => {
      dispatch({ type: 'UPDATE_CURRENT_CHART', chart: updates });
    },
    [dispatch, currentChart]
  );

  const getInputValue = (): string => {
    if (!activeInput) return '';
    switch (activeInput.type) {
      case 'title': return currentChart.title;
      case 'topIndicator': return currentChart.topIndicators[activeInput.index];
      case 'markerLabel': {
        const m = currentChart.markers.find(m => m.id === activeInput.markerId);
        return m?.label || '';
      }
      case 'bottomNote': return currentChart.bottomNoteLabels[activeInput.index];
      case 'bottomInterval': return currentChart.bottomIntervalLabels[activeInput.index];
      case 'startFret': return String(currentChart.startFret || '');
    }
  };

  const getInputLabel = (): string => {
    if (!activeInput) return 'Click a field to edit';
    switch (activeInput.type) {
      case 'title': return 'Chart Title';
      case 'topIndicator': return `String ${activeInput.index + 1} (X/O)`;
      case 'markerLabel': return 'Marker Label';
      case 'bottomNote': return `Note Label (String ${activeInput.index + 1})`;
      case 'bottomInterval': return `Interval (String ${activeInput.index + 1})`;
      case 'startFret': return `Fret Number (Fret ${activeInput.fretIndex})`;
    }
  };

  // Convert activeInput to a focusedInput prop for the diagram
  const focusedInput = useMemo(() => {
    if (!activeInput) return null;
    switch (activeInput.type) {
      case 'topIndicator': return { type: 'topIndicator', index: activeInput.index };
      case 'bottomNote': return { type: 'bottomNote', index: activeInput.index };
      case 'bottomInterval': return { type: 'bottomInterval', index: activeInput.index };
      case 'startFret': return { type: 'startFret', index: activeInput.fretIndex };
      default: return null;
    }
  }, [activeInput]);

  // ── Tab navigation order ──
  // Build ordered list of tabbable inputs: top indicators L→R, markers top→bottom L→R, bottom notes L→R, bottom intervals L→R
  const tabbableInputs = useMemo((): InputTarget[] => {
    const inputs: InputTarget[] = [];
    // Title
    inputs.push({ type: 'title' });
    // Top indicators L→R
    for (let i = 0; i < 6; i++) inputs.push({ type: 'topIndicator', index: i });
    // Markers sorted: top→bottom (by fretIndex), then left→right (by stringIndex)
    const sortedMarkers = [...currentChart.markers].sort((a, b) => {
      if (a.fretIndex !== b.fretIndex) return a.fretIndex - b.fretIndex;
      return a.stringIndex - b.stringIndex;
    });
    for (const m of sortedMarkers) inputs.push({ type: 'markerLabel', markerId: m.id });
    // Bottom note labels L→R
    for (let i = 0; i < 6; i++) inputs.push({ type: 'bottomNote', index: i });
    // Bottom interval labels L→R
    for (let i = 0; i < 6; i++) inputs.push({ type: 'bottomInterval', index: i });
    return inputs;
  }, [currentChart.markers]);

  const findCurrentTabIndex = (): number => {
    if (!activeInput) return -1;
    return tabbableInputs.findIndex(t => {
      if (t.type !== activeInput.type) return false;
      if (t.type === 'topIndicator' && activeInput.type === 'topIndicator') return t.index === activeInput.index;
      if (t.type === 'markerLabel' && activeInput.type === 'markerLabel') return t.markerId === activeInput.markerId;
      if (t.type === 'bottomNote' && activeInput.type === 'bottomNote') return t.index === activeInput.index;
      if (t.type === 'bottomInterval' && activeInput.type === 'bottomInterval') return t.index === activeInput.index;
      if (t.type === 'startFret' && activeInput.type === 'startFret') return true;
      if (t.type === 'title' && activeInput.type === 'title') return true;
      return false;
    });
  };

  // Write a new value into whichever field is active. Returns false if the value isn't allowed.
  const setInputValue = useCallback((value: string): boolean => {
    if (!activeInput) return false;
    switch (activeInput.type) {
      case 'title':
        updateChart({ title: value });
        return true;
      case 'topIndicator': {
        const arr = [...currentChart.topIndicators] as [string, string, string, string, string, string];
        arr[activeInput.index] = value;
        updateChart({ topIndicators: arr });
        return true;
      }
      case 'markerLabel':
        updateChart({ markers: currentChart.markers.map(m => m.id === activeInput.markerId ? { ...m, label: value } : m) });
        return true;
      case 'bottomNote': {
        const arr = [...currentChart.bottomNoteLabels] as [string, string, string, string, string, string];
        arr[activeInput.index] = value;
        updateChart({ bottomNoteLabels: arr });
        return true;
      }
      case 'bottomInterval': {
        const arr = [...currentChart.bottomIntervalLabels] as [string, string, string, string, string, string];
        arr[activeInput.index] = value;
        updateChart({ bottomIntervalLabels: arr });
        return true;
      }
      case 'startFret': {
        // The fret number: digits only, 1-24. Having a number turns the thick nut into a thin line.
        if (!/^\d{0,2}$/.test(value)) return false;
        const n = value === '' ? 0 : parseInt(value, 10);
        if (n > 24) return false;
        updateChart({ startFret: n, nutThickness: n > 0 ? 'thin' : 'thick' });
        return true;
      }
    }
  }, [activeInput, currentChart, updateChart]);

  const caretPos = (value: string) => (caret === null ? value.length : Math.min(caret, value.length));

  // Typing inserts at the cursor; backspace removes just the character before it.
  const handleKeyboardInput = useCallback((value: string) => {
    if (!activeInput) return;
    const current = getInputValue();
    const pos = caretPos(current);
    if (setInputValue(current.slice(0, pos) + value + current.slice(pos))) setCaret(pos + value.length);
  }, [activeInput, currentChart, caret, setInputValue]);

  const handleBackspace = useCallback(() => {
    if (!activeInput) return;
    const current = getInputValue();
    const pos = caretPos(current);
    if (pos === 0) return;
    if (setInputValue(current.slice(0, pos - 1) + current.slice(pos))) setCaret(pos - 1);
  }, [activeInput, currentChart, caret, setInputValue]);

  const handleMoveCaret = useCallback((delta: -1 | 1) => {
    const current = getInputValue();
    setCaret(Math.max(0, Math.min(current.length, caretPos(current) + delta)));
  }, [activeInput, currentChart, caret]);

  const handleSpace = useCallback(() => {
    handleKeyboardInput(' ');
  }, [handleKeyboardInput]);

  // Cell click: place marker
  const handleCellClick = useCallback(
    (stringIndex: number, fretIndex: number) => {
      const newMarker: ChartMarker = {
        id: crypto.randomUUID(),
        stringIndex,
        fretIndex,
        label: '',
        ringStyle: 'single',
      };
      updateChart({ markers: [...currentChart.markers, newMarker] });
      dispatch({ type: 'SET_SELECTED_MARKER', id: newMarker.id });
      setActiveInput({ type: 'markerLabel', markerId: newMarker.id });
      setSelectedConnectorId(null);
    },
    [currentChart, updateChart, dispatch]
  );

  const handleMarkerClick = useCallback(
    (markerId: string) => {
      if (connectMode) {
        if (connectMode !== markerId) {
          const newConn = {
            id: crypto.randomUUID(),
            fromMarkerId: connectMode,
            toMarkerId: markerId,
          };
          updateChart({ connectors: [...currentChart.connectors, newConn] });
        }
        setConnectMode(null);
        return;
      }
      dispatch({ type: 'SET_SELECTED_MARKER', id: markerId });
      setActiveInput({ type: 'markerLabel', markerId });
      setSelectedConnectorId(null);
    },
    [connectMode, dispatch, currentChart, updateChart]
  );

  // Drag a dot onto an empty spot: move it
  const handleMarkerMove = useCallback((markerId: string, stringIndex: number, fretIndex: number) => {
    const occupied = currentChart.markers.some(m => m.id !== markerId && m.stringIndex === stringIndex && m.fretIndex === fretIndex);
    if (occupied) return;
    const markers = currentChart.markers.map(m =>
      m.id === markerId ? { ...m, stringIndex, fretIndex } : m
    );
    updateChart({ markers });
  }, [currentChart, updateChart]);

  // Drag a dot onto another dot: join them with a bar line (e.g. a barre chord)
  const handleMarkerJoin = useCallback((fromMarkerId: string, toMarkerId: string) => {
    if (fromMarkerId === toMarkerId) return;
    const existing = currentChart.connectors.find(c =>
      (c.fromMarkerId === fromMarkerId && c.toMarkerId === toMarkerId) ||
      (c.fromMarkerId === toMarkerId && c.toMarkerId === fromMarkerId)
    );
    if (existing) {
      setSelectedConnectorId(existing.id);
      return;
    }
    const connector = { id: crypto.randomUUID(), fromMarkerId, toMarkerId };
    updateChart({ connectors: [...currentChart.connectors, connector] });
    // Select the new bar so it's obvious what happened (and easy to remove).
    setSelectedConnectorId(connector.id);
    dispatch({ type: 'SET_SELECTED_MARKER', id: null });
    setActiveInput(null);
  }, [currentChart, updateChart, dispatch]);

  const handleConnectorClick = useCallback((connectorId: string) => {
    setSelectedConnectorId(connectorId);
    dispatch({ type: 'SET_SELECTED_MARKER', id: null });
    setActiveInput(null);
  }, [dispatch]);

  const deleteConnector = useCallback(() => {
    if (!selectedConnectorId) return;
    const connectors = currentChart.connectors.filter(c => c.id !== selectedConnectorId);
    updateChart({ connectors });
    setSelectedConnectorId(null);
  }, [selectedConnectorId, currentChart, updateChart]);

  const handleNutClick = useCallback(() => {
    updateChart({
      nutThickness: currentChart.nutThickness === 'thick' ? 'thin' : 'thick',
    });
  }, [currentChart.nutThickness, updateChart]);

  const handleTopIndicatorClick = useCallback((index: number) => {
    setActiveInput({ type: 'topIndicator', index });
    setSelectedConnectorId(null);
  }, []);

  const handleBottomNoteLabelClick = useCallback((index: number) => {
    setActiveInput({ type: 'bottomNote', index });
    setSelectedConnectorId(null);
  }, []);

  const handleBottomIntervalLabelClick = useCallback((index: number) => {
    setActiveInput({ type: 'bottomInterval', index });
    setSelectedConnectorId(null);
  }, []);

  // Fret dot click: just selects the fret-number field. The number comes from the keyboard.
  const handleFretDotClick = useCallback((fretIndex: number) => {
    setActiveInput({ type: 'startFret', fretIndex });
    setSelectedConnectorId(null);
    dispatch({ type: 'SET_SELECTED_MARKER', id: null });
  }, [dispatch]);

  // Click away: deselect everything
  const handleEditorBgClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on the editor-main background
    const target = e.target as HTMLElement;
    if (target.classList.contains('editor-main') || target.classList.contains('chart-editor')) {
      setActiveInput(null);
      setSelectedConnectorId(null);
      dispatch({ type: 'SET_SELECTED_MARKER', id: null });
      setConnectMode(null);
    }
  }, [dispatch]);

  // Selected marker actions
  const selectedMarker = currentChart.markers.find(m => m.id === selectedMarkerId);

  const toggleRingStyle = () => {
    if (!selectedMarkerId) return;
    const markers = currentChart.markers.map(m =>
      m.id === selectedMarkerId
        ? { ...m, ringStyle: (m.ringStyle === 'single' ? 'double' : 'single') as 'single' | 'double' }
        : m
    );
    updateChart({ markers });
  };

  const deleteMarker = () => {
    if (!selectedMarkerId) return;
    const markers = currentChart.markers.filter(m => m.id !== selectedMarkerId);
    const connectors = currentChart.connectors.filter(
      c => c.fromMarkerId !== selectedMarkerId && c.toMarkerId !== selectedMarkerId
    );
    updateChart({ markers, connectors });
    dispatch({ type: 'SET_SELECTED_MARKER', id: null });
    setActiveInput(null);
  };

  const clearMarkerLabel = () => {
    if (!selectedMarkerId) return;
    const markers = currentChart.markers.map(m =>
      m.id === selectedMarkerId ? { ...m, label: '' } : m
    );
    updateChart({ markers });
  };

  const startConnect = () => {
    if (!selectedMarkerId) return;
    setConnectMode(selectedMarkerId);
  };

  const handleSave = () => {
    // If the chart is already in the library, ask whether to overwrite it or save a copy
    const existsInLibrary = state.charts.some(c => c.id === currentChart.id);
    if (existsInLibrary) {
      setShowSaveOptions(true);
    } else {
      dispatch({ type: 'SAVE_CHART' });
      dispatch({ type: 'SHOW_TOAST', message: 'Saved to library' });
    }
  };

  const handleSaveOverwrite = () => {
    dispatch({ type: 'SAVE_CHART' });
    setShowSaveOptions(false);
    dispatch({ type: 'SHOW_TOAST', message: 'Saved' });
  };

  const handleSaveNewCopy = () => {
    const newChart = {
      ...currentChart,
      id: crypto.randomUUID(),
      title: currentChart.title ? `${currentChart.title} (Copy)` : 'Untitled (Copy)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: 'SET_CURRENT_CHART', chart: newChart });
    dispatch({ type: 'SAVE_CHART' });
    setShowSaveOptions(false);
    dispatch({ type: 'SHOW_TOAST', message: 'Saved as a new copy' });
  };

  const handleNew = () => {
    dispatch({ type: 'NEW_CHART' });
    setActiveInput(null);
    setSelectedConnectorId(null);
  };

  // Hardware keyboard support with Tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Tab navigation
      if (e.key === 'Tab') {
        e.preventDefault();
        const idx = findCurrentTabIndex();
        const next = e.shiftKey
          ? (idx <= 0 ? tabbableInputs.length - 1 : idx - 1)
          : (idx >= tabbableInputs.length - 1 ? 0 : idx + 1);
        const nextInput = tabbableInputs[next];
        setActiveInput(nextInput);
        if (nextInput.type === 'markerLabel') {
          dispatch({ type: 'SET_SELECTED_MARKER', id: nextInput.markerId });
        } else {
          dispatch({ type: 'SET_SELECTED_MARKER', id: null });
        }
        setSelectedConnectorId(null);
        return;
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveInput(null);
        setSelectedConnectorId(null);
        dispatch({ type: 'SET_SELECTED_MARKER', id: null });
        setConnectMode(null);
        return;
      }
      // Delete key removes selected connector
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedConnectorId && !activeInput) {
        e.preventDefault();
        deleteConnector();
        return;
      }
      if (!activeInput) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleMoveCaret(e.key === 'ArrowLeft' ? -1 : 1);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === ' ') {
        e.preventDefault();
        handleSpace();
      } else if (e.key.length === 1) {
        e.preventDefault();
        handleKeyboardInput(e.key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeInput, handleBackspace, handleSpace, handleKeyboardInput, handleMoveCaret, selectedConnectorId, deleteConnector, tabbableInputs, dispatch]);

  // Build the toolbar content for the floating keyboard
  const toolbarContent = selectedMarker ? (
    <div className="marker-controls">
      <span className="marker-controls-label">Marker:</span>
      <button className="btn btn-sm" onClick={toggleRingStyle}>
        {selectedMarker.ringStyle === 'single' ? 'Double Ring' : 'Single Ring'}
      </button>
      <button className="btn btn-sm" onClick={clearMarkerLabel}>Clear Label</button>
      <button className="btn btn-sm" onClick={startConnect}>
        {connectMode ? 'Connecting...' : 'Connect'}
      </button>
      <button className="btn btn-sm btn-danger" onClick={deleteMarker}>Remove Marker</button>
    </div>
  ) : selectedConnectorId ? (
    <div className="marker-controls">
      <span className="marker-controls-label">Connector:</span>
      <button className="btn btn-sm btn-danger" onClick={deleteConnector}>Delete Connector</button>
      <button className="btn btn-sm" onClick={() => setSelectedConnectorId(null)}>Deselect</button>
    </div>
  ) : connectMode ? (
    <div className="connect-hint">
      Click another marker to connect <button className="btn btn-sm" onClick={() => setConnectMode(null)}>Cancel</button>
    </div>
  ) : null;

  return (
    <div className="chart-editor" onClick={handleEditorBgClick}>
      {isPhone && headerSlot && createPortal(
        <>
          <button className="icon-btn" onClick={handleNew} aria-label="New chart" title="New chart"><PlusIcon /></button>
          <button className="icon-btn primary" onClick={handleSave} aria-label="Save chart" title="Save chart"><SaveIcon /></button>
        </>,
        headerSlot
      )}
      {!isPhone && <div className="editor-toolbar">
        <button className="btn btn-secondary" onClick={handleNew}>New Chart</button>
        <button className="btn btn-primary" onClick={handleSave}>Save Chart</button>
      </div>}

      <div className="editor-main" onClick={handleEditorBgClick}>
        <div className="diagram-container">
          {/* Unified title input */}
          <div
            className={`title-input ${activeInput?.type === 'title' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveInput({ type: 'title' }); setSelectedConnectorId(null); }}
          >
            {currentChart.title || 'Click to add title'}
            {activeInput?.type === 'title' && <span className="cursor-blink">|</span>}
          </div>

          <ChordDiagram
            chart={{ ...currentChart, title: '' }}
            width={320}
            height={450}
            theme={theme}
            interactive
            selectedMarkerId={selectedMarkerId}
            selectedConnectorId={selectedConnectorId}
            focusedInput={focusedInput}
            onCellClick={handleCellClick}
            onMarkerClick={handleMarkerClick}
            onNutClick={handleNutClick}
            onTopIndicatorClick={handleTopIndicatorClick}
            onBottomNoteLabelClick={handleBottomNoteLabelClick}
            onBottomIntervalLabelClick={handleBottomIntervalLabelClick}
            onConnectorClick={handleConnectorClick}
            onStartFretClick={handleFretDotClick}
            onMarkerMove={handleMarkerMove}
            onMarkerJoin={handleMarkerJoin}
          />
        </div>
      </div>

      {/* Save options dialog */}
      {showSaveOptions && (
        <div className="dialog-overlay" onClick={() => setShowSaveOptions(false)}>
          <div className="save-options-dialog" onClick={e => e.stopPropagation()}>
            <h3>Save Chord Chart</h3>
            <button className="save-option-btn" onClick={handleSaveOverwrite}>
              <strong>Overwrite Current</strong>
              <span>Save changes to the existing chart in library</span>
            </button>
            <button className="save-option-btn" onClick={handleSaveNewCopy}>
              <strong>Save as New Copy</strong>
              <span>Create a new chart in library with these contents</span>
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
        caret={caret ?? undefined}
        onCaretChange={setCaret}
        onMoveCaret={handleMoveCaret}
        toolbarContent={toolbarContent}
      />
    </div>
  );
}
