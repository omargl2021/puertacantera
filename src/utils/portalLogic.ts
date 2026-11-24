import type {
  AuditLogEntry,
  CommunityNotice,
  CommunityReport,
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
  UserRole,
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

export function validateLoginInput(email: string, password: string): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Ingresa un correo electrónico válido.';
  }
  if (password.trim().length < 4) {
    return 'Ingresa tu contraseña (mínimo 4 caracteres).';
  }
  return null;
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
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

export interface SubmitPaymentInput {
  periodLabel: string;
  monthsCovered: number;
  amountMxn: number;
  method: PaymentRecord['method'];
  reference: string;
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
  if (!input.reference.trim()) {
    return { db, error: 'Ingresa la referencia o clave de rastreo del comprobante.' };
  }

  const nextNum = db.payments.length + 1;
  const folio = `P-${String(nextNum).padStart(4, '0')}`;
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
    reference: input.reference.trim().toUpperCase(),
    notes: input.notes?.trim() || undefined,
    status: 'pending',
    createdAt: nowIso.slice(0, 10),
  };

  let nextDb: PortalDatabase = {
    ...db,
    payments: [payment, ...db.payments],
  };

  nextDb = addAuditEntry(nextDb, user.name, 'Subió un comprobante de pago', {
    afterSummary: `folio: ${payment.folio} · amount: ${formatMxnWhole(payment.amountMxn)} · months: ${payment.monthsCovered}`,
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
): VehicleQrCode[] {
  const safeCount = Math.max(0, Math.min(10, Math.floor(Number.isFinite(carCount) ? carCount : 0)));
  const result: VehicleQrCode[] = [];
  for (let i = 1; i <= safeCount; i += 1) {
    const prev = existing.find((item) => item.index === i);
    if (prev) {
      result.push(prev);
    } else {
      result.push({
        index: i,
        label: `Auto ${i}`,
        code: `PC-A${i}-${fnv1aNumber(`auto:${seedText}:${i}`)}`,
      });
    }
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

  const users = raw.users.map((u) => {
    const qrCode = u.qrCode || generateUserQrCode(`${u.email}-${u.id}`);
    const carCount = typeof u.carCount === 'number' && Number.isFinite(u.carCount) ? u.carCount : 1;
    const vehicleQrCodes =
      Array.isArray(u.vehicleQrCodes) && u.vehicleQrCodes.length === carCount
        ? u.vehicleQrCodes
        : generateVehicleQrCodes(`${u.email}-${u.id}`, carCount, u.vehicleQrCodes ?? []);
    return {
      ...u,
      qrCode,
      carCount,
      vehicleQrCodes,
    };
  });

  const invitations = (raw.invitations ?? []).map((inv) => {
    const qrCode = inv.qrCode || generateUserQrCode(`${inv.email}-${inv.id}`);
    const carCount = typeof inv.carCount === 'number' && Number.isFinite(inv.carCount) ? inv.carCount : 1;
    const vehicleQrCodes =
      Array.isArray(inv.vehicleQrCodes) && inv.vehicleQrCodes.length === carCount
        ? inv.vehicleQrCodes
        : generateVehicleQrCodes(`${inv.email}-${inv.id}`, carCount, inv.vehicleQrCodes ?? []);
    return {
      ...inv,
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
      h.street.toLowerCase() === street.toLowerCase() &&
      h.number.toLowerCase() === number.toLowerCase() &&
      (h.interiorNumber ?? '').toLowerCase() === (interiorNumber ?? '').toLowerCase(),
  );
  if (duplicate) {
    return { db, error: 'Ya existe una casa con esa calle, número y número interior.' };
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
  email: string;
  name?: string;
  role: UserRole;
  houseId: string | null;
  carCount?: number;
}

export function inviteUser(
  db: PortalDatabase,
  input: InviteUserInput,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; invitation?: Invitation; user?: PortalUser; error?: string } {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { db, error: 'Ingresa un correo válido para el registro.' };
  }
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return { db, error: 'Ese correo ya pertenece a un usuario registrado.' };
  }
  if (db.invitations.some((i) => i.email.toLowerCase() === email && i.status === 'pending')) {
    return { db, error: 'Ya existe una invitación pendiente para ese correo.' };
  }

  const carCount =
    input.carCount !== undefined && Number.isFinite(input.carCount)
      ? Math.max(0, Math.min(10, Math.floor(input.carCount)))
      : 1;

  const displayName =
    input.name?.trim() ||
    email
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const seed = `${email}-${nowIso}-${db.users.length}`;
  const qrCode = generateUserQrCode(seed);
  const vehicleQrCodes = generateVehicleQrCodes(seed, carCount);

  const user: PortalUser = {
    id: `usr-${Date.now()}-${db.users.length + 1}`,
    name: displayName,
    email,
    role: input.role,
    houseId: input.houseId || null,
    active: true,
    qrCode,
    carCount,
    vehicleQrCodes,
  };

  const invitation: Invitation = {
    id: `inv-${Date.now()}`,
    email,
    name: displayName,
    role: input.role,
    houseId: input.houseId || null,
    carCount,
    qrCode,
    vehicleQrCodes,
    createdAt: nowIso.slice(0, 10),
    status: 'pending',
  };

  let nextDb: PortalDatabase = {
    ...db,
    users: [...db.users, user],
    invitations: [invitation, ...db.invitations],
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Registró e invitó a un usuario', {
    afterSummary: `role: ${invitation.role} · email: ${invitation.email} · qr: ${qrCode} · autos: ${carCount} · houseId: ${invitation.houseId ?? 'null'}`,
    nowIso,
  });

  return { db: nextDb, invitation, user };
}

export function updateUserAccess(
  db: PortalDatabase,
  userId: string,
  patch: Partial<Pick<PortalUser, 'name' | 'role' | 'houseId' | 'active' | 'carCount'>>,
  actorName: string,
  nowIso = DEFAULT_NOW_ISO,
): { db: PortalDatabase; error?: string } {
  const existing = db.users.find((u) => u.id === userId);
  if (!existing) return { db, error: 'Usuario no encontrado.' };

  const nextCarCount =
    patch.carCount !== undefined && Number.isFinite(patch.carCount)
      ? Math.max(0, Math.min(10, Math.floor(patch.carCount)))
      : existing.carCount;

  const nextVehicleQrs = generateVehicleQrCodes(
    `${existing.email}-${existing.id}`,
    nextCarCount,
    existing.vehicleQrCodes,
  );

  const updated: PortalUser = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
    role: patch.role ?? existing.role,
    houseId: patch.houseId !== undefined ? patch.houseId : existing.houseId,
    active: patch.active !== undefined ? patch.active : existing.active,
    carCount: nextCarCount,
    vehicleQrCodes: nextVehicleQrs,
  };

  let nextDb: PortalDatabase = {
    ...db,
    users: db.users.map((u) => (u.id === userId ? updated : u)),
  };

  nextDb = addAuditEntry(nextDb, actorName, 'Cambió el acceso de un usuario', {
    beforeSummary: `role: ${existing.role} · active: ${existing.active} · autos: ${existing.carCount} · houseId: ${existing.houseId ?? 'null'}`,
    afterSummary: `role: ${updated.role} · active: ${updated.active} · autos: ${updated.carCount} · houseId: ${updated.houseId ?? 'null'}`,
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
 * Deterministic 21x21 QR-like matrix for visitor pass rendering.
 */
export function buildQrMatrix(code: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = isBorder || isCore;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isReserved = (r: number, c: number) =>
    (r < 8 && c < 8) ||
    (r < 8 && c >= size - 8) ||
    (r >= size - 8 && c < 8) ||
    r === 6 ||
    c === 6;

  let state = hash >>> 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (isReserved(r, c)) continue;
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      grid[r][c] = ((state >>> 24) & 1) === 1;
    }
  }

  return grid;
}
