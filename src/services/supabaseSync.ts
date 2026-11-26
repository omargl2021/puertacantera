import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  PortalDatabase,
  PortalUser,
  SupabaseRegistroAccesoRow,
  SupabaseSyncSnapshot,
} from '../types/portal';
import {
  buildFullSupabaseSyncPayload,
  buildSupabaseBundleForUser,
  toDeterministicUuid,
} from '../utils/supabaseMapper';

export interface SupabaseConnectionStatus {
  configured: boolean;
  connected: boolean;
  counts?: {
    viviendas: number;
    vehiculos: number;
    marbetes: number;
    registros_acceso: number;
  };
  error?: string;
}

function getBrowserSupabaseClient(): SupabaseClient | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const key = (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function callSupabaseApi<T>(
  path: string,
  authToken: string | null,
  init: RequestInit = {},
): Promise<{ data: T | null; fallbackToBrowser: boolean; error?: string }> {
  if (!authToken) {
    return { data: null, fallbackToBrowser: true };
  }

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        ...(init.headers || {}),
      },
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 404 || response.status === 405 || !contentType.includes('application/json')) {
      return { data: null, fallbackToBrowser: true };
    }
    const json = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!response.ok) {
      return { data: null, fallbackToBrowser: false, error: json.error || 'Error en Supabase.' };
    }
    return { data: json, fallbackToBrowser: false };
  } catch {
    return { data: null, fallbackToBrowser: true };
  }
}

export async function fetchSupabaseStatus(
  authToken: string | null,
): Promise<SupabaseConnectionStatus> {
  const apiRes = await callSupabaseApi<SupabaseConnectionStatus>('/api/supabase/status', authToken);
  if (!apiRes.fallbackToBrowser) {
    return (
      apiRes.data ?? {
        configured: true,
        connected: false,
        error: apiRes.error,
      }
    );
  }

  const client = getBrowserSupabaseClient();
  if (!client) {
    return { configured: false, connected: false };
  }

  try {
    const [vivRes, vehRes, marRes, regRes] = await Promise.all([
      client.from('viviendas').select('id', { count: 'exact', head: true }),
      client.from('vehiculos').select('id', { count: 'exact', head: true }),
      client.from('marbetes').select('id', { count: 'exact', head: true }),
      client.from('registros_acceso').select('id', { count: 'exact', head: true }),
    ]);
    const err = vivRes.error || vehRes.error || marRes.error || regRes.error;
    if (err) {
      return { configured: true, connected: false, error: err.message };
    }
    return {
      configured: true,
      connected: true,
      counts: {
        viviendas: vivRes.count ?? 0,
        vehiculos: vehRes.count ?? 0,
        marbetes: marRes.count ?? 0,
        registros_acceso: regRes.count ?? 0,
      },
    };
  } catch {
    return { configured: true, connected: false, error: 'No se pudo conectar con Supabase.' };
  }
}

export async function fetchSupabaseRecords(
  authToken: string | null,
): Promise<{ snapshot: SupabaseSyncSnapshot | null; configured: boolean; error?: string }> {
  const apiRes = await callSupabaseApi<{
    ok: boolean;
    configured?: boolean;
    snapshot?: SupabaseSyncSnapshot;
    error?: string;
  }>('/api/supabase/records', authToken);

  if (!apiRes.fallbackToBrowser) {
    if (apiRes.data?.snapshot) {
      return { snapshot: apiRes.data.snapshot, configured: true };
    }
    return {
      snapshot: null,
      configured: apiRes.data?.configured !== false,
      error: apiRes.error,
    };
  }

  const client = getBrowserSupabaseClient();
  if (!client) {
    return { snapshot: null, configured: false };
  }

  try {
    const [vivRes, vehRes, marRes, regRes] = await Promise.all([
      client.from('viviendas').select('*').order('created_at', { ascending: true }),
      client.from('vehiculos').select('*').order('created_at', { ascending: true }),
      client.from('marbetes').select('*').order('folio', { ascending: true }),
      client
        .from('registros_acceso')
        .select('*')
        .order('fecha_hora', { ascending: false })
        .limit(200),
    ]);
    const err = vivRes.error || vehRes.error || marRes.error || regRes.error;
    if (err) {
      return { snapshot: null, configured: true, error: err.message };
    }
    return {
      configured: true,
      snapshot: {
        viviendas: vivRes.data ?? [],
        vehiculos: vehRes.data ?? [],
        marbetes: marRes.data ?? [],
        registros_acceso: regRes.data ?? [],
      },
    };
  } catch {
    return { snapshot: null, configured: true, error: 'Error al consultar Supabase.' };
  }
}

export async function syncSupabaseUser(
  authToken: string | null,
  db: PortalDatabase,
  user: PortalUser,
): Promise<{ ok: boolean; error?: string }> {
  const bundle = buildSupabaseBundleForUser(db, user);
  const apiRes = await callSupabaseApi<{ ok: boolean; error?: string }>(
    '/api/supabase/residents',
    authToken,
    {
      method: 'POST',
      body: JSON.stringify(bundle),
    },
  );

  if (!apiRes.fallbackToBrowser) {
    return { ok: Boolean(apiRes.data?.ok), error: apiRes.error };
  }

  const client = getBrowserSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase no configurado.' };
  }

  try {
    const { error: vivErr } = await client
      .from('viviendas')
      .upsert(bundle.vivienda, { onConflict: 'id' });
    if (vivErr) return { ok: false, error: vivErr.message };

    if (bundle.vehiculos.length > 0) {
      const { error: vehErr } = await client
        .from('vehiculos')
        .upsert(bundle.vehiculos, { onConflict: 'id' });
      if (vehErr) return { ok: false, error: vehErr.message };
    }
    if (bundle.marbetes.length > 0) {
      const { error: marErr } = await client
        .from('marbetes')
        .upsert(bundle.marbetes, { onConflict: 'id' });
      if (marErr) return { ok: false, error: marErr.message };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error al guardar en Supabase.' };
  }
}

export async function deleteSupabaseUser(
  authToken: string | null,
  user: PortalUser,
): Promise<{ ok: boolean; error?: string }> {
  const viviendaId = toDeterministicUuid(
    user.houseId ? `vivienda:${user.houseId}` : `vivienda-user:${user.id}`,
  );
  const apiRes = await callSupabaseApi<{ ok: boolean; error?: string }>(
    `/api/supabase/residents/${encodeURIComponent(viviendaId)}`,
    authToken,
    { method: 'DELETE' },
  );

  if (!apiRes.fallbackToBrowser) {
    return { ok: Boolean(apiRes.data?.ok), error: apiRes.error };
  }

  const client = getBrowserSupabaseClient();
  if (!client) return { ok: false };

  try {
    const { error } = await client.from('viviendas').delete().eq('id', viviendaId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function syncAllToSupabase(
  authToken: string | null,
  db: PortalDatabase,
): Promise<{
  ok: boolean;
  synced?: { viviendas: number; vehiculos: number; marbetes: number };
  error?: string;
}> {
  const payload = buildFullSupabaseSyncPayload(db);
  const apiRes = await callSupabaseApi<{
    ok: boolean;
    synced?: { viviendas: number; vehiculos: number; marbetes: number };
    error?: string;
  }>('/api/supabase/sync-all', authToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!apiRes.fallbackToBrowser) {
    return apiRes.data ?? { ok: false, error: apiRes.error };
  }

  const client = getBrowserSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase no configurado en variables de entorno.' };
  }

  try {
    if (payload.viviendas.length > 0) {
      const { error: vivErr } = await client
        .from('viviendas')
        .upsert(payload.viviendas, { onConflict: 'id' });
      if (vivErr) return { ok: false, error: vivErr.message };
    }
    if (payload.vehiculos.length > 0) {
      const { error: vehErr } = await client
        .from('vehiculos')
        .upsert(payload.vehiculos, { onConflict: 'id' });
      if (vehErr) return { ok: false, error: vehErr.message };
    }
    if (payload.marbetes.length > 0) {
      const { error: marErr } = await client
        .from('marbetes')
        .upsert(payload.marbetes, { onConflict: 'id' });
      if (marErr) return { ok: false, error: marErr.message };
    }
    return {
      ok: true,
      synced: {
        viviendas: payload.viviendas.length,
        vehiculos: payload.vehiculos.length,
        marbetes: payload.marbetes.length,
      },
    };
  } catch {
    return { ok: false, error: 'Error al sincronizar con Supabase.' };
  }
}

export async function updateSupabaseViviendaAlCorriente(
  authToken: string | null,
  houseId: string,
  alCorriente: boolean,
): Promise<void> {
  const viviendaId = toDeterministicUuid(`vivienda:${houseId}`);
  const apiRes = await callSupabaseApi<{ ok: boolean }>(
    `/api/supabase/viviendas/${encodeURIComponent(viviendaId)}/al-corriente`,
    authToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ al_corriente: alCorriente }),
    },
  );
  if (!apiRes.fallbackToBrowser) return;

  const client = getBrowserSupabaseClient();
  if (!client) return;
  await client.from('viviendas').update({ al_corriente: alCorriente }).eq('id', viviendaId);
}

export async function recordSupabaseAcceso(
  authToken: string | null,
  residentKey: string,
  vehicleCode: string,
  tipoMovimiento: 'entrada' | 'salida' | 'escaneo_qr',
  observaciones: string,
): Promise<SupabaseRegistroAccesoRow | null> {
  const marbeteId = toDeterministicUuid(`marbete:${residentKey}:${vehicleCode}`);
  const apiRes = await callSupabaseApi<{ ok: boolean; registro?: SupabaseRegistroAccesoRow }>(
    '/api/supabase/registros-acceso',
    authToken,
    {
      method: 'POST',
      body: JSON.stringify({
        marbete_id: marbeteId,
        tipo_movimiento: tipoMovimiento,
        observaciones,
      }),
    },
  );
  if (!apiRes.fallbackToBrowser) {
    return apiRes.data?.registro ?? null;
  }

  const client = getBrowserSupabaseClient();
  if (!client) return null;

  const { data } = await client
    .from('registros_acceso')
    .insert({
      marbete_id: marbeteId,
      tipo_movimiento: tipoMovimiento,
      observaciones,
    })
    .select('*')
    .single();
  return (data as SupabaseRegistroAccesoRow | null) ?? null;
}
