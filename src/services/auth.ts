// ============================================================
// Cliente de autenticación (frontend). Guarda solo el token de sesión de
// NUESTRA app en localStorage (no tokens de terceros). Genérico: si cambias
// el backend por otro proveedor, basta con adaptar estas funciones.
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const SESSION_KEY = 'cuentos_session_v1';

export function getToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* modo privado */
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const data: AuthResponse = await res.json();
  if (data.success && data.token) setToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data: AuthResponse = await res.json();
  if (data.success && data.token) setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() });
  } catch {
    /* noop */
  }
  setToken(null);
}

/** Devuelve el usuario actual si el token sigue siendo válido. */
export async function me(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  try {
    const res = await fetch('/api/auth/me', { headers: authHeaders() });
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

// -------- Datos sincronizados (nube) --------

export async function pullData<T>(): Promise<T | null> {
  const res = await fetch('/api/data', { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.data as T) ?? null;
}

export async function pushData(data: unknown): Promise<boolean> {
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ data }),
  });
  return res.ok;
}
