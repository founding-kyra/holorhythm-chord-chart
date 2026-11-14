import { ChartData, SheetData, TrashedChart, TrashedSheet } from '../types';

export interface Library {
  charts: ChartData[];
  sheets: SheetData[];
  trashedCharts: TrashedChart[];
  trashedSheets: TrashedSheet[];
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Your session expired. Please sign in again.');
  }
}

/** Someone else saved a newer version of the library since this tab loaded it. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Returns the saved library (null if nothing has been saved yet) and its version number. */
export async function loadLibrary(): Promise<{ library: Library | null; version: number }> {
  const res = await fetch('/api/library', { credentials: 'same-origin' });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(await readError(res, 'Could not load your library.'));
  return (await res.json()) as { library: Library | null; version: number };
}

/** Saves the library. `baseVersion` is the version this tab last loaded or saved. Returns the new version. */
export async function saveLibrary(library: Library, baseVersion: number): Promise<number> {
  const res = await fetch('/api/library', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ library, baseVersion }),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 409) throw new ConflictError(await readError(res, 'The library was changed somewhere else.'));
  if (!res.ok) throw new Error(await readError(res, 'Could not save your changes.'));
  return ((await res.json()) as { version: number }).version;
}
