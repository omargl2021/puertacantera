import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type { PortalUser } from '../types/portal';
import { validateLoginInput, validateRecoveryEmail } from '../utils/portalLogic';
import { BrandMark } from './BrandMark';

interface AuthViewProps {
  mode: 'login' | 'recover';
  users: PortalUser[];
  onLogin: (email: string) => void;
  onNavigateMode: (mode: 'login' | 'recover') => void;
  onOpenPrivacy: () => void;
}

export function AuthView({
  mode,
  users,
  onLogin,
  onNavigateMode,
  onOpenPrivacy,
}: AuthViewProps) {
  const [email, setEmail] = useState('admin@puertacantera.com');
  const [password, setPassword] = useState('cantera2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateLoginInput(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    const normalized = email.trim().toLowerCase();
    const matched = users.find((u) => u.email.toLowerCase() === normalized);
    if (matched && !matched.active) {
      setError('Tu cuenta está inactiva. Contacta a la mesa directiva.');
      return;
    }
    setError(null);
    onLogin(normalized);
  };

  const handleRecoverySubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateRecoveryEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setRecoverySent(true);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-night">
      <div className="flex flex-col items-center gap-2.5 px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-14">
        <BrandMark variant="light" width={160} />
        <p className="text-sm text-night-muted">Portal vecinal</p>
      </div>

      <main className="-mt-8 flex flex-1 flex-col rounded-t-[28px] bg-sand px-5 pt-7 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-between gap-6">
          {mode === 'login' ? (
            <div className="flex flex-col gap-5">
              <div className="space-y-1">
                <h1 className="font-heading text-3xl font-semibold text-ink">Bienvenido</h1>
                <p className="text-[15px] text-stone">
                  Entra con el correo con el que te invitó la mesa directiva.
                </p>
              </div>

              <form className="flex flex-col gap-4" noValidate onSubmit={handleLoginSubmit}>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-email" className="text-sm font-semibold text-ink">
                    Correo
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="nombre@correo.com"
                    className="h-12 w-full min-w-0 rounded-[10px] border border-input bg-white px-3 py-1 text-base font-medium text-ink transition-colors outline-none placeholder:text-stone/60 focus-visible:border-cantera focus-visible:ring-3 focus-visible:ring-cantera/20"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-password" className="text-sm font-semibold text-ink">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Tu contraseña"
                      className="h-12 w-full min-w-0 rounded-[10px] border border-input bg-white px-3 pr-11 py-1 text-base font-medium text-ink transition-colors outline-none placeholder:text-stone/60 focus-visible:border-cantera focus-visible:ring-3 focus-visible:ring-cantera/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone hover:bg-sand-2 hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cantera px-4 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
                >
                  Entrar
                </button>
              </form>

              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setRecoverySent(false);
                    onNavigateMode('recover');
                  }}
                  className="text-sm font-semibold text-cantera hover:underline"
                >
                  Olvidé mi contraseña
                </button>

                <div className="w-full rounded-[14px] border border-line bg-white/80 p-3">
                  <p className="mb-2 text-xs font-semibold tracking-[0.06em] text-stone uppercase">
                    Acceso rápido
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onLogin('admin@puertacantera.com')}
                      className="flex flex-col items-start rounded-[10px] border border-chip-line bg-white px-3 py-2 text-left transition-colors hover:bg-sand-2"
                    >
                      <span className="text-sm font-semibold text-ink">Admin</span>
                      <span className="text-xs text-stone">Mesa directiva</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onLogin('daniel@appmrl.mx')}
                      className="flex flex-col items-start rounded-[10px] border border-chip-line bg-white px-3 py-2 text-left transition-colors hover:bg-sand-2"
                    >
                      <span className="text-sm font-semibold text-ink">Daniel Cruz</span>
                      <span className="text-xs text-stone">Flores #389</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setRecoverySent(false);
                  onNavigateMode('login');
                }}
                className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-cantera hover:underline"
              >
                <ArrowLeft className="size-4" />
                Volver a entrar
              </button>

              <div className="space-y-1">
                <h1 className="font-heading text-3xl font-semibold text-ink">Recuperar acceso</h1>
                <p className="text-[15px] text-stone">
                  Te enviaremos un enlace temporal para definir una nueva contraseña.
                </p>
              </div>

              {recoverySent ? (
                <div className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-5">
                  <div className="flex items-center gap-2 text-ok">
                    <CheckCircle2 className="size-5 shrink-0" />
                    <span className="font-semibold">Enlace enviado</span>
                  </div>
                  <p className="text-sm text-ink-soft">
                    Revisa tu correo <strong>{email}</strong>. Si no aparece en unos minutos, revisa tu carpeta de spam o avisa a la mesa directiva.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoverySent(false);
                      onNavigateMode('login');
                    }}
                    className="mt-1 inline-flex h-11 items-center justify-center rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink hover:bg-sand-2"
                  >
                    Regresar al inicio de sesión
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-4" noValidate onSubmit={handleRecoverySubmit}>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="recover-email" className="text-sm font-semibold text-ink">
                      Correo
                    </label>
                    <input
                      id="recover-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="nombre@correo.com"
                      className="h-12 w-full min-w-0 rounded-[10px] border border-input bg-white px-3 py-1 text-base font-medium text-ink transition-colors outline-none placeholder:text-stone/60 focus-visible:border-cantera focus-visible:ring-3 focus-visible:ring-cantera/20"
                    />
                  </div>
                  {error && (
                    <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cantera px-4 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
                  >
                    Enviar enlace
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="text-sm text-stone underline-offset-4 hover:text-ink hover:underline"
            >
              Aviso de privacidad
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
