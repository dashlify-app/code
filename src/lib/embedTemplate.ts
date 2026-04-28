/**
 * HTML embed template generator.
 *
 * Produces a standalone HTML file that:
 *   - Uses Chart.js via CDN (no bundler needed)
 *   - Calls /api/embed/{dashboardId}?t={token} on load
 *   - Renders widgets with live data
 *   - Auto-refreshes every 60s
 *
 * The JS portion is meant to be obfuscated by the caller before
 * being injected into the final HTML.
 */

interface TemplateInput {
  apiUrl: string; // e.g. https://dashlify.app
  dashboardId: string;
  token: string; // plaintext, will be embedded (caller obfuscates)
  title: string;
}

/**
 * Returns an object with `html` and `js` separated, so the caller can
 * obfuscate just the JS, then call `assemble(html, obfuscatedJs)`.
 */
export function buildEmbedHtml({ apiUrl, dashboardId, token, title }: TemplateInput) {
  const safeTitle = escapeHtml(title);
  const js = buildEmbedJs({ apiUrl, dashboardId, token });
  const html = buildEmbedShell({ title: safeTitle });
  return { html, js };
}

export function assembleHtml(shell: string, obfuscatedJs: string): string {
  return shell.replace('/*__DLF_JS__*/', obfuscatedJs);
}

function buildEmbedShell({ title }: { title: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc;
    color: #0f172a;
    padding: 24px;
  }
  .dlf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e8f0;
  }
  .dlf-title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .dlf-meta { font-size: 11px; color: #94a3b8; font-family: monospace; }
  .dlf-meta .live-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: #10b981; margin-right: 6px; animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .dlf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 18px;
  }
  .dlf-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    min-height: 280px;
    display: flex;
    flex-direction: column;
  }
  .dlf-card-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .dlf-card-sub { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .dlf-card-body { flex: 1; position: relative; min-height: 200px; }
  .dlf-stat-value { font-size: 38px; font-weight: 900; color: #0ea5e9; text-align: center; padding: 30px 0; }
  .dlf-stat-label { font-size: 11px; color: #94a3b8; text-align: center; text-transform: uppercase; letter-spacing: 1.5px; }
  .dlf-loader { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #94a3b8; font-size: 12px; }
  .dlf-error { padding: 24px; text-align: center; color: #ef4444; font-size: 13px; border: 1px dashed #fca5a5; border-radius: 12px; }
  .dlf-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #cbd5e1; }
  .dlf-footer a { color: #94a3b8; text-decoration: none; }
</style>
</head>
<body>
<header class="dlf-header">
  <div class="dlf-title" id="dlf-title">${title}</div>
  <div class="dlf-meta">
    <span class="live-dot"></span>LIVE · <span id="dlf-updated">cargando…</span>
  </div>
</header>
<div id="dlf-grid" class="dlf-grid">
  <div class="dlf-loader">Cargando dashboard…</div>
</div>
<footer class="dlf-footer">
  Powered by <a href="https://dashlify.app" target="_blank">Dashlify</a>
</footer>
<script>
/*__DLF_JS__*/
</script>
</body>
</html>`;
}

function buildEmbedJs({
  apiUrl,
  dashboardId,
  token,
}: {
  apiUrl: string;
  dashboardId: string;
  token: string;
}): string {
  // The JSON.stringify-encoded values are safe to embed inside a string template;
  // the obfuscator will further mangle them.
  return `
(function () {
  var _C = {
    api: ${JSON.stringify(apiUrl)},
    dash: ${JSON.stringify(dashboardId)},
    tok: ${JSON.stringify(token)}
  };
  var REFRESH_MS = 60000;
  var _charts = [];

  function fmt(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') {
      if (Math.abs(v) >= 1000000) return (v/1000000).toFixed(1) + 'M';
      if (Math.abs(v) >= 1000)    return (v/1000).toFixed(1) + 'K';
      return Number.isInteger(v) ? String(v) : v.toFixed(2);
    }
    return String(v);
  }

  function aggregate(rows, xKey, yKey, mode) {
    if (!rows || !rows.length) return { labels: [], data: [] };
    var groups = {};
    rows.forEach(function (r) {
      var k = r[xKey] != null ? String(r[xKey]) : '(vacío)';
      if (!groups[k]) groups[k] = [];
      var v = parseFloat(r[yKey]);
      if (!isNaN(v)) groups[k].push(v);
    });
    var labels = Object.keys(groups).slice(0, 30);
    var data = labels.map(function (k) {
      var arr = groups[k];
      if (!arr.length) return 0;
      if (mode === 'avg') return arr.reduce(function (a,b){return a+b;},0) / arr.length;
      if (mode === 'count') return arr.length;
      if (mode === 'max') return Math.max.apply(null, arr);
      if (mode === 'min') return Math.min.apply(null, arr);
      return arr.reduce(function (a,b){return a+b;},0); // sum default
    });
    return { labels: labels, data: data };
  }

  function renderStat(card, w) {
    var rows = (w.config && w.config.sampleData) || [];
    var metric = (w.config && (w.config.metric || w.config.yAxis)) || null;
    var mode = (w.config && w.config.aggregation) || 'sum';
    var value = 0;
    if (metric && rows.length) {
      var nums = rows.map(function(r){return parseFloat(r[metric]);}).filter(function(n){return !isNaN(n);});
      if (nums.length) {
        if (mode === 'avg') value = nums.reduce(function(a,b){return a+b;},0)/nums.length;
        else if (mode === 'count') value = rows.length;
        else if (mode === 'max') value = Math.max.apply(null, nums);
        else if (mode === 'min') value = Math.min.apply(null, nums);
        else value = nums.reduce(function(a,b){return a+b;},0);
      } else { value = rows.length; }
    } else { value = rows.length; }
    var body = card.querySelector('.dlf-card-body');
    body.innerHTML = '<div class="dlf-stat-value">' + fmt(value) + '</div>' +
      '<div class="dlf-stat-label">' + (metric || 'registros') + '</div>';
  }

  function renderChart(card, w) {
    var rows = (w.config && w.config.sampleData) || [];
    var xKey = (w.config && (w.config.xAxis || w.config.dimension)) || null;
    var yKey = (w.config && (w.config.yAxis || w.config.metric)) || null;
    var mode = (w.config && w.config.aggregation) || 'sum';
    var type = w.type;

    if (!xKey || (!yKey && type !== 'pie' && type !== 'donut')) {
      card.querySelector('.dlf-card-body').innerHTML = '<div class="dlf-loader">Configuración incompleta</div>';
      return;
    }

    var agg = aggregate(rows, xKey, yKey || xKey, type === 'pie' || type === 'donut' ? 'count' : mode);
    var body = card.querySelector('.dlf-card-body');
    body.innerHTML = '<canvas></canvas>';
    var canvas = body.querySelector('canvas');

    var palette = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
    var bg = type === 'pie' || type === 'donut' ? palette : palette[0];

    var chartType = type;
    if (type === 'donut') chartType = 'doughnut';
    if (type === 'stat') chartType = 'bar';

    var chart = new Chart(canvas, {
      type: chartType,
      data: {
        labels: agg.labels,
        datasets: [{
          label: yKey || 'Conteo',
          data: agg.data,
          backgroundColor: bg,
          borderColor: type === 'line' || type === 'area' ? palette[0] : undefined,
          fill: type === 'area',
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: type === 'pie' || type === 'donut' } },
        scales: type === 'pie' || type === 'donut' ? {} : {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
    _charts.push(chart);
  }

  function renderWidget(w) {
    var card = document.createElement('div');
    card.className = 'dlf-card';
    var subtype = (w.type || '').toUpperCase();
    card.innerHTML =
      '<div class="dlf-card-title">' + (w.title || 'Widget') + '</div>' +
      '<div class="dlf-card-sub">' + subtype + '</div>' +
      '<div class="dlf-card-body"></div>';
    return card;
  }

  function destroyCharts() {
    _charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    _charts = [];
  }

  function load() {
    var url = _C.api + '/api/embed/' + _C.dash + '?t=' + _C.tok;
    console.log('Fetching from:', url);
    fetch(url)
      .then(function (r) {
        if (!r.ok) {
          throw new Error('HTTP ' + r.status + ': ' + r.statusText);
        }
        return r.json();
      })
      .then(function (j) {
        console.log('Response:', j);
        if (!j.dashboard) throw new Error(j.error || 'Sin datos en respuesta');
        var d = j.dashboard;
        document.getElementById('dlf-title').textContent = d.title;
        document.getElementById('dlf-updated').textContent = new Date(d.updatedAt || Date.now()).toLocaleString();
        document.title = d.title;
        var grid = document.getElementById('dlf-grid');
        destroyCharts();
        grid.innerHTML = '';
        (d.widgets || []).forEach(function (w) {
          var card = renderWidget(w);
          grid.appendChild(card);
          if (w.type === 'stat') renderStat(card, w);
          else renderChart(card, w);
        });
      })
      .catch(function (err) {
        console.error('Load error:', err);
        var grid = document.getElementById('dlf-grid');
        var msg = err && err.message ? err.message : 'Error desconocido';
        grid.innerHTML = '<div class="dlf-error">No se pudo cargar el dashboard.<br><small>' + msg + '</small><br><small style="color:#999;font-size:10px">Abre la consola (F12) para más detalles</small></div>';
      });
  }

  load();
  setInterval(load, REFRESH_MS);
})();
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
