import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

// Runtime HMAC signing secret (env override or cryptographically strong in-memory key)
const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const DEFAULT_ADMIN_USERNAME = 'ADMON';
// Precomputed scrypt hash for the user-specified initial admin credential (overridden if process.env.ADMIN_PASSWORD is set)
const DEFAULT_ADMIN_SCRYPT =
  'pc_admon_salt_v1_9f4a:9fa591999d6333954990165dcbbb48f49aea110b387ee2ea297a4ffa400742dc';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_MOVEMENTS = new Set(['entrada', 'salida', 'escaneo_qr']);

interface ServerSession {
  token: string;
  username: string;
  role: 'admin' | 'resident' | 'treasurer' | 'guard';
  issuedAt: number;
}

const activeSessions = new Map<string, ServerSession>();

function getSupabaseServerClient(): { client: SupabaseClient | null; configured: boolean } {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  const key = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    return { client: null, configured: false };
  }

  return {
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    configured: true,
  };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyScryptHash(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const derivedHex = crypto.scryptSync(password, salt, 32).toString('hex');
  return timingSafeEqualStr(derivedHex, expectedHex);
}

function verifyAdminCredentials(username: string, password: string): boolean {
  const configuredUser = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
  if (username.trim().toUpperCase() !== configuredUser.toUpperCase()) {
    return false;
  }
  const configuredPass = process.env.ADMIN_PASSWORD;
  if (configuredPass && configuredPass.length > 0) {
    return timingSafeEqualStr(password, configuredPass);
  }
  return verifyScryptHash(password, DEFAULT_ADMIN_SCRYPT);
}

function issueSessionToken(username: string, role: ServerSession['role']): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(`${username}:${role}:${nonce}`)
    .digest('hex');
  const token = `${nonce}.${sig}`;
  activeSessions.set(token, { token, username, role, issuedAt: Date.now() });
  return token;
}

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue || !headerValue.startsWith('Bearer ')) return null;
  return headerValue.slice('Bearer '.length).trim() || null;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.header('authorization'));
  if (!token) {
    res.status(401).json({ ok: false, error: 'No autenticado.' });
    return;
  }
  const session = activeSessions.get(token);
  if (!session || session.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'Acceso reservado para administración.' });
    return;
  }
  next();
}

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function sanitizeText(value: unknown, maxLen = 240): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/auth/login', (req, res) => {
    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawUsername || rawUsername.length > 160 || rawPassword.length < 4 || rawPassword.length > 128) {
      res.status(400).json({ ok: false, error: 'Ingresa un usuario y contraseña válidos.' });
      return;
    }

    const configuredAdminUser = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
    if (!verifyAdminCredentials(rawUsername, rawPassword)) {
      res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
      return;
    }

    const token = issueSessionToken(configuredAdminUser, 'admin');
    res.json({
      ok: true,
      isAdmin: true,
      username: configuredAdminUser,
      role: 'admin',
      token,
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      res.status(401).json({ ok: false, error: 'No autenticado.' });
      return;
    }
    const session = activeSessions.get(token);
    if (!session) {
      res.status(401).json({ ok: false, error: 'Sesión expirada o inválida.' });
      return;
    }
    res.json({ ok: true, username: session.username, role: session.role });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req.header('authorization'));
    if (token) {
      activeSessions.delete(token);
    }
    res.json({ ok: true });
  });

  app.get('/api/supabase/status', requireAdminAuth, async (_req, res) => {
    const { client, configured } = getSupabaseServerClient();
    if (!configured || !client) {
      res.json({ ok: true, configured: false, connected: false });
      return;
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
        res.status(502).json({ ok: false, configured: true, connected: false, error: err.message });
        return;
      }

      res.json({
        ok: true,
        configured: true,
        connected: true,
        counts: {
          viviendas: vivRes.count ?? 0,
          vehiculos: vehRes.count ?? 0,
          marbetes: marRes.count ?? 0,
          registros_acceso: regRes.count ?? 0,
        },
      });
    } catch {
      res.status(502).json({
        ok: false,
        configured: true,
        connected: false,
        error: 'No se pudo consultar Supabase.',
      });
    }
  });

  app.get('/api/supabase/records', requireAdminAuth, async (_req, res) => {
    const { client, configured } = getSupabaseServerClient();
    if (!configured || !client) {
      res.json({
        ok: true,
        configured: false,
        snapshot: null,
      });
      return;
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
        res.status(502).json({ ok: false, error: err.message });
        return;
      }

      res.json({
        ok: true,
        snapshot: {
          viviendas: vivRes.data ?? [],
          vehiculos: vehRes.data ?? [],
          marbetes: marRes.data ?? [],
          registros_acceso: regRes.data ?? [],
        },
      });
    } catch {
      res.status(502).json({ ok: false, error: 'Error al leer las tablas de Supabase.' });
    }
  });

  app.post('/api/supabase/residents', requireAdminAuth, async (req, res) => {
    const { client, configured } = getSupabaseServerClient();
    if (!configured || !client) {
      res.status(503).json({ ok: false, configured: false, error: 'Supabase no configurado.' });
      return;
    }

    const vivienda = req.body?.vivienda;
    const vehiculos = Array.isArray(req.body?.vehiculos) ? req.body.vehiculos : [];
    const marbetes = Array.isArray(req.body?.marbetes) ? req.body.marbetes : [];

    if (!vivienda || !isValidUuid(vivienda.id) || !sanitizeText(vivienda.residente_titular)) {
      res.status(400).json({ ok: false, error: 'Datos de vivienda inválidos.' });
      return;
    }

    try {
      const cleanVivienda = {
        id: vivienda.id,
        residente_titular: sanitizeText(vivienda.residente_titular, 180)!,
        calle: sanitizeText(vivienda.calle, 140) || 'Sin calle',
        numero_exterior: sanitizeText(vivienda.numero_exterior, 40) || 'S/N',
        numero_interior: sanitizeText(vivienda.numero_interior, 40),
        telefono: sanitizeText(vivienda.telefono, 40),
        tipo_residente: sanitizeText(vivienda.tipo_residente, 60) || 'Residente',
        al_corriente: Boolean(vivienda.al_corriente ?? true),
      };

      const { error: vivErr } = await client
        .from('viviendas')
        .upsert(cleanVivienda, { onConflict: 'id' });
      if (vivErr) {
        res.status(400).json({ ok: false, error: vivErr.message });
        return;
      }

      const incomingVehIds = new Set(
        vehiculos.map((v: { id?: unknown }) => (isValidUuid(v?.id) ? v.id : '')).filter(Boolean),
      );
      const { data: existingVehs } = await client
        .from('vehiculos')
        .select('id')
        .eq('vivienda_id', cleanVivienda.id);

      const staleVehIds = (existingVehs ?? [])
        .map((v: { id: string }) => v.id)
        .filter((id: string) => !incomingVehIds.has(id));

      if (staleVehIds.length > 0) {
        await client.from('marbetes').delete().in('vehiculo_id', staleVehIds);
        await client.from('vehiculos').delete().in('id', staleVehIds);
      }

      if (vehiculos.length > 0) {
        const cleanVehiculos = vehiculos
          .filter((v: { id?: unknown; placas?: unknown }) => isValidUuid(v?.id) && sanitizeText(v?.placas, 30))
          .map((v: Record<string, unknown>) => ({
            id: v.id as string,
            vivienda_id: cleanVivienda.id,
            placas: sanitizeText(v.placas, 30)!.toUpperCase(),
            marca: sanitizeText(v.marca, 60),
            modelo: sanitizeText(v.modelo, 80),
            color: sanitizeText(v.color, 50),
          }));

        if (cleanVehiculos.length > 0) {
          const { error: vehErr } = await client
            .from('vehiculos')
            .upsert(cleanVehiculos, { onConflict: 'id' });
          if (vehErr) {
            res.status(400).json({ ok: false, error: vehErr.message });
            return;
          }
        }
      }

      if (marbetes.length > 0) {
        const cleanMarbetes = marbetes
          .filter(
            (m: { id?: unknown; vehiculo_id?: unknown; codigo_qr?: unknown }) =>
              isValidUuid(m?.id) && isValidUuid(m?.vehiculo_id) && isValidUuid(m?.codigo_qr),
          )
          .map((m: Record<string, unknown>) => ({
            id: m.id as string,
            folio: Math.max(1, Math.floor(Number(m.folio) || 1)),
            codigo_qr: m.codigo_qr as string,
            vehiculo_id: m.vehiculo_id as string,
            estatus: sanitizeText(m.estatus, 30) || 'activo',
            fecha_emision: sanitizeText(m.fecha_emision, 20) || new Date().toISOString().slice(0, 10),
            fecha_vencimiento: sanitizeText(m.fecha_vencimiento, 20),
            notas: sanitizeText(m.notas, 240),
          }));

        if (cleanMarbetes.length > 0) {
          const { error: marErr } = await client
            .from('marbetes')
            .upsert(cleanMarbetes, { onConflict: 'id' });
          if (marErr) {
            res.status(400).json({ ok: false, error: marErr.message });
            return;
          }
        }
      }

      res.json({ ok: true });
    } catch {
      res.status(502).json({ ok: false, error: 'Error al guardar en Supabase.' });
    }
  });

  app.delete('/api/supabase/residents/:viviendaId', requireAdminAuth, async (req, res) => {
    const { client, configured } = getSupabaseServerClient();
    if (!configured || !client) {
      res.status(503).json({ ok: false, configured: false, error: 'Supabase no configurado.' });
      return;
    }

    const { viviendaId } = req.params;
    if (!isValidUuid(viviendaId)) {
      res.status(400).json({ ok: false, error: 'ID de vivienda inválido.' });
      return;
    }

    try {
      const { data: vehs } = await client
        .from('vehiculos')
        .select('id')
        .eq('vivienda_id', viviendaId);
      const vehIds = (vehs ?? []).map((v: { id: string }) => v.id);

      if (vehIds.length > 0) {
        const { data: marbs } = await client
          .from('marbetes')
          .select('id')
          .in('vehiculo_id', vehIds);
        const marbIds = (marbs ?? []).map((m: { id: string }) => m.id);
        if (marbIds.length > 0) {
          await client.from('registros_acceso').delete().in('marbete_id', marbIds);
          await client.from('marbetes').delete().in('id', marbIds);
        }
        await client.from('vehiculos').delete().in('id', vehIds);
      }

      const { error } = await client.from('viviendas').delete().eq('id', viviendaId);
      if (error) {
        res.status(400).json({ ok: false, error: error.message });
        return;
      }

      res.json({ ok: true });
    } catch {
      res.status(502).json({ ok: false, error: 'Error al eliminar en Supabase.' });
    }
  });

  app.post('/api/supabase/sync-all', requireAdminAuth, async (req, res) => {
    const { client, configured } = getSupabaseServerClient();
    if (!configured || !client) {
      res.status(503).json({ ok: false, configured: false, error: 'Supabase no configurado.' });
      return;
    }

    const viviendas = Array.isArray(req.body?.viviendas) ? req.body.viviendas.slice(0, 500) : [];
    const vehiculos = Array.isArray(req.body?.vehiculos) ? req.body.vehiculos.slice(0, 1500) : [];
    const marbetes = Array.isArray(req.body?.marbetes) ? req.body.marbetes.slice(0, 1500) : [];

    try {
      const cleanViviendas = viviendas
        .filter((v: { id?: unknown; residente_titular?: unknown }) => isValidUuid(v?.id) && sanitizeText(v?.residente_titular))
        .map((v: Record<string, unknown>) => ({
          id: v.id as string,
          residente_titular: sanitizeText(v.residente_titular, 180)!,
          calle: sanitizeText(v.calle, 140) || 'Sin calle',
          numero_exterior: sanitizeText(v.numero_exterior, 40) || 'S/N',
          numero_interior: sanitizeText(v.numero_interior, 40),
          telefono: sanitizeText(v.telefono, 40),
          tipo_residente: sanitizeText(v.tipo_residente, 60) || 'Residente',
          al_corriente: Boolean(v.al_corriente ?? true),
        }));

      if (cleanViviendas.length > 0) {
        const { error: vivErr } = await client
          .from('viviendas')
          .upsert(cleanViviendas, { onConflict: 'id' });
        if (vivErr) {
          res.status(400).json({ ok: false, error: vivErr.message });
          return;
        }
      }

      const cleanVehiculos = vehiculos
        .filter(
          (v: { id?: unknown; vivienda_id?: unknown; placas?: unknown }) =>
            isValidUuid(v?.id) && isValidUuid(v?.vivienda_id) && sanitizeText(v?.placas, 30),
        )
        .map((v: Record<string, unknown>) => ({
          id: v.id as string,
          vivienda_id: v.vivienda_id as string,
          placas: sanitizeText(v.placas, 30)!.toUpperCase(),
          marca: sanitizeText(v.marca, 60),
          modelo: sanitizeText(v.modelo, 80),
          color: sanitizeText(v.color, 50),
        }));

      if (cleanVehiculos.length > 0) {
        const { error: vehErr } = await client
          .from('vehiculos')
          .upsert(cleanVehiculos, { onConflict: 'id' });
        if (vehErr) {
          res.status(400).json({ ok: false, error: vehErr.message });
          return;
        }
      }

      const cleanMarbetes = marbetes
        .filter(
          (m: { id?: unknown; vehiculo_id?: unknown; codigo_qr?: unknown }) =>
            isValidUuid(m?.id) && isValidUuid(m?.vehiculo_id) && isValidUuid(m?.codigo_qr),
        )
        .map((m: Record<string, unknown>) => ({
          id: m.id as string,
          folio: Math.max(1, Math.floor(Number(m.folio) || 1)),
          codigo_qr: m.codigo_qr as string,
          vehiculo_id: m.vehiculo_id as string,
          estatus: sanitizeText(m.estatus, 30) || 'activo',
          fecha_emision: sanitizeText(m.fecha_emision, 20) || new Date().toISOString().slice(0, 10),
          fecha_vencimiento: sanitizeText(m.fecha_vencimiento, 20),
          notas: sanitizeText(m.notas, 240),
        }));

      if (cleanMarbetes.length > 0) {
        const { error: marErr } = await client
          .from('marbetes')
          .upsert(cleanMarbetes, { onConflict: 'id' });
        if (marErr) {
          res.status(400).json({ ok: false, error: marErr.message });
          return;
        }
      }

      res.json({
        ok: true,
        synced: {
          viviendas: cleanViviendas.length,
          vehiculos: cleanVehiculos.length,
          marbetes: cleanMarbetes.length,
        },
      });
    } catch {
      res.status(502).json({ ok: false, error: 'Error al sincronizar el padrón con Supabase.' });
    }
  });

  app.patch('/api/supabase/viviendas/:viviendaId/al-corriente', requireAdminAuth, async (req, res) => {
    const { client, configured } = getSupabaseServerClient();
    if (!configured || !client) {
      res.status(503).json({ ok: false, configured: false, error: 'Supabase no configurado.' });
      return;
    }

    const { viviendaId } = req.params;
    if (!isValidUuid(viviendaId) || typeof req.body?.al_corriente !== 'boolean') {
      res.status(400).json({ ok: false, error: 'Datos inválidos para actualizar estatus.' });
      return;
    }

    try {
      const { error } = await client
        .from('viviendas')
        .update({ al_corriente: req.body.al_corriente })
        .eq('id', viviendaId);
      if (error) {
        res.status(400).json({ ok: false, error: error.message });
        return;
      }
      res.json({ ok: true });
    } catch {
      res.status(502).json({ ok: false, error: 'Error al actualizar al_corriente.' });
    }
  });

  app.post('/api/supabase/registros-acceso', requireAdminAuth, async (req, res) => {
    const { client, configured } = getSupabaseServerClient();
    if (!configured || !client) {
      res.status(503).json({ ok: false, configured: false, error: 'Supabase no configurado.' });
      return;
    }

    const marbeteId = req.body?.marbete_id;
    const tipoMovimiento = sanitizeText(req.body?.tipo_movimiento, 30) || 'escaneo_qr';
    const observaciones = sanitizeText(req.body?.observaciones, 240);

    if (!isValidUuid(marbeteId) || !ALLOWED_MOVEMENTS.has(tipoMovimiento)) {
      res.status(400).json({ ok: false, error: 'Datos inválidos para registro de acceso.' });
      return;
    }

    try {
      const { data, error } = await client
        .from('registros_acceso')
        .insert({
          marbete_id: marbeteId,
          tipo_movimiento: tipoMovimiento,
          observaciones,
        })
        .select('*')
        .single();

      if (error) {
        res.status(400).json({ ok: false, error: error.message });
        return;
      }

      res.json({ ok: true, registro: data });
    } catch {
      res.status(502).json({ ok: false, error: 'Error al guardar registro de acceso.' });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Puerta Cantera server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
