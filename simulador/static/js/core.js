/* Núcleo compartilhado: utilitários, API, tema, ícones, componentes visuais e gráficos. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, d = 1) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const bi = (v) => 'R$ ' + nf(v, Math.abs(v) >= 100 ? 0 : 1) + ' bi';
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rngSeed(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const guardar = { get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };

/* ---------- tema e preferências ---------- */
const Tema = {
  get() { return guardar.get('sim_tema', 'auto'); },
  aplicar() {
    const t = this.get();
    const escuro = t === 'auto' ? matchMedia('(prefers-color-scheme: dark)').matches : t === 'dark';
    document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    document.documentElement.classList.toggle('sem-animacao', guardar.get('sim_anim') === '0');
  },
  set(t) { guardar.set('sim_tema', t); this.aplicar(); },
  alternar() { this.set(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); },
};
Tema.aplicar();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => Tema.aplicar());

/* ---------- API ---------- */
const Tokens = {
  get(cod) { return guardar.get('sim_token_' + cod, ''); },
  set(cod, t) { guardar.set('sim_token_' + cod, t); },
  del(cod) { guardar.del('sim_token_' + cod); },
  codigos() { try { return Object.keys(localStorage).filter((k) => k.startsWith('sim_token_')).map((k) => k.slice(10)); } catch { return []; } },
};
async function api(url, corpo, codigo) {
  const opts = { headers: { 'Content-Type': 'application/json' } };
  if (codigo) opts.headers['X-Token'] = Tokens.get(codigo);
  if (corpo !== undefined) { opts.method = 'POST'; opts.body = JSON.stringify(corpo); }
  try {
    const r = await fetch(url, opts);
    const j = await r.json();
    if (j && typeof j === 'object' && !Array.isArray(j)) j._status = r.status;
    return j;
  } catch { return { ok: false, erro: 'Falha de conexão com o servidor.', _status: 0 }; }
}

/* ---------- ícones (traço 24×24, estilo Lucide) ---------- */
const ICONES = {
  palacio: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  economia: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  justica: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  congresso: '<path d="M3 21h18"/><path d="M5 21v-7a7 7 0 0 1 14 0v7"/><path d="M12 7V3"/><path d="M9 21v-4h6v4"/>',
  globo: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  ajustes: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  dir: '<path d="m9 18 6-6-6-6"/>', esq: '<path d="m15 18-6-6 6-6"/>', seta: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  mais: '<path d="M5 12h14"/><path d="M12 5v14"/>', menos: '<path d="M5 12h14"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  lua: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  trofeu: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  livro: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  megafone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  jornal: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
  pasta: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  mira: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  moedas: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  mapa: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
  usuario: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  dados: '<rect width="18" height="18" x="3" y="3" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  zoomMais: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>',
  zoomMenos: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>',
  expandir: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  bandeira: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  raio: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  coracao: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  capelo: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  folha: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  predio: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  olho: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  calendario: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  urna: '<path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z"/><path d="M22 19H2"/>',
  aperto: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  pincel: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4.07-1.8 4.07-4.03a3.03 3.03 0 0 0-3.03-3.03z"/>',
  lixo: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  estrela: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
};
const icone = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[n] || ICONES.info}</svg>`;

/* ---------- toasts ---------- */
function toast(msg, tipo = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = icone(tipo === 'erro' ? 'alerta' : 'check') + `<span>${esc(msg)}</span>`;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 320); }, 4200);
}

/* ---------- componentes ---------- */
const UIc = {
  painel(titulo, ico, corpo, { acoes = '', cls = '', sub = '' } = {}) {
    return `<section class="vidro painel ${cls}"><header class="painel-cab"><span class="ico-caixa">${icone(ico)}</span>
      <div class="flex1"><h2>${titulo}</h2>${sub ? `<div class="mini fraco">${sub}</div>` : ''}</div>${acoes ? `<div class="acoes">${acoes}</div>` : ''}</header>${corpo}</section>`;
  },
  medidor(v, max = 100, cor = 'var(--ouro)', fino = false) {
    return `<div class="medidor ${fino ? 'fino' : ''}" style="--c:${cor}"><i style="width:${clampN((v / max) * 100, 0, 100)}%"></i></div>`;
  },
  barra(rot, v, cor, texto, max = 100) {
    return `<div class="barra-linha"><span class="suave">${rot}</span>${this.medidor(v, max, cor)}<span class="v">${texto ?? nf(v, 0)}</span></div>`;
  },
  partido(sigla, cor, num) { return `<span class="selo-partido" style="--pc:${esc(cor || '#667')}" title="${esc(sigla)}${num ? ' · ' + num : ''}">${esc(num || sigla)}</span>`; },
  anel(v, max, rotulo, cor = 'var(--ouro)', tam = 112, texto) {
    const r = 44, c = 2 * Math.PI * r, p = clampN(v / max, 0, 1);
    return `<div class="anel" style="width:${tam}px;height:${tam}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="anel-fundo"/>
      <circle cx="50" cy="50" r="${r}" class="anel-valor" style="stroke:${cor};stroke-dasharray:${c};stroke-dashoffset:${c * (1 - p)}"/></svg>
      <div class="anel-txt"><b>${texto ?? nf(v, 0)}</b><span>${rotulo}</span></div></div>`;
  },
  vazio(txt, ico = 'info') { return `<div class="vazio">${icone(ico, 'g')}<span>${txt}</span></div>`; },
};

/* cor contínua para relações (0 hostil → 50 neutro → 100 aliado) */
function corRelacao(rel) {
  const a = [194, 65, 75], n = [120, 128, 142], b = [47, 179, 127];
  const t = clampN(rel, 0, 100) / 100;
  const [c1, c2, k] = t < .5 ? [a, n, t / .5] : [n, b, (t - .5) / .5];
  return `rgb(${c1.map((x, i) => Math.round(x + (c2[i] - x) * k)).join(',')})`;
}
const corEstado = (v, bom, ruim, inverso = false) => {
  const ok = inverso ? v <= bom : v >= bom, mau = inverso ? v >= ruim : v <= ruim;
  return ok ? 'var(--verde)' : mau ? 'var(--vermelho)' : 'var(--ambar)';
};

/* ---------- gráficos ---------- */
function graficoArea(dados, chave, cor = 'var(--ouro)', fmt = (v) => nf(v, 1), alt = 150) {
  const vals = dados.map((d) => Number(d[chave]));
  if (vals.length < 2) return UIc.vazio('Os dados aparecem a partir do 2º trimestre.', 'grafico');
  const w = 320, h = alt, px = 8, py = 14;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * .12; lo -= pad; hi += pad;
  const X = (i) => px + (i / (vals.length - 1)) * (w - 2 * px), Y = (v) => py + (1 - (v - lo) / (hi - lo)) * (h - 2 * py);
  const pts = vals.map((v, i) => [X(i), Y(v)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`; }
  const id = 'g' + hashStr(chave + vals.join()).toString(36);
  const grade = [0.25, .5, .75].map((f) => `<line x1="0" x2="${w}" y1="${py + f * (h - 2 * py)}" y2="${py + f * (h - 2 * py)}" class="grade-linha"/>`).join('');
  const ult = pts[pts.length - 1];
  return `<div class="grafico" data-vals='${esc(JSON.stringify(vals.map((v) => fmt(v))))}' data-rot='${esc(JSON.stringify(dados.map((x) => x.ano + ' T' + x.tri)))}'>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".38"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>
    ${grade}<path d="${d} L${ult[0]},${h} L${pts[0][0]},${h}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${cor}" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
    <line class="cursor-linha" x1="0" x2="0" y1="0" y2="${h}" style="opacity:0"/></svg>
    <span class="ponto" style="left:${(ult[0] / w) * 100}%;top:${(ult[1] / h) * 100}%;--c:${cor}"></span>
    <div class="grafico-dica" hidden></div>
    <div class="grafico-eixo"><span>${fmt(Math.max(...vals))} máx</span><span>${fmt(vals[vals.length - 1])} atual</span></div></div>`;
}
function sparkline(vals, cor = 'var(--ouro)') {
  if (vals.length < 2) return '';
  const w = 90, h = 26, lo = Math.min(...vals), hi = Math.max(...vals), f = hi - lo || 1;
  const p = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - lo) / f) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${p}" fill="none" stroke="${cor}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}
document.addEventListener('pointermove', (ev) => { /* dica dos gráficos */
  const g = ev.target.closest && ev.target.closest('.grafico');
  $$('.grafico-dica').forEach((d) => { if (!g || !g.contains(d)) d.hidden = true; });
  if (!g) return;
  const vals = JSON.parse(g.dataset.vals || '[]'), rot = JSON.parse(g.dataset.rot || '[]');
  const r = g.getBoundingClientRect(), t = clampN((ev.clientX - r.left) / r.width, 0, 1), i = Math.round(t * (vals.length - 1));
  const dica = $('.grafico-dica', g), linha = $('.cursor-linha', g);
  dica.hidden = false; dica.innerHTML = `<b>${vals[i]}</b><span>${esc(rot[i] || '')}</span>`;
  dica.style.left = `${(i / (vals.length - 1)) * 100}%`;
  const x = (i / (vals.length - 1)) * 320; linha.setAttribute('x1', x); linha.setAttribute('x2', x); linha.style.opacity = 1;
});

/* hemiciclo: cadeiras em arcos, partidos ordenados da esquerda para a direita */
function hemiciclo(partidos, casa, total, destaque) {
  if (!total) return '';
  const linhas = total > 300 ? 12 : total > 120 ? 8 : total > 60 ? 6 : 4;
  const R = 100, r0 = 34, pos = [];
  const raios = Array.from({ length: linhas }, (_, i) => r0 + (i * (R - r0)) / (linhas - 1));
  const soma = raios.reduce((a, b) => a + b, 0);
  let resto = total;
  raios.forEach((rr, i) => {
    const n = i === linhas - 1 ? resto : Math.round((total * rr) / soma);
    resto -= n;
    for (let k = 0; k < n; k++) { const ang = Math.PI - (Math.PI * (k + .5)) / n; pos.push({ ang, x: 110 + rr * Math.cos(ang), y: 108 - rr * Math.sin(ang) }); }
  });
  pos.sort((a, b) => b.ang - a.ang);
  const ordem = [...partidos].filter((p) => p[casa] > 0).sort((a, b) => a.eco - b.eco);
  const tam = total > 300 ? 2.6 : total > 120 ? 3.6 : 4.6;
  let k = 0, circ = '';
  for (const p of ordem) for (let j = 0; j < p[casa] && k < pos.length; j++, k++) {
    const q = pos[k];
    circ += `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${tam}" fill="${esc(p.cor || '#888')}" class="${destaque && p.posicao !== destaque ? 'apagada' : ''}"><title>${esc(p.sigla)}</title></circle>`;
  }
  return `<svg class="hemiciclo" viewBox="0 0 220 116">${circ}</svg>`;
}

/* ---------- retratos reais (Wikipédia) ---------- */
const Retratos = {
  async url(titulo) {
    const k = 'sim_wiki_' + titulo, c = guardar.get(k);
    if (c !== null) return c || null;
    try {
      const r = await fetch('https://pt.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(titulo.replace(/ /g, '_')));
      const j = await r.json();
      const u = (j.thumbnail && j.thumbnail.source) || '';
      guardar.set(k, u); return u || null;
    } catch { return null; }
  },
  carregar(raiz = document) {
    $$('[data-wiki]:not([data-ok])', raiz).forEach((el, i) => { el.dataset.ok = '1'; setTimeout(() => this._um(el), i * 40); });
  },
  async _um(el) {
    const u = await this.url(el.dataset.wiki);
    if (!u) return;
    const img = new Image(); img.alt = el.dataset.alt || ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onload = () => { el.classList.add('com-foto'); el.prepend(img); };
    img.src = u;
  },
};
const iniciais = (n) => String(n || '?').split(/\s+/).filter((x) => x.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(x)).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
