import html2canvas from 'html2canvas';

export async function downloadSvgAsImage(containerId: string, filename: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Buscar la tarjeta completa para incluir el título y el fondo blanco, si existe
  const card = container.closest('.chart-card') as HTMLElement;
  const targetElement = card || container;

  try {
    const canvas = await html2canvas(targetElement, {
      backgroundColor: '#ffffff',
      scale: 2, // Alta resolución
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
