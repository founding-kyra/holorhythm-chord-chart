import React, { useState, useCallback } from 'react';
import { useApp } from '../store/AppContext';

const ROW1 = ['C', 'D', 'E', 'F', 'G', 'A', 'B', '\u266D', '\u266F', '-'];
const ROW2 = ['1', '2', '3', '4', '5', '6', '7', '9', 'o', '\u00F8', '\u0394'];
const ROW3 = ['(', ')', '/', 'sus', 'add', 'alt', '+', 'X', 'O'];
const ROW4 = ['m', 'M', 'P'];

const KEY_LABELS: Record<string, string> = {
  '\u266D': '\u266D',
  '\u266F': '\u266F',
  '\u00F8': '\u00F8',
  '\u0394': '\u0394',
};

interface MusicKeyboardProps {
  onInput: (value: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
}

export default function MusicKeyboard({ onInput, onBackspace, onSpace }: MusicKeyboardProps) {
  return (
    <div className="music-keyboard">
      <div className="keyboard-util-row">
        <button className="key-util" onMouseDown={e => { e.preventDefault(); onBackspace(); }}>
          <span style={{ fontSize: 15, marginRight: 4 }}>{'\u2190'}</span> BACK
        </button>
        <button className="key-util" onMouseDown={e => { e.preventDefault(); onSpace(); }}>
          SPACE
        </button>
      </div>
      <KeyRow keys={ROW1} onInput={onInput} group="top" />
      <KeyRow keys={ROW2} onInput={onInput} group="mid" />
      <KeyRow keys={ROW3} onInput={onInput} group="bot" />
      <KeyRow keys={ROW4} onInput={onInput} group="bot" />
    </div>
  );
}

function KeyRow({ keys, onInput, group }: { keys: string[]; onInput: (v: string) => void; group: string }) {
  return (
    <div className="keyboard-row">
      {keys.map((k, i) => (
        <KeyButton key={`${k}-${i}`} label={KEY_LABELS[k] || k} value={k} onInput={onInput} group={group} />
      ))}
    </div>
  );
}

function KeyButton({ label, value, onInput, group }: { label: string; value: string; onInput: (v: string) => void; group: string }) {
  const [pressed, setPressed] = useState(false);

  const handleDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setPressed(true);
    onInput(value);
    setTimeout(() => setPressed(false), 120);
  }, [value, onInput]);

  const isWide = value.length > 1;

  return (
    <button
      className={`music-key ${group} ${pressed ? 'pressed' : ''} ${isWide ? 'wide' : ''}`}
      onMouseDown={handleDown}
      onTouchStart={handleDown}
      tabIndex={-1}
    >
      {label}
    </button>
  );
}
