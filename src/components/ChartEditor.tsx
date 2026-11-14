import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { ChartMarker } from '../types';
import ChordDiagram from './ChordDiagram';
import FloatingKeyboard from './FloatingKeyboard';

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
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingView, setPendingView] = useState<'library' | 'composer' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState<string | null>(null);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const lastSavedRef = useRef(JSON.stringify(currentChart));

  // Track unsaved changes
  useEffect(() => {
    const current = JSON.stringify(currentChart);
    setHasUnsavedChanges(current !== lastSavedRef.current);
  }, [currentChart]);

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

  const handleKeyboardInput = useCallback(
    (value: string) => {
      if (!activeInput) return;
      switch (activeInput.type) {
        case 'title':
          updateChart({ title: currentChart.title + value });
          break;
        case 'topIndicator': {
          const arr = [...currentChart.topIndicators] as [string, string, string, string, string, string];
          arr[activeInput.index] = arr[activeInput.index] + value;
          updateChart({ topIndicators: arr });
          break;
        }
        case 'markerLabel': {
          const markers = currentChart.markers.map(m =>
            m.id === activeInput.markerId ? { ...m, label: m.label + value } : m
          );
          updateChart({ markers });
          break;
        }
        case 'bottomNote': {
          const arr = [...currentChart.bottomNoteLabels] as [string, string, string, string, string, string];
          arr[activeInput.index] = arr[activeInput.index] + value;
          updateChart({ bottomNoteLabels: arr });
          break;
        }
        case 'bottomInterval': {
          const arr = [...currentChart.bottomIntervalLabels] as [string, string, string, string, string, string];
          arr[activeInput.index] = arr[activeInput.index] + value;
          updateChart({ bottomIntervalLabels: arr });
          break;
        }
        case 'startFret': {
          const digit = parseInt(value, 10);
          if (!isNaN(digit)) {
            const current = String(currentChart.startFret || '');
            const newVal = parseInt(current + value, 10);
            if (newVal >= 0 && newVal <= 24) {
              updateChart({ startFret: newVal });
            }
          }
          break;
        }
      }
    },
    [activeInput, currentChart, updateChart]
  );

  const handleBackspace = useCallback(() => {
    if (!activeInput) return;
    switch (activeInput.type) {
      case 'title':
        updateChart({ title: currentChart.title.slice(0, -1) });
        break;
      case 'topIndicator': {
        const arr = [...currentChart.topIndicators] as [string, string, string, string, string, string];
        arr[activeInput.index] = arr[activeInput.index].slice(0, -1);
        updateChart({ topIndicators: arr });
        break;
      }
      case 'markerLabel': {
        const marker = currentChart.markers.find(m => m.id === activeInput.markerId);
        if (marker && marker.label.length === 0) {
          const markers = currentChart.markers.filter(m => m.id !== activeInput.markerId);
          const connectors = currentChart.connectors.filter(
            c => c.fromMarkerId !== activeInput.markerId && c.toMarkerId !== activeInput.markerId
          );
          updateChart({ markers, connectors });
          dispatch({ type: 'SET_SELECTED_MARKER', id: null });
          setActiveInput(null);
        } else {
          const markers = currentChart.markers.map(m =>
            m.id === activeInput.markerId ? { ...m, label: m.label.slice(0, -1) } : m
          );
          updateChart({ markers });
        }
        break;
      }
      case 'bottomNote': {
        const arr = [...currentChart.bottomNoteLabels] as [string, string, string, string, string, string];
        arr[activeInput.index] = arr[activeInput.index].slice(0, -1);
        updateChart({ bottomNoteLabels: arr });
        break;
      }
      case 'bottomInterval': {
        const arr = [...currentChart.bottomIntervalLabels] as [string, string, string, string, string, string];
        arr[activeInput.index] = arr[activeInput.index].slice(0, -1);
        updateChart({ bottomIntervalLabels: arr });
        break;
      }
      case 'startFret': {
        const current = String(currentChart.startFret || '');
        const newStr = current.slice(0, -1);
        updateChart({ startFret: newStr ? parseInt(newStr, 10) : 0 });
        break;
      }
    }
  }, [activeInput, currentChart, updateChart, dispatch]);

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

  // Marker drag: move to new fret/string
  const handleMarkerDragStart = useCallback((markerId: string) => {
    setDraggingMarker(markerId);
  }, []);

  const handleMarkerDrop = useCallback((stringIndex: number, fretIndex: number) => {
    if (!draggingMarker) return;
    // Check if there's already a marker at target position
    const existing = currentChart.markers.find(m => m.stringIndex === stringIndex && m.fretIndex === fretIndex);
    if (existing && existing.id !== draggingMarker) return; // Don't drop on existing marker
    const markers = currentChart.markers.map(m =>
      m.id === draggingMarker ? { ...m, stringIndex, fretIndex } : m
    );
    updateChart({ markers });
    setDraggingMarker(null);
  }, [draggingMarker, currentChart, updateChart]);

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

  // Fret dot click: clicking a fret dot on the left sets startFret and auto-removes nut
  const handleFretDotClick = useCallback((fretIndex: number) => {
    // If clicking same fret that's already set, clear it and restore thick nut
    if (currentChart.startFret === fretIndex && currentChart.nutThickness === 'thin') {
      updateChart({ startFret: 0, nutThickness: 'thick' });
      setActiveInput(null);
    } else {
      // Set fret number and auto-remove nut (set to thin)
      updateChart({ startFret: fretIndex, nutThickness: 'thin' });
      setActiveInput({ type: 'startFret', fretIndex });
    }
    setSelectedConnectorId(null);
    dispatch({ type: 'SET_SELECTED_MARKER', id: null });
  }, [currentChart.startFret, currentChart.nutThickness, dispatch, updateChart]);

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
    // Check if chart already exists in library — if so, show overwrite/copy options
    const existsInLibrary = state.charts.some(c => c.id === currentChart.id);
    if (existsInLibrary) {
      setShowSaveOptions(true);
    } else {
      dispatch({ type: 'SAVE_CHART' });
      lastSavedRef.current = JSON.stringify(currentChart);
      setHasUnsavedChanges(false);
    }
  };

  const handleSaveOverwrite = () => {
    dispatch({ type: 'SAVE_CHART' });
    lastSavedRef.current = JSON.stringify(currentChart);
    setHasUnsavedChanges(false);
    setShowSaveOptions(false);
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
    lastSavedRef.current = JSON.stringify(newChart);
    setHasUnsavedChanges(false);
    setShowSaveOptions(false);
  };

  const handleNew = () => {
    dispatch({ type: 'NEW_CHART' });
    setActiveInput(null);
    setSelectedConnectorId(null);
    lastSavedRef.current = JSON.stringify(currentChart);
  };

  // Navigation with unsaved changes dialog
  const handleNavigate = useCallback((view: 'library' | 'composer') => {
    if (hasUnsavedChanges) {
      setPendingView(view);
      setShowUnsavedDialog(true);
    } else {
      dispatch({ type: 'SET_ACTIVE_VIEW', view });
    }
  }, [hasUnsavedChanges, dispatch]);

  const handleDialogSave = () => {
    dispatch({ type: 'SAVE_CHART' });
    lastSavedRef.current = JSON.stringify(currentChart);
    setHasUnsavedChanges(false);
    setShowUnsavedDialog(false);
    if (pendingView) dispatch({ type: 'SET_ACTIVE_VIEW', view: pendingView });
    setPendingView(null);
  };

  const handleDialogExit = () => {
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);
    lastSavedRef.current = JSON.stringify(currentChart);
    if (pendingView) dispatch({ type: 'SET_ACTIVE_VIEW', view: pendingView });
    setPendingView(null);
  };

  const handleDialogCancel = () => {
    setShowUnsavedDialog(false);
    setPendingView(null);
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
      if (e.key === 'Backspace') {
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
  }, [activeInput, handleBackspace, handleSpace, handleKeyboardInput, selectedConnectorId, deleteConnector, tabbableInputs, dispatch]);

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
      <button className="btn btn-sm btn-danger" onClick={deleteMarker}>Delete</button>
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
      <div className="editor-toolbar">
        <button className="btn btn-secondary" onClick={handleNew}>New Chart</button>
        <button className="btn btn-primary" onClick={handleSave}>Save Chart</button>
        <button
          className="btn btn-secondary toolbar-nav"
          onClick={() => handleNavigate('library')}
        >
          Library
        </button>
        <button
          className="btn btn-secondary toolbar-nav"
          onClick={() => handleNavigate('composer')}
        >
          Lesson Sheet
        </button>
      </div>

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
            onMarkerDragStart={handleMarkerDragStart}
            onMarkerDrop={handleMarkerDrop}
            draggingMarker={draggingMarker}
          />
        </div>
      </div>

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <div className="dialog-overlay" onClick={handleDialogCancel}>
          <div className="dialog-box" onClick={e => e.stopPropagation()}>
            <h3 className="dialog-title">Save this chord chart?</h3>
            <p className="dialog-text">You have unsaved changes that will be lost.</p>
            <div className="dialog-actions">
              <button className="btn btn-primary" onClick={handleDialogSave}>Save</button>
              <button className="btn btn-danger" onClick={handleDialogExit}>Exit Without Saving</button>
              <button className="btn btn-secondary" onClick={handleDialogCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
        toolbarContent={toolbarContent}
      />
    </div>
  );
}
