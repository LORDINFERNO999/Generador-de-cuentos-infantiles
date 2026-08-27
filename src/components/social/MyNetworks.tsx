// ============================================================
// "🔗 MIS REDES" (spec 43).
// Conexión de cuentas mediante OAuth oficial. NUNCA se piden contraseñas.
// Los tokens se manejan en el backend, nunca en el frontend.
// ============================================================

import { Link2, Link2Off, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { connectAccount, disconnectAccount, getSocialStatus } from '../../services/api';
import { ALL_PLATFORMS, PLATFORMS } from '../../services/social';
import type { AccountConnection, SocialPlatform } from '../../types';
import { Button, Card, SectionTitle } from '../ui';

interface Props {
  onStatusChange?: (accounts: AccountConnection[]) => void;
}

export function MyNetworks({ onStatusChange }: Props) {
  const [accounts, setAccounts] = useState<AccountConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<SocialPlatform | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await getSocialStatus();
      setAccounts(list);
      onStatusChange?.(list);
    } catch {
      setAccounts(
        ALL_PLATFORMS.map((platform) => ({
          platform,
          connected: false,
          directPublishAvailable: false,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async (platform: SocialPlatform) => {
    setBusy(platform);
    setNotice(null);
    try {
      const res = await connectAccount(platform);
      if (res.available && res.authUrl) {
        // Redirige al login OAuth oficial de la plataforma.
        window.open(res.authUrl, '_blank', 'noopener');
        setNotice(
          `Se abrió el inicio de sesión oficial de ${PLATFORMS[platform].label}. Al terminar, vuelve y actualiza el estado.`
        );
      } else {
        setNotice(
          res.message ||
            `La conexión con ${PLATFORMS[platform].label} no está configurada en el servidor. Podrás preparar el video y publicarlo manualmente.`
        );
      }
    } catch (e: any) {
      setNotice(e?.message || 'No se pudo iniciar la conexión.');
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async (platform: SocialPlatform) => {
    setBusy(platform);
    try {
      await disconnectAccount(platform);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <SectionTitle
        emoji="🔗"
        title="Mis redes"
        subtitle="Conecta tus cuentas con el inicio de sesión oficial de cada plataforma."
      />

      <div className="mb-4 flex items-start gap-2 rounded-2xl bg-blue-50 p-3 text-xs text-blue-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Seguridad: usamos OAuth oficial. Nunca pedimos ni guardamos tu contraseña, y los tokens
          se manejan solo en el servidor.
        </span>
      </div>

      <div className="space-y-3">
        {ALL_PLATFORMS.map((platform) => {
          const info = PLATFORMS[platform];
          const account = accounts.find((a) => a.platform === platform);
          const connected = account?.connected;
          return (
            <div
              key={platform}
              className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{info.emoji}</span>
                <div>
                  <p className="font-semibold text-slate-800">{info.label.replace(' Reels', '').replace(' Shorts', '')}</p>
                  <p className="text-xs text-slate-500">
                    {loading
                      ? 'Comprobando...'
                      : connected
                        ? `Conectado${account?.displayName ? ` · ${account.displayName}` : ''}`
                        : 'No conectado'}
                  </p>
                </div>
              </div>
              {connected ? (
                <Button
                  variant="secondary"
                  loading={busy === platform}
                  onClick={() => handleDisconnect(platform)}
                >
                  <Link2Off className="h-4 w-4" /> Desconectar
                </Button>
              ) : (
                <Button
                  variant="primary"
                  loading={busy === platform}
                  onClick={() => handleConnect(platform)}
                >
                  <Link2 className="h-4 w-4" /> Conectar
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {notice}
        </div>
      )}
    </Card>
  );
}
