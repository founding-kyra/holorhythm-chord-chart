import React, { useState, useCallback, useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { ChartData, SheetData } from '../types';
import ChordDiagram from './ChordDiagram';

type LibraryTab = 'charts' | 'lessons' | 'trash';

export default function ChartLibrary() {
  const { state, dispatch } = useApp();
  const { charts, sheets, trashedCharts, trashedSheets, currentSheet, theme } = state;
  const [activeTab, setActiveTab] = useState<LibraryTab>('charts');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [quickLookChart, setQuickLookChart] = useState<ChartData | null>(null);

  // Derive which chart IDs are currently on the active sheet
  const chartsOnSheet = useMemo(() => {
    const ids = new Set<string>();
    currentSheet.slots.forEach(s => { if (s) ids.add(s); });
    return ids;
  }, [currentSheet.slots]);

  // Tags
  const allChartTags = useMemo(() => {
    const tags = new Set<string>();
    charts.forEach(c => (c.tags || []).forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [charts]);

  const allSheetTags = useMemo(() => {
    const tags = new Set<string>();
    sheets.forEach(s => (s.tags || []).forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [sheets]);

  // Filter charts — sorted most recent first
  const filteredCharts = useMemo(() => {
    let result = [...charts].sort((a, b) => b.updatedAt - a.updatedAt);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (tagFilter) {
      result = result.filter(c => (c.tags || []).includes(tagFilter));
    }
    return result;
  }, [charts, search, tagFilter]);

  // Filter sheets — sorted most recent first
  const filteredSheets = useMemo(() => {
    let result = [...sheets].sort((a, b) => b.updatedAt - a.updatedAt);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (tagFilter) {
      result = result.filter(s => (s.tags || []).includes(tagFilter));
    }
    return result;
  }, [sheets, search, tagFilter]);

  const handleAddToSheet = useCallback((chartId: string) => {
    if (chartsOnSheet.has(chartId)) return;
    const emptySlot = currentSheet.slots.findIndex(s => s === null);
    if (emptySlot >= 0) {
      const slots = [...currentSheet.slots];
      slots[emptySlot] = chartId;
      dispatch({ type: 'UPDATE_CURRENT_SHEET', sheet: { slots } });
    }
  }, [currentSheet, chartsOnSheet, dispatch]);

  const handleRemoveFromSheet = useCallback((chartId: string) => {
    const slots = currentSheet.slots.map(s => s === chartId ? null : s);
    dispatch({ type: 'UPDATE_CURRENT_SHEET', sheet: { slots } });
  }, [currentSheet, dispatch]);

  const handleTrashChart = useCallback((id: string) => { dispatch({ type: 'TRASH_CHART', id }); }, [dispatch]);
  const handleTrashSheet = useCallback((id: string) => { dispatch({ type: 'TRASH_SHEET', id }); }, [dispatch]);
  const handleRestoreChart = useCallback((id: string) => { dispatch({ type: 'RESTORE_CHART', id }); }, [dispatch]);
  const handleRestoreSheet = useCallback((id: string) => { dispatch({ type: 'RESTORE_SHEET', id }); }, [dispatch]);
  const handlePermanentDeleteChart = useCallback((id: string) => { dispatch({ type: 'PERMANENT_DELETE_CHART', id }); }, [dispatch]);
  const handlePermanentDeleteSheet = useCallback((id: string) => { dispatch({ type: 'PERMANENT_DELETE_SHEET', id }); }, [dispatch]);
  const handleEmptyTrash = useCallback(() => { dispatch({ type: 'EMPTY_TRASH' }); }, [dispatch]);

  // Double-click chart card to open in editor
  const handleChartDoubleClick = useCallback((id: string) => {
    dispatch({ type: 'LOAD_CHART', id });
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' });
  }, [dispatch]);

  // Double-click sheet card to open in lesson sheet editor
  const handleSheetDoubleClick = useCallback((id: string) => {
    dispatch({ type: 'LOAD_SHEET', id });
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'composer' });
  }, [dispatch]);

  // New chart from library
  const handleNewChart = useCallback(() => {
    dispatch({ type: 'NEW_CHART' });
    dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' });
  }, [dispatch]);

  // Tag management
  const addTagToChart = useCallback((chartId: string, tag: string) => {
    const chart = charts.find(c => c.id === chartId);
    if (!chart) return;
    const cleaned = tag.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
    if (!cleaned || (chart.tags || []).includes(cleaned)) return;
    const updatedTags = [...(chart.tags || []), cleaned];
    dispatch({ type: 'SET_CURRENT_CHART', chart: { ...chart, tags: updatedTags } });
    dispatch({ type: 'SAVE_CHART' });
  }, [charts, dispatch]);

  const removeTagFromChart = useCallback((chartId: string, tag: string) => {
    const chart = charts.find(c => c.id === chartId);
    if (!chart) return;
    const updatedChart = { ...chart, tags: (chart.tags || []).filter(t => t !== tag), updatedAt: Date.now() };
    dispatch({ type: 'SET_CURRENT_CHART', chart: updatedChart });
    dispatch({ type: 'SAVE_CHART' });
  }, [charts, dispatch]);

  const addTagToSheet = useCallback((sheetId: string, tag: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const cleaned = tag.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
    if (!cleaned || (sheet.tags || []).includes(cleaned)) return;
    const updatedSheet = { ...sheet, tags: [...(sheet.tags || []), cleaned], updatedAt: Date.now() };
    dispatch({ type: 'SET_CURRENT_SHEET', sheet: updatedSheet });
    dispatch({ type: 'SAVE_SHEET' });
  }, [sheets, dispatch]);

  const removeTagFromSheet = useCallback((sheetId: string, tag: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    const updatedSheet = { ...sheet, tags: (sheet.tags || []).filter(t => t !== tag), updatedAt: Date.now() };
    dispatch({ type: 'SET_CURRENT_SHEET', sheet: updatedSheet });
    dispatch({ type: 'SAVE_SHEET' });
  }, [sheets, dispatch]);

  const handleTagInputKeyDown = (e: React.KeyboardEvent, itemId: string, type: 'chart' | 'sheet') => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (type === 'chart') addTagToChart(itemId, tagInput);
      else addTagToSheet(itemId, tagInput);
      setTagInput('');
    }
    if (e.key === 'Escape') {
      setEditingTagsFor(null);
      setTagInput('');
    }
  };

  const currentTags = activeTab === 'charts' ? allChartTags : allSheetTags;

  return (
    <div className="chart-library">
      <div className="library-header">
        <h2>Library</h2>
        <div className="library-actions">
          <input
            type="text"
            className="search-input"
            placeholder={`Search ${activeTab === 'charts' ? 'charts' : activeTab === 'lessons' ? 'lesson sheets' : 'trash'}...`}
            value={search}
            onChange={e => { setSearch(e.target.value); setTagFilter(null); }}
          />
          <button className="btn btn-secondary" onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' })}>
            Back to Editor
          </button>
        </div>
      </div>

      {/* ── Folder Tabs ── */}
      <div className="library-tabs">
        <button className={`lib-tab ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => { setActiveTab('charts'); setTagFilter(null); setSearch(''); }}>
          Chord Charts <span className="tab-count">{charts.length}</span>
        </button>
        <button className={`lib-tab ${activeTab === 'lessons' ? 'active' : ''}`} onClick={() => { setActiveTab('lessons'); setTagFilter(null); setSearch(''); }}>
          Lesson Sheets <span className="tab-count">{sheets.length}</span>
        </button>
        <button className={`lib-tab ${activeTab === 'trash' ? 'active' : ''}`} onClick={() => { setActiveTab('trash'); setTagFilter(null); setSearch(''); }}>
          Trash
          {(trashedCharts.length + (trashedSheets || []).length) > 0 && (
            <span className="tab-count">{trashedCharts.length + (trashedSheets || []).length}</span>
          )}
        </button>
      </div>

      {/* ── Tag Filter Bar ── */}
      {activeTab !== 'trash' && currentTags.length > 0 && (
        <div className="tag-filter-bar">
          <span className="tag-filter-label">Tags:</span>
          <button className={`tag-chip ${!tagFilter ? 'active' : ''}`} onClick={() => setTagFilter(null)}>All</button>
          {currentTags.map(tag => (
            <button key={tag} className={`tag-chip ${tagFilter === tag ? 'active' : ''}`} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Charts Tab ── */}
      {activeTab === 'charts' && (
        <>
          <div className="lesson-actions-bar">
            <button className="btn btn-primary" onClick={handleNewChart}>+ New Chord Chart</button>
          </div>
          {filteredCharts.length === 0 && (
            <div className="empty-state">
              {search || tagFilter ? 'No charts match your filter.' : 'No saved charts yet. Create one in the editor!'}
            </div>
          )}
          <div className="library-grid">
            {filteredCharts.map(chart => {
              const isOnSheet = chartsOnSheet.has(chart.id);
              return (
                <div key={chart.id} className={`library-card ${isOnSheet ? 'on-sheet' : ''}`} onDoubleClick={() => handleChartDoubleClick(chart.id)}>
                  <div className="card-preview" style={{ cursor: 'pointer' }} onClick={() => setQuickLookChart(chart)}>
                    <ChordDiagram chart={chart} width={180} height={252} theme={theme} />
                    {isOnSheet && (
                      <div className="added-indicator">
                        <svg width="28" height="28" viewBox="0 0 28 28">
                          <circle cx="14" cy="14" r="13" fill="#4CAF50" />
                          <path d="M8 14l4 4 8-8" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="card-tags">
                    {(chart.tags || []).map(tag => (
                      <span key={tag} className="tag-badge">
                        #{tag}
                        {editingTagsFor === chart.id && (
                          <button className="tag-remove" onClick={() => removeTagFromChart(chart.id, tag)}>{'\u00D7'}</button>
                        )}
                      </span>
                    ))}
                    {editingTagsFor === chart.id ? (
                      <input className="tag-input" placeholder="add tag..." value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => handleTagInputKeyDown(e, chart.id, 'chart')}
                        onBlur={() => { setEditingTagsFor(null); setTagInput(''); }}
                        autoFocus />
                    ) : (
                      <button className="tag-add-btn" onClick={() => { setEditingTagsFor(chart.id); setTagInput(''); }}>+</button>
                    )}
                  </div>

                  <div className="card-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => handleChartDoubleClick(chart.id)}>Edit</button>
                    <button className={`btn btn-sm ${isOnSheet ? 'btn-on-sheet' : 'btn-secondary'}`}
                      onClick={() => isOnSheet ? handleRemoveFromSheet(chart.id) : handleAddToSheet(chart.id)}>
                      {isOnSheet ? 'On Sheet \u2713' : 'Add to Sheet'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleTrashChart(chart.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Lesson Sheets Tab ── */}
      {activeTab === 'lessons' && (
        <>
          <div className="lesson-actions-bar">
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'NEW_SHEET' })}>+ New Lesson Sheet</button>
          </div>
          {filteredSheets.length === 0 && (
            <div className="empty-state">
              {search || tagFilter ? 'No lesson sheets match your filter.' : 'No saved lesson sheets yet. Create one in the Lesson Sheet tab!'}
            </div>
          )}
          <div className="library-grid lesson-grid">
            {filteredSheets.map(sheet => {
              const filledSlots = sheet.slots.filter(s => s !== null).length;
              const isActive = currentSheet.id === sheet.id;
              return (
                <div key={sheet.id} className={`library-card lesson-card ${isActive ? 'active-sheet' : ''}`} onDoubleClick={() => handleSheetDoubleClick(sheet.id)}>
                  <div className="lesson-card-header">
                    <h3 className="lesson-card-title">{sheet.title || 'Untitled Sheet'}</h3>
                    <span className="lesson-card-meta">{filledSlots}/16 charts</span>
                  </div>

                  {/* Mini grid preview */}
                  <div className="lesson-mini-grid">
                    {sheet.slots.slice(0, 16).map((slotId, i) => (
                      <div key={i} className={`mini-slot ${slotId ? 'filled' : ''}`} />
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="card-tags">
                    {(sheet.tags || []).map(tag => (
                      <span key={tag} className="tag-badge">
                        #{tag}
                        {editingTagsFor === sheet.id && (
                          <button className="tag-remove" onClick={() => removeTagFromSheet(sheet.id, tag)}>{'\u00D7'}</button>
                        )}
                      </span>
                    ))}
                    {editingTagsFor === sheet.id ? (
                      <input className="tag-input" placeholder="add tag..." value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => handleTagInputKeyDown(e, sheet.id, 'sheet')}
                        onBlur={() => { setEditingTagsFor(null); setTagInput(''); }}
                        autoFocus />
                    ) : (
                      <button className="tag-add-btn" onClick={() => { setEditingTagsFor(sheet.id); setTagInput(''); }}>+</button>
                    )}
                  </div>

                  <div className="card-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => handleSheetDoubleClick(sheet.id)}>
                      {isActive ? 'Active' : 'Open'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleTrashSheet(sheet.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Trash Tab ── */}
      {activeTab === 'trash' && (
        <>
          {(trashedCharts.length + (trashedSheets || []).length) === 0 && (
            <div className="empty-state">Trash is empty.</div>
          )}
          {(trashedCharts.length + (trashedSheets || []).length) > 0 && (
            <div className="trash-actions-bar">
              <button className="btn btn-danger" onClick={handleEmptyTrash}>Empty All Trash</button>
            </div>
          )}
          {trashedCharts.length > 0 && (
            <>
              <h3 className="trash-section-title">Charts</h3>
              <div className="library-grid">
                {trashedCharts.map(({ chart }) => (
                  <div key={chart.id} className="library-card trashed">
                    <div className="card-preview">
                      <ChordDiagram chart={chart} width={180} height={252} theme={theme} />
                    </div>
                    <div className="card-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => handleRestoreChart(chart.id)}>Restore</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handlePermanentDeleteChart(chart.id)}>Delete Forever</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {(trashedSheets || []).length > 0 && (
            <>
              <h3 className="trash-section-title">Lesson Sheets</h3>
              <div className="library-grid lesson-grid">
                {(trashedSheets || []).map(({ sheet }) => (
                  <div key={sheet.id} className="library-card lesson-card trashed">
                    <div className="lesson-card-header">
                      <h3 className="lesson-card-title">{sheet.title || 'Untitled'}</h3>
                    </div>
                    <div className="card-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => handleRestoreSheet(sheet.id)}>Restore</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handlePermanentDeleteSheet(sheet.id)}>Delete Forever</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Quick Look Popup ── */}
      {quickLookChart && (
        <div className="dialog-overlay" onClick={() => setQuickLookChart(null)}>
          <div className="quick-look-popup" onClick={e => e.stopPropagation()}>
            <div className="quick-look-header">
              <h3>{quickLookChart.title || 'Untitled Chart'}</h3>
              <button className="btn btn-sm" onClick={() => setQuickLookChart(null)}>{'\u00D7'}</button>
            </div>
            <div className="quick-look-body">
              <ChordDiagram chart={quickLookChart} width={320} height={450} theme={theme} />
            </div>
            <div className="quick-look-actions">
              <button className="btn btn-primary" onClick={() => { handleChartDoubleClick(quickLookChart.id); setQuickLookChart(null); }}>
                Edit Chart
              </button>
              <button className={`btn ${chartsOnSheet.has(quickLookChart.id) ? 'btn-on-sheet' : 'btn-secondary'}`}
                onClick={() => {
                  if (chartsOnSheet.has(quickLookChart.id)) handleRemoveFromSheet(quickLookChart.id);
                  else handleAddToSheet(quickLookChart.id);
                }}>
                {chartsOnSheet.has(quickLookChart.id) ? 'On Sheet \u2713' : 'Add to Sheet'}
              </button>
              <button className="btn btn-secondary" onClick={() => setQuickLookChart(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
