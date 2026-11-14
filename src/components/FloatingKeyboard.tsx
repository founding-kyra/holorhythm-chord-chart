import React, { useState, useRef, useCallback, useEffect } from 'react';
import MusicKeyboard from './MusicKeyboard';
import { useIsPhone } from '../utils/useIsPhone';

interface FloatingKeyboardProps {
  inputLabel: string;
  inputValue: string;
  isActive: boolean;
  onInput: (value: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  /** Extra toolbar content rendered above the keyboard (e.g. marker controls) */
  toolbarContent?: React.ReactNode;
}

type AnchorPosition = 'float' | 'bottom-left' | 'bottom-right' | 'bottom-center';

export default function FloatingKeyboard({
  inputLabel,
  inputValue,
  isActive,
  onInput,
  onBackspace,
  onSpace,
  toolbarContent,
}: FloatingKeyboardProps) {
  const [minimized, setMinimized] = useState(false);
  const [anchor, setAnchor] = useState<AnchorPosition>('bottom-center');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone();

  // When switching to float, place in center-bottom
  useEffect(() => {
    if (anchor === 'float' && pos.x === 0 && pos.y === 0) {
      setPos({
        x: Math.max(0, (window.innerWidth - 520) / 2),
        y: window.innerHeight - 340,
      });
    }
  }, [anchor]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (anchor !== 'float') return;
    setDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, [anchor]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, dragOffset]);

  const anchorClass =
    anchor === 'float' ? 'kb-float'
    : anchor === 'bottom-left' ? 'kb-anchor-bl'
    : anchor === 'bottom-right' ? 'kb-anchor-br'
    : 'kb-anchor-bc';

  const floatStyle: React.CSSProperties = anchor === 'float' ? {
    left: pos.x,
    top: pos.y,
  } : {};

  // On a phone the keyboard would otherwise take a third of the screen all the time.
  if (isPhone && !isActive && !toolbarContent) return null;

  return (
    <div
      ref={panelRef}
      className={`floating-keyboard ${anchorClass} ${minimized ? 'minimized' : ''}`}
      style={floatStyle}
    >
      {/* Title bar */}
      <div
        className="kb-titlebar"
        onMouseDown={handleMouseDown}
        style={{ cursor: anchor === 'float' ? 'grab' : 'default' }}
      >
        <div className="kb-titlebar-left">
          <span className="kb-grip">{anchor === 'float' ? '\u2630' : ''}</span>
          <span className="kb-title-label">
            {isActive ? inputLabel : 'Keyboard'}
          </span>
        </div>
        <div className="kb-titlebar-actions">
          {/* Anchor buttons */}
          <button
            className={`kb-anchor-btn ${anchor === 'bottom-center' ? 'active' : ''}`}
            onClick={() => setAnchor('bottom-center')}
            title="Anchor bottom center"
          >
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="8" width="10" height="4" rx="1" fill="currentColor"/></svg>
          </button>
          <button
            className={`kb-anchor-btn ${anchor === 'bottom-left' ? 'active' : ''}`}
            onClick={() => setAnchor('bottom-left')}
            title="Anchor bottom left"
          >
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="8" width="6" height="4" rx="1" fill="currentColor"/></svg>
          </button>
          <button
            className={`kb-anchor-btn ${anchor === 'bottom-right' ? 'active' : ''}`}
            onClick={() => setAnchor('bottom-right')}
            title="Anchor bottom right"
          >
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="7" y="8" width="6" height="4" rx="1" fill="currentColor"/></svg>
          </button>
          <button
            className={`kb-anchor-btn ${anchor === 'float' ? 'active' : ''}`}
            onClick={() => setAnchor('float')}
            title="Float (drag to move)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <button
            className="kb-minimize-btn"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '\u25B2' : '\u25BC'}
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="kb-body">
          {/* Toolbar content (marker controls, etc.) */}
          {toolbarContent && (
            <div className="kb-toolbar-content">{toolbarContent}</div>
          )}

          {/* Input display */}
          {isActive && (
            <div className="input-display">
              <span className="input-label">{inputLabel}</span>
              <span className="input-value">
                {inputValue}
                <span className="cursor-blink">|</span>
              </span>
            </div>
          )}

          <MusicKeyboard onInput={onInput} onBackspace={onBackspace} onSpace={onSpace} />
        </div>
      )}
    </div>
  );
}
