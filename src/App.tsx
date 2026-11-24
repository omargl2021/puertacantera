import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
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
import { PrintCorbatinesView } from './components/PrintCorbatinesView';
import { PrivacyView } from './components/PrivacyView';
import { ResidentAccount } from './components/ResidentAccount';
import { ResidentHome } from './components/ResidentHome';
import {
  ResidentNotices,
  ResidentPayments,
  ResidentReports,
  ResidentVisits,
} from './components/ResidentPages';
import { ResidentQrScanModal } from './components/ResidentQrScanModal';
import { ResidentShell } from './components/ResidentShell';
import { SEED_DATABASE } from './data/seedData';
import { firebaseAuth } from './firebase';
import {
  isFirebaseBootstrapAdmin,
  seedFirestoreIfEmpty,
  signInWithGoogleCloud,
  subscribeToFirestoreDatabase,
  syncDatabaseChangesToFirestore,
} from './services/firestoreSync';
import type { AppRoute, PortalDatabase, PortalUser, ScannedResidentData } from './types/portal';
import {
  addHouse,
  cancelVisitPass,
  checkInVisitPass,
  commentAndUpdateReport,
  createReport,
  createVisitPass,
  DEFAULT_NOW_ISO,
  deleteNotice,
  deleteResident,
  importResidentsBatch,
  inviteUser,
  isAdminUser,
  isPrimaryAdminUser,
  normalizePortalDatabase,
  parseResidentQrScanParams,
  publishNotice,
  reviewPayment,
  submitPayment,
  updateFeeSchedule,
  updateHouse,
  updateUserAccess,
  type ExcelImportBatchResult,
  type ParsedExcelResidentRow,
} from './utils/portalLogic';

const DB_STORAGE_KEY = 'puerta_cantera_v2_db';

const ROUTE_TITLES: Record<AppRoute, string> = {
  '/login': 'Entrar · Puerta Cantera',
  '/privacidad': 'Aviso de privacidad · Puerta Cantera',
  '/': 'Inicio · Puerta Cantera',
  '/pagos': 'Pagos · Puerta Cantera',
  '/visitas': 'Visitas · Puerta Cantera',
  '/reportes': 'Reportes · Puerta Cantera',
  '/avisos': 'Avisos · Puerta Cantera',
  '/cuenta': 'Mi cuenta · Puerta Cantera',
  '/corbatines': 'Imprimir corbatín · Puerta Cantera',
  '/admin/tesoreria': 'Pagos por validar · Puerta Cantera',
  '/admin/tesoreria/casas': 'Estado por casa · Puerta Cantera',
  '/admin/tesoreria/cuotas': 'Cuotas · Puerta Cantera',
  '/admin/avisos': 'Avisos · Puerta Cantera',
  '/admin/reportes': 'Reportes · Puerta Cantera',
  '/admin/visitas': 'Bitácora de visitas · Puerta Cantera',
  '/admin/padron': 'Vecinos y casas · Puerta Cantera',
  '/admin/corbatines': 'Imprimir corbatín · Puerta Cantera',
  '/admin/bitacora': 'Bitácora de cambios · Puerta Cantera',
};

function loadInitialDb(): PortalDatabase {
  try {
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PortalDatabase;
      if (
        Array.isArray(parsed.houses) &&
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.feeHistory)
      ) {
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
    const adminUser = db.users.find((u) => isPrimaryAdminUser(u)) ?? db.users[0] ?? null;
    const validRoute: AppRoute =
      requestedRoute && requestedRoute in ROUTE_TITLES ? requestedRoute : '/';
    return { userId: adminUser?.id ?? null, route: validRoute };
  }

  return { userId: null, route: '/login' };
}

export default function App() {
  const [db, setDb] = useState<PortalDatabase>(loadInitialDb);
  const dbRef = useRef<PortalDatabase>(db);
  const initialSession = useRef(getInitialSession(db));
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialSession.current.userId);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [route, setRoute] = useState<AppRoute>(initialSession.current.route);
  const [prevRoute, setPrevRoute] = useState<AppRoute>('/login');
  const [scannedResident, setScannedResident] = useState<ScannedResidentData | null>(() =>
    parseResidentQrScanParams(window.location.search, db, window.location.origin),
  );
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  const handleCloseScannedResident = () => {
    setScannedResident(null);
    if (window.location.search.includes('scan=') || window.location.search.includes('qr=')) {
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
    }
  };

  // Persist local cache as offline mirror while cloud Firestore syncs in real time
  useEffect(() => {
    try {
      window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Ignore storage quota errors
    }
  }, [db]);

  // Listen for Firebase Auth state & activate real-time Firestore cloud database listeners
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(firebaseAuth, (fbUser) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      setFirebaseUser(fbUser);

      if (fbUser && fbUser.emailVerified) {
        if (isFirebaseBootstrapAdmin(fbUser)) {
          void seedFirestoreIfEmpty(dbRef.current, fbUser).catch(() => {
            // Structured error already logged via handleFirestoreError
          });
        }
        unsubFirestore = subscribeToFirestoreDatabase(
          fbUser,
          (patch) => {
            setDb((prev) => normalizePortalDatabase({ ...prev, ...patch }));
          },
          (msg) => showToast(msg),
        );
      }
    });

    return () => {
      if (unsubFirestore) unsubFirestore();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    document.title = ROUTE_TITLES[route] ?? 'Puerta Cantera';
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [route]);

  const currentUser: PortalUser | null = currentUserId
    ? db.users.find((u) => u.id === currentUserId) ?? null
    : null;

  const commitDbChange = (nextDb: PortalDatabase) => {
    const prevDb = dbRef.current;
    dbRef.current = nextDb;
    setDb(nextDb);
    if (firebaseUser) {
      void syncDatabaseChangesToFirestore(prevDb, nextDb, firebaseUser).catch(() => {
        showToast('Cambio guardado localmente. Revisa la conexión con Firebase.');
      });
    }
  };

  const navigate = (nextRoute: AppRoute) => {
    if (nextRoute.startsWith('/admin') && !isAdminUser(currentUser)) {
      showToast('Solo el administrador puede acceder a esta sección.');
      setRoute('/');
      return;
    }
    setPrevRoute(route);
    setRoute(nextRoute);
  };

  const handleConnectCloud = async () => {
    if (!isAdminUser(currentUser)) {
      showToast('Solo el administrador puede sincronizar la base de datos en la nube.');
      return;
    }
    if (firebaseUser) {
      try {
        await seedFirestoreIfEmpty(dbRef.current, firebaseUser);
        showToast('Base de datos Firebase Firestore sincronizada.');
      } catch {
        showToast('Error al sincronizar con Firebase Firestore.');
      }
      return;
    }
    try {
      const fbUser = await signInWithGoogleCloud();
      await seedFirestoreIfEmpty(dbRef.current, fbUser);
      showToast('Conectado a la base de datos en la nube Firebase.');
    } catch {
      showToast('No se completó la conexión con Firebase.');
    }
  };

  const handleLogin = async (username: string, password: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (response.status === 404 || response.status === 405 || !isJson) {
        return 'No se encontró el servidor de autenticación. Abre la aplicación desde su servidor activo (npm start).';
      }

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        isAdmin?: boolean;
        token?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.isAdmin || !data.token) {
        return data.error || 'Usuario o contraseña incorrectos.';
      }

      const adminUser =
        dbRef.current.users.find((u) => isPrimaryAdminUser(u)) ??
        dbRef.current.users.find((u) => u.role === 'admin');
      if (!adminUser) {
        return 'No se encontró la cuenta del administrador.';
      }

      setAuthToken(data.token);
      setCurrentUserId(adminUser.id);
      setPrevRoute('/login');
      setRoute('/');
      showToast('Bienvenido administrador (ADMON).');
      return null;
    } catch {
      return 'No se pudo verificar el acceso con el servidor.';
    }
  };

  const handleLogout = () => {
    if (authToken) {
      void fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    setAuthToken(null);
    setCurrentUserId(null);
    setPrevRoute(route);
    setRoute('/login');
    showToast('Sesión cerrada.');
  };

  const nowIso = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${DEFAULT_NOW_ISO.slice(0, 10)}T${hh}:${mm}:00`;
  };

  if (route === '/privacidad') {
    return (
      <>
        <PrivacyView
          onBack={() =>
            navigate(currentUser ? (prevRoute === '/privacidad' ? '/' : prevRoute) : '/login')
          }
        />
        {scannedResident && (
          <ResidentQrScanModal data={scannedResident} onClose={handleCloseScannedResident} />
        )}
      </>
    );
  }

  if (!currentUser || route === '/login') {
    return (
      <>
        <AuthView onLogin={handleLogin} onOpenPrivacy={() => navigate('/privacidad')} />
        {scannedResident && (
          <ResidentQrScanModal data={scannedResident} onClose={handleCloseScannedResident} />
        )}
        {toast && <ToastBanner message={toast} />}
      </>
    );
  }

  const userIsAdmin = isAdminUser(currentUser);
  const isAdminRoute = route.startsWith('/admin') && userIsAdmin;
  const pendingPaymentsCount = db.payments.filter((p) => p.status === 'pending').length;

  const handleAdminAddResident = (input: Parameters<typeof inviteUser>[1]) => {
    if (!userIsAdmin) {
      return { error: 'Solo el administrador puede agregar residentes.' };
    }
    const res = inviteUser(dbRef.current, input, currentUser.name, nowIso());
    if (res.error) return { error: res.error };
    commitDbChange(res.db);
    const cars = res.user?.carCount ?? 0;
    const keyTag = res.user?.residentKey ? ` (${res.user.residentKey})` : '';
    showToast(
      cars > 0
        ? `Residente${keyTag} registrado con ${cars} ${cars === 1 ? 'QR de auto' : 'QR de autos'}.`
        : `Residente${keyTag} registrado sin automóviles.`,
    );
    return { user: res.user, error: null };
  };

  const handleAdminUpdateResident = (
    userId: string,
    patch: Parameters<typeof updateUserAccess>[2],
  ): string | null => {
    if (!userIsAdmin) {
      return 'Solo el administrador puede modificar datos de residentes.';
    }
    const res = updateUserAccess(dbRef.current, userId, patch, currentUser.name, nowIso());
    if (res.error) return res.error;
    commitDbChange(res.db);
    showToast('Datos del residente actualizados.');
    return null;
  };

  const handleAdminImportResidents = (
    rows: ParsedExcelResidentRow[],
  ): ExcelImportBatchResult => {
    if (!userIsAdmin) {
      showToast('Solo el administrador puede importar residentes.');
      return {
        db: dbRef.current,
        added: [],
        skipped: rows.map((r) => ({
          rowNumber: r.rowNumber,
          name: r.name || '(Sin nombre)',
          reason: 'Solo el administrador puede importar residentes.',
        })),
      };
    }
    const res = importResidentsBatch(dbRef.current, rows, currentUser.name, nowIso());
    if (res.added.length > 0) {
      commitDbChange(res.db);
      showToast(
        res.skipped.length > 0
          ? `${res.added.length} residentes importados (${res.skipped.length} omitidos).`
          : `${res.added.length} ${
              res.added.length === 1 ? 'residente importado' : 'residentes importados'
            } a la base.`,
      );
    } else if (res.skipped.length > 0) {
      showToast('Ninguna fila se importó. Revisa los motivos de validación.');
    }
    return res;
  };

  const handleAdminDeleteResident = (userId: string): string | null => {
    if (!userIsAdmin) {
      return 'Solo el administrador puede eliminar residentes.';
    }
    const res = deleteResident(dbRef.current, userId, currentUser.name, nowIso());
    if (res.error) return res.error;
    commitDbChange(res.db);
    showToast('Residente eliminado del padrón.');
    return null;
  };

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
                  dbRef.current,
                  paymentId,
                  decision,
                  amount,
                  note,
                  currentUser.name,
                  nowIso(),
                );
                if (res.error) return res.error;
                commitDbChange(res.db);
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
                const res = updateFeeSchedule(dbRef.current, input, currentUser.name, nowIso());
                if (res.error) return res.error;
                commitDbChange(res.db);
                showToast('Cuotas actualizadas correctamente.');
                return null;
              }}
            />
          )}

          {route === '/admin/avisos' && (
            <AdminNoticesView
              db={db}
              onPublishNotice={(input) => {
                const res = publishNotice(dbRef.current, input, currentUser.name, nowIso());
                if (res.error) return res.error;
                commitDbChange(res.db);
                showToast('Aviso publicado.');
                return null;
              }}
              onDeleteNotice={(id) => {
                commitDbChange(deleteNotice(dbRef.current, id, currentUser.name, nowIso()));
                showToast('Aviso eliminado.');
              }}
            />
          )}

          {route === '/admin/reportes' && (
            <AdminReportsView
              db={db}
              onUpdateReport={(reportId, body, nextStatus) => {
                const res = commentAndUpdateReport(
                  dbRef.current,
                  reportId,
                  body,
                  nextStatus,
                  currentUser.name,
                  true,
                  nowIso(),
                );
                if (res.error) return res.error;
                commitDbChange(res.db);
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
                const res = addHouse(dbRef.current, input, currentUser.name, nowIso());
                if (res.error) return res.error;
                commitDbChange(res.db);
                showToast('Casa agregada al padrón.');
                return null;
              }}
              onUpdateHouse={(houseId, patch) => {
                const res = updateHouse(dbRef.current, houseId, patch, currentUser.name, nowIso());
                if (res.error) return res.error;
                commitDbChange(res.db);
                showToast('Casa actualizada.');
                return null;
              }}
              onInviteUser={handleAdminAddResident}
              onImportResidents={handleAdminImportResidents}
              onUpdateUser={handleAdminUpdateResident}
              onDeleteUser={handleAdminDeleteResident}
              onScanQr={setScannedResident}
              onNotify={showToast}
            />
          )}

          {route === '/admin/corbatines' && (
            <PrintCorbatinesView
              db={db}
              user={currentUser}
              isAdminLayout
              onScanQr={setScannedResident}
              onNotify={showToast}
            />
          )}

          {route === '/admin/bitacora' && <AdminAuditLogView db={db} />}
        </AdminShell>
        {scannedResident && (
          <ResidentQrScanModal data={scannedResident} onClose={handleCloseScannedResident} />
        )}
        {toast && <ToastBanner message={toast} />}
      </>
    );
  }

  const effectiveResidentRoute: AppRoute = route.startsWith('/admin') ? '/' : route;

  return (
    <>
      <ResidentShell
        currentRoute={effectiveResidentRoute}
        user={currentUser}
        cloudConnected={Boolean(firebaseUser)}
        onConnectCloud={handleConnectCloud}
        onNavigate={navigate}
        onLogout={handleLogout}
      >
        {effectiveResidentRoute === '/' && (
          <ResidentHome
            db={db}
            user={currentUser}
            cloudConnected={Boolean(firebaseUser)}
            onConnectCloud={handleConnectCloud}
            onNavigate={navigate}
            onLogout={handleLogout}
            onAddResident={handleAdminAddResident}
            onImportResidents={handleAdminImportResidents}
            onUpdateResident={handleAdminUpdateResident}
            onDeleteResident={handleAdminDeleteResident}
            onScanQr={setScannedResident}
            onNotify={showToast}
          />
        )}

        {effectiveResidentRoute === '/corbatines' && (
          <PrintCorbatinesView
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onScanQr={setScannedResident}
            onNotify={showToast}
          />
        )}

        {effectiveResidentRoute === '/avisos' && <ResidentNotices db={db} onNavigate={navigate} />}

        {effectiveResidentRoute === '/cuenta' && (
          <ResidentAccount
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onTogglePush={() => {
              commitDbChange({ ...dbRef.current, pushEnabled: !dbRef.current.pushEnabled });
              showToast(
                dbRef.current.pushEnabled
                  ? 'Notificaciones activadas.'
                  : 'Notificaciones desactivadas.',
              );
            }}
            onInstallApp={() => {
              showToast(
                'En Safari o Chrome usa "Agregar a pantalla de inicio" para instalar la app.',
              );
            }}
            onScanQr={setScannedResident}
            onNotify={showToast}
            onLogout={handleLogout}
          />
        )}

        {effectiveResidentRoute === '/pagos' && (
          <ResidentPayments
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onSubmitPayment={(input) => {
              const res = submitPayment(dbRef.current, input, currentUser, nowIso());
              if (res.error) return res.error;
              commitDbChange(res.db);
              showToast('Comprobante enviado a tesorería para validación.');
              return null;
            }}
          />
        )}

        {effectiveResidentRoute === '/visitas' && (
          <ResidentVisits
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onCreatePass={(input) => {
              const res = createVisitPass(dbRef.current, input, currentUser, nowIso());
              if (res.error) return res.error;
              commitDbChange(res.db);
              showToast(`Pase ${res.pass?.code} generado.`);
              return null;
            }}
            onCancelPass={(passId) => {
              commitDbChange(cancelVisitPass(dbRef.current, passId, currentUser.name, nowIso()));
              showToast('Pase cancelado.');
            }}
            onCheckInPass={(passId) => {
              commitDbChange(
                checkInVisitPass(dbRef.current, passId, 'Caseta principal', nowIso()),
              );
              showToast('Entrada registrada en la bitácora de visitas.');
            }}
            onCopyCode={(code) => {
              navigator.clipboard?.writeText(code).catch(() => {});
              showToast(`Código ${code} copiado.`);
            }}
          />
        )}

        {effectiveResidentRoute === '/reportes' && (
          <ResidentReports
            db={db}
            user={currentUser}
            onNavigate={navigate}
            onCreateReport={(input) => {
              const res = createReport(dbRef.current, input, currentUser, nowIso());
              if (res.error) return res.error;
              commitDbChange(res.db);
              showToast(`Reporte ${res.report?.folio} registrado.`);
              return null;
            }}
          />
        )}
      </ResidentShell>
      {scannedResident && (
        <ResidentQrScanModal data={scannedResident} onClose={handleCloseScannedResident} />
      )}
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
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-gold/35 bg-night px-4 py-2.5 text-sm font-medium text-white shadow-xl">
        <CheckCircle2 className="size-4 shrink-0 text-gold" />
        <span>{message}</span>
      </div>
    </div>
  );
}
