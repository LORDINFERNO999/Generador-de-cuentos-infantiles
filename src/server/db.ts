// ============================================================
// Conexión a MySQL (opcional). Si las variables de entorno de la base de
// datos están configuradas, se usa MySQL; si no, el resto de la app cae a un
// almacén en memoria (ver authService). Así funciona con o sin base de datos.
//
// Variables de entorno:
//   DB_HOST, DB_PORT (3306), DB_USER, DB_PASSWORD, DB_NAME
// ============================================================

import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;
let schemaReady: Promise<void> | null = null;

/** ¿Están configuradas las credenciales de MySQL? */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
}

/** Devuelve el pool de conexiones (o null si no hay BD configurada). */
export function getPool(): mysql.Pool | null {
  if (!isDbConfigured()) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

/** Crea las tablas necesarias si no existen (idempotente). */
export function ensureSchema(): Promise<void> {
  const p = getPool();
  if (!p) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await p.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          hash VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await p.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          created_at BIGINT NOT NULL,
          INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await p.query(`
        CREATE TABLE IF NOT EXISTS user_data (
          user_id VARCHAR(64) PRIMARY KEY,
          data LONGTEXT,
          updated_at BIGINT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    })().catch((e) => {
      console.error('Error creando el esquema de la base de datos:', e);
    });
  }
  return schemaReady;
}
