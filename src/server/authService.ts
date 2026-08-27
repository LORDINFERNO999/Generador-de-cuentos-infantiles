// ============================================================
// Servicio de autenticación GENÉRICO (lado servidor).
//
// Implementación en memoria e intencionadamente sencilla y desacoplada,
// para poder sustituirla más adelante por un proveedor real (Firebase,
// Supabase, Auth0, una base de datos, etc.) sin tocar el frontend:
// basta con reimplementar estas funciones.
//
// Seguridad: las contraseñas se guardan como hash (scrypt + salt), NUNCA en
// claro. El token de sesión es opaco y aleatorio.
//
// NOTA: al ser en memoria, los datos se pierden al reiniciar el servidor.
// Es un andamiaje funcional para desarrollo; cámbialo por persistencia real.
// ============================================================

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface StoredUser extends User {
  salt: string;
  hash: string;
}

const users = new Map<string, StoredUser>(); // email -> usuario
const sessions = new Map<string, string>(); // token -> userId
const cloudData = new Map<string, unknown>(); // userId -> datos sincronizados

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, 'hex');
  return candidate.length === original.length && timingSafeEqual(candidate, original);
}

function publicUser(u: StoredUser): User {
  return { id: u.id, email: u.email, name: u.name };
}

/** Registra un nuevo usuario y devuelve la sesión. */
export function register(
  email: string,
  password: string,
  name: string
): { success: boolean; message?: string; token?: string; user?: User } {
  const key = email.trim().toLowerCase();
  if (!key || !password) {
    return { success: false, message: 'Email y contraseña son obligatorios.' };
  }
  if (password.length < 6) {
    return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (users.has(key)) {
    return { success: false, message: 'Ya existe una cuenta con ese email.' };
  }
  const salt = randomBytes(16).toString('hex');
  const user: StoredUser = {
    id: `u_${randomBytes(8).toString('hex')}`,
    email: key,
    name: name.trim() || key.split('@')[0],
    salt,
    hash: hashPassword(password, salt),
  };
  users.set(key, user);
  const token = createSession(user.id);
  return { success: true, token, user: publicUser(user) };
}

/** Inicia sesión con email y contraseña. */
export function login(
  email: string,
  password: string
): { success: boolean; message?: string; token?: string; user?: User } {
  const key = email.trim().toLowerCase();
  const user = users.get(key);
  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return { success: false, message: 'Email o contraseña incorrectos.' };
  }
  const token = createSession(user.id);
  return { success: true, token, user: publicUser(user) };
}

function createSession(userId: string): string {
  const token = randomBytes(24).toString('hex');
  sessions.set(token, userId);
  return token;
}

/** Cierra la sesión asociada a un token. */
export function logout(token: string): void {
  sessions.delete(token);
}

/** Devuelve el usuario asociado a un token de sesión, o null. */
export function getUserByToken(token?: string): User | null {
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  for (const u of users.values()) {
    if (u.id === userId) return publicUser(u);
  }
  return null;
}

/** Extrae el token del header Authorization: Bearer <token>. */
export function tokenFromHeader(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
}

// -------- Datos sincronizados por usuario (nube genérica) --------

export function getUserData(userId: string): unknown {
  return cloudData.get(userId) ?? null;
}

export function setUserData(userId: string, data: unknown): void {
  cloudData.set(userId, data);
}
