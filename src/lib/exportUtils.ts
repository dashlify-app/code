import html2canvas from 'html2canvas';

export async function downloadSvgAsImage(containerId: string, filename: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Buscar la tarjeta completa para incluir el título y el fondo blanco, si existe
  const card = container.closest('.chart-card') as HTMLElement;
  const targetElement = card || container;

  try {
    // Prefer: export directo desde el canvas (Chart.js) para evitar bugs de html2canvas con oklch().
    const chartCanvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    if (chartCanvas && chartCanvas.width > 0 && chartCanvas.height > 0) {
      const pad = 24;
      const titleH = 44;
      const out = document.createElement('canvas');
      const ctx = out.getContext('2d');
      if (!ctx) return;

      const w = chartCanvas.width;
      const h = chartCanvas.height;
      out.width = w + pad * 2;
      out.height = h + pad * 2 + titleH;

      // background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);

      // title
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textBaseline = 'top';
      ctx.fillText(String(filename || '').slice(0, 60), pad, pad);

      // chart image
      ctx.drawImage(chartCanvas, pad, pad + titleH);

      const pngUrl = out.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const normalizeColorToken = (doc: Document, token: string): string => {
      // Convert oklch(...) token -> rgb(...) via browser engine
      const tmp = doc.createElement('div');
      tmp.style.color = token;
      tmp.style.position = 'fixed';
      tmp.style.left = '-99999px';
      tmp.style.top = '0';
      doc.body.appendChild(tmp);
      const out = doc.defaultView?.getComputedStyle(tmp).color || token;
      doc.body.removeChild(tmp);
      return out;
    };

    const sanitizeCssText = (doc: Document, cssText: string): string => {
      if (!cssText || typeof cssText !== 'string') return cssText;
      if (!cssText.includes('oklch(')) return cssText;
      return cssText.replace(/oklch\([^)]+\)/g, (m) => normalizeColorToken(doc, m));
    };

    const canvas = await html2canvas(targetElement, {
      backgroundColor: '#ffffff',
      scale: 2, // Alta resolución
      onclone: (clonedDoc) => {
        // html2canvas aún no soporta oklch(); normalizamos a rgb() antes de renderizar.
        const root = clonedDoc.getElementById(containerId) || clonedDoc.body;
        const all: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];

        for (const el of all) {
          const st = clonedDoc.defaultView?.getComputedStyle(el as Element);
          if (!st) continue;
          const style = (el as HTMLElement).style;

          // 1) Sanitiza estilos inline (Tailwind a veces inyecta sombras/rings en style="...")
          const inline = (el as HTMLElement).getAttribute?.('style');
          if (inline && inline.includes('oklch(')) {
            (el as HTMLElement).setAttribute('style', sanitizeCssText(clonedDoc, inline));
          }

          // 2) Sanitiza cualquier propiedad computada que contenga oklch(...)
          // Itera todas las propiedades para evitar “misses” (ring/shadow/filters/etc).
          for (let i = 0; i < st.length; i++) {
            const prop = st.item(i);
            const v = st.getPropertyValue(prop);
            if (!v || !v.includes('oklch(')) continue;
            try {
              style.setProperty(prop, sanitizeCssText(clonedDoc, v));
            } catch {
              // ignore
            }
          }
        }
      },
      ignoreElements: (el) => {
        // Ocultar los botones de maximizar/descargar en la foto exportada
        return el.classList.contains('chart-actions');
      }
    });

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error al exportar la gráfica:', error);
  }
}
