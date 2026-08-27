// ============================================================
// Panel de cuenta: registro/login genérico y sincronización en la nube
// de la biblioteca (cuentos, personajes, calendario y marca).
// ============================================================

import { CloudDownload, CloudUpload, LogIn, LogOut, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { login, logout, me, register, type AuthUser } from '../services/auth';
import { syncDown, syncMerge, syncUp } from '../services/cloudSync';
import { Button, Card, SectionTitle } from './ui';

interface Props {
  /** Se llama tras sincronizar hacia abajo (para refrescar la UI). */
  onSynced?: () => void;
}

export function AuthPanel({ onSynced }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    me().then(setUser);
  }, []);

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res =
        mode === 'login' ? await login(email, password) : await register(email, password, name);
      if (res.success && res.user) {
        setUser(res.user);
        // Fusiona nube y local al entrar.
        const which = await syncMerge();
        if (which === 'nube') onSynced?.();
        setNotice(
          which === 'nube'
            ? 'Sesión iniciada. Cargados tus datos de la nube.'
            : 'Sesión iniciada. Tus datos locales se han subido.'
        );
      } else {
        setNotice(res.message || 'No se pudo completar la operación.');
      }
    } catch (e: any) {
      setNotice(e?.message || 'Error de red.');
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    await logout();
    setUser(null);
    setNotice(null);
  };

  const doSyncUp = async () => {
    setBusy(true);
    const ok = await syncUp();
    setNotice(ok ? 'Biblioteca subida a la nube.' : 'No se pudo subir.');
    setBusy(false);
  };

  const doSyncDown = async () => {
    setBusy(true);
    const ok = await syncDown();
    setNotice(ok ? 'Biblioteca descargada de la nube.' : 'No hay datos en la nube.');
    if (ok) onSynced?.();
    setBusy(false);
  };

  return (
    <Card>
      <SectionTitle
        emoji="👤"
        title="Mi cuenta"
        subtitle="Inicia sesión para guardar tu biblioteca en la nube y usarla en otros dispositivos."
      />

      {user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-800">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <Button variant="ghost" onClick={doLogout} className="!px-3 !py-1.5 text-xs">
              <LogOut className="h-4 w-4" /> Salir
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={doSyncUp} loading={busy} className="!py-2 text-sm">
              <CloudUpload className="h-4 w-4" /> Subir a la nube
            </Button>
            <Button variant="secondary" onClick={doSyncDown} loading={busy} className="!py-2 text-sm">
              <CloudDownload className="h-4 w-4" /> Bajar de la nube
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                mode === 'login' ? 'bg-rose-400 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                mode === 'register' ? 'bg-rose-400 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {mode === 'register' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mín. 6)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-300"
          />
          <Button onClick={submit} loading={busy} fullWidth>
            {mode === 'login' ? (
              <>
                <LogIn className="h-5 w-5" /> Entrar
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5" /> Crear cuenta
              </>
            )}
          </Button>
        </div>
      )}

      {notice && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {notice}
        </div>
      )}
    </Card>
  );
}
