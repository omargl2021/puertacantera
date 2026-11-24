export type UserRole = 'resident' | 'treasurer' | 'admin' | 'guard';

export type AppRoute =
  | '/login'
  | '/recuperar'
  | '/privacidad'
  | '/'
  | '/pagos'
  | '/visitas'
  | '/reportes'
  | '/avisos'
  | '/cuenta'
  | '/admin/tesoreria'
  | '/admin/tesoreria/casas'
  | '/admin/tesoreria/cuotas'
  | '/admin/avisos'
  | '/admin/reportes'
  | '/admin/visitas'
  | '/admin/padron'
  | '/admin/bitacora';

export interface VehicleQrCode {
  index: number;
  label: string;
  code: string;
}

export interface House {
  id: string;
  street: string;
  number: string;
  interiorNumber: string | null;
  familyName: string;
  active: boolean;
}

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  houseId: string | null;
  active: boolean;
  phone?: string;
  qrCode: string;
  carCount: number;
  vehicleQrCodes: VehicleQrCode[];
}

export interface Invitation {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  houseId: string | null;
  carCount: number;
  qrCode: string;
  vehicleQrCodes: VehicleQrCode[];
  createdAt: string;
  status: 'pending' | 'accepted';
}

export interface FeeScheduleVersion {
  id: string;
  monthlyMxn: number;
  semiannualMxn: number;
  annualMxn: number;
  dueDay: number;
  billingStartMonth: string; // YYYY-MM
  effectiveFrom: string; // YYYY-MM-DD
  createdAt: string; // YYYY-MM-DD
  createdBy: string;
}

export type PaymentStatus = 'pending' | 'approved' | 'adjusted' | 'rejected';

export interface PaymentRecord {
  id: string;
  folio: string;
  houseId: string;
  userId: string;
  userName: string;
  periodLabel: string;
  monthsCovered: number;
  amountMxn: number;
  approvedAmountMxn?: number;
  method: 'Transferencia SPEI' | 'Depósito bancario' | 'Efectivo';
  reference: string;
  notes?: string;
  reviewNote?: string;
  status: PaymentStatus;
  createdAt: string;
  reviewedAt?: string;
}

export type NoticeCategory = 'administracion' | 'mantenimiento' | 'seguridad' | 'eventos';

export interface CommunityNotice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  urgent: boolean;
  pinned: boolean;
  sendPush: boolean;
  createdAt: string;
  authorName: string;
}

export type ReportStatus = 'open' | 'in_progress' | 'resolved';

export type ReportCategory =
  | 'Alumbrado'
  | 'Agua'
  | 'Seguridad'
  | 'Áreas verdes'
  | 'Portón'
  | 'Otro';

export interface ReportComment {
  id: string;
  authorName: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface CommunityReport {
  id: string;
  folio: string; // #R-0001
  title: string;
  category: ReportCategory;
  description: string;
  location?: string;
  houseId: string;
  authorName: string;
  status: ReportStatus;
  createdAt: string;
  comments: ReportComment[];
}

export type VisitAccessType = 'single' | 'multi';
export type VisitPassStatus = 'active' | 'used' | 'cancelled';

export interface VisitPass {
  id: string;
  code: string;
  houseId: string;
  createdByName: string;
  visitorName: string;
  phone?: string;
  plate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  companions: number;
  accessType: VisitAccessType;
  validFrom: string;
  validUntil: string;
  status: VisitPassStatus;
  createdAt: string;
  entries: Array<{
    id: string;
    enteredAt: string;
    guardName: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  action: string;
  timestampLabel: string;
  beforeSummary?: string;
  afterSummary?: string;
}

export interface PortalDatabase {
  houses: House[];
  users: PortalUser[];
  invitations: Invitation[];
  feeHistory: FeeScheduleVersion[];
  payments: PaymentRecord[];
  notices: CommunityNotice[];
  reports: CommunityReport[];
  passes: VisitPass[];
  auditLog: AuditLogEntry[];
  pushEnabled: boolean;
}
