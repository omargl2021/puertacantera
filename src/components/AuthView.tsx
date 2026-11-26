import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { validateLoginInput } from '../utils/portalLogic';
import { BrandMark } from './BrandMark';

interface AuthViewProps {
  onLogin: (username: string, password: string) => Promise<string | null>;
  onOpenPrivacy?: () => void;
}

export function AuthView({ onLogin }: AuthViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateLoginInput(username, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const loginError = await onLogin(username.trim(), password);
      if (loginError) {
        setError(loginError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh w-full grid-cols-1 bg-gradient-to-b from-[#1C1813] via-night to-[#14110E] lg:grid-cols-12">
      {/* Brand hero panel — top banner on smartphone/tablet, full-height left column on desktop */}
      <aside className="flex flex-col items-center justify-center gap-4 px-6 pt-[max(env(safe-area-inset-top),2.75rem)] pb-14 lg:col-span-6 lg:border-r lg:border-gold/20 lg:px-12 lg:py-12 xl:col-span-7">
        <BrandMark variant="light" width={190} />
      </aside>

      {/* Sign-in panel — edge-to-edge full height on every device */}
      <main className="-mt-8 flex flex-1 flex-col justify-center rounded-t-[28px] border-t border-gold/30 bg-sand px-6 pt-9 pb-[max(env(safe-area-inset-bottom),2rem)] md:px-12 lg:col-span-6 lg:mt-0 lg:rounded-none lg:border-t-0 lg:px-14 xl:col-span-5">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between gap-8 lg:flex-none">
          <div className="flex flex-col gap-6">
            <form className="flex flex-col gap-4" noValidate onSubmit={handleLoginSubmit}>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-username" className="text-sm font-semibold text-ink">
                  Usuario
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Ingresa tu usuario"
                    className="h-12 w-full min-w-0 rounded-xl border border-input bg-white pr-3.5 pl-10 text-base font-medium text-ink transition-colors outline-none placeholder:text-stone/60 focus-visible:border-cantera focus-visible:ring-3 focus-visible:ring-gold/25"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-password" className="text-sm font-semibold text-ink">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Tu contraseña"
                    className="h-12 w-full min-w-0 rounded-xl border border-input bg-white pr-11 pl-10 text-base font-medium text-ink transition-colors outline-none placeholder:text-stone/60 focus-visible:border-cantera focus-visible:ring-3 focus-visible:ring-gold/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone transition-colors hover:bg-sand-2 hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-xl bg-cantera px-4 text-base font-semibold text-white shadow-[0_6px_16px_rgba(138,100,27,0.22)] transition-all hover:bg-cantera-dark active:translate-y-px disabled:opacity-60"
              >
                {submitting ? 'Verificando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
