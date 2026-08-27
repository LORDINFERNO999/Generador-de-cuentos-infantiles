// ============================================================
// Servicio de autenticación.
//
// Usa MySQL si está configurado (DB_HOST, DB_USER, DB_NAME); si no, cae a un
// almacén EN MEMORIA (útil para desarrollo o demos sin base de datos).
// La interfaz pública es asíncrona en ambos casos.
//
// Seguridad: contraseñas con hash scrypt + salt (nunca en claro); token de
// sesión opaco y aleatorio.
// ============================================================

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { ensureSchema, getPool, isDbConfigured } from './db';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface StoredUser extends User {
  salt: string;
  hash: string;
}

// --- Almacén en memoria (fallback) ---
const memUsers = new Map<string, StoredUser>(); // email -> usuario
const memSessions = new Map<string, string>(); // token -> userId
const memData = new Map<string, unknown>(); // userId -> datos

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

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

interface AuthResult {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

// ------------------------------------------------------------
// Registro
// ------------------------------------------------------------

export async function register(
  email: string,
  password: string,
  name: string
): Promise<AuthResult> {
  const key = email.trim().toLowerCase();
  if (!key || !password) return { success: false, message: 'Email y contraseña son obligatorios.' };
  if (password.length < 6)
    return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };

  const salt = randomBytes(16).toString('hex');
  const user: StoredUser = {
    id: newId('u'),
    email: key,
    name: name.trim() || key.split('@')[0],
    salt,
    hash: hashPassword(password, salt),
  };

  if (isDbConfigured()) {
    await ensureSchema();
    const pool = getPool()!;
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [key]);
    if ((rows as any[]).length) return { success: false, message: 'Ya existe una cuenta con ese email.' };
    await pool.query(
      'INSERT INTO users (id, email, name, salt, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.email, user.name, user.salt, user.hash, Date.now()]
    );
  } else {
    if (memUsers.has(key)) return { success: false, message: 'Ya existe una cuenta con ese email.' };
    memUsers.set(key, user);
  }

  const token = await createSession(user.id);
  return { success: true, token, user: publicUser(user) };
}

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthResult> {
  const key = email.trim().toLowerCase();
  let stored: StoredUser | undefined;

  if (isDbConfigured()) {
    await ensureSchema();
    const pool = getPool()!;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [key]);
    const row = (rows as any[])[0];
    if (row) {
      stored = { id: row.id, email: row.email, name: row.name, salt: row.salt, hash: row.hash };
    }
  } else {
    stored = memUsers.get(key);
  }

  if (!stored || !verifyPassword(password, stored.salt, stored.hash)) {
    return { success: false, message: 'Email o contraseña incorrectos.' };
  }
  const token = await createSession(stored.id);
  return { success: true, token, user: publicUser(stored) };
}

// ------------------------------------------------------------
// Sesiones
// ------------------------------------------------------------

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(24).toString('hex');
  if (isDbConfigured()) {
    const pool = getPool()!;
    await pool.query('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [
      token,
      userId,
      Date.now(),
    ]);
  } else {
    memSessions.set(token, userId);
  }
  return token;
}

export async function logout(token: string): Promise<void> {
  if (isDbConfigured()) {
    await getPool()!.query('DELETE FROM sessions WHERE token = ?', [token]);
  } else {
    memSessions.delete(token);
  }
}

export async function getUserByToken(token?: string): Promise<User | null> {
  if (!token) return null;

  if (isDbConfigured()) {
    await ensureSchema();
    const pool = getPool()!;
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.name FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token = ? LIMIT 1`,
      [token]
    );
    const row = (rows as any[])[0];
    return row ? { id: row.id, email: row.email, name: row.name } : null;
  }

  const userId = memSessions.get(token);
  if (!userId) return null;
  for (const u of memUsers.values()) {
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

// ------------------------------------------------------------
// Datos sincronizados por usuario
// ------------------------------------------------------------

export async function getUserData(userId: string): Promise<unknown> {
  if (isDbConfigured()) {
    const pool = getPool()!;
    const [rows] = await pool.query('SELECT data FROM user_data WHERE user_id = ? LIMIT 1', [userId]);
    const row = (rows as any[])[0];
    if (!row?.data) return null;
    try {
      return JSON.parse(row.data);
    } catch {
      return null;
    }
  }
  return memData.get(userId) ?? null;
}

export async function setUserData(userId: string, data: unknown): Promise<void> {
  if (isDbConfigured()) {
    const pool = getPool()!;
    await pool.query(
      `INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
      [userId, JSON.stringify(data ?? null), Date.now()]
    );
  } else {
    memData.set(userId, data);
  }
}
