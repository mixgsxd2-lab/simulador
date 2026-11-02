/* Utilitários compartilhados: tema, API, formatação, mapas em grade */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, d = 1) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const bi = (v) => 'R$ ' + nf(v, Math.abs(v) >= 100 ? 0 : 1) + ' bi';
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---- tema ---- */
const Tema = {
  get() { try { return localStorage.getItem('sim_tema') || 'auto'; } catch { return 'auto'; } },
  aplicar() {
    const t = this.get();
    const efetivo = t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
    document.documentElement.dataset.theme = efetivo;
  },
  set(t) { try { localStorage.setItem('sim_tema', t); } catch {} this.aplicar(); },
  alternar() { this.set(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); },
};
Tema.aplicar();

/* ---- API ---- */
const Tokens = {
  get(cod) { try { return localStorage.getItem('sim_token_' + cod) || ''; } catch { return ''; } },
  set(cod, t) { try { localStorage.setItem('sim_token_' + cod, t); } catch {} },
};
async function api(url, corpo, codigo) {
  const opts = { headers: { 'Content-Type': 'application/json' } };
  if (codigo) opts.headers['X-Token'] = Tokens.get(codigo);
  if (corpo !== undefined) { opts.method = 'POST'; opts.body = JSON.stringify(corpo); }
  try {
    const r = await fetch(url, opts);
    const j = await r.json();
    j._status = r.status;
    return j;
  } catch (e) {
    return { ok: false, erro: 'Falha de conexão com o servidor.', _status: 0 };
  }
}

/* ---- toasts ---- */
function toast(msg, tipo = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---- mapa em grade (tile map) ---- */
function mapaGrade(itens, colunas, linhas, opts = {}) {
  const cel = new Map(itens.map((i) => [i.col + ',' + i.row, i]));
  let html = `<div class="mapa" style="grid-template-columns:repeat(${colunas},1fr)">`;
  for (let r = 0; r < linhas; r++) {
    for (let c = 0; c < colunas; c++) {
      const i = cel.get(c + ',' + r);
      if (!i) { html += '<span class="tile vazio"></span>'; continue; }
      html += `<button type="button" class="tile ${i.cls || ''}" data-id="${esc(i.id)}" ${opts.fn ? `data-fn="${opts.fn}"` : ''}
        style="background:${i.fill}" title="${esc(i.titulo || '')}">${esc(i.rotulo)}</button>`;
    }
  }
  return html + '</div>';
}
const corRel = (rel) => `hsl(${clampN(rel, 0, 100) * 1.2} 58% 42% / .88)`;

/* ---- avatar simples (aparência opcional) ---- */
function avatar(ap = {}) {
  const pele = ap.pele || '#d9a77b', cabelo = ap.cabelo || '#3b2a1e', traje = ap.traje || '#2f3b52';
  return `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="rgba(128,138,160,.35)"/>
    <path d="M10 64c2-14 12-20 22-20s20 6 22 20z" fill="${esc(traje)}"/>
    <circle cx="32" cy="27" r="12" fill="${esc(pele)}"/>
    <path d="M20 25c0-9 7-13 13-12 6 0 11 4 11 12-3-4-8-6-12-6s-9 2-12 6z" fill="${esc(cabelo)}"/>
  </svg>`;
}

/* ---- gráfico de linha em SVG ---- */
function grafico(dados, chave, cor, rotuloFmt = (v) => nf(v, 1)) {
  const w = 300, h = 110, p = 22;
  const v = dados.map((d) => d[chave]);
  if (v.length < 2) return '<div class="suave peq">Sem dados ainda.</div>';
  const lo = Math.min(...v), hi = Math.max(...v);
  const faixa = hi - lo || 1;
  const pts = v.map((y, i) => `${(p + (i / (v.length - 1)) * (w - 2 * p)).toFixed(1)},${(h - p - ((y - lo) / faixa) * (h - 2 * p)).toFixed(1)}`);
  return `<svg class="grafico" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline class="sv" stroke="${cor}" points="${pts.join(' ')}"/>
    <text x="${p}" y="10">${rotuloFmt(hi)}</text><text x="${p}" y="${h - 4}">${rotuloFmt(lo)}</text>
    <text x="${w - p}" y="${h - 4}" text-anchor="end">atual: ${rotuloFmt(v[v.length - 1])}</text></svg>`;
}
