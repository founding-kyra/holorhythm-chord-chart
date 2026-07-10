import { supabase } from '../lib/supabase';
import { ChartData, SheetData, TrashedChart, TrashedSheet } from '../types';

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export async function loadCharts(): Promise<ChartData[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('charts')
    .select('data')
    .eq('user_id', userId)
    .is('trashed_at', null);
  if (error) throw error;
  return (data ?? []).map(row => row.data as ChartData);
}

export async function loadSheets(): Promise<SheetData[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('sheets')
    .select('data')
    .eq('user_id', userId)
    .is('trashed_at', null);
  if (error) throw error;
  return (data ?? []).map(row => row.data as SheetData);
}

export async function loadTrash(): Promise<TrashedChart[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('charts')
    .select('data, trashed_at')
    .eq('user_id', userId)
    .not('trashed_at', 'is', null);
  if (error) throw error;
  return (data ?? []).map(row => ({
    chart: row.data as ChartData,
    trashedAt: Date.parse(row.trashed_at as string),
  }));
}

export async function loadTrashedSheets(): Promise<TrashedSheet[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('sheets')
    .select('data, trashed_at')
    .eq('user_id', userId)
    .not('trashed_at', 'is', null);
  if (error) throw error;
  return (data ?? []).map(row => ({
    sheet: row.data as SheetData,
    trashedAt: Date.parse(row.trashed_at as string),
  }));
}

export async function saveCharts(active: ChartData[], trashed: TrashedChart[]): Promise<void> {
  const userId = await getUserId();

  const rows = [
    ...active.map(chart => ({
      id: chart.id,
      user_id: userId,
      data: chart,
      updated_at: new Date().toISOString(),
      trashed_at: null,
    })),
    ...trashed.map(({ chart, trashedAt }) => ({
      id: chart.id,
      user_id: userId,
      data: chart,
      updated_at: new Date().toISOString(),
      trashed_at: new Date(trashedAt).toISOString(),
    })),
  ];

  if (rows.length > 0) {
    const { error } = await supabase.from('charts').upsert(rows);
    if (error) throw error;
  }

  const keepIds = rows.map(r => r.id);
  let deleteQuery = supabase.from('charts').delete().eq('user_id', userId);
  if (keepIds.length > 0) {
    deleteQuery = deleteQuery.not('id', 'in', `(${keepIds.join(',')})`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
}

export async function saveSheets(active: SheetData[], trashed: TrashedSheet[]): Promise<void> {
  const userId = await getUserId();

  const rows = [
    ...active.map(sheet => ({
      id: sheet.id,
      user_id: userId,
      data: sheet,
      updated_at: new Date().toISOString(),
      trashed_at: null,
    })),
    ...trashed.map(({ sheet, trashedAt }) => ({
      id: sheet.id,
      user_id: userId,
      data: sheet,
      updated_at: new Date().toISOString(),
      trashed_at: new Date(trashedAt).toISOString(),
    })),
  ];

  if (rows.length > 0) {
    const { error } = await supabase.from('sheets').upsert(rows);
    if (error) throw error;
  }

  const keepIds = rows.map(r => r.id);
  let deleteQuery = supabase.from('sheets').delete().eq('user_id', userId);
  if (keepIds.length > 0) {
    deleteQuery = deleteQuery.not('id', 'in', `(${keepIds.join(',')})`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
}
