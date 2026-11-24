import { useState } from 'react';
import { Bell, BellOff, Car, ChevronLeft, Download, LogOut, QrCode, Shield } from 'lucide-react';
import type { AppRoute, PortalDatabase, PortalUser, ScannedResidentData } from '../types/portal';
import {
  buildVehicleScanUrl,
  createScannedResidentData,
  formatHouseLabel,
  formatVehicleSummary,
  ROLE_LABELS,
} from '../utils/portalLogic';
import { EntryPassModal } from './EntryPassModal';
import { QrCodeSvg } from './QrCodeSvg';

interface ResidentAccountProps {
  db: PortalDatabase;
  user: PortalUser;
  onNavigate: (route: AppRoute) => void;
  onTogglePush: () => void;
  onInstallApp: () => void;
  onScanQr: (data: ScannedResidentData) => void;
  onNotify: (message: string) => void;
  onLogout: () => void;
}

export function ResidentAccount({
  db,
  user,
  onNavigate,
  onTogglePush,
  onInstallApp,
  onScanQr,
  onNotify,
  onLogout,
}: ResidentAccountProps) {
  const [showEntryPass, setShowEntryPass] = useState(false);
  const house = user.houseId ? db.houses.find((h) => h.id === user.houseId) ?? null : null;
  const firstVehicle = user.vehicleQrCodes[0] ?? null;

  return (
    <div>
      <header className="flex flex-col gap-2 px-4 pt-[max(env(safe-area-inset-top),2.5rem)] pb-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Volver"
            onClick={() => onNavigate('/')}
            className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink hover:bg-white/60"
          >
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="flex-1 font-heading text-[28px] leading-tight font-semibold text-ink">
            Mi cuenta
          </h1>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-8">
        <section className="flex flex-col gap-1 rounded-[18px] border border-line bg-white p-[18px]">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-night px-2 py-0.5 font-mono text-xs font-semibold text-gold-light">
              {user.residentKey}
            </span>
            <span className="text-lg font-semibold text-ink">{user.name}</span>
          </div>
          <span className="text-sm text-stone">
            {user.email}
            {user.phone ? ` · Tel. ${user.phone}` : ''}
          </span>
          <span className="text-sm text-stone">
            {ROLE_LABELS[user.role]}
            {house ? ` · ${formatHouseLabel(house)}` : ''}
          </span>
        </section>

        {/* Vehicle QR Card (1 per car with titular data) + Entry Pass button */}
        <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-[18px]">
          <div className="flex items-center gap-3">
            {firstVehicle && (
              <button
                type="button"
                onClick={() => onScanQr(createScannedResidentData(user, firstVehicle, house))}
                aria-label="Escanear código QR vehicular"
                className="shrink-0 rounded-xl border border-line bg-sand p-1.5 transition-transform hover:scale-105"
              >
                <QrCodeSvg code={buildVehicleScanUrl(user, firstVehicle, house)} size={58} />
              </button>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold text-ink">Códigos QR por automóvil</span>
              <span className="text-xs text-ink-soft">Titular: {user.name}</span>
              {firstVehicle && (
                <span className="font-mono text-xs text-stone">
                  {firstVehicle.code}
                  {formatVehicleSummary(firstVehicle)
                    ? ` · ${formatVehicleSummary(firstVehicle)}`
                    : ''}
                </span>
              )}
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
                <Car className="size-3.5 text-cantera" />
                {user.carCount} {user.carCount === 1 ? 'auto' : 'autos'} ·{' '}
                {user.vehicleQrCodes.length} QR vehicular{user.vehicleQrCodes.length === 1 ? '' : 'es'}
              </span>
            </div>
          </div>

          {user.vehicleQrCodes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEntryPass(true)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cantera px-4 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
            >
              <QrCode className="size-4" />
              Generar pase de entrada
            </button>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-[18px]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cantera-soft text-cantera">
                  {db.pushEnabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
                </span>
                <div className="flex flex-col">
                  <span className="font-semibold text-ink">Notificaciones</span>
                  <span className="text-sm text-stone">Avisos, pagos y reportes</span>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={db.pushEnabled}
                aria-label="Activar o desactivar notificaciones"
                onClick={onTogglePush}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  db.pushEnabled ? 'bg-cantera' : 'bg-chip-line'
                }`}
              >
                <span
                  className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
                    db.pushEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onInstallApp}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-chip-line bg-white px-4 text-base font-semibold text-ink transition-colors hover:bg-sand-2 active:translate-y-px"
          >
            <Download className="size-4" />
            Instalar la app
          </button>
        </section>

        <button
          type="button"
          onClick={() => onNavigate('/privacidad')}
          className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-4 py-3.5 text-left font-semibold text-ink transition-colors hover:bg-sand-2/60"
        >
          <Shield className="size-5 text-cantera" />
          <span>Aviso de privacidad</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-chip-line bg-white px-4 text-base font-semibold text-ink transition-colors hover:bg-sand-2 active:translate-y-px"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </div>

      {showEntryPass && (
        <EntryPassModal
          user={user}
          house={house}
          onClose={() => setShowEntryPass(false)}
          onNotify={onNotify}
          onScanQr={onScanQr}
        />
      )}
    </div>
  );
}
