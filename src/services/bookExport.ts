// ============================================================
// Exportar el cuento como libro imprimible / PDF.
// Abre una ventana con el cuento maquetado y lanza el diálogo de impresión
// del navegador (donde el usuario puede elegir "Guardar como PDF").
// No requiere dependencias externas.
// ============================================================

import type { Branding, Story } from '../types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Abre una ventana con el cuento maquetado como libro y lanza la impresión.
 * El usuario puede "Guardar como PDF" desde el diálogo del navegador.
 */
export function openBookPrint(story: Story, branding?: Branding | null): void {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Permite las ventanas emergentes para exportar el libro en PDF.');
    return;
  }

  const accent = branding?.accentColor || '#fb7185';
  const brandLine = branding?.brandName
    ? `<p class="brand">${escapeHtml(branding.brandName)}</p>`
    : '';
  const logoImg = branding?.logo
    ? `<img class="logo" src="${branding.logo}" alt="logo" />`
    : '';

  const pages = story.scenes
    .map((scene, i) => {
      const img = scene.imageUrl
        ? `<img class="scene-img" src="${scene.imageUrl}" alt="Escena ${i + 1}" />`
        : '';
      const text = escapeHtml(scene.narration || scene.subtitle || '');
      return `
        <section class="page">
          ${img}
          <div class="text">
            <p class="page-num">${i + 1}</p>
            <p class="narration">${text}</p>
          </div>
        </section>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="${story.language === 'english' ? 'en' : 'es'}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(story.title)}</title>
<style>
  @page { size: A5 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Quicksand', 'Segoe UI', sans-serif;
    color: #1f2937;
  }
  .cover {
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: linear-gradient(160deg, ${accent}, #1e293b);
    color: #fff;
    padding: 40px;
    page-break-after: always;
  }
  .cover h1 { font-size: 40px; margin: 20px 0; }
  .cover .logo { width: 120px; height: 120px; object-fit: contain; margin-bottom: 16px; }
  .cover .moral { font-size: 18px; opacity: 0.9; margin-top: 20px; }
  .brand { font-size: 16px; letter-spacing: 1px; opacity: 0.85; }
  .cover-img { width: 70%; border-radius: 20px; margin: 16px 0; }
  .page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    padding: 24px;
  }
  .scene-img {
    width: 100%;
    height: 60%;
    object-fit: cover;
    border-radius: 20px;
  }
  .text { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 16px 8px; }
  .page-num { color: ${accent}; font-weight: 700; font-size: 14px; margin: 0 0 8px; }
  .narration { font-size: 22px; line-height: 1.5; font-weight: 600; margin: 0; }
  .end { text-align: center; padding-top: 30vh; page-break-after: avoid; }
  .end h2 { color: ${accent}; font-size: 32px; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="cover">
    ${logoImg}
    ${brandLine}
    <h1>${escapeHtml(story.title)}</h1>
    ${story.scenes.find((s) => s.imageUrl)?.imageUrl ? `<img class="cover-img" src="${story.scenes.find((s) => s.imageUrl)!.imageUrl}" alt="portada" />` : ''}
    ${story.moral ? `<p class="moral">🌟 ${escapeHtml(story.moral)}</p>` : ''}
  </div>
  ${pages}
  <div class="page end">
    <h2>Fin 🎉</h2>
    ${story.moral ? `<p class="narration">Moraleja: ${escapeHtml(story.moral)}</p>` : ''}
    ${brandLine}
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
