import type {
  House,
  PortalDatabase,
  PortalUser,
  SupabaseMarbeteRow,
  SupabaseSyncSnapshot,
  SupabaseVehiculoRow,
  SupabaseViviendaRow,
  UserRole,
  VehicleQrCode,
} from '../types/portal';
import {
  computeHouseBalance,
  DEFAULT_NOW_ISO,
  isPrimaryAdminUser,
  normalizePortalDatabase,
  ROLE_LABELS,
} from './portalLogic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Generates a deterministic RFC-4122 compliant v4-formatted UUID from any seed string
 * so local IDs / QR codes map stably to Supabase uuid primary/unique columns.
 */
export function toDeterministicUuid(seed: string): string {
  const normalized = seed.trim();
  if (isUuid(normalized)) return normalized.toLowerCase();

  const p1 = fnv1a32(`a:${normalized}`, 0x811c9dc5).toString(16).padStart(8, '0');
  const p2 = fnv1a32(`b:${normalized}`, 0x9e3779b9).toString(16).padStart(8, '0');
  const p3 = fnv1a32(`c:${normalized}`, 0x85ebca6b).toString(16).padStart(8, '0');
  const p4 = fnv1a32(`d:${normalized}`, 0xc2b2ae35).toString(16).padStart(8, '0');

  const combined = `${p1}${p2}${p3}${p4}`;
  const timeHi = `4${combined.slice(13, 16)}`;
  const clockVariant = ((parseInt(combined.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0');

  return `${combined.slice(0, 8)}-${combined.slice(8, 12)}-${timeHi}-${clockVariant}${combined.slice(18, 20)}-${combined.slice(20, 32)}`;
}

export function computeMarbeteFolio(residentKey: string, vehicleIndex: number): number {
  const digits = parseInt(residentKey.replace(/\D/g, ''), 10);
  const base = Number.isFinite(digits) && digits > 0 ? digits : 1;
  const safeIdx = Math.max(1, Math.min(99, Math.floor(vehicleIndex)));
  return base * 100 + safeIdx;
}

export function mapRoleToTipoResidente(role: UserRole): string {
  return ROLE_LABELS[role] ?? 'Residente';
}

export function mapTipoResidenteToRole(tipo: string | null | undefined): UserRole {
  const normalized = (tipo ?? '').trim().toLowerCase();
  if (normalized === 'admin' || normalized.includes('mesa') || normalized.includes('admon')) {
    return 'admin';
  }
  if (normalized === 'treasurer' || normalized.includes('tesorer')) {
    return 'treasurer';
  }
  if (normalized === 'guard' || normalized.includes('caseta') || normalized.includes('guardia')) {
    return 'guard';
  }
  return 'resident';
}

export interface SupabaseResidentBundle {
  vivienda: SupabaseViviendaRow;
  vehiculos: SupabaseVehiculoRow[];
  marbetes: SupabaseMarbeteRow[];
}

export function buildSupabaseBundleForUser(
  db: PortalDatabase,
  user: PortalUser,
  nowDate = DEFAULT_NOW_ISO.slice(0, 10),
): SupabaseResidentBundle {
  const house = user.houseId ? db.houses.find((h) => h.id === user.houseId) ?? null : null;
  const viviendaId = toDeterministicUuid(house ? `vivienda:${house.id}` : `vivienda-user:${user.id}`);
  const balance = house ? computeHouseBalance(house, db.feeHistory, db.payments) : null;
  const alCorriente = balance ? balance.status === 'ok' : true;
  const createdAt = `${nowDate}T12:00:00.000Z`;
  const [yr, mo, dy] = nowDate.split('-').map((n) => parseInt(n, 10));
  const nextYearDate =
    Number.isFinite(yr) && Number.isFinite(mo) && Number.isFinite(dy)
      ? `${yr + 1}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`
      : null;

  const vivienda: SupabaseViviendaRow = {
    id: viviendaId,
    residente_titular: user.name,
    calle: house?.street || 'Sin calle',
    numero_exterior: house?.number || 'S/N',
    numero_interior: house?.interiorNumber || null,
    telefono: user.phone || null,
    tipo_residente: mapRoleToTipoResidente(user.role),
    al_corriente: alCorriente,
    created_at: createdAt,
  };

  const vehiculos: SupabaseVehiculoRow[] = [];
  const marbetes: SupabaseMarbeteRow[] = [];

  for (const vehicle of user.vehicleQrCodes) {
    const folio = computeMarbeteFolio(user.residentKey, vehicle.index);
    const vehiculoId = toDeterministicUuid(`vehiculo:${user.residentKey}:${vehicle.code}`);
    const marbeteId = toDeterministicUuid(`marbete:${user.residentKey}:${vehicle.code}`);
    const codigoQr = toDeterministicUuid(`qr:${vehicle.code}`);
    const placas = (vehicle.plate ?? '').trim().toUpperCase() || `PC-${folio}`;

    vehiculos.push({
      id: vehiculoId,
      vivienda_id: viviendaId,
      placas,
      created_at: createdAt,
      marca: null,
      modelo: vehicle.model || null,
      color: vehicle.color || null,
    });

    marbetes.push({
      id: marbeteId,
      folio,
      codigo_qr: codigoQr,
      vehiculo_id: vehiculoId,
      estatus: user.active ? 'activo' : 'inactivo',
      fecha_emision: nowDate,
      fecha_vencimiento: nextYearDate,
      notas: `${user.residentKey} · ${vehicle.label} · ${vehicle.code}`,
    });
  }

  return { vivienda, vehiculos, marbetes };
}

export function buildFullSupabaseSyncPayload(
  db: PortalDatabase,
  nowDate = DEFAULT_NOW_ISO.slice(0, 10),
): {
  viviendas: SupabaseViviendaRow[];
  vehiculos: SupabaseVehiculoRow[];
  marbetes: SupabaseMarbeteRow[];
} {
  const viviendaMap = new Map<string, SupabaseViviendaRow>();
  const vehiculos: SupabaseVehiculoRow[] = [];
  const marbetes: SupabaseMarbeteRow[] = [];

  for (const user of db.users) {
    if (isPrimaryAdminUser(user) && !user.houseId) continue;
    const bundle = buildSupabaseBundleForUser(db, user, nowDate);
    viviendaMap.set(bundle.vivienda.id, bundle.vivienda);
    vehiculos.push(...bundle.vehiculos);
    marbetes.push(...bundle.marbetes);
  }

  return {
    viviendas: Array.from(viviendaMap.values()),
    vehiculos,
    marbetes,
  };
}

function parseNotasMeta(notas: string | null): {
  residentKey?: string;
  vehicleLabel?: string;
  vehicleCode?: string;
} {
  if (!notas) return {};
  const parts = notas.split('·').map((p) => p.trim());
  const residentKey = parts.find((p) => /^RES\d+$/i.test(p))?.toUpperCase();
  const vehicleLabel = parts.find((p) => /^Auto\s+\d+$/i.test(p));
  const vehicleCode = parts.find((p) => /^PC-/i.test(p));
  return { residentKey, vehicleLabel, vehicleCode };
}

export function mergeSupabaseSnapshotIntoDb(
  baseDb: PortalDatabase,
  snapshot: SupabaseSyncSnapshot,
): PortalDatabase {
  if (snapshot.viviendas.length === 0) {
    return {
      ...baseDb,
      supabaseRegistrosAcceso: snapshot.registros_acceso,
    };
  }

  const vehiclesByVivienda = new Map<string, SupabaseVehiculoRow[]>();
  for (const veh of snapshot.vehiculos) {
    const list = vehiclesByVivienda.get(veh.vivienda_id) ?? [];
    list.push(veh);
    vehiclesByVivienda.set(veh.vivienda_id, list);
  }

  const marbeteByVehicle = new Map<string, SupabaseMarbeteRow>();
  for (const marbete of snapshot.marbetes) {
    marbeteByVehicle.set(marbete.vehiculo_id, marbete);
  }

  const primaryAdmin =
    baseDb.users.find((u) => isPrimaryAdminUser(u)) ??
    baseDb.users.find((u) => u.role === 'admin') ??
    null;

  const existingHouseByUuid = new Map<string, House>();
  for (const h of baseDb.houses) {
    existingHouseByUuid.set(toDeterministicUuid(`vivienda:${h.id}`), h);
    existingHouseByUuid.set(h.id, h);
  }

  const existingUserByViviendaUuid = new Map<string, PortalUser>();
  for (const u of baseDb.users) {
    if (isPrimaryAdminUser(u)) continue;
    const key = u.houseId
      ? toDeterministicUuid(`vivienda:${u.houseId}`)
      : toDeterministicUuid(`vivienda-user:${u.id}`);
    existingUserByViviendaUuid.set(key, u);
  }

  const houses: House[] = [];
  const users: PortalUser[] = primaryAdmin ? [primaryAdmin] : [];
  let seqResident = 2;

  for (const viv of snapshot.viviendas) {
    const existingHouse = existingHouseByUuid.get(viv.id);
    const houseId = existingHouse?.id ?? viv.id;
    const existingUser = existingUserByViviendaUuid.get(viv.id);

    const house: House = {
      id: houseId,
      street: viv.calle,
      number: viv.numero_exterior,
      interiorNumber: viv.numero_interior ?? null,
      familyName: existingHouse?.familyName || viv.residente_titular,
      active: viv.al_corriente,
    };
    houses.push(house);

    const linkedVehicles = vehiclesByVivienda.get(viv.id) ?? [];
    let inferredKey = existingUser?.residentKey;
    const vehicleQrCodes: VehicleQrCode[] = linkedVehicles.map((veh, idx) => {
      const marbete = marbeteByVehicle.get(veh.id);
      const meta = parseNotasMeta(marbete?.notas ?? null);
      if (!inferredKey && meta.residentKey) {
        inferredKey = meta.residentKey;
      }
      const code =
        meta.vehicleCode ||
        (marbete ? `PC-M${marbete.folio}` : `PC-V${String(idx + 1)}-${veh.id.slice(0, 6).toUpperCase()}`);
      return {
        index: idx + 1,
        label: meta.vehicleLabel || `Auto ${idx + 1}`,
        code,
        plate: veh.placas,
        model: [veh.marca, veh.modelo].filter(Boolean).join(' ') || undefined,
        color: veh.color || undefined,
      };
    });

    const residentKey =
      inferredKey || `RES${String(seqResident++).padStart(3, '0')}`;
    const firstMarbete = linkedVehicles[0] ? marbeteByVehicle.get(linkedVehicles[0].id) : undefined;
    const isActive = firstMarbete ? firstMarbete.estatus !== 'inactivo' : true;

    users.push({
      id: existingUser?.id ?? `sb-${viv.id}`,
      residentKey,
      name: viv.residente_titular,
      email: existingUser?.email ?? `${residentKey.toLowerCase()}@puertacantera.com`,
      role: mapTipoResidenteToRole(viv.tipo_residente),
      houseId,
      active: isActive,
      phone: viv.telefono ?? undefined,
      qrCode: existingUser?.qrCode ?? vehicleQrCodes[0]?.code ?? `PC-${residentKey}`,
      carCount: vehicleQrCodes.length,
      vehicleQrCodes,
    });
  }

  return normalizePortalDatabase({
    ...baseDb,
    houses,
    users,
    supabaseRegistrosAcceso: snapshot.registros_acceso,
  });
}
