// ============================================================
// "✨ VIDEO TERMINADO" (spec 47).
// Panel de acciones tras terminar un video.
// ============================================================

import { Download, Edit3, Eye, RefreshCw, Rocket, Share2 } from 'lucide-react';
import { Button, Card } from './ui';

interface Props {
  onView: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
  onPrepareSocial: () => void;
  onPublish: () => void;
  exporting: boolean;
  hasVideo: boolean;
}

export function FinalPanel({
  onView,
  onEdit,
  onRegenerate,
  onDownload,
  onPrepareSocial,
  onPublish,
  exporting,
  hasVideo,
}: Props) {
  return (
    <Card className="bg-gradient-to-br from-rose-50 to-amber-50">
      <div className="mb-4 text-center">
        <p className="font-['Fredoka',sans-serif] text-2xl font-bold text-slate-800">
          ✨ ¡Video terminado!
        </p>
        <p className="text-sm text-slate-500">Ya puedes verlo, editarlo, descargarlo o publicarlo.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Button variant="secondary" onClick={onView}>
          <Eye className="h-5 w-5" /> Ver video
        </Button>
        <Button variant="secondary" onClick={onEdit}>
          <Edit3 className="h-5 w-5" /> Editar
        </Button>
        <Button variant="secondary" onClick={onRegenerate}>
          <RefreshCw className="h-5 w-5" /> Regenerar
        </Button>
        <Button variant="primary" onClick={onDownload} loading={exporting}>
          <Download className="h-5 w-5" /> {hasVideo ? 'Descargar MP4' : 'Exportar MP4'}
        </Button>
        <Button variant="primary" onClick={onPrepareSocial}>
          <Share2 className="h-5 w-5" /> Preparar para redes
        </Button>
        <Button variant="success" onClick={onPublish}>
          <Rocket className="h-5 w-5" /> Publicar
        </Button>
      </div>
    </Card>
  );
}
