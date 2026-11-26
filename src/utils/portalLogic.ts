import QRCode from 'qrcode';
import type {
  AuditLogEntry,
  CommunityNotice,
  CommunityReport,
  CorbatinItem,
  FeeScheduleVersion,
  House,
  Invitation,
  NoticeCategory,
  PaymentRecord,
  PaymentStatus,
  PortalDatabase,
  PortalUser,
  ReportCategory,
  ReportStatus,
  ScannedResidentData,
  UserRole,
  VehicleDetailsInput,
  VehicleQrCode,
  VisitAccessType,
  VisitPass,
} from '../types/portal';

const MONTHS_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const MONTHS_LONG_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const DEFAULT_TODAY_ISO = '2026-11-21';
export const DEFAULT_NOW_ISO = '2026-11-21T12:00:00';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Mesa directiva',
  treasurer: 'Tesorería',
  resident: 'Vecino',
  guard: 'Caseta',
};

export const RESIDENTIAL_STREETS = [
  'Av. de las Flores',
  'Calle Violeta',
  'Av. Cantera',
  'Calle Girasol',
  'Calle Flor de Loto',
  'Calle Flor de Calabaza',
] as const;

export const ROLE_LIMITS = {
  treasurer: 1,
  admin: 5,
} as const;

export function getRoleUsage(
  db: PortalDatabase,
  excludeUserId?: string,
): { treasurer: number; admin: number } {
  let treasurer = 0;
  let admin = 0;
  for (const u of db.users) {
    if (!u.active) continue;
    if (excludeUserId && u.id === excludeUserId) continue;
    if (u.role === 'treasurer') treasurer += 1;
    if (u.role === 'admin') admin += 1;
  }
  return { treasurer, admin };
}

export function validateRoleLimit(
  db: PortalDatabase,
  role: UserRole,
  options?: { excludeUserId?: string; nextActive?: boolean },
): string | null {
  if (options?.nextActive === false) return null;
  const usage = getRoleUsage(db, options?.excludeUserId);
  if (role === 'treasurer' && usage.treasurer >= ROLE_LIMITS.treasurer) {
    return `Solo puede haber ${ROLE_LIMITS.treasurer} usuario con el rol de Tesorería.`;
  }
  if (role === 'admin' && usage.admin >= ROLE_LIMITS.admin) {
    return `Solo puede haber máximo ${ROLE_LIMITS.admin} usuarios con el rol de Mesa directiva.`;
  }
  return null;
}

export function formatVehicleSummary(vehicle: VehicleQrCode): string {
  const parts = [vehicle.plate, vehicle.model, vehicle.color]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  return parts.join(' · ');
}

export function normalizeTextKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizePlateKey(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function normalizeAddressKey(
  street: string,
  number: string,
  interiorNumber?: string | null,
): string {
  return `${normalizeTextKey(street)}|${normalizeTextKey(number)}|${normalizeTextKey(interiorNumber ?? '')}`;
}

export function formatResidentKey(sequenceNumber: number): string {
  return `RES${String(Math.max(1, Math.floor(sequenceNumber))).padStart(3, '0')}`;
}

export function generateNextResidentKey(users: Array<Pick<PortalUser, 'residentKey'>>): string {
  let maxNum = 0;
  for (const u of users) {
    const match = /^RES(\d+)$/i.exec((u.residentKey ?? '').trim());
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return formatResidentKey(maxNum + 1);
}

export function buildVehicleQrPayload(
  user: Pick<PortalUser, 'name' | 'email' | 'phone'> & { residentKey?: string },
  vehicle: VehicleQrCode,
  house?: House | null,
): string {
  const parts = [
    `CODIGO:${vehicle.code}`,
    user.residentKey ? `CLAVE:${user.residentKey}` : null,
    `TITULAR:${user.name}`,
    user.phone ? `TEL:${user.phone}` : null,
    house ? `CASA:${formatHouseLabel(house)}` : null,
    `AUTO:${vehicle.label}`,
    vehicle.plate ? `PLACA:${vehicle.plate}` : null,
    vehicle.model ? `MODELO:${vehicle.model}` : null,
    vehicle.color ? `COLOR:${vehicle.color}` : null,
  ].filter((p): p is string => Boolean(p));
  return parts.join(' | ');
}

export function buildVehicleScanUrl(
  user: Pick<PortalUser, 'residentKey' | 'name' | 'email' | 'phone' | 'role' | 'active'>,
  vehicle: VehicleQrCode,
  house?: House | null,
  origin?: string,
): string {
  const resolvedOrigin =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://puertacantera.app');
  const params = new URLSearchParams();
  params.set('scan', '1');
  params.set('code', vehicle.code);
  if (user.residentKey) params.set('key', user.residentKey);
  params.set('name', user.name);
  if (user.phone) params.set('phone', user.phone);
  if (user.email) params.set('email', user.email);
  params.set('role', user.role);
  if (house) params.set('house', formatHouseLabel(house));
  params.set('car', vehicle.label);
  if (vehicle.plate) params.set('plate', vehicle.plate);
  if (vehicle.model) params.set('model', vehicle.model);
  if (vehicle.color) params.set('color', vehicle.color);
  return `${resolvedOrigin.replace(/\/$/, '')}/?${params.toString()}`;
}

export function createScannedResidentData(
  user: PortalUser,
  vehicle: VehicleQrCode,
  house?: House | null,
  origin?: string,
): ScannedResidentData {
  return {
    code: vehicle.code,
    residentKey: user.residentKey,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    houseLabel: house ? formatHouseLabel(house) : 'Sin casa asignada',
    active: user.active,
    vehicleLabel: vehicle.label,
    plate: vehicle.plate,
    model: vehicle.model,
    color: vehicle.color,
    qrValue: buildVehicleScanUrl(user, vehicle, house, origin),
  };
}

export function parseResidentQrScanParams(
  search: string,
  db?: PortalDatabase,
  origin?: string,
): ScannedResidentData | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const code = params.get('code')?.trim() || '';
  const isScan = params.get('scan') === '1' || Boolean(params.get('qr')?.trim());
  const lookupCode = code || params.get('qr')?.trim() || '';

  if (!isScan && !lookupCode) return null;

  // Prefer live database record if the scanned code exists locally
  if (db && lookupCode) {
    const normalizedLookup = lookupCode.toUpperCase();
    for (const user of db.users) {
      const matchedVehicle = user.vehicleQrCodes.find(
        (v) => v.code.toUpperCase() === normalizedLookup,
      );
      if (matchedVehicle) {
        const house = user.houseId ? db.houses.find((h) => h.id === user.houseId) ?? null : null;
        return createScannedResidentData(user, matchedVehicle, house, origin);
      }
      if (user.residentKey.toUpperCase() === normalizedLookup && user.vehicleQrCodes[0]) {
        const house = user.houseId ? db.houses.find((h) => h.id === user.houseId) ?? null : null;
        return createScannedResidentData(user, user.vehicleQrCodes[0], house, origin);
      }
    }
  }

  // Fallback to self-contained URL parameters (works when scanned from any external phone!)
  const name = params.get('name')?.trim() || '';
  if (!name && !lookupCode) return null;

  const rawRole = params.get('role') as UserRole | null;
  const role: UserRole =
    rawRole && ['resident', 'treasurer', 'admin', 'guard'].includes(rawRole)
      ? rawRole
      : 'resident';

  return {
    code: lookupCode || 'PC-QR',
    residentKey: params.get('key')?.trim() || 'RES001',
    name: name || 'Residente Puerta Cantera',
    email: params.get('email')?.trim() || '—',
    phone: params.get('phone')?.trim() || undefined,
    role,
    houseLabel: params.get('house')?.trim() || 'Sin casa asignada',
    active: true,
    vehicleLabel: params.get('car')?.trim() || 'Auto 1',
    plate: params.get('plate')?.trim() || undefined,
    model: params.get('model')?.trim() || undefined,
    color: params.get('color')?.trim() || undefined,
    qrValue: `${(origin ?? 'https://puertacantera.app').replace(/\/$/, '')}/?${params.toString()}`,
  };
}

export function isAdminUser(user: Pick<PortalUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin';
}

export function isPrimaryAdminUser(
  user: Pick<PortalUser, 'id' | 'username' | 'role'> | null | undefined,
): boolean {
  if (!user) return false;
  return user.id === 'usr-admin' || (user.username ?? '').trim().toUpperCase() === 'ADMON';
}

export function findUserByIdentifier(
  users: PortalUser[],
  identifier: string,
): PortalUser | undefined {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return undefined;
  return users.find(
    (u) =>
      (u.username ?? '').trim().toLowerCase() === normalized ||
      u.email.trim().toLowerCase() === normalized ||
      u.residentKey.trim().toLowerCase() === normalized,
  );
}

export function getAllCorbatines(db: PortalDatabase, filterUserId?: string): CorbatinItem[] {
  const houseMap = new Map(db.houses.map((h) => [h.id, h]));
  const items: CorbatinItem[] = [];
  for (const user of db.users) {
    if (filterUserId && user.id !== filterUserId) continue;
    const house = user.houseId ? houseMap.get(user.houseId) ?? null : null;
    for (const vehicle of user.vehicleQrCodes) {
      items.push({
        id: `${user.id}:${vehicle.code}`,
        user,
        house,
        vehicle,
      });
    }
  }
  return items;
}

export function chunkCorbatines<T>(items: T[], perPage: 1 | 4): T[][] {
  const size = perPage === 4 ? 4 : 1;
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
  administracion: 'Administración',
  mantenimiento: 'Mantenimiento',
  seguridad: 'Seguridad',
  eventos: 'Eventos',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Recibido',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Por revisar',
  approved: 'Aprobado',
  adjusted: 'Ajustado',
  rejected: 'Rechazado',
};

export function formatMxnWhole(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded).toLocaleString('es-MX');
  return rounded < 0 ? `-$${abs}` : `$${abs}`;
}

export function formatShortDateEs(isoDate: string, includeYear = true): string {
  const parts = isoDate.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const [year, month, day] = parts;
  const monthLabel = MONTHS_SHORT_ES[Math.max(0, Math.min(11, month - 1))];
  return includeYear ? `${day} ${monthLabel} ${year}` : `${day} ${monthLabel}`;
}

export function formatAuditTimestamp(nowIso: string): string {
  const datePart = nowIso.slice(0, 10);
  const timePart = nowIso.length >= 16 ? nowIso.slice(11, 16) : '12:00';
  return `${formatShortDateEs(datePart, true)}, ${timePart}`;
}

export function formatMonthYearEs(yyyyMm: string): string {
  const [yStr, mStr] = yyyyMm.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return yyyyMm;
  return `${MONTHS_SHORT_ES[m - 1]} ${y}`;
}

export function formatPeriodKickerEs(todayIso = DEFAULT_TODAY_ISO): string {
  const [yStr, mStr] = todayIso.split('-');
  const m = Number(mStr);
  const monthName = MONTHS_LONG_ES[Math.max(0, Math.min(11, m - 1))];
  return `${monthName.toUpperCase()} ${yStr}`;
}

export function formatHouseLabel(house: House | undefined | null): string {
  if (!house) return '—';
  const base = `${house.street} #${house.number}`;
  return house.interiorNumber ? `${base} Int. ${house.interiorNumber}` : base;
}

export function validateLoginInput(username: string, password: string): string | null {
  const trimmedUser = username.trim();
  if (trimmedUser.length < 2) {
    return 'Ingresa un usuario válido (por ejemplo ADMON).';
  }
  if (password.trim().length < 4) {
    return 'Ingresa tu contraseña (mínimo 4 caracteres).';
  }
  return null;
}

const STATIC_ADMIN_PBKDF2_SALT = 'puerta_cantera_admon_pbkdf2_v1';
const STATIC_ADMIN_PBKDF2_HASH =
  '053a20476c537774b27ff8df59566809d3f7ad39188eeb3621ae56c3a6c75fce';

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Static-host fallback verification (e.g. GitHub Pages / static SPA builds without server.ts).
 * Uses Web Crypto PBKDF2-SHA256 (100,000 iterations) with no plaintext secret in source.
 */
export async function verifyStaticAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  if (username.trim().toUpperCase() !== 'ADMON') return false;
  if (!globalThis.crypto?.subtle) return false;
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(STATIC_ADMIN_PBKDF2_SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  const derivedHex = Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return constantTimeHexEqual(derivedHex, STATIC_ADMIN_PBKDF2_HASH);
}

export function validateRecoveryEmail(email: string): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Escribe el correo con el que te invitó la mesa directiva.';
  }
  return null;
}

export function getCurrentFeeSchedule(feeHistory: FeeScheduleVersion[]): FeeScheduleVersion {
  if (feeHistory.length === 0) {
    return {
      id: 'default-fee',
      monthlyMxn: 400,
      semiannualMxn: 2200,
      annualMxn: 4200,
      dueDay: 10,
      billingStartMonth: '2026-11',
      effectiveFrom: '2026-11-09',
      createdAt: '2026-11-09',
      createdBy: 'Admin',
    };
  }
  return feeHistory[0];
}

export interface HouseBalanceSummary {
  house: House;
  status: 'ok' | 'debt';
  paidUntilLabel: string;
  monthsOwed: number;
  debtMxn: number;
  monthsPaid: number;
  totalValidatedMxn: number;
  pendingCount: number;
}

function monthIndex(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(Number);
  return y * 12 + (m - 1);
}

function monthIndexToYyyyMm(idx: number): string {
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function computeHouseBalance(
  house: House,
  feeHistory: FeeScheduleVersion[],
  payments: PaymentRecord[],
  todayIso = DEFAULT_TODAY_ISO,
): HouseBalanceSummary {
  const fee = getCurrentFeeSchedule(feeHistory);
  const startIdx = monthIndex(fee.billingStartMonth);
  const todayMonth = todayIso.slice(0, 7);
  const todayDay = Number(todayIso.slice(8, 10)) || 1;
  const currentIdx = monthIndex(todayMonth);

  // Months elapsed since billingStartMonth inclusive if past or on dueDay,
  // or counting current month once dueDay has passed.
  const rawElapsed = currentIdx - startIdx + (todayDay >= fee.dueDay ? 1 : 0);
  const expectedMonths = Math.max(0, rawElapsed);

  const housePayments = payments.filter((p) => p.houseId === house.id);
  const validatedPayments = housePayments.filter(
    (p) => p.status === 'approved' || p.status === 'adjusted',
  );
  const pendingCount = housePayments.filter((p) => p.status === 'pending').length;

  const monthsPaid = validatedPayments.reduce((sum, p) => sum + Math.max(0, p.monthsCovered), 0);
  const totalValidatedMxn = validatedPayments.reduce(
    (sum, p) => sum + (p.approvedAmountMxn ?? p.amountMxn),
    0,
  );

  const monthsOwed = Math.max(0, expectedMonths - monthsPaid);
  const debtMxn = monthsOwed * fee.monthlyMxn;

  let paidUntilLabel = '—';
  if (monthsPaid > 0) {
    paidUntilLabel = formatMonthYearEs(monthIndexToYyyyMm(startIdx + monthsPaid - 1));
  }

  return {
    house,
    status: monthsOwed > 0 ? 'debt' : 'ok',
    paidUntilLabel,
    monthsOwed,
    debtMxn,
    monthsPaid,
    totalValidatedMxn,
    pendingCount,
  };
}

export function addAuditEntry(
  db: PortalDatabase,
  actorName: string,
  action: string,
  options?: { beforeSummary?: string; afterSummary?: string; nowIso?: string },
): PortalDatabase {
  const entry: AuditLogEntry = {
    id: `aud-${Date.now()}-${db.auditLog.length + 1}-${Math.floor(Math.random() * 1000)}`,
    actorName,
    action,
    timestampLabel: formatAuditTimestamp(options?.nowIso ?? DEFAULT_NOW_ISO),
    beforeSummary: options?.beforeSummary,
    afterSummary: options?.afterSummary,
  };

  return {
    ...db,
    auditLog: [entry, ...db.auditLog].slice(0, 300),
  };
}

export const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;

export function validateReceiptImageFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const mime = (file.type || '').toLowerCase();
  const isImageMime = mime.startsWith('image/');
  const hasImageExt = ALLOWED_IMAGE_EXTENSIONS.test(file.name || '');

  if (!isImageMime && !hasImageExt) {
    return 'Solo se admiten imágenes (JPG, PNG, WebP, GIF o HEIC).';
  }
  if (file.size <= 0) {
    return 'El archivo seleccionado está vacío.';
  }
  if (file.size > MAX_RECEIPT_IMAGE_BYTES) {
    return 'La imagen supera el límite máximo de 5 MB.';
  }
  return null;
}

export function formatFileSizeEs(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface SubmitPaymentInput {
  periodLabel: string;
  monthsCovered: number;
  amountMxn: number;
  method: PaymentRecord['method'];
  receiptImageUrl: string;
  receiptFileName: string;
  receiptFileSizeBytes?: number;
  notes?: string;
}

export function submitPayment(
  db: PortalDatabase,
  input: SubmitPaymentInput,
  user: PortalUser,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; payment?: PaymentRecord; error?: string } {
  if (!user.houseId) {
    return { db, error: 'Tu usuario no está ligado a una casa.' };
  }
  if (!input.periodLabel.trim()) {
    return { db, error: 'Indica el periodo que estás cubriendo.' };
  }
  if (!Number.isFinite(input.amountMxn) || input.amountMxn <= 0) {
    return { db, error: 'El monto debe ser mayor a $0.' };
  }
  if (!input.receiptImageUrl.trim()) {
    return { db, error: 'Adjunta la imagen de tu comprobante de pago (máximo 5 MB).' };
  }
  if (
    input.receiptFileSizeBytes !== undefined &&
    input.receiptFileSizeBytes > MAX_RECEIPT_IMAGE_BYTES
  ) {
    return { db, error: 'La imagen supera el límite máximo de 5 MB.' };
  }

  const nextNum = db.payments.length + 1;
  const folio = `P-${String(nextNum).padStart(4, '0')}`;
  const cleanFileName = input.receiptFileName.trim() || `comprobante-${folio}.jpg`;
  const payment: PaymentRecord = {
    id: `pay-${Date.now()}-${nextNum}`,
    folio,
    houseId: user.houseId,
    userId: user.id,
    userName: user.name,
    periodLabel: input.periodLabel.trim(),
    monthsCovered: Math.max(1, Math.round(input.monthsCovered)),
    amountMxn: Math.round(input.amountMxn),
    method: input.method,
    reference: cleanFileName,
    receiptImageUrl: input.receiptImageUrl,
    receiptFileName: cleanFileName,
    receiptFileSizeBytes: input.receiptFileSizeBytes,
    notes: input.notes?.trim() || undefined,
    status: 'pending',
    createdAt: nowIso.slice(0, 10),
  };

  let nextDb: PortalDatabase = {
    ...db,
    payments: [payment, ...db.payments],
  };

  nextDb = addAuditEntry(nextDb, user.name, 'Subió un comprobante de pago', {
    afterSummary: `folio: ${payment.folio} · amount: ${formatMxnWhole(payment.amountMxn)} · file: ${cleanFileName}`,
    nowIso,
  });

  return { db: nextDb, payment };
}

export function reviewPayment(
  db: PortalDatabase,
  paymentId: string,
  decision: 'approved' | 'adjusted' | 'rejected',
  approvedAmountMxn: number,
  reviewNote: string,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; error?: string } {
  const existing = db.payments.find((p) => p.id === paymentId);
  if (!existing) {
    return { db, error: 'No se encontró el pago seleccionado.' };
  }
  if (decision === 'adjusted' && (!Number.isFinite(approvedAmountMxn) || approvedAmountMxn <= 0)) {
    return { db, error: 'Ingresa un monto ajustado válido mayor a $0.' };
  }
  if (decision === 'rejected' && !reviewNote.trim()) {
    return { db, error: 'Agrega un motivo al rechazar el pago.' };
  }

  const finalAmount =
    decision === 'rejected'
      ? 0
      : decision === 'adjusted'
        ? Math.round(approvedAmountMxn)
        : existing.amountMxn;

  const updated: PaymentRecord = {
    ...existing,
    status: decision,
    approvedAmountMxn: decision === 'rejected' ? undefined : finalAmount,
    reviewNote: reviewNote.trim() || undefined,
    reviewedAt: nowIso.slice(0, 10),
  };

  const actionLabel =
    decision === 'approved'
      ? 'Aprobó un pago'
      : decision === 'adjusted'
        ? 'Ajustó un pago'
        : 'Rechazó un pago';

  let nextDb: PortalDatabase = {
    ...db,
    payments: db.payments.map((p) => (p.id === paymentId ? updated : p)),
  };

  nextDb = addAuditEntry(nextDb, actorName, actionLabel, {
    beforeSummary: `folio: ${existing.folio} · status: ${existing.status} · amount: ${formatMxnWhole(existing.amountMxn)}`,
    afterSummary: `folio: ${updated.folio} · status: ${updated.status} · validated: ${formatMxnWhole(finalAmount)}`,
    nowIso,
  });

  return { db: nextDb };
}

export interface UpdateFeeScheduleInput {
  monthlyMxn: number;
  semiannualMxn: number;
  annualMxn: number;
  dueDay: number;
  billingStartMonth: string;
  effectiveFrom: string;
}

export function updateFeeSchedule(
  db: PortalDatabase,
  input: UpdateFeeScheduleInput,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; error?: string } {
  if (input.monthlyMxn <= 0 || input.semiannualMxn <= 0 || input.annualMxn <= 0) {
    return { db, error: 'Todas las cuotas deben ser mayores a $0.' };
  }
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 28) {
    return { db, error: 'El día límite de pago debe estar entre 1 y 28.' };
  }
  if (!/^\d{4}-\d{2}$/.test(input.billingStartMonth)) {
    return { db, error: 'Selecciona un mes de inicio de cobro válido.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) {
    return { db, error: 'Selecciona una fecha de vigencia válida.' };
  }

  const previous = getCurrentFeeSchedule(db.feeHistory);
  const created: FeeScheduleVersion = {
    id: `fee-${Date.now()}`,
    monthlyMxn: Math.round(input.monthlyMxn),
    semiannualMxn: Math.round(input.semiannualMxn),
    annualMxn: Math.round(input.annualMxn),
    dueDay: input.dueDay,
    billingStartMonth: input.billingStartMonth,
    effectiveFrom: input.effectiveFrom,
    createdAt: nowIso.slice(0, 10),
    createdBy: actorName,
  };

  let nextDb: PortalDatabase = {
    ...db,
    feeHistory: [created, ...db.feeHistory],
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Cambió las cuotas', {
    beforeSummary: `monthlyCents: ${previous.monthlyMxn * 100} · semiannualCents: ${previous.semiannualMxn * 100} · annualCents: ${previous.annualMxn * 100} · dueDay: ${previous.dueDay}`,
    afterSummary: `monthlyCents: ${created.monthlyMxn * 100} · semiannualCents: ${created.semiannualMxn * 100} · annualCents: ${created.annualMxn * 100} · dueDay: ${created.dueDay} · effectiveFrom: ${created.effectiveFrom}`,
    nowIso,
  });

  return { db: nextDb };
}

export interface PublishNoticeInput {
  title: string;
  body: string;
  category: NoticeCategory;
  urgent: boolean;
  pinned: boolean;
  sendPush: boolean;
}

export function publishNotice(
  db: PortalDatabase,
  input: PublishNoticeInput,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; notice?: CommunityNotice; error?: string } {
  if (input.title.trim().length < 3) {
    return { db, error: 'Escribe un título para el aviso.' };
  }
  if (input.body.trim().length < 5) {
    return { db, error: 'Escribe el contenido del aviso.' };
  }

  const notice: CommunityNotice = {
    id: `not-${Date.now()}`,
    title: input.title.trim(),
    body: input.body.trim(),
    category: input.category,
    urgent: input.urgent,
    pinned: input.pinned,
    sendPush: input.sendPush,
    createdAt: nowIso.slice(0, 10),
    authorName: actorName,
  };

  let nextDb: PortalDatabase = {
    ...db,
    notices: [notice, ...db.notices],
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Publicó un aviso', {
    afterSummary: `category: ${notice.category} · title: ${notice.title}${notice.urgent ? ' · urgent: true' : ''}`,
    nowIso,
  });

  return { db: nextDb, notice };
}

export function deleteNotice(
  db: PortalDatabase,
  noticeId: string,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): PortalDatabase {
  const existing = db.notices.find((n) => n.id === noticeId);
  if (!existing) return db;
  const nextDb: PortalDatabase = {
    ...db,
    notices: db.notices.filter((n) => n.id !== noticeId),
  };
  return addAuditEntry(nextDb, actorName, 'Eliminó un aviso', {
    beforeSummary: `title: ${existing.title} · category: ${existing.category}`,
    nowIso,
  });
}

export interface CreateReportInput {
  title: string;
  category: ReportCategory;
  description: string;
  location?: string;
}

export function createReport(
  db: PortalDatabase,
  input: CreateReportInput,
  user: PortalUser,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; report?: CommunityReport; error?: string } {
  if (input.title.trim().length < 4) {
    return { db, error: 'Escribe un título breve para el reporte.' };
  }
  if (input.description.trim().length < 6) {
    return { db, error: 'Describe qué ocurrió para poder atenderlo.' };
  }

  const nextNum = db.reports.length + 1;
  const report: CommunityReport = {
    id: `rep-${Date.now()}-${nextNum}`,
    folio: `#R-${String(nextNum).padStart(4, '0')}`,
    title: input.title.trim(),
    category: input.category,
    description: input.description.trim(),
    location: input.location?.trim() || undefined,
    houseId: user.houseId ?? db.houses[0]?.id ?? 'general',
    authorName: user.name,
    status: 'open',
    createdAt: nowIso.slice(0, 10),
    comments: [],
  };

  let nextDb: PortalDatabase = {
    ...db,
    reports: [report, ...db.reports],
  };

  nextDb = addAuditEntry(nextDb, user.name, 'Levantó un reporte', {
    afterSummary: `folio: ${report.folio} · category: ${report.category.toLowerCase()}`,
    nowIso,
  });

  return { db: nextDb, report };
}

export function commentAndUpdateReport(
  db: PortalDatabase,
  reportId: string,
  body: string,
  nextStatus: ReportStatus | '',
  actorName: string,
  isAdmin: boolean,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; error?: string } {
  const existing = db.reports.find((r) => r.id === reportId);
  if (!existing) {
    return { db, error: 'No se encontró el reporte.' };
  }
  const trimmedBody = body.trim();
  const statusChanged = Boolean(nextStatus && nextStatus !== existing.status);

  if (!trimmedBody && !statusChanged) {
    return { db, error: 'Escribe una respuesta o cambia el estado del reporte.' };
  }

  const updatedComments = trimmedBody
    ? [
        ...existing.comments,
        {
          id: `cmt-${Date.now()}`,
          authorName: isAdmin ? 'Administración' : actorName,
          isAdmin,
          body: trimmedBody,
          createdAt: nowIso.slice(0, 10),
        },
      ]
    : existing.comments;

  const finalStatus: ReportStatus = statusChanged ? (nextStatus as ReportStatus) : existing.status;

  let nextDb: PortalDatabase = {
    ...db,
    reports: db.reports.map((r) =>
      r.id === reportId ? { ...r, status: finalStatus, comments: updatedComments } : r,
    ),
  };

  const action =
    statusChanged && trimmedBody
      ? 'Actualizó y comentó un reporte'
      : statusChanged
        ? 'Cambió el estado de un reporte'
        : 'Comentó un reporte';

  nextDb = addAuditEntry(nextDb, actorName, action, {
    beforeSummary: statusChanged ? `folio: ${existing.folio} · status: ${existing.status}` : undefined,
    afterSummary: statusChanged ? `folio: ${existing.folio} · status: ${finalStatus}` : undefined,
    nowIso,
  });

  return { db: nextDb };
}

function fnv1aNumber(seedText: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 900000) + 100000;
}

export function generatePassCode(seedText: string): string {
  return `PC-${fnv1aNumber(seedText)}`;
}

export function generateUserQrCode(seedText: string): string {
  return `PC-USR-${fnv1aNumber(`usr:${seedText}`)}`;
}

export function generateVehicleQrCodes(
  seedText: string,
  carCount: number,
  existing: VehicleQrCode[] = [],
  vehicleDetails?: VehicleDetailsInput[],
): VehicleQrCode[] {
  const safeCount = Math.max(0, Math.min(10, Math.floor(Number.isFinite(carCount) ? carCount : 0)));
  const result: VehicleQrCode[] = [];
  for (let i = 1; i <= safeCount; i += 1) {
    const prev = existing.find((item) => item.index === i);
    const detail = vehicleDetails?.[i - 1];
    const plate =
      detail?.plate !== undefined
        ? detail.plate.trim().toUpperCase() || undefined
        : prev?.plate;
    const color =
      detail?.color !== undefined ? detail.color.trim() || undefined : prev?.color;
    const model =
      detail?.model !== undefined ? detail.model.trim() || undefined : prev?.model;

    result.push({
      index: i,
      label: prev?.label ?? `Auto ${i}`,
      code: prev?.code ?? `PC-A${i}-${fnv1aNumber(`auto:${seedText}:${i}`)}`,
      plate,
      color,
      model,
    });
  }
  return result;
}

export function normalizePortalDatabase(raw: PortalDatabase): PortalDatabase {
  const houses = raw.houses.map((h) => {
    const legacy = h as House & { lot?: string | null };
    return {
      id: h.id,
      street: h.street,
      number: h.number,
      interiorNumber: h.interiorNumber !== undefined ? h.interiorNumber : (legacy.lot ?? null),
      familyName: h.familyName,
      active: h.active,
    };
  });

  let maxSeq = 0;
  for (const u of raw.users) {
    const match = /^RES(\d+)$/i.exec((u.residentKey ?? '').trim());
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
    }
  }

  const usedKeys = new Set<string>();
  const users = raw.users.map((u) => {
    let residentKey = (u.residentKey ?? '').trim().toUpperCase();
    if (!/^RES\d+$/i.test(residentKey) || usedKeys.has(residentKey)) {
      maxSeq += 1;
      residentKey = formatResidentKey(maxSeq);
    }
    usedKeys.add(residentKey);
    const carCount = typeof u.carCount === 'number' && Number.isFinite(u.carCount) ? u.carCount : 1;
    const vehicleQrCodes =
      Array.isArray(u.vehicleQrCodes) && u.vehicleQrCodes.length === carCount
        ? u.vehicleQrCodes
        : generateVehicleQrCodes(`${u.email}-${u.id}`, carCount, u.vehicleQrCodes ?? []);
    const qrCode = vehicleQrCodes[0]?.code ?? u.qrCode ?? '';
    const isPrimary = u.id === 'usr-admin' || (u.username ?? '').trim().toUpperCase() === 'ADMON';
    const username = isPrimary ? 'ADMON' : (u.username?.trim() || u.email);
    return {
      ...u,
      residentKey,
      username,
      name: isPrimary && u.name === 'Admin' ? 'ADMON' : u.name,
      role: isPrimary ? 'admin' : u.role,
      active: isPrimary ? true : u.active,
      qrCode,
      carCount,
      vehicleQrCodes,
    };
  });

  const userKeyByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.residentKey]));

  const invitations = (raw.invitations ?? []).map((inv) => {
    const carCount = typeof inv.carCount === 'number' && Number.isFinite(inv.carCount) ? inv.carCount : 1;
    const vehicleQrCodes =
      Array.isArray(inv.vehicleQrCodes) && inv.vehicleQrCodes.length === carCount
        ? inv.vehicleQrCodes
        : generateVehicleQrCodes(`${inv.email}-${inv.id}`, carCount, inv.vehicleQrCodes ?? []);
    const qrCode = vehicleQrCodes[0]?.code ?? inv.qrCode ?? '';
    const residentKey =
      inv.residentKey?.trim().toUpperCase() ||
      userKeyByEmail.get(inv.email.toLowerCase()) ||
      formatResidentKey(maxSeq + 1);
    return {
      ...inv,
      residentKey,
      qrCode,
      carCount,
      vehicleQrCodes,
    };
  });

  return {
    ...raw,
    houses,
    users,
    invitations,
  };
}

export interface CreateVisitPassInput {
  visitorName: string;
  phone?: string;
  plate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  companions: number;
  accessType: VisitAccessType;
  validFrom: string;
  validUntil: string;
}

export function createVisitPass(
  db: PortalDatabase,
  input: CreateVisitPassInput,
  user: PortalUser,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; pass?: VisitPass; error?: string } {
  if (!user.houseId) {
    return { db, error: 'Tu usuario no está ligado a una casa.' };
  }
  if (input.visitorName.trim().length < 2) {
    return { db, error: 'Ingresa el nombre completo del visitante.' };
  }
  if (input.validUntil < input.validFrom) {
    return { db, error: 'La fecha de salida no puede ser anterior a la de entrada.' };
  }

  const code = generatePassCode(`${input.visitorName}-${nowIso}-${db.passes.length}`);
  const pass: VisitPass = {
    id: `pass-${Date.now()}`,
    code,
    houseId: user.houseId,
    createdByName: user.name,
    visitorName: input.visitorName.trim(),
    phone: input.phone?.trim() || undefined,
    plate: input.plate?.trim().toUpperCase() || undefined,
    vehicleModel: input.vehicleModel?.trim() || undefined,
    vehicleColor: input.vehicleColor?.trim() || undefined,
    companions: Math.max(0, Math.min(20, Math.round(input.companions))),
    accessType: input.accessType,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    status: 'active',
    createdAt: nowIso.slice(0, 10),
    entries: [],
  };

  let nextDb: PortalDatabase = {
    ...db,
    passes: [pass, ...db.passes],
  };

  nextDb = addAuditEntry(nextDb, user.name, 'Creó un pase de visita', {
    afterSummary: `access: ${pass.accessType} · houseId: ${pass.houseId} · validFrom: ${pass.validFrom} · validUntil: ${pass.validUntil}`,
    nowIso,
  });

  return { db: nextDb, pass };
}

export function cancelVisitPass(
  db: PortalDatabase,
  passId: string,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): PortalDatabase {
  const existing = db.passes.find((p) => p.id === passId);
  if (!existing || existing.status === 'cancelled') return db;

  const nextDb: PortalDatabase = {
    ...db,
    passes: db.passes.map((p) => (p.id === passId ? { ...p, status: 'cancelled' } : p)),
  };

  return addAuditEntry(nextDb, actorName, 'Canceló un pase', { nowIso });
}

export function checkInVisitPass(
  db: PortalDatabase,
  passId: string,
  guardName = 'Caseta principal',
  nowIso = DEFAULT_NOW_ISO,
): PortalDatabase {
  const existing = db.passes.find((p) => p.id === passId);
  if (!existing || existing.status === 'cancelled') return db;

  const entry = {
    id: `ent-${Date.now()}`,
    enteredAt: nowIso,
    guardName,
  };

  const nextStatus = existing.accessType === 'single' ? 'used' : 'active';

  const nextDb: PortalDatabase = {
    ...db,
    passes: db.passes.map((p) =>
      p.id === passId
        ? { ...p, status: nextStatus, entries: [entry, ...p.entries] }
        : p,
    ),
  };

  return addAuditEntry(nextDb, guardName, 'Registró entrada de visita', {
    afterSummary: `code: ${existing.code} · visitor: ${existing.visitorName}`,
    nowIso,
  });
}

export interface AddHouseInput {
  street: string;
  number: string;
  interiorNumber?: string;
  familyName?: string;
}

export function addHouse(
  db: PortalDatabase,
  input: AddHouseInput,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; house?: House; error?: string } {
  const street = input.street.trim();
  const number = input.number.trim();
  const interiorNumber = input.interiorNumber?.trim() || null;
  if (!street || !number) {
    return { db, error: 'Calle y número son obligatorios.' };
  }

  const duplicate = db.houses.some(
    (h) =>
      normalizeAddressKey(h.street, h.number, h.interiorNumber) ===
      normalizeAddressKey(street, number, interiorNumber),
  );
  if (duplicate) {
    return { db, error: 'Ya existe una casa con esa dirección. Las direcciones no se pueden repetir.' };
  }

  const house: House = {
    id: `house-${Date.now()}`,
    street,
    number,
    interiorNumber,
    familyName: input.familyName?.trim() || '',
    active: true,
  };

  let nextDb: PortalDatabase = {
    ...db,
    houses: [...db.houses, house],
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Agregó una casa', {
    afterSummary: `id: ${house.id} · interiorNumber: ${house.interiorNumber ?? 'null'} · active: true · number: ${house.number} · street: ${house.street} · familyName: ${house.familyName || '—'}`,
    nowIso,
  });

  return { db: nextDb, house };
}

export function updateHouse(
  db: PortalDatabase,
  houseId: string,
  patch: Partial<Pick<House, 'street' | 'number' | 'interiorNumber' | 'familyName' | 'active'>>,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; error?: string } {
  const existing = db.houses.find((h) => h.id === houseId);
  if (!existing) return { db, error: 'Casa no encontrada.' };

  const updated: House = {
    ...existing,
    street: patch.street !== undefined ? patch.street.trim() : existing.street,
    number: patch.number !== undefined ? patch.number.trim() : existing.number,
    interiorNumber:
      patch.interiorNumber !== undefined
        ? patch.interiorNumber?.trim() || null
        : existing.interiorNumber,
    familyName: patch.familyName !== undefined ? patch.familyName.trim() : existing.familyName,
    active: patch.active !== undefined ? patch.active : existing.active,
  };

  if (!updated.street || !updated.number) {
    return { db, error: 'Calle y número son obligatorios.' };
  }

  const duplicateAddress = db.houses.some(
    (h) =>
      h.id !== houseId &&
      normalizeAddressKey(h.street, h.number, h.interiorNumber) ===
        normalizeAddressKey(updated.street, updated.number, updated.interiorNumber),
  );
  if (duplicateAddress) {
    return { db, error: 'Ya existe otra casa con esa dirección. Las direcciones no se pueden repetir.' };
  }

  let nextDb: PortalDatabase = {
    ...db,
    houses: db.houses.map((h) => (h.id === houseId ? updated : h)),
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Editó una casa', {
    beforeSummary: `street: ${existing.street} · number: ${existing.number} · interior: ${existing.interiorNumber ?? '—'} · active: ${existing.active}`,
    afterSummary: `street: ${updated.street} · number: ${updated.number} · interior: ${updated.interiorNumber ?? '—'} · active: ${updated.active}`,
    nowIso,
  });

  return { db: nextDb };
}

export interface InviteUserInput {
  email?: string;
  name?: string;
  phone?: string;
  role: UserRole;
  houseId: string | null;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  carCount?: number;
  vehicles?: VehicleDetailsInput[];
}

function validateVehiclesInput(
  db: PortalDatabase,
  carCount: number,
  vehicles?: VehicleDetailsInput[],
  excludeUserId?: string,
): string | null {
  if (carCount <= 0 || !vehicles) return null;

  const existingPlates = new Set<string>();
  for (const u of db.users) {
    if (excludeUserId && u.id === excludeUserId) continue;
    for (const v of u.vehicleQrCodes) {
      if (v.plate?.trim()) {
        existingPlates.add(normalizePlateKey(v.plate));
      }
    }
  }

  const seenInBatch = new Set<string>();
  for (let i = 0; i < carCount; i += 1) {
    const v = vehicles[i];
    const hasColorOrModelField = v?.color !== undefined || v?.model !== undefined;
    if (!v?.plate?.trim()) {
      return `Completa la placa del Automóvil ${i + 1}.`;
    }
    if (hasColorOrModelField && (!v.color?.trim() || !v.model?.trim())) {
      return `Completa placa, color y modelo del Automóvil ${i + 1}.`;
    }
    const plateKey = normalizePlateKey(v.plate);
    if (seenInBatch.has(plateKey)) {
      return `La placa ${v.plate.trim().toUpperCase()} está repetida en este registro.`;
    }
    if (existingPlates.has(plateKey)) {
      return `La placa ${v.plate.trim().toUpperCase()} ya está registrada en otro automóvil.`;
    }
    seenInBatch.add(plateKey);
  }
  return null;
}

export function inviteUser(
  db: PortalDatabase,
  input: InviteUserInput,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; invitation?: Invitation; user?: PortalUser; error?: string } {
  const rawEmail = input.email;
  const email = (rawEmail ?? '').trim().toLowerCase();
  if (rawEmail !== undefined) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { db, error: 'Ingresa un correo válido para el registro.' };
    }
    if (db.users.some((u) => u.email.trim().toLowerCase() === email)) {
      return { db, error: 'Ese correo ya pertenece a un usuario registrado.' };
    }
    if (db.invitations.some((i) => i.email.trim().toLowerCase() === email && i.status === 'pending')) {
      return { db, error: 'Ya existe una invitación pendiente para ese correo.' };
    }
  }

  const displayName =
    input.name?.trim() ||
    (email
      ? email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : '');

  if (displayName.length < 2) {
    return { db, error: 'Ingresa el nombre completo del residente.' };
  }

  const nameKey = normalizeTextKey(displayName);
  if (db.users.some((u) => normalizeTextKey(u.name) === nameKey)) {
    return {
      db,
      error: 'Ese nombre ya está registrado. Los nombres de residentes no se pueden repetir.',
    };
  }

  const roleLimitError = validateRoleLimit(db, input.role, { nextActive: true });
  if (roleLimitError) {
    return { db, error: roleLimitError };
  }

  const carCount =
    input.carCount !== undefined && Number.isFinite(input.carCount)
      ? Math.max(0, Math.min(10, Math.floor(input.carCount)))
      : 1;

  const vehiclesError = validateVehiclesInput(db, carCount, input.vehicles);
  if (vehiclesError) {
    return { db, error: vehiclesError };
  }

  // Enforce unique house address: neither street+ext+int nor an already-assigned houseId may repeat
  let resolvedHouseId: string | null = input.houseId || null;
  let nextHouses = db.houses;
  const trimmedStreet = input.street?.trim() || '';
  if (trimmedStreet) {
    const extNum = input.exteriorNumber?.trim() || '';
    if (!extNum) {
      return { db, error: 'Ingresa el Número ext de la casa.' };
    }
    const intNum = input.interiorNumber?.trim() || null;
    const addrKey = normalizeAddressKey(trimmedStreet, extNum, intNum);
    const existingHouse = db.houses.find(
      (h) => normalizeAddressKey(h.street, h.number, h.interiorNumber) === addrKey,
    );
    if (existingHouse) {
      return {
        db,
        error: 'Esa dirección de casa ya está registrada. Las direcciones no se pueden repetir.',
      };
    }
    const createdHouse: House = {
      id: `house-${Date.now()}-${db.houses.length + 1}`,
      street: trimmedStreet,
      number: extNum,
      interiorNumber: intNum,
      familyName: displayName,
      active: true,
    };
    nextHouses = [...db.houses, createdHouse];
    resolvedHouseId = createdHouse.id;
  } else if (resolvedHouseId) {
    const alreadyAssigned = db.users.some((u) => u.houseId === resolvedHouseId);
    if (alreadyAssigned) {
      return {
        db,
        error: 'Esa dirección de casa ya está asignada a otro residente. No se puede repetir.',
      };
    }
  }

  const residentKey = generateNextResidentKey(db.users);
  const phone = input.phone?.trim() || undefined;
  const seed = `${email || residentKey}-${nowIso}-${db.users.length}`;
  const vehicleQrCodes = generateVehicleQrCodes(seed, carCount, [], input.vehicles);
  const qrCode = vehicleQrCodes[0]?.code ?? '';

  const user: PortalUser = {
    id: `usr-${Date.now()}-${db.users.length + 1}`,
    residentKey,
    username: email || residentKey,
    name: displayName,
    email,
    phone,
    role: input.role,
    houseId: resolvedHouseId,
    active: true,
    qrCode,
    carCount,
    vehicleQrCodes,
  };

  const invitation: Invitation = {
    id: `inv-${Date.now()}-${db.invitations.length + 1}`,
    residentKey,
    email,
    name: displayName,
    phone,
    role: input.role,
    houseId: resolvedHouseId,
    carCount,
    qrCode,
    vehicleQrCodes,
    createdAt: nowIso.slice(0, 10),
    status: 'pending',
  };

  let nextDb: PortalDatabase = {
    ...db,
    houses: nextHouses,
    users: [...db.users, user],
    invitations: [invitation, ...db.invitations],
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Registró e invitó a un usuario', {
    afterSummary: `clave: ${residentKey} · role: ${invitation.role} · email: ${invitation.email}${phone ? ` · tel: ${phone}` : ''} · autos: ${carCount} · qrAutos: ${vehicleQrCodes.map((v) => v.code).join(', ') || 'ninguno'} · houseId: ${invitation.houseId ?? 'null'}`,
    nowIso,
  });

  return { db: nextDb, invitation, user };
}

export interface UpdateUserPatch {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  houseId?: string | null;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  active?: boolean;
  carCount?: number;
  vehicles?: VehicleDetailsInput[];
}

export function updateUserAccess(
  db: PortalDatabase,
  userId: string,
  patch: UpdateUserPatch,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; user?: PortalUser; error?: string } {
  const existing = db.users.find((u) => u.id === userId);
  if (!existing) return { db, error: 'Usuario no encontrado.' };

  const primaryAdmin = isPrimaryAdminUser(existing);

  const nextName = patch.name !== undefined ? patch.name.trim() || existing.name : existing.name;
  const nameKey = normalizeTextKey(nextName);
  if (db.users.some((u) => u.id !== userId && normalizeTextKey(u.name) === nameKey)) {
    return {
      db,
      error: 'Ese nombre ya está registrado. Los nombres de residentes no se pueden repetir.',
    };
  }

  let nextEmail = existing.email;
  if (patch.email !== undefined) {
    const trimmedEmail = patch.email.trim().toLowerCase();
    if (trimmedEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return { db, error: 'Ingresa un correo electrónico válido.' };
      }
      if (db.users.some((u) => u.id !== userId && u.email.trim().toLowerCase() === trimmedEmail)) {
        return { db, error: 'Ese correo ya pertenece a otro usuario registrado.' };
      }
    }
    nextEmail = trimmedEmail;
  }

  let nextHouses = db.houses;
  let nextHouseId: string | null =
    patch.houseId !== undefined ? patch.houseId : existing.houseId;

  if (patch.street !== undefined) {
    const trimmedStreet = patch.street.trim();
    if (!trimmedStreet) {
      nextHouseId = null;
    } else {
      const extNum = patch.exteriorNumber?.trim() || '';
      if (!extNum) {
        return { db, error: 'Ingresa el Número ext de la casa.' };
      }
      const intNum = patch.interiorNumber?.trim() || null;
      const addrKey = normalizeAddressKey(trimmedStreet, extNum, intNum);
      const duplicateHouse = db.houses.find(
        (h) =>
          h.id !== existing.houseId &&
          normalizeAddressKey(h.street, h.number, h.interiorNumber) === addrKey,
      );
      if (duplicateHouse) {
        return {
          db,
          error: 'Esa dirección de casa ya está registrada. Las direcciones no se pueden repetir.',
        };
      }
      if (existing.houseId && db.houses.some((h) => h.id === existing.houseId)) {
        nextHouses = db.houses.map((h) =>
          h.id === existing.houseId
            ? {
                ...h,
                street: trimmedStreet,
                number: extNum,
                interiorNumber: intNum,
                familyName: nextName,
              }
            : h,
        );
        nextHouseId = existing.houseId;
      } else {
        const createdHouse: House = {
          id: `house-${Date.now()}-${db.houses.length + 1}`,
          street: trimmedStreet,
          number: extNum,
          interiorNumber: intNum,
          familyName: nextName,
          active: true,
        };
        nextHouses = [...db.houses, createdHouse];
        nextHouseId = createdHouse.id;
      }
    }
  } else if (nextHouseId && db.users.some((u) => u.id !== userId && u.houseId === nextHouseId)) {
    return {
      db,
      error: 'Esa dirección de casa ya está asignada a otro residente. No se puede repetir.',
    };
  }

  const nextRole = primaryAdmin ? 'admin' : (patch.role ?? existing.role);
  const nextActive = primaryAdmin ? true : (patch.active !== undefined ? patch.active : existing.active);

  if (primaryAdmin && (patch.role && patch.role !== 'admin' || patch.active === false)) {
    return { db, error: 'La cuenta principal del administrador ADMON debe permanecer activa con rol de administrador.' };
  }

  const roleLimitError = validateRoleLimit(db, nextRole, {
    excludeUserId: userId,
    nextActive,
  });
  if (roleLimitError) {
    return { db, error: roleLimitError };
  }

  const nextCarCount =
    patch.carCount !== undefined && Number.isFinite(patch.carCount)
      ? Math.max(0, Math.min(10, Math.floor(patch.carCount)))
      : existing.carCount;

  const vehiclesError = validateVehiclesInput(db, nextCarCount, patch.vehicles, userId);
  if (vehiclesError) {
    return { db, error: vehiclesError };
  }

  const nextVehicleQrs = generateVehicleQrCodes(
    `${nextEmail}-${existing.id}`,
    nextCarCount,
    existing.vehicleQrCodes,
    patch.vehicles,
  );

  const updated: PortalUser = {
    ...existing,
    username: primaryAdmin ? 'ADMON' : nextEmail,
    name: nextName,
    email: nextEmail,
    phone: patch.phone !== undefined ? patch.phone.trim() || undefined : existing.phone,
    role: nextRole,
    houseId: nextHouseId,
    active: nextActive,
    qrCode: nextVehicleQrs[0]?.code ?? '',
    carCount: nextCarCount,
    vehicleQrCodes: nextVehicleQrs,
  };

  let nextDb: PortalDatabase = {
    ...db,
    houses: nextHouses,
    users: db.users.map((u) => (u.id === userId ? updated : u)),
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Actualizó los datos de un residente', {
    beforeSummary: `clave: ${existing.residentKey} · nombre: ${existing.name} · email: ${existing.email} · role: ${existing.role} · active: ${existing.active} · autos: ${existing.carCount}`,
    afterSummary: `clave: ${updated.residentKey} · nombre: ${updated.name} · email: ${updated.email} · role: ${updated.role} · active: ${updated.active} · autos: ${updated.carCount}`,
    nowIso,
  });

  return { db: nextDb, user: updated };
}

export function deleteResident(
  db: PortalDatabase,
  userId: string,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; error?: string } {
  const existing = db.users.find((u) => u.id === userId);
  if (!existing) {
    return { db, error: 'Residente no encontrado.' };
  }
  if (isPrimaryAdminUser(existing)) {
    return { db, error: 'No se puede eliminar la cuenta principal del administrador ADMON.' };
  }

  const nextUsers = db.users.filter((u) => u.id !== userId);
  const nextInvitations = db.invitations.filter(
    (inv) => inv.email.trim().toLowerCase() !== existing.email.trim().toLowerCase(),
  );

  // Release unreferenced house if no other user, payment, report, or pass belongs to it
  let nextHouses = db.houses;
  if (existing.houseId) {
    const houseStillUsed =
      nextUsers.some((u) => u.houseId === existing.houseId) ||
      db.payments.some((p) => p.houseId === existing.houseId) ||
      db.reports.some((r) => r.houseId === existing.houseId) ||
      db.passes.some((p) => p.houseId === existing.houseId);
    if (!houseStillUsed) {
      nextHouses = db.houses.filter((h) => h.id !== existing.houseId);
    }
  }

  let nextDb: PortalDatabase = {
    ...db,
    houses: nextHouses,
    users: nextUsers,
    invitations: nextInvitations,
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Eliminó un residente', {
    beforeSummary: `clave: ${existing.residentKey} · nombre: ${existing.name} · email: ${existing.email} · autos: ${existing.carCount}`,
    nowIso,
  });

  return { db: nextDb };
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildBalancesCsv(db: PortalDatabase, todayIso = DEFAULT_TODAY_ISO): string {
  const headers = ['Casa', 'Familia', 'Estado', 'Pagado hasta', 'Meses', 'Adeudo (MXN)'];
  const rows = db.houses
    .filter((h) => h.active)
    .map((h) => {
      const b = computeHouseBalance(h, db.feeHistory, db.payments, todayIso);
      return [
        formatHouseLabel(h),
        h.familyName || '—',
        b.status === 'ok' ? 'Al corriente' : 'Con adeudo',
        b.paidUntilLabel,
        b.monthsOwed,
        b.debtMxn,
      ]
        .map(escapeCsvCell)
        .join(',');
    });
  return [headers.join(','), ...rows].join('\n');
}

export function buildPaymentsCsv(db: PortalDatabase): string {
  const headers = ['Folio', 'Casa', 'Vecino', 'Periodo', 'Meses', 'Monto', 'Validado', 'Método', 'Referencia', 'Estado', 'Fecha'];
  const houseMap = new Map(db.houses.map((h) => [h.id, formatHouseLabel(h)]));
  const rows = db.payments.map((p) =>
    [
      p.folio,
      houseMap.get(p.houseId) ?? '—',
      p.userName,
      p.periodLabel,
      p.monthsCovered,
      p.amountMxn,
      p.approvedAmountMxn ?? 0,
      p.method,
      p.reference,
      PAYMENT_STATUS_LABELS[p.status],
      p.createdAt,
    ]
      .map(escapeCsvCell)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates a real, camera-scannable ISO 18004 QR code boolean matrix.
 */
export function buildQrMatrix(code: string): boolean[][] {
  const text = code.trim() || 'PUERTA-CANTERA';
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const grid: boolean[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => Boolean(qr.modules.get(r, c))),
  );
  return grid;
}

/* ==================== IMPORTACIÓN MASIVA EXCEL / CSV ==================== */

export const MAX_EXCEL_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_EXCEL_IMPORT_ROWS = 500;

export interface ParsedExcelResidentRow {
  rowNumber: number;
  name: string;
  phone?: string;
  email?: string;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  plates: string[];
}

export interface ExcelImportSkippedRow {
  rowNumber: number;
  name: string;
  reason: string;
}

export interface ExcelImportBatchResult {
  db: PortalDatabase;
  added: PortalUser[];
  skipped: ExcelImportSkippedRow[];
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeHeaderKey(value: unknown): string {
  return stripDiacritics(String(value ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeResidentialStreet(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const needle = stripDiacritics(trimmed)
    .toLowerCase()
    .replace(/^(av\.?|avenida|calle|c\.?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const official of RESIDENTIAL_STREETS) {
    const officialFull = stripDiacritics(official).toLowerCase();
    const officialCore = officialFull.replace(/^(av\.?|avenida|calle)\s+/i, '').trim();
    if (stripDiacritics(trimmed).toLowerCase() === officialFull || needle === officialCore) {
      return official;
    }
  }
  return trimmed;
}

export function parseCsvText(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  let commaCount = 0;
  let semiCount = 0;
  let inQ = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQ = !inQ;
    } else if (!inQ) {
      if (ch === ',') commaCount += 1;
      else if (ch === ';') semiCount += 1;
    }
  }
  const delimiter = semiCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i += 1;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

export function parseExcelResidentRows(matrix: unknown[][]): {
  rows: ParsedExcelResidentRow[];
  parseError?: string;
} {
  const nonEmptyEntries: Array<{ rowNumber: number; cells: unknown[] }> = [];
  for (let i = 0; i < matrix.length; i += 1) {
    const cells = Array.isArray(matrix[i]) ? matrix[i] : [];
    const hasContent = cells.some((c) => cellToString(c).length > 0);
    if (hasContent) {
      nonEmptyEntries.push({ rowNumber: i + 1, cells });
    }
  }

  if (nonEmptyEntries.length < 2) {
    return {
      rows: [],
      parseError:
        'El archivo debe contener una fila de encabezados y al menos una fila de residentes.',
    };
  }

  const headerRow = nonEmptyEntries[0].cells.map(normalizeHeaderKey);
  let nameCol = -1;
  let phoneCol = -1;
  let emailCol = -1;
  let streetCol = -1;
  let extCol = -1;
  let intCol = -1;
  const plateCols: number[] = [];

  headerRow.forEach((h, idx) => {
    if (!h) return;
    if (
      nameCol === -1 &&
      (h === 'nombre' ||
        h === 'nombre completo' ||
        h === 'residente' ||
        h === 'titular' ||
        h === 'propietario' ||
        h === 'vecino' ||
        h === 'name' ||
        h.startsWith('nombre'))
    ) {
      nameCol = idx;
      return;
    }
    if (
      phoneCol === -1 &&
      (h === 'telefono' ||
        h === 'numero de telefono' ||
        h === 'tel' ||
        h === 'celular' ||
        h === 'movil' ||
        h === 'whatsapp' ||
        h === 'phone' ||
        h.includes('telefono') ||
        h.includes('celular'))
    ) {
      phoneCol = idx;
      return;
    }
    if (
      emailCol === -1 &&
      (h === 'correo' ||
        h === 'correo electronico' ||
        h === 'email' ||
        h === 'e mail' ||
        h === 'mail' ||
        h.includes('correo'))
    ) {
      emailCol = idx;
      return;
    }
    if (
      streetCol === -1 &&
      (h === 'calle' ||
        h === 'calle avenida' ||
        h === 'avenida' ||
        h === 'direccion' ||
        h === 'domicilio' ||
        h === 'street' ||
        h.startsWith('calle'))
    ) {
      streetCol = idx;
      return;
    }
    if (
      extCol === -1 &&
      (h === 'numero ext' ||
        h === 'num ext' ||
        h === 'no ext' ||
        h === 'exterior' ||
        h === 'numero exterior' ||
        h === 'num exterior' ||
        h === 'numero' ||
        h === 'num' ||
        h === 'casa' ||
        h === 'ext')
    ) {
      extCol = idx;
      return;
    }
    if (
      intCol === -1 &&
      (h === 'num int' ||
        h === 'numero int' ||
        h === 'no int' ||
        h === 'interior' ||
        h === 'numero interior' ||
        h === 'num interior' ||
        h === 'int' ||
        h === 'depto' ||
        h === 'departamento' ||
        h === 'lote')
    ) {
      intCol = idx;
      return;
    }
    if (
      h === 'placa' ||
      h === 'placas' ||
      h === 'plate' ||
      h === 'plates' ||
      /^placa\s*\d+$/.test(h) ||
      /^placas\s*\d+$/.test(h) ||
      /^auto\s*\d+$/.test(h) ||
      /^vehiculo\s*\d+$/.test(h) ||
      h.includes('placa')
    ) {
      plateCols.push(idx);
    }
  });

  if (nameCol === -1) {
    return {
      rows: [],
      parseError:
        'No se encontró la columna "Nombre completo" (o "Nombre"). Descarga la plantilla Excel para ver el formato recomendado.',
    };
  }

  const dataEntries = nonEmptyEntries.slice(1);
  if (dataEntries.length > MAX_EXCEL_IMPORT_ROWS) {
    return {
      rows: [],
      parseError: `El archivo supera el límite de ${MAX_EXCEL_IMPORT_ROWS} filas por importación (${dataEntries.length} filas detectadas).`,
    };
  }

  const rows: ParsedExcelResidentRow[] = dataEntries.map(({ rowNumber, cells }) => {
    const name = cellToString(cells[nameCol]);
    const phone = phoneCol >= 0 ? cellToString(cells[phoneCol]) || undefined : undefined;
    const email = emailCol >= 0 ? cellToString(cells[emailCol]) || undefined : undefined;
    let rawStreet = streetCol >= 0 ? cellToString(cells[streetCol]) : '';
    let exteriorNumber = extCol >= 0 ? cellToString(cells[extCol]) || undefined : undefined;
    const interiorNumber = intCol >= 0 ? cellToString(cells[intCol]) || undefined : undefined;

    // Support combined street + number in a single cell (e.g. "Av. Cantera #205")
    if (rawStreet && !exteriorNumber) {
      const combinedMatch = /^(.+?)\s*#?\s*(\d+[A-Za-z]?)$/.exec(rawStreet);
      if (combinedMatch) {
        rawStreet = combinedMatch[1].trim();
        exteriorNumber = combinedMatch[2].trim();
      }
    }

    const street = rawStreet ? normalizeResidentialStreet(rawStreet) : undefined;

    const plates: string[] = [];
    for (const colIdx of plateCols) {
      const rawPlateCell = cellToString(cells[colIdx]);
      if (!rawPlateCell) continue;
      for (const token of rawPlateCell.split(/[,;/|\n]+/)) {
        const cleaned = token.trim().toUpperCase();
        if (cleaned) plates.push(cleaned);
      }
    }

    return {
      rowNumber,
      name,
      phone,
      email,
      street,
      exteriorNumber,
      interiorNumber,
      plates,
    };
  });

  return { rows };
}

export function importResidentsBatch(
  db: PortalDatabase,
  rows: ParsedExcelResidentRow[],
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): ExcelImportBatchResult {
  let currentDb = db;
  const added: PortalUser[] = [];
  const skipped: ExcelImportSkippedRow[] = [];

  for (const row of rows.slice(0, MAX_EXCEL_IMPORT_ROWS)) {
    const cleanName = row.name.trim();
    const vehicles: VehicleDetailsInput[] = row.plates.map((plate) => ({ plate }));
    const res = inviteUser(
      currentDb,
      {
        ...(row.email ? { email: row.email } : {}),
        name: cleanName,
        phone: row.phone,
        role: 'resident',
        houseId: null,
        street: row.street,
        exteriorNumber: row.exteriorNumber,
        interiorNumber: row.interiorNumber,
        carCount: vehicles.length,
        vehicles,
      },
      actorName,
      nowIso,
    );

    if (res.error || !res.user) {
      skipped.push({
        rowNumber: row.rowNumber,
        name: cleanName || '(Sin nombre)',
        reason: res.error ?? 'No se pudo registrar esta fila.',
      });
    } else {
      currentDb = res.db;
      added.push(res.user);
    }
  }

  if (added.length > 0) {
    currentDb = addAuditEntry(currentDb, actorName, 'Importó residentes desde Excel', {
      afterSummary: `agregados: ${added.length} · omitidos: ${skipped.length} · claves: ${added.map((u) => u.residentKey).join(', ')}`,
      nowIso,
    });
  }

  return { db: currentDb, added, skipped };
}

