import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  AdminAuditLogView,
  AdminDirectoryView,
  AdminNoticesView,
  AdminReportsView,
  AdminVisitsLogView,
} from './components/AdminCommunityViews';
import { AdminShell } from './components/AdminShell';
import {
  AdminFeesView,
  AdminHousesStatusView,
  AdminPaymentsView,
} from './components/AdminTreasuryViews';
import { AuthView } from './components/AuthView';
import { PrivacyView } from './components/PrivacyView';
import { ResidentAccount } from './components/ResidentAccount';
import { ResidentHome } from './components/ResidentHome';
import {
  ResidentNotices,
  ResidentPayments,
  ResidentReports,
  ResidentVisits,
} from './components/ResidentPages';
import { ResidentShell } from './components/ResidentShell';
import { SEED_DATABASE } from './data/seedData';
import type { AppRoute, PortalDatabase, PortalUser } from './types/portal';
import {
  addHouse,
  cancelVisitPass,
  checkInVisitPass,
  commentAndUpdateReport,
  createReport,
  createVisitPass,
  DEFAULT_NOW_ISO,
  deleteNotice,
  generateUserQrCode,
  generateVehicleQrCodes,
  inviteUser,
  normalizePortalDatabase,
  publishNotice,
  reviewPayment,
  submitPayment,
  updateFeeSchedule,
  updateHouse,
  updateUserAccess,
} from './utils/portalLogic';

const DB_STORAGE_KEY = 'puerta_cantera_v2_db';
const SESSION_STORAGE_KEY = 'puerta_cantera_v2_session';

const ROUTE_TITLES: Record<AppRoute, string> = {
  '/login': 'Entrar · Puerta Cantera',
  '/recuperar': 'Recuperar acceso · Puerta Cantera',
  '/privacidad': 'Aviso de privacidad · Puerta Cantera',
  '/': 'Inicio · Puerta Cantera',
  '/pagos': 'Pagos · Puerta Cantera',
  '/visitas': 'Visitas · Puerta Cantera',
  '/reportes': 'Reportes · Puerta Cantera',
  '/avisos': 'Avisos · Puerta Cantera',
  '/cuenta': 'Mi cuenta · Puerta Cantera',
  '/admin/tesoreria': 'Pagos por validar · Puerta Cantera',
  '/admin/tesoreria/casas': 'Estado por casa · Puerta Cantera',
  '/admin/tesoreria/cuotas': 'Cuotas · Puerta Cantera',
  '/admin/avisos': 'Avisos · Puerta Cantera',
  '/admin/reportes': 'Reportes · Puerta Cantera',
  '/admin/visitas': 'Bitácora de visitas · Puerta Cantera',
  '/admin/padron': 'Vecinos y casas · Puerta Cantera',
  '/admin/bitacora': 'Bitácora de cambios · Puerta Cantera',
};

function loadInitialDb(): PortalDatabase {
  try {
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PortalDatabase;
      if (Array.isArray(parsed.houses) && Array.isArray(parsed.users) && Array.isArray(parsed.feeHistory)) {
        return normalizePortalDatabase(parsed);
      }
    }
  } catch {
    // Fallback to deterministic seed
  }
  return SEED_DATABASE;
}

function getInitialSession(db: PortalDatabase): { userId: string | null; route: AppRoute } {
  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart') === '1';
  const requestedRoute = params.get('route') as AppRoute | null;

  if (autostart) {
    const fallbackUser = db.users[0]?.id ?? null;
    const validRoute: AppRoute =
      requestedRoute && requestedRoute in ROUTE_TITLES ? requestedRoute : '/';
    return { userId: fallbackUser, route: validRoute };
  }

  try {
    const storedUserId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedUserId && db.users.some((u) => u.id === storedUserId)) {
      const validRoute: AppRoute =
        requestedRoute && requestedRoute in ROUTE_TITLES ? requestedRoute : '/';
      return { userId: storedUserId, route: validRoute };
    }
  } catch {
    // Ignore storage errors
  }

  return { userId: null, route: '/login' };
}

export default function App() {
  const [db, setDb] = useState<PortalDatabase>(loadInitialDb);
  const initialSession = useRef(getInitialSession(db));
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialSession.current.userId);
  const [route, setRoute] = useState<AppRoute>(initialSession.current.route);
  const [prevRoute, setPrevRoute] = useState<AppRoute>('/login');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore quota errors
    }
  }, [db]);

  useEffect(() => {
    try {
      if (currentUserId) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, currentUserId);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentUserId]);

  useEffect(() => {
    document.title = ROUTE_TITLES[route] ?? 'Puerta Cantera';
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [route]);

  const currentUser: PortalUser | null = currentUserId
    ? db.users.find((u) => u.id === currentUserId) ?? null
    : null;

  const navigate = (nextRoute: AppRoute) => {
    setPrevRoute(route);
    setRoute(nextRoute);
  };

  const handleLogin = (email: string) => {
    const normalized = email.trim().toLowerCase();
    const existing = db.users.find((u) => u.email.toLowerCase() === normalized);
    if (existing) {
      setCurrentUserId(existing.id);
      navigate('/');
      showToast(`Bienvenido, ${existing.name}`);
      return;
    }
    // If user logs in with an invited or custom email, sign in as resident with personal & vehicle QR
    const seed = `${normalized}-${Date.now()}`;
    const newUser: PortalUser = {
      id: `usr-${Date.now()}`,
      name: normalized.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      email: normalized,
      role: 'resident',
      houseId: db.houses[0]?.id ?? null,
      active: true,
      qrCode: generateUserQrCode(seed),
      carCount: 1,
      vehicleQrCodes: generateVehicleQrCodes(seed, 1),
    };
    setDb((prev) => ({ ...prev, users: [...prev.users, newUser] }));
    setCurrentUserId(newUser.id);
    navigate('/');
    showToast(`Bienvenido, ${newUser.name}`);
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    navigate('/login');
    showToast('Sesión cerrada.');
  };

  const switchToHouseUser = () => {
    const withHouse = db.users.find((u) => u.houseId !== null && u.active);
    if (withHouse) {
      setCurrentUserId(withHouse.id);
      showToast(`Perfil activo: ${withHouse.name}`);
    }
  };

  const nowIso = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${DEFAULT_NOW_ISO.slice(0, 10)}T${hh}:${mm}:00`;
  };

  if (route === '/privacidad') {
    return (
      <PrivacyView
        onBack={() => navigate(currentUser ? (prevRoute === '/privacidad' ? '/' : prevRoute) : '/login')}
      />
    );
  }

  if (!currentUser || route === '/login' || route === '/recuperar') {
    return (
      <>
        <AuthView
          mode={route === '/recuperar' ? 'recover' : 'login'}
          users={db.users}
          onLogin={handleLogin}
          onNavigateMode={(m) => navigate(m === 'recover' ? '/recuperar' : '/login')}
          onOpenPrivacy={() => navigate('/privacidad')}
        />
        {toast && <ToastBanner message={toast} />}
      </>
    );
  }

  const isAdminRoute = route.startsWith('/admin');
  const pendingPaymentsCount = db.payments.filter((p) => p.status === 'pending').length;

  if (isAdminRoute) {
    return (
      <>
        <AdminShell
          currentRoute={route}
          pendingPaymentsCount={pendingPaymentsCount}
          onNavigate={navigate}
        >
          {route === '/admin/tesoreria' && (
            <AdminPaymentsView
              db={db}
              onReviewPayment={(paymentId, decision, amount, note) => {
                const res = reviewPayment(
                  db,
                  paymentId,
                  decision,
                  amount,
                  note,
                  currentUser.name,
                  nowIso(),
                );
                if (res.error) return res.error;
                setDb(res.db);
                showToast(
                  decision === 'approved'
                    ? 'Pago aprobado y acreditado.'
                    : decision === 'adjusted'
                      ? 'Pago ajustado y acreditado.'
                      : 'Pago rechazado.',
                );
                return null;
              }}
            />
          )}

          {route === '/admin/tesoreria/casas' && (
            <AdminHousesStatusView db={db} onExportToast={showToast} />
          )}

          {route === '/admin/tesoreria/cuotas' && (
            <AdminFeesView
              db={db}
              onUpdateFees={(input) => {
                const res = updateFeeSchedule(db, input, currentUser.name, nowIso());
                if (res.error) return res.error;
                setDb(res.db);
                showToast('Cuotas actualizadas correctamente.');
                return null;
              }}
            />
          )}

          {route === '/admin/avisos' && (
            <AdminNoticesView
              db={db}
              onPublishNotice={(input) => {
                const res = publishNotice(db, input, currentUser.name, nowIso());
                if (res.error) return res.error;
                setDb(res.db);
                showToast('Aviso publicado.');
                return null;
              }}
              onDeleteNotice={(id) => {
                setDb((prev) => deleteNotice(prev, id, currentUser.name, nowIso()));
                showToast('Aviso eliminado.');
              }}
            />
          )}

          {route === '/admin/reportes' && (
            <AdminReportsView
              db={db}
              onUpdateReport={(reportId, body, nextStatus) => {
                const res = commentAndUpdateReport(
                  db,
                  reportId,
                  body,
                  nextStatus,
                  currentUser.name,
                  true,
                  nowIso(),
                );
                if (res.error) return res.error;
                setDb(res.db);
                showToast('Reporte actualizado.');
                return null;
              }}
            />
          )}

          {route === '/admin/visitas' && <AdminVisitsLogView db={db} />}

          {route === '/admin/padron' && (
            <AdminDirectoryView
              db={db}
              onAddHouse={(input) => {
                const res = addHouse(db, input, currentUser.name, nowIso());
                if (res.error) return res.error;
                setDb(res.db);
                showToast('Casa agregada al padrón.');
                return null;
              }}
              onUpdateHouse={(houseId, patch) => {
                const res = updateHouse(db, houseId, patch, currentUser.name, nowIso());
                if (res.error) return res.error;
                setDb(res.db);
                showToast('Casa actualizada.');
                return null;
              }}
              onInviteUser={(input) => {
                const res = inviteUser(db, input, currentUser.name, nowIso());
                if (res.error) return { error: res.error };
                setDb(res.db);
                const cars = res.user?.carCount ?? 0;
                showToast(
                  `Registro creado con QR personal y ${cars} ${cars === 1 ? 'QR de auto' : 'QR de autos'}.`,
                );
                return { user: res.user, error: null };
              }}
              onUpdateUser={(userId, patch) => {
                const res = updateUserAccess(db, userId, patch, currentUser.name, nowIso());
                if (res.error) return res.error;
                setDb(res.db);
                showToast('Usuario actualizado.');
                return null;
              }}
              onNotify={showToast}
            />
          )}

          {route === '/admin/bitacora' && <AdminAuditLogView db={db} />}
        </AdminShell>
        {toast && <ToastBanner message={toast} />}
      </>
    );
  }

  return (
    <>
      <ResidentShell currentRoute={route} onNavigate={navigate}>
        {route === '/' && <ResidentHome db={db} user={currentUser} onNavigate={navigate} />}

        {route === '/avisos' && <ResidentNotices db={db} onNavigate={navigate} />}

        {route === '/cuenta' && (
          <ResidentAccount
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onTogglePush={() => {
              setDb((prev) => ({ ...prev, pushEnabled: !prev.pushEnabled }));
              showToast(
                db.pushEnabled ? 'Notificaciones desactivadas.' : 'Notificaciones activadas.',
              );
            }}
            onInstallApp={() => {
              showToast('En Safari o Chrome usa "Agregar a pantalla de inicio" para instalar la app.');
            }}
            onSwitchUser={(userId) => {
              const target = db.users.find((u) => u.id === userId);
              if (target) {
                setCurrentUserId(target.id);
                showToast(`Perfil cambiado a ${target.name}`);
              }
            }}
            onNotify={showToast}
            onLogout={handleLogout}
          />
        )}

        {route === '/pagos' && (
          <ResidentPayments
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onSwitchToHouseUser={switchToHouseUser}
            onSubmitPayment={(input) => {
              const res = submitPayment(db, input, currentUser, nowIso());
              if (res.error) return res.error;
              setDb(res.db);
              showToast('Comprobante enviado a tesorería para validación.');
              return null;
            }}
          />
        )}

        {route === '/visitas' && (
          <ResidentVisits
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onSwitchToHouseUser={switchToHouseUser}
            onCreatePass={(input) => {
              const res = createVisitPass(db, input, currentUser, nowIso());
              if (res.error) return res.error;
              setDb(res.db);
              showToast(`Pase ${res.pass?.code} generado.`);
              return null;
            }}
            onCancelPass={(passId) => {
              setDb((prev) => cancelVisitPass(prev, passId, currentUser.name, nowIso()));
              showToast('Pase cancelado.');
            }}
            onCheckInPass={(passId) => {
              setDb((prev) => checkInVisitPass(prev, passId, 'Caseta principal', nowIso()));
              showToast('Entrada registrada en la bitácora de visitas.');
            }}
            onCopyCode={(code) => {
              navigator.clipboard?.writeText(code).catch(() => {});
              showToast(`Código ${code} copiado.`);
            }}
          />
        )}

        {route === '/reportes' && (
          <ResidentReports
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onCreateReport={(input) => {
              const res = createReport(db, input, currentUser, nowIso());
              if (res.error) return res.error;
              setDb(res.db);
              showToast(`Reporte ${res.report?.folio} registrado.`);
              return null;
            }}
          />
        )}
      </ResidentShell>
      {toast && <ToastBanner message={toast} />}
    </>
  );
}

function ToastBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:inset-x-auto lg:right-6 lg:bottom-6"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-night-line bg-night px-4 py-2.5 text-sm font-medium text-white shadow-lg">
        <CheckCircle2 className="size-4 shrink-0 text-ok-bg" />
        <span>{message}</span>
      </div>
    </div>
  );
}
