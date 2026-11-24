import { useState, type FormEvent } from 'react';
import { Car, X } from 'lucide-react';
import type { House, PortalDatabase, PortalUser, UserRole, VehicleDetailsInput } from '../types/portal';
import {
  getRoleUsage,
  isPrimaryAdminUser,
  RESIDENTIAL_STREETS,
  ROLE_LIMITS,
  type UpdateUserPatch,
} from '../utils/portalLogic';

interface EditResidentModalProps {
  db: PortalDatabase;
  user: PortalUser;
  house: House | null;
  onClose: () => void;
  onSave: (patch: UpdateUserPatch) => string | null;
}

function resizeVehicleDrafts(
  prev: VehicleDetailsInput[],
  count: number,
): VehicleDetailsInput[] {
  const safe = Math.max(0, Math.min(10, Math.floor(Number.isFinite(count) ? count : 0)));
  return Array.from({ length: safe }, (_, idx) => prev[idx] ?? { plate: '', color: '', model: '' });
}

export function EditResidentModal({
  db,
  user,
  house,
  onClose,
  onSave,
}: EditResidentModalProps) {
  const primaryAdmin = isPrimaryAdminUser(user);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [street, setStreet] = useState(house?.street ?? '');
  const [extNumber, setExtNumber] = useState(house?.number ?? '');
  const [intNumber, setIntNumber] = useState(house?.interiorNumber ?? '');
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

  const streetOptions: string[] =
    street && !RESIDENTIAL_STREETS.includes(street as (typeof RESIDENTIAL_STREETS)[number])
      ? [street, ...RESIDENTIAL_STREETS]
      : [...RESIDENTIAL_STREETS];

  const handleCarCountChange = (raw: string) => {
    setCarCount(raw);
    const parsed = Math.max(0, Math.min(10, Number(raw) || 0));
    setVehicles((prev) => resizeVehicleDrafts(prev, parsed));
    if (error) setError(null);
  };

  const handleVehicleChange = (idx: number, field: keyof VehicleDetailsInput, value: string) => {
    setVehicles((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
    if (error) setError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedCars = Math.max(0, Math.min(10, Number(carCount) || 0));
    const resized = resizeVehicleDrafts(vehicles, parsedCars);
    const hasAnyVehicleDetail = resized.some(
      (v) => Boolean(v.plate?.trim() || v.color?.trim() || v.model?.trim()),
    );
    const normalizedVehicles = resized.map((v) =>
      v.color?.trim() || v.model?.trim()
        ? { plate: v.plate ?? '', color: v.color ?? '', model: v.model ?? '' }
        : { plate: v.plate ?? '' },
    );
    const err = onSave({
      name,
      email,
      phone,
      role: primaryAdmin ? 'admin' : role,
      street,
      exteriorNumber: extNumber,
      interiorNumber: intNumber,
      carCount: parsedCars,
      vehicles: hasAnyVehicleDetail ? normalizedVehicles : undefined,
      active: primaryAdmin ? true : active,
    });
    if (err) {
      setError(err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-resident-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
    >
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[22px] border border-gold/30 bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="edit-resident-modal-title"
                className="font-heading text-2xl font-semibold text-ink"
              >
                Modificar residente
              </h3>
              <span className="rounded-md bg-night px-2 py-0.5 font-mono text-xs font-semibold text-gold-light">
                {user.residentKey}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone">
              Actualiza datos personales, domicilio, rol y automóviles registrados.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-stone hover:bg-sand-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-res-name" className="text-sm font-semibold text-ink">
                Nombre completo
              </label>
              <input
                id="edit-res-name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                className="h-11 rounded-xl border border-input px-3.5 text-sm font-medium outline-none focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-res-phone" className="text-sm font-semibold text-ink">
                Número de teléfono
              </label>
              <input
                id="edit-res-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="442 123 4567"
                className="h-11 rounded-xl border border-input px-3.5 text-sm font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="edit-res-email" className="text-sm font-semibold text-ink">
              Correo electrónico <span className="font-normal text-stone">(opcional)</span>
            </label>
            <input
              id="edit-res-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="residente@correo.com"
              className="h-11 rounded-xl border border-input px-3.5 text-sm font-medium outline-none focus-visible:border-cantera"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-res-street" className="text-sm font-semibold text-ink">
                Calle / Avenida
              </label>
              <select
                id="edit-res-street"
                value={street}
                onChange={(e) => {
                  setStreet(e.target.value);
                  if (error) setError(null);
                }}
                className="h-11 rounded-xl border border-input bg-white px-3 text-sm font-medium outline-none focus-visible:border-cantera"
              >
                <option value="">Sin casa</option>
                {streetOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="edit-res-cars" className="text-sm font-semibold text-ink">
                Número de autos
              </label>
              <input
                id="edit-res-cars"
                type="number"
                min={0}
                max={10}
                value={carCount}
                onChange={(e) => handleCarCountChange(e.target.value)}
                className="h-11 rounded-xl border border-input px-3.5 text-sm font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          {street && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-res-ext" className="text-sm font-semibold text-ink">
                  Número ext
                </label>
                <input
                  id="edit-res-ext"
                  required
                  value={extNumber}
                  onChange={(e) => {
                    setExtNumber(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Ej. 389"
                  className="h-11 rounded-xl border border-input px-3.5 text-sm font-medium outline-none focus-visible:border-cantera"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-res-int" className="text-sm font-semibold text-ink">
                  Num Int <span className="font-normal text-stone">(opcional)</span>
                </label>
                <input
                  id="edit-res-int"
                  value={intNumber}
                  onChange={(e) => setIntNumber(e.target.value)}
                  placeholder="Ej. 2B"
                  className="h-11 rounded-xl border border-input px-3.5 text-sm font-medium outline-none focus-visible:border-cantera"
                />
              </div>
            </div>
          )}

          {!primaryAdmin && (
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-res-role" className="text-sm font-semibold text-ink">
                Rol
              </label>
              <select
                id="edit-res-role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as UserRole);
                  if (error) setError(null);
                }}
                className="h-11 rounded-xl border border-input bg-white px-3 text-sm font-medium outline-none focus-visible:border-cantera"
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
          )}

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
                  className="flex flex-col gap-2 rounded-2xl border border-line bg-sand/60 p-3"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cantera uppercase">
                    <Car className="size-3.5" />
                    Automóvil {idx + 1}
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      aria-label={`Placa automóvil ${idx + 1}`}
                      value={v.plate ?? ''}
                      onChange={(e) =>
                        handleVehicleChange(idx, 'plate', e.target.value.toUpperCase())
                      }
                      placeholder="Placa"
                      className="h-9 rounded-lg border border-input bg-white px-2.5 font-mono text-sm uppercase outline-none focus-visible:border-cantera"
                    />
                    <input
                      aria-label={`Color automóvil ${idx + 1}`}
                      value={v.color ?? ''}
                      onChange={(e) => handleVehicleChange(idx, 'color', e.target.value)}
                      placeholder="Color"
                      className="h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-cantera"
                    />
                    <input
                      aria-label={`Modelo automóvil ${idx + 1}`}
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

          {!primaryAdmin && (
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
              Residente activo
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2.5">
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
