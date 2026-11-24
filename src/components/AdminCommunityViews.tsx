import { useState, type FormEvent } from 'react';
import { Car, Pencil, Pin, QrCode, Trash2, X } from 'lucide-react';
import { EntryPassModal } from './EntryPassModal';
import { QrCodeSvg } from './QrCodeSvg';
import type {
  House,
  NoticeCategory,
  PortalDatabase,
  PortalUser,
  ReportStatus,
  ScannedResidentData,
  UserRole,
  VehicleDetailsInput,
} from '../types/portal';
import {
  buildVehicleScanUrl,
  createScannedResidentData,
  DEFAULT_TODAY_ISO,
  formatAuditTimestamp,
  formatHouseLabel,
  formatShortDateEs,
  formatVehicleSummary,
  getRoleUsage,
  NOTICE_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  ROLE_LABELS,
  ROLE_LIMITS,
  type AddHouseInput,
  type InviteUserInput,
  type PublishNoticeInput,
  type UpdateUserPatch,
} from '../utils/portalLogic';

/* ==================== 4. AVISOS ==================== */

interface AdminNoticesViewProps {
  db: PortalDatabase;
  onPublishNotice: (input: PublishNoticeInput) => string | null;
  onDeleteNotice: (noticeId: string) => void;
}

export function AdminNoticesView({
  db,
  onPublishNotice,
  onDeleteNotice,
}: AdminNoticesViewProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('administracion');
  const [urgent, setUrgent] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [sendPush, setSendPush] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = onPublishNotice({ title, body, category, urgent, pinned, sendPush });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setTitle('');
    setBody('');
    setUrgent(false);
    setPinned(false);
  };

  const sortedNotices = [...db.notices].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Comunidad
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">Avisos</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-5">
          <h2 className="font-heading text-2xl font-semibold text-ink">Nuevo aviso</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="n-title" className="text-sm font-semibold text-ink">
                Título
              </label>
              <input
                id="n-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Fumigación de áreas comunes"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="n-body" className="text-sm font-semibold text-ink">
                Contenido
              </label>
              <textarea
                id="n-body"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escribe el comunicado para los vecinos..."
                className="w-full rounded-[10px] border border-input bg-white p-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="n-category" className="text-sm font-semibold text-ink">
                Categoría
              </label>
              <select
                id="n-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NoticeCategory)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              >
                <option value="administracion">Administración</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="seguridad">Seguridad</option>
                <option value="eventos">Eventos</option>
              </select>
            </div>

            <div className="flex flex-col gap-2.5 pt-1 text-[15px]">
              <label className="flex items-center gap-2.5 font-medium text-ink">
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                  className="size-4 accent-[#8A2E1F]"
                />
                Urgente
              </label>
              <label className="flex items-center gap-2.5 font-medium text-ink">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="size-4 accent-[#8A641B]"
                />
                Fijar arriba
              </label>
              <label className="flex items-center gap-2.5 font-medium text-ink">
                <input
                  type="checkbox"
                  checked={sendPush}
                  onChange={(e) => setSendPush(e.target.checked)}
                  className="size-4 accent-[#8A641B]"
                />
                Enviar notificación push a todos los vecinos
              </label>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-cantera px-5 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
            >
              Publicar aviso
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl font-semibold text-ink">Publicados</h2>
          {sortedNotices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-10 text-center text-sm text-stone">
              No hay avisos publicados todavía.
            </div>
          ) : (
            sortedNotices.map((n) => (
              <article
                key={n.id}
                className="flex flex-col gap-2 rounded-[16px] border border-line bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sand-2 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                    {NOTICE_CATEGORY_LABELS[n.category]}
                  </span>
                  {n.urgent && (
                    <span className="rounded-full bg-bad-bg px-2 py-0.5 text-xs font-semibold text-bad">
                      Urgente
                    </span>
                  )}
                  {n.pinned && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-cantera">
                      <Pin className="size-3" />
                      Fijado
                    </span>
                  )}
                  <span className="ml-auto text-xs text-stone">{formatShortDateEs(n.createdAt)}</span>
                  <button
                    type="button"
                    aria-label={`Eliminar aviso ${n.title}`}
                    onClick={() => onDeleteNotice(n.id)}
                    className="flex size-8 items-center justify-center rounded-lg text-stone hover:bg-bad-bg hover:text-bad"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <h3 className="font-semibold text-ink">{n.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{n.body}</p>
              </article>
            ))
          )}
        </section>
      </div>
    </>
  );
}

/* ==================== 5. REPORTES ==================== */

interface AdminReportsViewProps {
  db: PortalDatabase;
  onUpdateReport: (reportId: string, body: string, nextStatus: ReportStatus | '') => string | null;
}

export function AdminReportsView({ db, onUpdateReport }: AdminReportsViewProps) {
  const [filter, setFilter] = useState<'abiertos' | 'open' | 'in_progress' | 'resolved' | 'all'>(
    'abiertos',
  );
  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, ReportStatus | ''>>({});
  const [formError, setFormError] = useState<Record<string, string | null>>({});

  const houseMap = new Map(db.houses.map((h) => [h.id, h]));

  const openCount = db.reports.filter((r) => r.status === 'open').length;
  const inProgressCount = db.reports.filter((r) => r.status === 'in_progress').length;
  const resolvedCount = db.reports.filter((r) => r.status === 'resolved').length;

  const filtered = db.reports.filter((r) => {
    if (filter === 'abiertos') return r.status !== 'resolved';
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const handleSave = (e: FormEvent, reportId: string) => {
    e.preventDefault();
    const err = onUpdateReport(
      reportId,
      draftReplies[reportId] ?? '',
      draftStatuses[reportId] ?? '',
    );
    if (err) {
      setFormError((prev) => ({ ...prev, [reportId]: err }));
      return;
    }
    setFormError((prev) => ({ ...prev, [reportId]: null }));
    setDraftReplies((prev) => ({ ...prev, [reportId]: '' }));
    setDraftStatuses((prev) => ({ ...prev, [reportId]: '' }));
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Comunidad
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">Reportes</h1>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Recibidos
          </span>
          <span className="font-heading text-3xl font-semibold text-warn tabular-nums">
            {openCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            En proceso
          </span>
          <span className="font-heading text-3xl font-semibold text-info tabular-nums">
            {inProgressCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Resueltos
          </span>
          <span className="font-heading text-3xl font-semibold text-ok tabular-nums">
            {resolvedCount}
          </span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: 'abiertos', label: 'Abiertos' },
            { value: 'open', label: 'Recibidos' },
            { value: 'in_progress', label: 'En proceso' },
            { value: 'resolved', label: 'Resueltos' },
            { value: 'all', label: 'Todos' },
          ] as const
        ).map((chip) => {
          const active = filter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-night bg-night text-white'
                  : 'border-chip-line bg-white text-ink hover:bg-sand-2'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-10 text-center text-sm text-stone">
          No hay reportes en este estado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((report) => {
            const step =
              report.status === 'resolved' ? 3 : report.status === 'in_progress' ? 2 : 1;
            return (
              <article
                key={report.id}
                className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-stone">
                      {report.folio} · {report.category} ·{' '}
                      {formatShortDateEs(report.createdAt, false)}
                      {houseMap.get(report.houseId)
                        ? ` · ${formatHouseLabel(houseMap.get(report.houseId))}`
                        : ''}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold text-ink">{report.title}</h2>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      report.status === 'resolved'
                        ? 'bg-ok-bg text-ok'
                        : report.status === 'in_progress'
                          ? 'bg-info-bg text-info'
                          : 'bg-warn-bg text-warn'
                    }`}
                  >
                    {REPORT_STATUS_LABELS[report.status]}
                  </span>
                </div>

                <p className="text-[15px] text-ink-soft">{report.description}</p>

                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full ${
                          idx <= step ? 'bg-cantera' : 'bg-sand-2'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-stone">
                    <span>Recibido</span>
                    <span>En proceso</span>
                    <span>Resuelto</span>
                  </div>
                </div>

                {report.comments.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-line pt-3">
                    {report.comments.map((c) => (
                      <div key={c.id} className="rounded-xl bg-sand px-3 py-2 text-sm">
                        <p className="text-xs font-semibold text-stone">
                          {c.authorName} · {formatShortDateEs(c.createdAt, false)}
                        </p>
                        <p className="mt-0.5 text-ink">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => handleSave(e, report.id)}
                  className="flex flex-col gap-2.5 border-t border-line pt-3"
                >
                  <input
                    value={draftReplies[report.id] ?? ''}
                    onChange={(e) =>
                      setDraftReplies((prev) => ({ ...prev, [report.id]: e.target.value }))
                    }
                    placeholder="Respuesta para el vecino"
                    className="h-11 w-full rounded-[10px] border border-input bg-white px-3 text-sm font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
                  />
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label="Cambiar estado"
                      value={draftStatuses[report.id] ?? ''}
                      onChange={(e) =>
                        setDraftStatuses((prev) => ({
                          ...prev,
                          [report.id]: e.target.value as ReportStatus | '',
                        }))
                      }
                      className="h-10 flex-1 rounded-[10px] border border-input bg-white px-3 text-sm font-medium outline-none focus-visible:border-cantera"
                    >
                      <option value="">Sin cambio de estado</option>
                      <option value="open">Recibido</option>
                      <option value="in_progress">En proceso</option>
                      <option value="resolved">Resuelto</option>
                    </select>
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-cantera px-4 text-sm font-semibold text-white hover:bg-cantera-dark"
                    >
                      Guardar
                    </button>
                  </div>
                  {formError[report.id] && (
                    <p role="alert" className="text-xs font-medium text-bad">
                      {formError[report.id]}
                    </p>
                  )}
                </form>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ==================== 6. BITÁCORA DE VISITAS ==================== */

interface AdminVisitsLogViewProps {
  db: PortalDatabase;
}

export function AdminVisitsLogView({ db }: AdminVisitsLogViewProps) {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('today');
  const houseMap = new Map(db.houses.map((h) => [h.id, h]));

  const todayMs = new Date(`${DEFAULT_TODAY_ISO}T23:59:59`).getTime();
  const maxAgeDays = range === 'today' ? 1 : range === '7d' ? 7 : 30;

  const entries = db.passes
    .flatMap((pass) =>
      pass.entries.map((entry) => ({
        ...entry,
        pass,
      })),
    )
    .filter((item) => {
      const entryDate = item.enteredAt.slice(0, 10);
      if (range === 'today') return entryDate === DEFAULT_TODAY_ISO;
      const diffDays = (todayMs - new Date(item.enteredAt).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= -1 && diffDays <= maxAgeDays;
    })
    .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Comunidad
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">
            Bitácora de visitas
          </h1>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: 'today', label: 'Hoy' },
            { value: '7d', label: '7 días' },
            { value: '30d', label: '30 días' },
          ] as const
        ).map((pill) => {
          const active = range === pill.value;
          return (
            <button
              key={pill.value}
              type="button"
              onClick={() => setRange(pill.value)}
              className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-night bg-night text-white'
                  : 'border-chip-line bg-white text-ink hover:bg-sand-2'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-12 text-center">
          <p className="font-semibold text-ink">Sin entradas en este periodo</p>
          <p className="text-sm text-stone">
            Las entradas registradas en caseta mediante pase QR aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="w-full min-w-[600px] text-left text-[15px]">
            <thead className="border-b border-line bg-sand-2 text-[13px] font-semibold tracking-[0.06em] text-stone uppercase">
              <tr>
                <th className="px-4 py-3">Visitante</th>
                <th className="px-4 py-3">Casa</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Vehículo / Placas</th>
                <th className="px-4 py-3">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{row.pass.visitorName}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {formatHouseLabel(houseMap.get(row.pass.houseId))}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm">{row.pass.code}</td>
                  <td className="px-4 py-2.5 text-stone">
                    {[row.pass.vehicleModel, row.pass.plate].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-stone">
                    {formatAuditTimestamp(row.enteredAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ==================== 7. VECINOS Y CASAS ==================== */

interface AdminDirectoryViewProps {
  db: PortalDatabase;
  onAddHouse: (input: AddHouseInput) => string | null;
  onUpdateHouse: (
    houseId: string,
    patch: Partial<Pick<House, 'street' | 'number' | 'interiorNumber' | 'familyName' | 'active'>>,
  ) => string | null;
  onInviteUser: (input: InviteUserInput) => { user?: PortalUser; error: string | null };
  onUpdateUser: (userId: string, patch: UpdateUserPatch) => string | null;
  onScanQr: (data: ScannedResidentData) => void;
  onNotify: (message: string) => void;
}

function resizeVehicleDrafts(
  prev: VehicleDetailsInput[],
  count: number,
): VehicleDetailsInput[] {
  const safe = Math.max(0, Math.min(10, Math.floor(Number.isFinite(count) ? count : 0)));
  return Array.from({ length: safe }, (_, idx) => prev[idx] ?? { plate: '', color: '', model: '' });
}

export function AdminDirectoryView({
  db,
  onAddHouse,
  onUpdateHouse,
  onInviteUser,
  onUpdateUser,
  onScanQr,
  onNotify,
}: AdminDirectoryViewProps) {
  // Invite / Register user form
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invRole, setInvRole] = useState<UserRole>('resident');
  const [invHouseId, setInvHouseId] = useState<string>('');
  const [invCarCount, setInvCarCount] = useState<string>('1');
  const [invVehicles, setInvVehicles] = useState<VehicleDetailsInput[]>([
    { plate: '', color: '', model: '' },
  ]);
  const [invError, setInvError] = useState<string | null>(null);
  const [lastCreatedUserId, setLastCreatedUserId] = useState<string | null>(null);

  // Add house form
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [interiorNumber, setInteriorNumber] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [houseError, setHouseError] = useState<string | null>(null);

  // Modals
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
  const [passModalUserId, setPassModalUserId] = useState<string | null>(null);

  const houseMap = new Map(db.houses.map((h) => [h.id, h]));
  const activeHousesCount = db.houses.filter((h) => h.active).length;
  const activeUsersCount = db.users.filter((u) => u.active).length;
  const pendingInvitesCount = db.invitations.filter((i) => i.status === 'pending').length;
  const roleUsage = getRoleUsage(db);
  const treasurerFull = roleUsage.treasurer >= ROLE_LIMITS.treasurer;
  const adminFull = roleUsage.admin >= ROLE_LIMITS.admin;

  const lastCreatedUser = lastCreatedUserId
    ? db.users.find((u) => u.id === lastCreatedUserId) ?? null
    : null;

  const passModalUser = passModalUserId
    ? db.users.find((u) => u.id === passModalUserId) ?? null
    : null;

  const handleInvCarCountChange = (raw: string) => {
    setInvCarCount(raw);
    const parsed = Math.max(0, Math.min(10, Number(raw) || 0));
    setInvVehicles((prev) => resizeVehicleDrafts(prev, parsed));
    if (invError) setInvError(null);
  };

  const handleInvVehicleChange = (
    idx: number,
    field: keyof VehicleDetailsInput,
    value: string,
  ) => {
    setInvVehicles((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
    if (invError) setInvError(null);
  };

  const handleInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedCars = Math.max(0, Math.min(10, Number(invCarCount) || 0));
    const vehiclesPayload = resizeVehicleDrafts(invVehicles, parsedCars);
    const res = onInviteUser({
      email: invEmail,
      name: invName,
      phone: invPhone,
      role: invRole,
      houseId: invHouseId || null,
      carCount: parsedCars,
      vehicles: vehiclesPayload,
    });
    if (res.error) {
      setInvError(res.error);
      return;
    }
    setInvError(null);
    setInvEmail('');
    setInvName('');
    setInvPhone('');
    setInvRole('resident');
    setInvHouseId('');
    setInvCarCount('1');
    setInvVehicles([{ plate: '', color: '', model: '' }]);
    if (res.user) {
      setLastCreatedUserId(res.user.id);
    }
  };

  const handleHouseSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = onAddHouse({ street, number, interiorNumber, familyName });
    if (err) {
      setHouseError(err);
      return;
    }
    setHouseError(null);
    setStreet('');
    setNumber('');
    setInteriorNumber('');
    setFamilyName('');
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Comunidad
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">
            Vecinos y casas
          </h1>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Casas activas
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {activeHousesCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Usuarios activos
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {activeUsersCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Invitaciones pendientes
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {pendingInvitesCount}
          </span>
        </div>
      </section>

      {/* Invitar / Registrar usuario */}
      <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-2xl font-semibold text-ink">Invitar usuario</h2>
          <p className="text-sm text-stone">
            Cada registro genera automáticamente un código QR por automóvil con los datos del titular.
          </p>
        </div>

        <form onSubmit={handleInviteSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-email" className="text-sm font-semibold text-ink">
                Correo
              </label>
              <input
                id="inv-email"
                type="email"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="vecino@correo.com"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-name" className="text-sm font-semibold text-ink">
                Nombre <span className="font-normal text-stone">(opcional)</span>
              </label>
              <input
                id="inv-name"
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder="Ana Morales"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-phone" className="text-sm font-semibold text-ink">
                Teléfono
              </label>
              <input
                id="inv-phone"
                type="tel"
                value={invPhone}
                onChange={(e) => setInvPhone(e.target.value)}
                placeholder="442 123 4567"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-role" className="text-sm font-semibold text-ink">
                Rol
              </label>
              <select
                id="inv-role"
                value={invRole}
                onChange={(e) => setInvRole(e.target.value as UserRole)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-sm font-medium outline-none focus-visible:border-cantera"
              >
                <option value="resident">Vecino</option>
                <option value="treasurer" disabled={treasurerFull}>
                  Tesorería ({roleUsage.treasurer}/{ROLE_LIMITS.treasurer}
                  {treasurerFull ? ' · Lleno' : ''})
                </option>
                <option value="admin" disabled={adminFull}>
                  Mesa directiva ({roleUsage.admin}/{ROLE_LIMITS.admin}
                  {adminFull ? ' · Lleno' : ''})
                </option>
                <option value="guard">Caseta</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-house" className="text-sm font-semibold text-ink">
                Casa
              </label>
              <select
                id="inv-house"
                value={invHouseId}
                onChange={(e) => setInvHouseId(e.target.value)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-sm font-medium outline-none focus-visible:border-cantera"
              >
                <option value="">Sin casa</option>
                {db.houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {formatHouseLabel(h)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-cars" className="text-sm font-semibold text-ink">
                Número de autos
              </label>
              <input
                id="inv-cars"
                type="number"
                min={0}
                max={10}
                value={invCarCount}
                onChange={(e) => handleInvCarCountChange(e.target.value)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          {invVehicles.length > 0 && (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-sand/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {invVehicles.length === 1
                    ? 'Características del automóvil'
                    : `Características de los automóviles (${invVehicles.length})`}
                </span>
                <span className="text-xs text-stone">
                  Límites de rol: máx. {ROLE_LIMITS.treasurer} Tesorería · máx. {ROLE_LIMITS.admin}{' '}
                  Mesa directiva
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {invVehicles.map((vehicle, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] text-cantera uppercase">
                      <Car className="size-3.5" />
                      Automóvil {idx + 1}
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        aria-label={`Placa automóvil ${idx + 1}`}
                        required
                        value={vehicle.plate ?? ''}
                        onChange={(e) =>
                          handleInvVehicleChange(idx, 'plate', e.target.value.toUpperCase())
                        }
                        placeholder="Placa (ABC-123-A)"
                        className="h-10 rounded-lg border border-input bg-white px-2.5 font-mono text-sm font-medium uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-stone/60 focus-visible:border-cantera"
                      />
                      <input
                        aria-label={`Color automóvil ${idx + 1}`}
                        required
                        value={vehicle.color ?? ''}
                        onChange={(e) => handleInvVehicleChange(idx, 'color', e.target.value)}
                        placeholder="Color"
                        className="h-10 rounded-lg border border-input bg-white px-2.5 text-sm font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
                      />
                      <input
                        aria-label={`Modelo automóvil ${idx + 1}`}
                        required
                        value={vehicle.model ?? ''}
                        onChange={(e) => handleInvVehicleChange(idx, 'model', e.target.value)}
                        placeholder="Modelo"
                        className="h-10 rounded-lg border border-input bg-white px-2.5 text-sm font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-stone">
              Tesorería: {roleUsage.treasurer}/{ROLE_LIMITS.treasurer} · Mesa directiva:{' '}
              {roleUsage.admin}/{ROLE_LIMITS.admin}
            </span>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-cantera px-6 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
            >
              Enviar invitación
            </button>
          </div>
        </form>
        {invError && (
          <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
            {invError}
          </p>
        )}

        {/* Newly generated QR summary banner */}
        {lastCreatedUser && (
          <div className="flex flex-col gap-3 rounded-2xl border border-cantera/25 bg-cantera-soft/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.06em] text-cantera uppercase">
                  Clave {lastCreatedUser.residentKey} · Códigos QR por automóvil · Titular:{' '}
                  {lastCreatedUser.name}
                </p>
                <p className="text-sm text-ink-soft">
                  {lastCreatedUser.email}
                  {lastCreatedUser.phone ? ` · Tel. ${lastCreatedUser.phone}` : ''} ·{' '}
                  {lastCreatedUser.vehicleQrCodes.length}{' '}
                  {lastCreatedUser.vehicleQrCodes.length === 1
                    ? 'QR de automóvil'
                    : 'QR de automóviles'}
                </p>
              </div>
              {lastCreatedUser.vehicleQrCodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPassModalUserId(lastCreatedUser.id)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-cantera px-3.5 text-sm font-semibold text-white hover:bg-cantera-dark"
                >
                  <QrCode className="size-4" />
                  Generar pase de entrada
                </button>
              )}
            </div>

            {lastCreatedUser.vehicleQrCodes.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {lastCreatedUser.vehicleQrCodes.map((v) => {
                  const specs = formatVehicleSummary(v);
                  const createdHouse = lastCreatedUser.houseId
                    ? houseMap.get(lastCreatedUser.houseId) ?? null
                    : null;
                  const qrUrl = buildVehicleScanUrl(lastCreatedUser, v, createdHouse);
                  const scanData = createScannedResidentData(lastCreatedUser, v, createdHouse);
                  return (
                    <div
                      key={v.code}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => onScanQr(scanData)}
                        aria-label={`Escanear QR ${v.code}`}
                        className="shrink-0 rounded-lg transition-transform hover:scale-105"
                      >
                        <QrCodeSvg code={qrUrl} size={44} />
                      </button>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-ink">
                          {v.label} · {lastCreatedUser.name}
                        </span>
                        {specs && <span className="text-[11px] text-ink-soft">{specs}</span>}
                        <span className="font-mono text-[11px] text-stone">{v.code}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {db.invitations.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line pt-3">
            <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
              Invitaciones enviadas
            </span>
            <div className="flex flex-wrap gap-2">
              {db.invitations.map((inv) => (
                <span
                  key={inv.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sand px-3 py-1 text-xs font-medium text-ink"
                >
                  {inv.email} · {ROLE_LABELS[inv.role]} · {inv.carCount}{' '}
                  {inv.carCount === 1 ? 'auto' : 'autos'}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Casas */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-semibold text-ink">Casas</h2>

        <div className="rounded-[18px] border border-line bg-white p-5">
          <form
            onSubmit={handleHouseSubmit}
            className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="h-street" className="text-sm font-semibold text-ink">
                Calle
              </label>
              <input
                id="h-street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="De Las Flores"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="h-num" className="text-sm font-semibold text-ink">
                Número
              </label>
              <input
                id="h-num"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="402"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="h-interior" className="text-sm font-semibold text-ink">
                Número Interior
              </label>
              <input
                id="h-interior"
                value={interiorNumber}
                onChange={(e) => setInteriorNumber(e.target.value)}
                placeholder="Opcional"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="h-family" className="text-sm font-semibold text-ink">
                Familia <span className="font-normal text-stone">(opcional)</span>
              </label>
              <input
                id="h-family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Familia Hernández"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-cantera px-4 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
            >
              Agregar
            </button>
          </form>
          {houseError && (
            <p role="alert" className="mt-3 rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
              {houseError}
            </p>
          )}
        </div>

        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <thead className="border-b border-line bg-sand-2 text-[13px] font-semibold tracking-[0.06em] text-stone uppercase">
              <tr>
                <th className="px-4 py-3">Casa</th>
                <th className="px-4 py-3">Número Interior</th>
                <th className="px-4 py-3">Familia</th>
                <th className="px-4 py-3 text-right">Usuarios</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {db.houses.map((house) => {
                const count = db.users.filter((u) => u.houseId === house.id).length;
                return (
                  <tr key={house.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                      {formatHouseLabel(house)}
                    </td>
                    <td className="px-4 py-2.5">{house.interiorNumber || '—'}</td>
                    <td className="px-4 py-2.5">{house.familyName || '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          house.active ? 'bg-ok-bg text-ok' : 'bg-sand-2 text-stone'
                        }`}
                      >
                        {house.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`Editar ${formatHouseLabel(house)}`}
                        onClick={() => setEditingHouse(house)}
                        className="inline-flex h-10 items-center justify-center rounded-[10px] px-3 text-stone hover:bg-sand-2 hover:text-ink"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Usuarios */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-semibold text-ink">Usuarios</h2>
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="w-full min-w-[680px] text-left text-[15px]">
            <thead className="border-b border-line bg-sand-2 text-[13px] font-semibold tracking-[0.06em] text-stone uppercase">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-3 py-3">Rol</th>
                <th className="px-3 py-3">Casa</th>
                <th className="px-3 py-3">Autos / QR</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {db.users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-night px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gold-light">
                          {u.residentKey}
                        </span>
                        <span className="font-semibold text-ink">{u.name}</span>
                      </div>
                      <span className="text-xs text-stone">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{ROLE_LABELS[u.role]}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {u.houseId ? formatHouseLabel(houseMap.get(u.houseId)) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sand-2 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-ink-soft">
                        <Car className="size-3.5 text-cantera" />
                        {u.carCount} {u.carCount === 1 ? 'auto' : 'autos'} ·{' '}
                        {u.vehicleQrCodes.length} QR
                      </span>
                      {u.vehicleQrCodes.some((v) => v.plate || v.model || v.color) && (
                        <div className="flex flex-col gap-0.5">
                          {u.vehicleQrCodes.map((v) => {
                            const specs = formatVehicleSummary(v);
                            return specs ? (
                              <span key={v.code} className="text-[11px] text-stone">
                                {v.label}: {specs}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.active ? 'bg-ok-bg text-ok' : 'bg-sand-2 text-stone'
                      }`}
                    >
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPassModalUserId(u.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cantera/30 bg-cantera-soft px-3 text-xs font-semibold text-cantera transition-colors hover:bg-cantera hover:text-white"
                      >
                        <QrCode className="size-3.5" />
                        Generar pase de entrada
                      </button>
                      <button
                        type="button"
                        aria-label={`Editar a ${u.name}`}
                        onClick={() => setEditingUser(u)}
                        className="inline-flex h-9 items-center justify-center rounded-[10px] px-2.5 text-stone hover:bg-sand-2 hover:text-ink"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit House Modal */}
      {editingHouse && (
        <EditHouseModal
          house={editingHouse}
          onClose={() => setEditingHouse(null)}
          onSave={(patch) => {
            const err = onUpdateHouse(editingHouse.id, patch);
            if (!err) setEditingHouse(null);
            return err;
          }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          db={db}
          user={editingUser}
          houses={db.houses}
          onClose={() => setEditingUser(null)}
          onSave={(patch) => {
            const err = onUpdateUser(editingUser.id, patch);
            if (!err) setEditingUser(null);
            return err;
          }}
        />
      )}

      {/* Entry Pass Corbatín Modal (19cm x 9cm) */}
      {passModalUser && (
        <EntryPassModal
          user={passModalUser}
          house={passModalUser.houseId ? houseMap.get(passModalUser.houseId) ?? null : null}
          onClose={() => setPassModalUserId(null)}
          onNotify={onNotify}
          onScanQr={onScanQr}
        />
      )}
    </>
  );
}

function EditHouseModal({
  house,
  onClose,
  onSave,
}: {
  house: House;
  onClose: () => void;
  onSave: (
    patch: Partial<Pick<House, 'street' | 'number' | 'interiorNumber' | 'familyName' | 'active'>>,
  ) => string | null;
}) {
  const [street, setStreet] = useState(house.street);
  const [number, setNumber] = useState(house.number);
  const [interiorNumber, setInteriorNumber] = useState(house.interiorNumber ?? '');
  const [familyName, setFamilyName] = useState(house.familyName);
  const [active, setActive] = useState(house.active);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = onSave({
      street,
      number,
      interiorNumber: interiorNumber || null,
      familyName,
      active,
    });
    setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[20px] border border-line bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-2xl font-semibold text-ink">Editar casa</h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-stone hover:bg-sand-2"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Calle</label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="h-11 rounded-[10px] border border-input px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Número</label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="h-11 rounded-[10px] border border-input px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Número Interior</label>
              <input
                value={interiorNumber}
                onChange={(e) => setInteriorNumber(e.target.value)}
                className="h-11 rounded-[10px] border border-input px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Familia</label>
              <input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="h-11 rounded-[10px] border border-input px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 accent-[#8A641B]"
            />
            Casa activa
          </label>

          {error && <p className="text-sm font-medium text-bad">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-chip-line px-4 text-sm font-semibold text-ink hover:bg-sand-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-11 rounded-xl bg-cantera px-5 text-sm font-semibold text-white hover:bg-cantera-dark"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({
  db,
  user,
  houses,
  onClose,
  onSave,
}: {
  db: PortalDatabase;
  user: PortalUser;
  houses: House[];
  onClose: () => void;
  onSave: (patch: UpdateUserPatch) => string | null;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [houseId, setHouseId] = useState(user.houseId ?? '');
  const [carCount, setCarCount] = useState(String(user.carCount));
  const [vehicles, setVehicles] = useState<VehicleDetailsInput[]>(() =>
    resizeVehicleDrafts(
      user.vehicleQrCodes.map((v) => ({
        plate: v.plate ?? '',
        color: v.color ?? '',
        model: v.model ?? '',
      })),
      user.carCount,
    ),
  );
  const [active, setActive] = useState(user.active);
  const [error, setError] = useState<string | null>(null);

  const otherUsage = getRoleUsage(db, user.id);
  const treasurerFull = active && otherUsage.treasurer >= ROLE_LIMITS.treasurer;
  const adminFull = active && otherUsage.admin >= ROLE_LIMITS.admin;

  const handleCarCountChange = (raw: string) => {
    setCarCount(raw);
    const parsed = Math.max(0, Math.min(10, Number(raw) || 0));
    setVehicles((prev) => resizeVehicleDrafts(prev, parsed));
  };

  const handleVehicleChange = (idx: number, field: keyof VehicleDetailsInput, value: string) => {
    setVehicles((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedCars = Math.max(0, Math.min(10, Number(carCount) || 0));
    const hasAnyVehicleDetail = vehicles.some(
      (v) => Boolean(v.plate?.trim() || v.color?.trim() || v.model?.trim()),
    );
    const err = onSave({
      name,
      phone,
      role,
      houseId: houseId || null,
      carCount: parsedCars,
      vehicles: hasAnyVehicleDetail ? resizeVehicleDrafts(vehicles, parsedCars) : undefined,
      active,
    });
    if (err) {
      setError(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[20px] border border-line bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-2xl font-semibold text-ink">Editar usuario</h3>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-stone hover:bg-sand-2"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-[10px] border border-input px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Número de teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="442 123 4567"
                className="h-11 rounded-[10px] border border-input px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Rol</label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as UserRole);
                  if (error) setError(null);
                }}
                className="h-11 rounded-[10px] border border-input bg-white px-3 text-sm font-medium outline-none focus-visible:border-cantera"
              >
                <option value="resident">Vecino</option>
                <option value="treasurer" disabled={treasurerFull}>
                  Tesorería ({otherUsage.treasurer}/{ROLE_LIMITS.treasurer}
                  {treasurerFull ? ' · Lleno' : ''})
                </option>
                <option value="admin" disabled={adminFull}>
                  Mesa directiva ({otherUsage.admin}/{ROLE_LIMITS.admin}
                  {adminFull ? ' · Lleno' : ''})
                </option>
                <option value="guard">Caseta</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-ink">Número de autos</label>
              <input
                type="number"
                min={0}
                max={10}
                value={carCount}
                onChange={(e) => handleCarCountChange(e.target.value)}
                className="h-11 rounded-[10px] border border-input px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-ink">Casa asignada</label>
            <select
              value={houseId}
              onChange={(e) => setHouseId(e.target.value)}
              className="h-11 rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
            >
              <option value="">Sin casa</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  {formatHouseLabel(h)}
                </option>
              ))}
            </select>
          </div>

          {vehicles.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink">
                {vehicles.length === 1
                  ? 'Datos del automóvil'
                  : `Datos de los automóviles (${vehicles.length})`}
              </span>
              {vehicles.map((v, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-sand/60 p-3"
                >
                  <span className="text-xs font-semibold text-cantera uppercase">
                    Automóvil {idx + 1}
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      value={v.plate ?? ''}
                      onChange={(e) =>
                        handleVehicleChange(idx, 'plate', e.target.value.toUpperCase())
                      }
                      placeholder="Placa"
                      className="h-9 rounded-lg border border-input bg-white px-2.5 font-mono text-sm uppercase outline-none focus-visible:border-cantera"
                    />
                    <input
                      value={v.color ?? ''}
                      onChange={(e) => handleVehicleChange(idx, 'color', e.target.value)}
                      placeholder="Color"
                      className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-cantera"
                    />
                    <input
                      value={v.model ?? ''}
                      onChange={(e) => handleVehicleChange(idx, 'model', e.target.value)}
                      placeholder="Modelo"
                      className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-cantera"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => {
                setActive(e.target.checked);
                if (error) setError(null);
              }}
              className="size-4 accent-[#8A641B]"
            />
            Usuario activo
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-chip-line px-4 text-sm font-semibold text-ink hover:bg-sand-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-11 rounded-xl bg-cantera px-5 text-sm font-semibold text-white hover:bg-cantera-dark"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================== 8. BITÁCORA DE CAMBIOS ==================== */

interface AdminAuditLogViewProps {
  db: PortalDatabase;
}

export function AdminAuditLogView({ db }: AdminAuditLogViewProps) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Control
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">
            Bitácora de cambios
          </h1>
        </div>
      </header>

      <p className="text-sm text-stone">
        Últimos 300 movimientos. Cada acción del tesorero guarda el valor anterior y el nuevo.
      </p>

      <ol className="flex flex-col gap-2">
        {db.auditLog.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-1 rounded-[14px] border border-line bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold text-ink">
                {entry.actorName} · {entry.action}
              </span>
              <span className="text-[13px] text-stone">{entry.timestampLabel}</span>
            </div>
            {entry.beforeSummary && (
              <span className="text-[13px] break-words text-stone">
                Antes: {entry.beforeSummary}
              </span>
            )}
            {entry.afterSummary && (
              <span className="text-[13px] break-words text-stone">
                Después: {entry.afterSummary}
              </span>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
