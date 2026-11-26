import { useState, type FormEvent } from 'react';
import {
  Car,
  FileSpreadsheet,
  Pencil,
  Printer,
  QrCode,
  Search,
  Settings2,
  Trash2,
  UserRoundPlus,
  UserSearch,
  X,
} from 'lucide-react';
import type {
  AppRoute,
  PortalDatabase,
  PortalUser,
  ScannedResidentData,
  VehicleDetailsInput,
} from '../types/portal';
import {
  buildVehicleScanUrl,
  createScannedResidentData,
  formatHouseLabel,
  formatVehicleSummary,
  generateNextResidentKey,
  isAdminUser,
  isPrimaryAdminUser,
  RESIDENTIAL_STREETS,
  ROLE_LABELS,
  type ExcelImportBatchResult,
  type InviteUserInput,
  type ParsedExcelResidentRow,
  type UpdateUserPatch,
} from '../utils/portalLogic';
import { EditResidentModal } from './EditResidentModal';
import { EntryPassModal } from './EntryPassModal';
import { ImportExcelModal } from './ImportExcelModal';
import { QrCodeSvg } from './QrCodeSvg';

interface ResidentHomeProps {
  db: PortalDatabase;
  user: PortalUser;
  onNavigate: (route: AppRoute) => void;
  onLogout?: () => void;
  onAddResident: (input: InviteUserInput) => { user?: PortalUser; error: string | null };
  onImportResidents: (rows: ParsedExcelResidentRow[]) => ExcelImportBatchResult;
  onUpdateResident: (userId: string, patch: UpdateUserPatch) => string | null;
  onDeleteResident: (userId: string) => string | null;
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

export function ResidentHome({
  db,
  user,
  onNavigate,
  onAddResident,
  onImportResidents,
  onUpdateResident,
  onDeleteResident,
  onScanQr,
  onNotify,
}: ResidentHomeProps) {
  const [showAddResident, setShowAddResident] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showConsultResident, setShowConsultResident] = useState(false);
  const [consultQuery, setConsultQuery] = useState('');
  const [editingResident, setEditingResident] = useState<PortalUser | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Add resident modal form state
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resStreet, setResStreet] = useState<string>(RESIDENTIAL_STREETS[0]);
  const [resExtNumber, setResExtNumber] = useState('');
  const [resIntNumber, setResIntNumber] = useState('');
  const [resCarCount, setResCarCount] = useState('1');
  const [resVehicles, setResVehicles] = useState<VehicleDetailsInput[]>([{ plate: '' }]);
  const [resError, setResError] = useState<string | null>(null);
  const [createdResident, setCreatedResident] = useState<PortalUser | null>(null);
  const [showPassForUser, setShowPassForUser] = useState<PortalUser | null>(null);

  const houseMap = new Map(db.houses.map((h) => [h.id, h]));
  const isAdmin = isAdminUser(user);
  const canAccessAdmin = isAdmin;
  const nextResidentKey = generateNextResidentKey(db.users);

  const normalizedConsultQuery = consultQuery.trim().toLowerCase();
  const filteredResidents = db.users.filter((candidate) => {
    if (!normalizedConsultQuery) return true;
    const candidateHouse = candidate.houseId ? houseMap.get(candidate.houseId) : null;
    const searchable = [
      candidate.residentKey,
      candidate.name,
      candidate.email,
      candidate.phone ?? '',
      ROLE_LABELS[candidate.role],
      candidateHouse ? formatHouseLabel(candidateHouse) : '',
      ...candidate.vehicleQrCodes.flatMap((v) => [
        v.code,
        v.plate ?? '',
        v.model ?? '',
        v.color ?? '',
      ]),
    ]
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalizedConsultQuery);
  });

  const openAddResidentModal = () => {
    setResError(null);
    setCreatedResident(null);
    setResStreet((prev) => prev || RESIDENTIAL_STREETS[0]);
    setResVehicles((prev) => resizeVehicleDrafts(prev, Number(resCarCount) || 0));
    setShowAddResident(true);
  };

  const handleCarCountChange = (raw: string) => {
    setResCarCount(raw);
    const parsed = Math.max(0, Math.min(10, Number(raw) || 0));
    setResVehicles((prev) => resizeVehicleDrafts(prev, parsed));
    if (resError) setResError(null);
  };

  const handleVehicleFieldChange = (
    idx: number,
    field: keyof VehicleDetailsInput,
    value: string,
  ) => {
    setResVehicles((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
    if (resError) setResError(null);
  };

  const handleAddResidentSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedCars = Math.max(0, Math.min(10, Number(resCarCount) || 0));
    const vehiclesPayload = resizeVehicleDrafts(resVehicles, parsedCars).map((v) => ({
      plate: v.plate ?? '',
    }));
    const result = onAddResident({
      name: resName,
      phone: resPhone,
      role: 'resident',
      houseId: null,
      street: resStreet,
      exteriorNumber: resExtNumber,
      interiorNumber: resIntNumber,
      carCount: parsedCars,
      vehicles: vehiclesPayload,
    });
    if (result.error) {
      setResError(result.error);
      return;
    }
    setResError(null);
    setResName('');
    setResPhone('');
    setResStreet(RESIDENTIAL_STREETS[0]);
    setResExtNumber('');
    setResIntNumber('');
    setResCarCount('1');
    setResVehicles([{ plate: '' }]);
    setCreatedResident(result.user ?? null);
  };

  const createdResidentHouse = createdResident?.houseId
    ? db.houses.find((h) => h.id === createdResident.houseId) ?? null
    : null;

  const passHouse = showPassForUser?.houseId
    ? db.houses.find((h) => h.id === showPassForUser.houseId) ?? null
    : null;

  return (
    <div className="w-full md:px-6 md:pt-5 lg:px-8 lg:pt-6">
      <header className="relative overflow-hidden border-b border-gold/25 bg-gradient-to-b from-[#1D1813] via-night to-[#221C15] px-5 pt-[max(env(safe-area-inset-top),2.25rem)] pb-7 md:rounded-[28px] md:border md:border-gold/25 md:px-8 md:pt-7 md:pb-8 md:shadow-[0_18px_40px_rgba(23,20,17,0.16)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-[34px] leading-[1.05] font-semibold tracking-tight text-white md:text-[40px]">
              {user.name}
            </h1>
          </div>

          {canAccessAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('/admin/padron')}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-gold/45 bg-gold/14 px-4 text-sm font-semibold whitespace-nowrap text-gold-light transition-colors hover:border-gold/75 hover:bg-gold/25"
            >
              <Settings2 className="size-4 text-gold" />
              Administración
            </button>
          )}
        </div>
      </header>

      {/* Quick Actions — Reorganized 5 controls for admin (2 for non-admin) */}
      <section
        className={`grid gap-2.5 px-4 pt-6 pb-8 md:px-0 ${
          isAdmin ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2'
        }`}
      >
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={openAddResidentModal}
              className="group flex flex-col items-center justify-center gap-2 rounded-[16px] border border-gold/40 bg-gradient-to-br from-white to-cantera-soft/45 px-2 py-3 text-center transition-all duration-150 hover:border-gold hover:shadow-[0_8px_22px_rgba(138,100,27,0.14)] active:translate-y-px"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-night text-gold shadow-sm transition-colors group-hover:bg-cantera group-hover:text-white">
                <UserRoundPlus className="size-[18px]" />
              </span>
              <span className="text-[12px] leading-[1.2] font-semibold text-ink">
                Agregar <br />
                residente
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setConsultQuery('');
                setConfirmDeleteId(null);
                setShowConsultResident(true);
              }}
              className="group flex flex-col items-center justify-center gap-2 rounded-[16px] border border-gold/40 bg-gradient-to-br from-white to-cantera-soft/45 px-2 py-3 text-center transition-all duration-150 hover:border-gold hover:shadow-[0_8px_22px_rgba(138,100,27,0.14)] active:translate-y-px"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-night text-gold shadow-sm transition-colors group-hover:bg-cantera group-hover:text-white">
                <UserSearch className="size-[18px]" />
              </span>
              <span className="text-[12px] leading-[1.2] font-semibold text-ink">
                Consultar <br />
                residente
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowImportExcel(true)}
              className="group flex flex-col items-center justify-center gap-2 rounded-[16px] border border-gold/40 bg-gradient-to-br from-white to-cantera-soft/45 px-2 py-3 text-center transition-all duration-150 hover:border-gold hover:shadow-[0_8px_22px_rgba(138,100,27,0.14)] active:translate-y-px"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-night text-gold shadow-sm transition-colors group-hover:bg-cantera group-hover:text-white">
                <FileSpreadsheet className="size-[18px]" />
              </span>
              <span className="text-[12px] leading-[1.2] font-semibold text-ink">
                Importar <br />
                Excel
              </span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onNavigate('/corbatines')}
          className="group flex flex-col items-center justify-center gap-2 rounded-[16px] border border-gold/40 bg-gradient-to-br from-white to-cantera-soft/45 px-2 py-3 text-center transition-all duration-150 hover:border-gold hover:shadow-[0_8px_22px_rgba(138,100,27,0.14)] active:translate-y-px"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-night text-gold shadow-sm transition-colors group-hover:bg-cantera group-hover:text-white">
            <Printer className="size-[18px]" />
          </span>
          <span className="text-[12px] leading-[1.2] font-semibold text-ink">
            Imprimir <br />
            corbatín
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/visitas')}
          className={`group flex flex-col items-center justify-center gap-2 rounded-[16px] border border-line bg-white px-2 py-3 text-center transition-all duration-150 hover:border-gold/55 hover:shadow-[0_8px_22px_rgba(138,100,27,0.10)] active:translate-y-px ${
            isAdmin ? 'col-span-2 sm:col-span-1' : ''
          }`}
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-gold/25 bg-cantera-soft text-cantera transition-colors group-hover:bg-cantera group-hover:text-white">
            <QrCode className="size-[18px]" />
          </span>
          <span className="text-[12px] leading-[1.2] font-semibold text-ink">
            Mis <br />
            pases
          </span>
        </button>
      </section>

      {/* Agregar residente modal (admin only) */}
      {isAdmin && showAddResident && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-resident-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
        >
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[22px] border border-gold/30 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3.5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="add-resident-title"
                    className="font-heading text-2xl font-semibold text-ink"
                  >
                    Agregar residente
                  </h2>
                  {!createdResident && (
                    <span className="rounded-md bg-night px-2 py-0.5 font-mono text-xs font-semibold text-gold-light">
                      {nextResidentKey}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-stone">
                  Genera clave consecutiva ({nextResidentKey}) y un código QR por automóvil con los datos del titular.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setShowAddResident(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-sand-2 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            {createdResident ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-gold/35 bg-cantera-soft/50 p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold tracking-[0.08em] text-cantera uppercase">
                        Registro completado · QR por automóvil
                      </p>
                      <span className="rounded-md bg-night px-2 py-0.5 font-mono text-xs font-semibold text-gold-light">
                        {createdResident.residentKey}
                      </span>
                    </div>
                    <p className="mt-1 text-base font-semibold text-ink">
                      Titular: {createdResident.name}
                    </p>
                    {(createdResident.email || createdResident.phone) && (
                      <p className="text-xs text-stone">
                        {[
                          createdResident.email,
                          createdResident.phone ? `Tel. ${createdResident.phone}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {createdResidentHouse && (
                      <p className="mt-0.5 text-xs font-medium text-ink-soft">
                        {formatHouseLabel(createdResidentHouse)}
                      </p>
                    )}
                  </div>

                  {createdResident.vehicleQrCodes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-chip-line bg-white/80 px-3 py-4 text-center text-xs text-stone">
                      Sin automóviles registrados. No se generaron códigos QR vehiculares.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {createdResident.vehicleQrCodes.map((v) => {
                        const specs = formatVehicleSummary(v);
                        const qrUrl = buildVehicleScanUrl(
                          createdResident,
                          v,
                          createdResidentHouse,
                        );
                        const scanData = createScannedResidentData(
                          createdResident,
                          v,
                          createdResidentHouse,
                        );
                        return (
                          <div
                            key={v.code}
                            className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5"
                          >
                            <button
                              type="button"
                              onClick={() => onScanQr(scanData)}
                              aria-label={`Escanear QR ${v.code}`}
                              className="shrink-0 rounded-lg transition-transform hover:scale-105"
                            >
                              <QrCodeSvg code={qrUrl} size={52} />
                            </button>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                                <Car className="size-3.5 shrink-0 text-cantera" />
                                {v.label} · {createdResident.name}
                              </span>
                              {specs && (
                                <span className="truncate text-xs font-medium text-ink-soft">
                                  {specs}
                                </span>
                              )}
                              <span className="truncate text-[11px] text-stone">
                                {createdResidentHouse
                                  ? formatHouseLabel(createdResidentHouse)
                                  : 'Sin casa'}
                                {createdResident.phone ? ` · Tel. ${createdResident.phone}` : ''}
                              </span>
                              <span className="font-mono text-[11px] text-stone">{v.code}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {createdResident.vehicleQrCodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPassForUser(createdResident)}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cantera px-4 text-sm font-semibold text-white transition-colors hover:bg-cantera-dark"
                    >
                      <QrCode className="size-4" />
                      Generar pase de entrada
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatedResident(null)}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-chip-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
                    >
                      Agregar otro
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddResident(false)}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-chip-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddResidentSubmit} className="flex flex-col gap-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="home-res-name" className="text-sm font-semibold text-ink">
                      Nombre completo
                    </label>
                    <input
                      id="home-res-name"
                      required
                      value={resName}
                      onChange={(e) => {
                        setResName(e.target.value);
                        if (resError) setResError(null);
                      }}
                      placeholder="Ej. Ana Morales"
                      className="h-11 w-full rounded-xl border border-input bg-white px-3.5 text-sm font-medium text-ink outline-none placeholder:text-stone/60 focus-visible:border-cantera"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="home-res-phone" className="text-sm font-semibold text-ink">
                      Número de teléfono
                    </label>
                    <input
                      id="home-res-phone"
                      type="tel"
                      value={resPhone}
                      onChange={(e) => setResPhone(e.target.value)}
                      placeholder="Ej. 442 123 4567"
                      className="h-11 w-full rounded-xl border border-input bg-white px-3.5 text-sm font-medium text-ink outline-none placeholder:text-stone/60 focus-visible:border-cantera"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="home-res-house" className="text-sm font-semibold text-ink">
                      Calle / Avenida
                    </label>
                    <select
                      id="home-res-house"
                      value={resStreet}
                      onChange={(e) => {
                        setResStreet(e.target.value);
                        if (resError) setResError(null);
                      }}
                      className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-medium text-ink outline-none focus-visible:border-cantera"
                    >
                      <option value="">Sin casa</option>
                      {RESIDENTIAL_STREETS.map((street) => (
                        <option key={street} value={street}>
                          {street}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="home-res-cars" className="text-sm font-semibold text-ink">
                      Número de autos
                    </label>
                    <input
                      id="home-res-cars"
                      type="number"
                      min={0}
                      max={10}
                      value={resCarCount}
                      onChange={(e) => handleCarCountChange(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-medium text-ink outline-none focus-visible:border-cantera"
                    />
                  </div>
                </div>

                {resStreet && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="home-res-ext" className="text-sm font-semibold text-ink">
                        Número ext
                      </label>
                      <input
                        id="home-res-ext"
                        required
                        value={resExtNumber}
                        onChange={(e) => {
                          setResExtNumber(e.target.value);
                          if (resError) setResError(null);
                        }}
                        placeholder="Ej. 389"
                        className="h-11 w-full rounded-xl border border-input bg-white px-3.5 text-sm font-medium text-ink outline-none placeholder:text-stone/60 focus-visible:border-cantera"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="home-res-int" className="text-sm font-semibold text-ink">
                        Num Int <span className="font-normal text-stone">(opcional)</span>
                      </label>
                      <input
                        id="home-res-int"
                        value={resIntNumber}
                        onChange={(e) => setResIntNumber(e.target.value)}
                        placeholder="Ej. 2B"
                        className="h-11 w-full rounded-xl border border-input bg-white px-3.5 text-sm font-medium text-ink outline-none placeholder:text-stone/60 focus-visible:border-cantera"
                      />
                    </div>
                  </div>
                )}

                {/* Per-vehicle plate when carCount >= 1 */}
                {resVehicles.length > 0 && (
                  <div className="flex flex-col gap-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">
                        {resVehicles.length === 1
                          ? 'Datos del automóvil'
                          : `Datos de los automóviles (${resVehicles.length})`}
                      </span>
                      <span className="text-xs text-stone">Placa</span>
                    </div>

                    {resVehicles.map((vehicle, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-2.5 rounded-2xl border border-line bg-sand/60 p-3.5"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] text-cantera uppercase">
                          <Car className="size-3.5" />
                          Automóvil {idx + 1}
                        </div>
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor={`home-car-${idx}-plate`}
                            className="text-xs font-semibold text-ink-soft"
                          >
                            Placa
                          </label>
                          <input
                            id={`home-car-${idx}-plate`}
                            required
                            value={vehicle.plate ?? ''}
                            onChange={(e) =>
                              handleVehicleFieldChange(idx, 'plate', e.target.value.toUpperCase())
                            }
                            placeholder="ABC-123-A"
                            className="h-10 w-full rounded-lg border border-input bg-white px-2.5 font-mono text-sm font-medium uppercase text-ink outline-none placeholder:font-sans placeholder:normal-case placeholder:text-stone/60 focus-visible:border-cantera"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {resError && (
                  <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
                    {resError}
                  </p>
                )}

                <div className="mt-1 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddResident(false)}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-cantera px-4 text-sm font-semibold text-white transition-colors hover:bg-cantera-dark"
                  >
                    Guardar residente
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Consultar residente modal (admin only — with Edit & Delete actions) */}
      {isAdmin && showConsultResident && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consult-resident-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
        >
          <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-[22px] border border-gold/30 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3.5">
              <div>
                <h2
                  id="consult-resident-title"
                  className="font-heading text-2xl font-semibold text-ink"
                >
                  Consultar residente
                </h2>
                <p className="mt-0.5 text-xs text-stone">
                  Busca, modifica o elimina registros por clave (RES001), nombre, correo, dirección o placa.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar consulta"
                onClick={() => setShowConsultResident(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-sand-2 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone" />
              <input
                type="search"
                aria-label="Buscar residente"
                value={consultQuery}
                onChange={(e) => setConsultQuery(e.target.value)}
                placeholder="Ej. RES001, Daniel Cruz, Av. Cantera o placa..."
                className="h-11 w-full rounded-xl border border-input bg-sand/50 pr-3.5 pl-10 text-sm font-medium text-ink outline-none placeholder:text-stone/60 focus-visible:border-cantera focus-visible:bg-white"
              />
            </div>

            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
              {filteredResidents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-chip-line bg-sand/40 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-stone">
                    No se encontraron residentes con ese criterio.
                  </p>
                </div>
              ) : (
                filteredResidents.map((resident) => {
                  const rHouse = resident.houseId ? houseMap.get(resident.houseId) ?? null : null;
                  const primary = isPrimaryAdminUser(resident);
                  const confirmingDelete = confirmDeleteId === resident.id;
                  return (
                    <article
                      key={resident.id}
                      className="flex flex-col gap-2.5 rounded-2xl border border-line bg-sand/45 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-night px-2 py-0.5 font-mono text-[11px] font-semibold text-gold-light">
                              {resident.residentKey}
                            </span>
                            <span className="text-sm font-semibold text-ink">{resident.name}</span>
                          </div>
                          {(resident.email || resident.phone) && (
                            <span className="truncate text-xs text-stone">
                              {[resident.email, resident.phone ? `Tel. ${resident.phone}` : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                          <span className="text-xs font-medium text-ink-soft">
                            {rHouse ? formatHouseLabel(rHouse) : 'Sin casa asignada'} ·{' '}
                            {ROLE_LABELS[resident.role]}
                          </span>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            resident.active ? 'bg-ok-bg text-ok' : 'bg-sand-2 text-stone'
                          }`}
                        >
                          {resident.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {resident.vehicleQrCodes.length > 0 && (
                        <div className="flex flex-col gap-1.5 border-t border-line/80 pt-2">
                          {resident.vehicleQrCodes.map((v) => {
                            const specs = formatVehicleSummary(v);
                            return (
                              <div
                                key={v.code}
                                className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs"
                              >
                                <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-medium text-ink">
                                  <Car className="size-3.5 shrink-0 text-cantera" />
                                  <span className="truncate">
                                    {v.label}
                                    {specs ? ` · ${specs}` : ''}
                                  </span>
                                </span>
                                <span className="shrink-0 font-mono text-[11px] text-stone">
                                  {v.code}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Admin actions: Ver pase, Modificar, Eliminar */}
                      {confirmingDelete ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bad/30 bg-bad-bg/70 px-3 py-2 text-xs">
                          <span className="font-semibold text-bad">
                            ¿Eliminar definitivamente a {resident.name}?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-8 rounded-lg border border-chip-line bg-white px-2.5 font-semibold text-ink hover:bg-sand-2"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const err = onDeleteResident(resident.id);
                                if (!err) {
                                  setConfirmDeleteId(null);
                                }
                              }}
                              className="h-8 rounded-lg bg-bad px-3 font-semibold text-white hover:opacity-90"
                            >
                              Sí, eliminar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 border-t border-line/80 pt-2">
                          {resident.vehicleQrCodes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowPassForUser(resident)}
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-cantera/35 bg-white px-3 text-xs font-semibold text-cantera transition-colors hover:bg-cantera hover:text-white"
                            >
                              <QrCode className="size-3.5" />
                              Pase QR
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingResident(resident)}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-chip-line bg-white px-3 text-xs font-semibold text-ink transition-colors hover:bg-sand-2"
                          >
                            <Pencil className="size-3.5 text-cantera" />
                            Modificar
                          </button>
                          {!primary && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(resident.id)}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-bad/30 bg-white px-3 text-xs font-semibold text-bad transition-colors hover:bg-bad-bg"
                            >
                              <Trash2 className="size-3.5" />
                              Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowConsultResident(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {isAdmin && editingResident && (
        <EditResidentModal
          db={db}
          user={editingResident}
          house={editingResident.houseId ? houseMap.get(editingResident.houseId) ?? null : null}
          onClose={() => setEditingResident(null)}
          onSave={(patch) => {
            const err = onUpdateResident(editingResident.id, patch);
            if (!err) setEditingResident(null);
            return err;
          }}
        />
      )}

      {isAdmin && showImportExcel && (
        <ImportExcelModal
          onClose={() => setShowImportExcel(false)}
          onImport={onImportResidents}
          onNotify={onNotify}
        />
      )}

      {showPassForUser && (
        <EntryPassModal
          user={showPassForUser}
          house={passHouse}
          onClose={() => setShowPassForUser(null)}
          onNotify={onNotify}
          onScanQr={onScanQr}
        />
      )}
    </div>
  );
}
