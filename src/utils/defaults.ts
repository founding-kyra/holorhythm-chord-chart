import { ChartData } from '../types';

export function createDefaultExampleChart(): ChartData {
  return {
    id: crypto.randomUUID(),
    title: 'C7#5',
    nutThickness: 'thick',
    startFret: 0,
    topIndicators: ['x', '', '', '', '', ''],
    markers: [
      { id: 'm1', stringIndex: 1, fretIndex: 1, label: 'R', ringStyle: 'double' },
      { id: 'm2', stringIndex: 2, fretIndex: 2, label: '7', ringStyle: 'single' },
      { id: 'm3', stringIndex: 3, fretIndex: 2, label: '3', ringStyle: 'single' },
      { id: 'm4', stringIndex: 4, fretIndex: 3, label: '#5', ringStyle: 'single' },
      { id: 'm5', stringIndex: 5, fretIndex: 3, label: '#5', ringStyle: 'single' },
    ],
    connectors: [
      { id: 'conn1', fromMarkerId: 'm4', toMarkerId: 'm5' },
    ],
    bottomNoteLabels: ['', 'C', 'B\u266D', 'E', 'G#', 'G#'],
    bottomIntervalLabels: ['', 'R', '\u266D7', '3', '#5', '#5'],
    tags: ['jazz', 'dominant'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createDefaultExampleSheet() {
  return {
    id: crypto.randomUUID(),
    title: 'Summertime - Jazz Voicings',
    slots: [
      'example-c7sharp5',
      null, null, null,
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
    ],
    notes: [
      { id: 'note1', x: 400, y: 300, text: 'Practice slowly with metronome' },
    ],
    tags: ['jazz', 'summertime'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
