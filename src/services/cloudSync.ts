// ============================================================
// Sincronización en la nube de la biblioteca (cuentos, personajes,
// calendario y marca). Usa el almacenamiento por usuario del backend.
// ============================================================

import { pullData, pushData } from './auth';
import { exportAll, importAll, type StorageSnapshot } from './storage';

/** Sube el estado local actual a la nube. */
export async function syncUp(): Promise<boolean> {
  return pushData(exportAll());
}

/** Descarga el estado de la nube y lo aplica localmente. */
export async function syncDown(): Promise<boolean> {
  const remote = await pullData<StorageSnapshot>();
  if (!remote) return false;
  importAll(remote);
  return true;
}

/**
 * Fusiona nube y local al iniciar sesión: se queda con el más reciente por
 * marca de tiempo. Estrategia simple (última escritura gana).
 */
export async function syncMerge(): Promise<'nube' | 'local' | 'ninguno'> {
  const local = exportAll();
  const remote = await pullData<StorageSnapshot>();

  if (!remote) {
    // No hay nada en la nube: subimos lo local.
    await pushData(local);
    return 'local';
  }
  if ((remote.updatedAt || 0) >= (local.updatedAt || 0)) {
    importAll(remote);
    return 'nube';
  }
  await pushData(local);
  return 'local';
}
