import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  FIREBASE_BOOTSTRAP_ADMIN_EMAIL,
  firebaseAuth,
  firestoreDb,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  AuditLogEntry,
  CommunityNotice,
  CommunityReport,
  FeeScheduleVersion,
  House,
  PaymentRecord,
  PortalDatabase,
  PortalUser,
  VisitPass,
} from '../types/portal';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `doc-${Date.now()}`;
}

function clip(value: string | undefined | null, maxLen: number): string {
  return (value ?? '').trim().slice(0, maxLen);
}

function ensureMinLen(value: string, minLen: number, fallback: string): string {
  return value.length >= minLen ? value : fallback;
}

function toHouseDoc(house: House, ownerUid: string, isNew: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(house.id),
    street: clip(house.street, 100) || 'Av. Cantera',
    number: clip(house.number, 32) || '1',
    familyName: clip(house.familyName, 120),
    active: Boolean(house.active),
    ownerUid: clip(ownerUid, 128),
    updatedAt: serverTimestamp(),
  };
  if (house.interiorNumber) {
    payload.interiorNumber = clip(house.interiorNumber, 32);
  }
  if (isNew) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

function toResidentDoc(user: PortalUser, ownerUid: string, isNew: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(user.id),
    residentKey: /^RES[0-9]+$/.test(user.residentKey) ? user.residentKey : 'RES001',
    username: ensureMinLen(clip(user.username || user.email || user.residentKey, 64), 2, 'usuario'),
    name: ensureMinLen(clip(user.name, 120), 2, 'Residente'),
    email: ensureMinLen(clip(user.email, 160), 3, 'sin-correo@puertacantera.com'),
    role: user.role,
    active: Boolean(user.active),
    qrCode: clip(user.qrCode, 64),
    carCount: Math.max(0, Math.min(10, Math.floor(user.carCount || 0))),
    vehicleQrCodes: (user.vehicleQrCodes ?? []).slice(0, 10).map((v) => ({
      index: v.index,
      label: clip(v.label, 40),
      code: clip(v.code, 64),
      ...(v.plate ? { plate: clip(v.plate, 32) } : {}),
      ...(v.color ? { color: clip(v.color, 40) } : {}),
      ...(v.model ? { model: clip(v.model, 80) } : {}),
    })),
    ownerUid: clip(ownerUid, 128),
    updatedAt: serverTimestamp(),
  };
  if (user.phone) payload.phone = clip(user.phone, 32);
  if (user.houseId) payload.houseId = sanitizeId(user.houseId);
  if (isNew) payload.createdAt = serverTimestamp();
  return payload;
}

function toPaymentDoc(payment: PaymentRecord, ownerUid: string, isNew: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(payment.id),
    folio: ensureMinLen(clip(payment.folio, 32), 2, 'P-0001'),
    houseId: sanitizeId(payment.houseId),
    userId: sanitizeId(payment.userId),
    ownerUid: clip(ownerUid, 128),
    userName: clip(payment.userName, 120) || 'Residente',
    periodLabel: clip(payment.periodLabel, 80) || 'Mensualidad',
    monthsCovered: Math.max(1, Math.min(24, Math.round(payment.monthsCovered || 1))),
    amountMxn: Math.max(1, Math.min(500000, Math.round(payment.amountMxn || 1))),
    method: payment.method,
    reference: clip(payment.reference, 160),
    status: payment.status,
    createdDate: ensureMinLen(clip(payment.createdAt, 20), 8, '2026-11-21'),
    updatedAt: serverTimestamp(),
  };
  if (payment.approvedAmountMxn !== undefined) {
    payload.approvedAmountMxn = Math.max(0, Math.min(500000, Math.round(payment.approvedAmountMxn)));
  }
  if (payment.receiptFileName) payload.receiptFileName = clip(payment.receiptFileName, 160);
  if (payment.receiptFileSizeBytes !== undefined) {
    payload.receiptFileSizeBytes = Math.max(0, Math.min(5242880, payment.receiptFileSizeBytes));
  }
  if (payment.notes) payload.notes = clip(payment.notes, 500);
  if (payment.reviewNote) payload.reviewNote = clip(payment.reviewNote, 500);
  if (payment.reviewedAt) payload.reviewedAt = clip(payment.reviewedAt, 20);
  if (isNew) payload.createdAt = serverTimestamp();
  return payload;
}

function toNoticeDoc(notice: CommunityNotice, isNew: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(notice.id),
    title: ensureMinLen(clip(notice.title, 160), 3, 'Aviso'),
    body: ensureMinLen(clip(notice.body, 3000), 5, 'Comunicado de administración.'),
    category: notice.category,
    urgent: Boolean(notice.urgent),
    pinned: Boolean(notice.pinned),
    sendPush: Boolean(notice.sendPush),
    createdDate: ensureMinLen(clip(notice.createdAt, 20), 8, '2026-11-21'),
    authorName: clip(notice.authorName, 120) || 'ADMON',
    visibility: 'community',
    updatedAt: serverTimestamp(),
  };
  if (isNew) payload.createdAt = serverTimestamp();
  return payload;
}

function toReportDoc(report: CommunityReport, ownerUid: string, isNew: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(report.id),
    folio: ensureMinLen(clip(report.folio, 32), 2, '#R-0001'),
    title: ensureMinLen(clip(report.title, 160), 4, 'Reporte vecinal'),
    category: report.category,
    description: ensureMinLen(clip(report.description, 2000), 6, 'Detalle del reporte.'),
    houseId: sanitizeId(report.houseId),
    ownerUid: clip(ownerUid, 128),
    authorName: clip(report.authorName, 120) || 'Residente',
    status: report.status,
    createdDate: ensureMinLen(clip(report.createdAt, 20), 8, '2026-11-21'),
    comments: (report.comments ?? []).slice(0, 50),
    updatedAt: serverTimestamp(),
  };
  if (report.location) payload.location = clip(report.location, 160);
  if (isNew) payload.createdAt = serverTimestamp();
  return payload;
}

function toVisitDoc(pass: VisitPass, ownerUid: string, isNew: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(pass.id),
    code: ensureMinLen(clip(pass.code, 32), 4, 'PC-000000'),
    houseId: sanitizeId(pass.houseId),
    ownerUid: clip(ownerUid, 128),
    createdByName: clip(pass.createdByName, 120) || 'Residente',
    visitorName: ensureMinLen(clip(pass.visitorName, 120), 2, 'Visitante'),
    companions: Math.max(0, Math.min(20, Math.round(pass.companions || 0))),
    accessType: pass.accessType,
    validFrom: ensureMinLen(clip(pass.validFrom, 20), 8, '2026-11-21'),
    validUntil: ensureMinLen(clip(pass.validUntil, 20), 8, '2026-11-21'),
    status: pass.status,
    createdDate: ensureMinLen(clip(pass.createdAt, 20), 8, '2026-11-21'),
    entries: (pass.entries ?? []).slice(0, 50),
    updatedAt: serverTimestamp(),
  };
  if (pass.phone) payload.phone = clip(pass.phone, 32);
  if (pass.plate) payload.plate = clip(pass.plate, 32);
  if (pass.vehicleModel) payload.vehicleModel = clip(pass.vehicleModel, 80);
  if (pass.vehicleColor) payload.vehicleColor = clip(pass.vehicleColor, 40);
  if (isNew) payload.createdAt = serverTimestamp();
  return payload;
}

function toFeeDoc(fee: FeeScheduleVersion, isNew: boolean) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(fee.id),
    monthlyMxn: Math.max(1, Math.min(100000, Math.round(fee.monthlyMxn))),
    semiannualMxn: Math.max(1, Math.min(500000, Math.round(fee.semiannualMxn))),
    annualMxn: Math.max(1, Math.min(1000000, Math.round(fee.annualMxn))),
    dueDay: Math.max(1, Math.min(28, Math.round(fee.dueDay))),
    billingStartMonth: ensureMinLen(clip(fee.billingStartMonth, 10), 7, '2026-11'),
    effectiveFrom: ensureMinLen(clip(fee.effectiveFrom, 20), 8, '2026-11-09'),
    createdDate: ensureMinLen(clip(fee.createdAt, 20), 8, '2026-11-09'),
    createdBy: clip(fee.createdBy, 120) || 'ADMON',
    visibility: 'community',
    updatedAt: serverTimestamp(),
  };
  if (isNew) payload.createdAt = serverTimestamp();
  return payload;
}

function toAuditDoc(entry: AuditLogEntry) {
  const payload: Record<string, unknown> = {
    id: sanitizeId(entry.id),
    actorName: clip(entry.actorName, 120) || 'ADMON',
    action: ensureMinLen(clip(entry.action, 160), 2, 'Movimiento'),
    timestampLabel: ensureMinLen(clip(entry.timestampLabel, 64), 2, '—'),
    createdAt: serverTimestamp(),
  };
  if (entry.beforeSummary) payload.beforeSummary = clip(entry.beforeSummary, 600);
  if (entry.afterSummary) payload.afterSummary = clip(entry.afterSummary, 600);
  return payload;
}

export function isFirebaseBootstrapAdmin(user: User | null): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === FIREBASE_BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
  );
}

export function formatFirebaseSyncErrorEs(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const msg = error instanceof Error ? error.message : String(error ?? '');

  if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'este dominio';
    return `Dominio no autorizado en Firebase (${host}). Agrégalo en Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-blocked' || msg.includes('auth/popup-blocked')) {
    return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e intenta de nuevo.';
  }
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    msg.includes('popup-closed-by-user')
  ) {
    return 'Se cerró la ventana de Google antes de completar la conexión.';
  }
  if (code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return `Permiso denegado en Firestore. Conéctate con la cuenta autorizada (${FIREBASE_BOOTSTRAP_ADMIN_EMAIL}).`;
  }
  if (code === 'unavailable' || msg.includes('offline')) {
    return 'Sin conexión con Firebase Firestore. Verifica tu internet e intenta nuevamente.';
  }
  return 'No se pudo completar la sincronización con Firebase. Revisa tu conexión e intenta de nuevo.';
}

export async function completePendingGoogleRedirect(): Promise<User | null> {
  try {
    const result = await getRedirectResult(firebaseAuth);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

export async function signInWithGoogleCloud(): Promise<User> {
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    return result.user;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(firebaseAuth, googleProvider);
    }
    throw error;
  }
}

export async function signOutGoogleCloud(): Promise<void> {
  await signOut(firebaseAuth);
}

interface PendingBatchOp {
  colName: string;
  docId: string;
  payload: Record<string, unknown>;
  merge?: boolean;
}

async function commitOpsInBatches(ops: PendingBatchOp[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(firestoreDb);
    for (const op of chunk) {
      const ref = doc(firestoreDb, op.colName, op.docId);
      if (op.merge) {
        batch.set(ref, op.payload, { merge: true });
      } else {
        batch.set(ref, op.payload);
      }
    }
    await batch.commit();
  }
}

export interface CloudSyncSummary {
  uploadedCount: number;
  cloudResidentsCount: number;
}

let activeSyncPromise: Promise<CloudSyncSummary> | null = null;

/**
 * Ensures the admin doc exists and uploads any local records not yet present in Firestore
 * (so residents added/imported before connecting to cloud are never lost or overwritten).
 */
export function syncLocalRecordsToFirestore(
  localDb: PortalDatabase,
  firebaseUser: User,
): Promise<CloudSyncSummary> {
  if (activeSyncPromise) return activeSyncPromise;
  activeSyncPromise = runSyncLocalRecordsToFirestore(localDb, firebaseUser).finally(() => {
    activeSyncPromise = null;
  });
  return activeSyncPromise;
}

async function runSyncLocalRecordsToFirestore(
  localDb: PortalDatabase,
  firebaseUser: User,
): Promise<CloudSyncSummary> {
  if (!isFirebaseBootstrapAdmin(firebaseUser)) {
    throw new Error('permission-denied');
  }

  const uid = firebaseUser.uid;
  const adminDocId = sanitizeId(uid);

  try {
    const [
      adminSnap,
      housesSnap,
      residentsSnap,
      feesSnap,
      noticesSnap,
      reportsSnap,
      visitsSnap,
      paymentsSnap,
      auditSnap,
    ] = await Promise.all([
      getDoc(doc(firestoreDb, 'admins', adminDocId)),
      getDocs(collection(firestoreDb, 'houses')),
      getDocs(collection(firestoreDb, 'residents')),
      getDocs(collection(firestoreDb, 'feeHistory')),
      getDocs(collection(firestoreDb, 'notices')),
      getDocs(collection(firestoreDb, 'reports')),
      getDocs(collection(firestoreDb, 'visits')),
      getDocs(collection(firestoreDb, 'payments')),
      getDocs(collection(firestoreDb, 'auditLogs')),
    ]);

    const existingHouseIds = new Set(housesSnap.docs.map((d) => d.id));
    const existingResidentIds = new Set(residentsSnap.docs.map((d) => d.id));
    const existingFeeIds = new Set(feesSnap.docs.map((d) => d.id));
    const existingNoticeIds = new Set(noticesSnap.docs.map((d) => d.id));
    const existingReportIds = new Set(reportsSnap.docs.map((d) => d.id));
    const existingVisitIds = new Set(visitsSnap.docs.map((d) => d.id));
    const existingPaymentIds = new Set(paymentsSnap.docs.map((d) => d.id));
    const existingAuditIds = new Set(auditSnap.docs.map((d) => d.id));

    const ops: PendingBatchOp[] = [];

    if (!adminSnap.exists()) {
      ops.push({
        colName: 'admins',
        docId: adminDocId,
        payload: {
          uid: adminDocId,
          email: clip(firebaseUser.email, 160),
          username: 'ADMON',
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }

    for (const h of localDb.houses) {
      const docId = sanitizeId(h.id);
      if (!existingHouseIds.has(docId)) {
        ops.push({ colName: 'houses', docId, payload: toHouseDoc(h, uid, true) });
      }
    }

    let uploadedResidents = 0;
    for (const u of localDb.users) {
      const docId = sanitizeId(u.id);
      if (!existingResidentIds.has(docId)) {
        ops.push({ colName: 'residents', docId, payload: toResidentDoc(u, uid, true) });
        uploadedResidents += 1;
      }
    }

    for (const f of localDb.feeHistory) {
      const docId = sanitizeId(f.id);
      if (!existingFeeIds.has(docId)) {
        ops.push({ colName: 'feeHistory', docId, payload: toFeeDoc(f, true) });
      }
    }

    for (const n of localDb.notices) {
      const docId = sanitizeId(n.id);
      if (!existingNoticeIds.has(docId)) {
        ops.push({ colName: 'notices', docId, payload: toNoticeDoc(n, true) });
      }
    }

    for (const r of localDb.reports) {
      const docId = sanitizeId(r.id);
      if (!existingReportIds.has(docId)) {
        ops.push({ colName: 'reports', docId, payload: toReportDoc(r, uid, true) });
      }
    }

    for (const v of localDb.passes) {
      const docId = sanitizeId(v.id);
      if (!existingVisitIds.has(docId)) {
        ops.push({ colName: 'visits', docId, payload: toVisitDoc(v, uid, true) });
      }
    }

    for (const p of localDb.payments) {
      const docId = sanitizeId(p.id);
      if (!existingPaymentIds.has(docId)) {
        ops.push({ colName: 'payments', docId, payload: toPaymentDoc(p, uid, true) });
      }
    }

    for (const log of localDb.auditLog.slice(0, 30)) {
      const docId = sanitizeId(log.id);
      if (!existingAuditIds.has(docId)) {
        ops.push({ colName: 'auditLogs', docId, payload: toAuditDoc(log) });
      }
    }

    if (ops.length > 0) {
      await commitOpsInBatches(ops);
    }

    return {
      uploadedCount: ops.length,
      cloudResidentsCount: existingResidentIds.size + uploadedResidents,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'residents');
  }
}

export async function syncDatabaseChangesToFirestore(
  prevDb: PortalDatabase,
  nextDb: PortalDatabase,
  firebaseUser: User | null,
): Promise<void> {
  if (!firebaseUser || !firebaseUser.emailVerified) return;
  const uid = firebaseUser.uid;
  const adminAccess = isFirebaseBootstrapAdmin(firebaseUser);

  const ops: PendingBatchOp[] = [];
  const deletes: Array<{ colName: string; docId: string }> = [];

  const collectCollectionDiff = async <T extends { id: string }>(
    colName: string,
    prevItems: T[],
    nextItems: T[],
    serializer: (item: T, isNew: boolean) => Record<string, unknown>,
    allowUpdate = true,
    allowDelete = true,
  ) => {
    const prevMap = new Map(prevItems.map((item) => [item.id, item]));
    const nextMap = new Map(nextItems.map((item) => [item.id, item]));

    for (const item of nextItems) {
      const prevItem = prevMap.get(item.id);
      const docId = sanitizeId(item.id);
      if (!prevItem) {
        ops.push({ colName, docId, payload: serializer(item, true), merge: false });
      } else if (allowUpdate && JSON.stringify(prevItem) !== JSON.stringify(item)) {
        // Verify whether doc already exists in Firestore so updates to locally-created docs
        // include createdAt when they are being written to Firestore for the first time.
        const snap = await getDoc(doc(firestoreDb, colName, docId));
        if (snap.exists()) {
          ops.push({ colName, docId, payload: serializer(item, false), merge: true });
        } else {
          ops.push({ colName, docId, payload: serializer(item, true), merge: false });
        }
      }
    }

    if (allowDelete) {
      for (const prevItem of prevItems) {
        if (!nextMap.has(prevItem.id)) {
          deletes.push({ colName, docId: sanitizeId(prevItem.id) });
        }
      }
    }
  };

  try {
    if (adminAccess) {
      await collectCollectionDiff('houses', prevDb.houses, nextDb.houses, (h, isNew) =>
        toHouseDoc(h, uid, isNew),
      );
      await collectCollectionDiff('residents', prevDb.users, nextDb.users, (u, isNew) =>
        toResidentDoc(u, uid, isNew),
      );
      await collectCollectionDiff('notices', prevDb.notices, nextDb.notices, (n, isNew) =>
        toNoticeDoc(n, isNew),
      );
      await collectCollectionDiff('feeHistory', prevDb.feeHistory, nextDb.feeHistory, (f, isNew) =>
        toFeeDoc(f, isNew),
      );
      await collectCollectionDiff(
        'auditLogs',
        prevDb.auditLog,
        nextDb.auditLog.slice(0, 50),
        (a) => toAuditDoc(a),
        false,
        false,
      );
    }

    await collectCollectionDiff('payments', prevDb.payments, nextDb.payments, (p, isNew) =>
      toPaymentDoc(p, uid, isNew),
    );
    await collectCollectionDiff('reports', prevDb.reports, nextDb.reports, (r, isNew) =>
      toReportDoc(r, uid, isNew),
    );
    await collectCollectionDiff('visits', prevDb.passes, nextDb.passes, (v, isNew) =>
      toVisitDoc(v, uid, isNew),
    );

    if (ops.length > 0) {
      await commitOpsInBatches(ops);
    }

    for (const del of deletes) {
      try {
        await deleteDoc(doc(firestoreDb, del.colName, del.docId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${del.colName}/${del.docId}`);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'sync');
  }
}

export function subscribeToFirestoreDatabase(
  firebaseUser: User,
  onPatch: (patch: Partial<PortalDatabase>) => void,
  onSyncError: (message: string) => void,
): () => void {
  const unsubs: Unsubscribe[] = [];
  const adminAccess = isFirebaseBootstrapAdmin(firebaseUser);
  const uid = firebaseUser.uid;

  const listen = <T>(
    colName: string,
    q: ReturnType<typeof query> | ReturnType<typeof collection>,
    mapper: (data: Record<string, unknown>) => T,
    apply: (items: T[]) => void,
    ignoreEmpty = false,
  ) => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (ignoreEmpty && snap.empty) return;
        const items = snap.docs.map((d) => mapper(d.data() as Record<string, unknown>));
        apply(items);
      },
      (error) => {
        onSyncError(`Error de sincronización en ${colName}: ${formatFirebaseSyncErrorEs(error)}`);
        handleFirestoreError(error, OperationType.LIST, colName);
      },
    );
    unsubs.push(unsub);
  };

  listen(
    'houses',
    adminAccess
      ? collection(firestoreDb, 'houses')
      : query(collection(firestoreDb, 'houses'), where('ownerUid', '==', uid)),
    (d) => ({
      id: String(d.id ?? ''),
      street: String(d.street ?? ''),
      number: String(d.number ?? ''),
      interiorNumber: d.interiorNumber ? String(d.interiorNumber) : null,
      familyName: String(d.familyName ?? ''),
      active: Boolean(d.active ?? true),
    }),
    (houses) => onPatch({ houses }),
    true,
  );

  listen(
    'residents',
    adminAccess
      ? collection(firestoreDb, 'residents')
      : query(collection(firestoreDb, 'residents'), where('ownerUid', '==', uid)),
    (d) => ({
      id: String(d.id ?? ''),
      residentKey: String(d.residentKey ?? 'RES001'),
      username: String(d.username ?? d.email ?? ''),
      name: String(d.name ?? ''),
      email: String(d.email ?? '') === 'sin-correo@puertacantera.com' ? '' : String(d.email ?? ''),
      phone: d.phone ? String(d.phone) : undefined,
      role: (d.role as PortalUser['role']) ?? 'resident',
      houseId: d.houseId ? String(d.houseId) : null,
      active: Boolean(d.active ?? true),
      qrCode: String(d.qrCode ?? ''),
      carCount: Number(d.carCount ?? 0),
      vehicleQrCodes: Array.isArray(d.vehicleQrCodes)
        ? (d.vehicleQrCodes as PortalUser['vehicleQrCodes'])
        : [],
    }),
    (users) => onPatch({ users }),
    true,
  );

  listen(
    'notices',
    adminAccess
      ? collection(firestoreDb, 'notices')
      : query(collection(firestoreDb, 'notices'), where('visibility', '==', 'community')),
    (d) => ({
      id: String(d.id ?? ''),
      title: String(d.title ?? ''),
      body: String(d.body ?? ''),
      category: (d.category as CommunityNotice['category']) ?? 'administracion',
      urgent: Boolean(d.urgent),
      pinned: Boolean(d.pinned),
      sendPush: Boolean(d.sendPush),
      createdAt: String(d.createdDate ?? '2026-11-21'),
      authorName: String(d.authorName ?? 'ADMON'),
    }),
    (notices) => onPatch({ notices }),
  );

  listen(
    'feeHistory',
    adminAccess
      ? collection(firestoreDb, 'feeHistory')
      : query(collection(firestoreDb, 'feeHistory'), where('visibility', '==', 'community')),
    (d) => ({
      id: String(d.id ?? ''),
      monthlyMxn: Number(d.monthlyMxn ?? 400),
      semiannualMxn: Number(d.semiannualMxn ?? 2200),
      annualMxn: Number(d.annualMxn ?? 4200),
      dueDay: Number(d.dueDay ?? 10),
      billingStartMonth: String(d.billingStartMonth ?? '2026-11'),
      effectiveFrom: String(d.effectiveFrom ?? '2026-11-09'),
      createdAt: String(d.createdDate ?? '2026-11-09'),
      createdBy: String(d.createdBy ?? 'ADMON'),
    }),
    (feeHistory) => onPatch({ feeHistory }),
    true,
  );

  listen(
    'payments',
    adminAccess
      ? collection(firestoreDb, 'payments')
      : query(collection(firestoreDb, 'payments'), where('ownerUid', '==', uid)),
    (d) => ({
      id: String(d.id ?? ''),
      folio: String(d.folio ?? ''),
      houseId: String(d.houseId ?? ''),
      userId: String(d.userId ?? ''),
      userName: String(d.userName ?? ''),
      periodLabel: String(d.periodLabel ?? ''),
      monthsCovered: Number(d.monthsCovered ?? 1),
      amountMxn: Number(d.amountMxn ?? 0),
      approvedAmountMxn:
        d.approvedAmountMxn !== undefined ? Number(d.approvedAmountMxn) : undefined,
      method: (d.method as PaymentRecord['method']) ?? 'Transferencia SPEI',
      reference: String(d.reference ?? ''),
      receiptFileName: d.receiptFileName ? String(d.receiptFileName) : undefined,
      receiptFileSizeBytes:
        d.receiptFileSizeBytes !== undefined ? Number(d.receiptFileSizeBytes) : undefined,
      notes: d.notes ? String(d.notes) : undefined,
      reviewNote: d.reviewNote ? String(d.reviewNote) : undefined,
      status: (d.status as PaymentRecord['status']) ?? 'pending',
      createdAt: String(d.createdDate ?? '2026-11-21'),
      reviewedAt: d.reviewedAt ? String(d.reviewedAt) : undefined,
    }),
    (payments) => onPatch({ payments }),
  );

  listen(
    'reports',
    adminAccess
      ? collection(firestoreDb, 'reports')
      : query(collection(firestoreDb, 'reports'), where('ownerUid', '==', uid)),
    (d) => ({
      id: String(d.id ?? ''),
      folio: String(d.folio ?? ''),
      title: String(d.title ?? ''),
      category: (d.category as CommunityReport['category']) ?? 'Otro',
      description: String(d.description ?? ''),
      location: d.location ? String(d.location) : undefined,
      houseId: String(d.houseId ?? ''),
      authorName: String(d.authorName ?? ''),
      status: (d.status as CommunityReport['status']) ?? 'open',
      createdAt: String(d.createdDate ?? '2026-11-21'),
      comments: Array.isArray(d.comments) ? (d.comments as CommunityReport['comments']) : [],
    }),
    (reports) => onPatch({ reports }),
  );

  listen(
    'visits',
    adminAccess
      ? collection(firestoreDb, 'visits')
      : query(collection(firestoreDb, 'visits'), where('ownerUid', '==', uid)),
    (d) => ({
      id: String(d.id ?? ''),
      code: String(d.code ?? ''),
      houseId: String(d.houseId ?? ''),
      createdByName: String(d.createdByName ?? ''),
      visitorName: String(d.visitorName ?? ''),
      phone: d.phone ? String(d.phone) : undefined,
      plate: d.plate ? String(d.plate) : undefined,
      vehicleModel: d.vehicleModel ? String(d.vehicleModel) : undefined,
      vehicleColor: d.vehicleColor ? String(d.vehicleColor) : undefined,
      companions: Number(d.companions ?? 0),
      accessType: (d.accessType as VisitPass['accessType']) ?? 'single',
      validFrom: String(d.validFrom ?? '2026-11-21'),
      validUntil: String(d.validUntil ?? '2026-11-21'),
      status: (d.status as VisitPass['status']) ?? 'active',
      createdAt: String(d.createdDate ?? '2026-11-21'),
      entries: Array.isArray(d.entries) ? (d.entries as VisitPass['entries']) : [],
    }),
    (passes) => onPatch({ passes }),
  );

  if (adminAccess) {
    listen(
      'auditLogs',
      collection(firestoreDb, 'auditLogs'),
      (d) => ({
        id: String(d.id ?? ''),
        actorName: String(d.actorName ?? ''),
        action: String(d.action ?? ''),
        timestampLabel: String(d.timestampLabel ?? ''),
        beforeSummary: d.beforeSummary ? String(d.beforeSummary) : undefined,
        afterSummary: d.afterSummary ? String(d.afterSummary) : undefined,
      }),
      (auditLog) => onPatch({ auditLog }),
      true,
    );
  }

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
