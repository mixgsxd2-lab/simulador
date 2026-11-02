/* Assistente de nova partida + entrada multiplayer */
const CFG = { modo: 'presidente', uf: null, partido: null, partido_novo: false, partido_nome: '', ideologia: null, propostas: [],
  duracao: 'media', cenario: 'aleatorio', nome: '', aparencia: { pele: '#d9a77b', cabelo: '#3b2a1e', traje: '#2f3b52' } };
let CAT = null;

const DURACOES = {
  curta: ['Curta', '1 mandato (4 anos) + eleição de reeleição. ~20 trimestres.'],
  media: ['Média', 'Até 2 mandatos consecutivos (8 anos). ~36 trimestres.'],
  longa: ['Longa', '2 mandatos + eleição do sucessor. ~36 trimestres.'],
};

function passo(n, titulo, corpo) {
  return `<section class="glass passo"><h2><span>${n}</span>${titulo}</h2>${corpo}</section>`;
}
const cartao = (sel, attrs, tit, sub) => `<button type="button" class="cand ${sel ? 'sel' : ''}" ${attrs}><b>${tit}</b><small>${sub}</small></button>`;

function desenhar() {
  const gov = CFG.modo === 'governador';
  let n = 1;
  let h = passo(n++, 'Modo de jogo', `<div class="grid g2">
    ${cartao(!gov, 'data-modo="presidente"', '🌐 Presidente', 'Eleições nacionais, campanha, debates e 2º turno. Mapa-múndi e diplomacia mundial.')}
    ${cartao(gov, 'data-modo="governador"', '🗺️ Hard: Governador', 'Governe um dos 26 estados ou o DF. Mapa do Brasil, administração estadual e relações federativas.')}
  </div>`);

  if (gov) {
    const itens = CAT.estados.map((e) => ({ id: e.uf, rotulo: e.uf, col: e.pos[0], row: e.pos[1], titulo: `${e.nome} — ${nf(e.pop, 1)} mi hab.`,
      fill: CFG.uf === e.uf ? 'var(--acento)' : 'rgba(110,120,140,.7)', cls: CFG.uf === e.uf ? 'sel eu' : '' }));
    const e = CAT.estados.find((x) => x.uf === CFG.uf);
    h += passo(n++, 'Escolha seu estado', `<div style="max-width:420px">${mapaGrade(itens, 6, 9, { fn: 'escolherUF' })}</div>
      <p class="suave peq">${e ? `<b>${esc(e.nome)}</b> · ${esc(e.regiao)} · ${nf(e.pop, 1)} mi habitantes · PIB R$ ${nf(e.pib, 0)} bi` : 'Clique em um estado do mapa.'}</p>`);
  }

  h += passo(n++, 'Partido', `<div class="grid gauto">
    ${CAT.partidos.map((p) => cartao(CFG.partido === p.sigla && !CFG.partido_novo, `data-partido="${p.sigla}"`, `${p.sigla}`, esc(p.nome))).join('')}
    ${cartao(CFG.partido_novo, 'data-partido-novo="1"', '＋ Criar partido', 'Fundar um partido novo (pequeno no início)')}
  </div>
  ${CFG.partido_novo ? `<div class="grid g2 mt"><label class="campo">Sigla (2–6 letras)<input type="text" id="p-sigla" maxlength="6" value="${esc(CFG.partido || '')}" style="text-transform:uppercase"></label>
    <label class="campo">Nome do partido<input type="text" id="p-nome" maxlength="50" value="${esc(CFG.partido_nome)}"></label></div>` : ''}`);

  h += passo(n++, 'Ideologia', `<div class="grid gauto">${Object.entries(CAT.ideologias).map(([k, i]) =>
    cartao(CFG.ideologia === k, `data-ideologia="${k}"`, esc(i.nome), esc(i.desc))).join('')}</div>`);

  h += passo(n++, `Propostas de campanha <span class="chip">${CFG.propostas.length}/4</span>`, `<p class="suave peq">Promessas cumpridas rendem votos; não cumpridas custam caro na reeleição.</p>
    <div class="grid gauto">${Object.entries(CAT.propostas).map(([k, p]) =>
    cartao(CFG.propostas.includes(k), `data-proposta="${k}"`, esc(p.nome), p.lei ? 'Exige aprovar a lei no Congresso' : 'Meta numérica até o fim do mandato')).join('')}</div>`);

  h += passo(n++, 'RUN (partida roguelike)', `<div class="grid g3">${Object.entries(DURACOES).map(([k, [t, d]]) =>
    cartao(CFG.duracao === k, `data-duracao="${k}"`, t, d)).join('')}</div>
    <label class="campo mt">Cenário<select id="cenario"><option value="aleatorio">🎲 Aleatório (recomendado)</option>
    ${Object.entries(CAT.cenarios).map(([k, c]) => `<option value="${k}" ${CFG.cenario === k ? 'selected' : ''}>${esc(c.nome)} — ${esc(c.desc)}</option>`).join('')}</select></label>`);

  h += passo(n++, 'Personagem <span class="chip">35 anos</span>', `<div class="row">${avatar(CFG.aparencia)}
    <label class="campo" style="flex:1;min-width:180px">Nome (opcional)<input type="text" id="nome" maxlength="40" value="${esc(CFG.nome)}" placeholder="Sorteado se vazio"></label></div>
    <div class="grid g3 mt">
      <label class="campo">Pele<input type="color" data-ap="pele" value="${CFG.aparencia.pele}"></label>
      <label class="campo">Cabelo<input type="color" data-ap="cabelo" value="${CFG.aparencia.cabelo}"></label>
      <label class="campo">Traje<input type="color" data-ap="traje" value="${CFG.aparencia.traje}"></label></div>`);

  h += `<button type="button" class="btn prim grande" id="iniciar">Iniciar campanha</button>`;
  const f = $('#form');
  const foco = document.activeElement && document.activeElement.id;
  f.innerHTML = h;
  if (foco) { const el = document.getElementById(foco); if (el) el.focus(); }
}

function lerCampos() {
  const g = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  if (g('nome') !== null) CFG.nome = g('nome');
  if (CFG.partido_novo) { if (g('p-sigla') !== null) CFG.partido = g('p-sigla').toUpperCase(); if (g('p-nome') !== null) CFG.partido_nome = g('p-nome'); }
  if (g('cenario')) CFG.cenario = g('cenario');
}

window.escolherUF = (el) => { CFG.uf = el.dataset.id; desenhar(); };

document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.fn && window[t.dataset.fn]) { window[t.dataset.fn](t); return; }
  const d = t.dataset;
  if (!$('#form') || !$('#form').contains(t) && t.id !== 'iniciar') return;
  lerCampos();
  if (d.modo) CFG.modo = d.modo;
  else if (d.partido) { CFG.partido = d.partido; CFG.partido_novo = false; }
  else if (d.partidoNovo) { CFG.partido_novo = true; CFG.partido = ''; }
  else if (d.ideologia) CFG.ideologia = d.ideologia;
  else if (d.proposta) {
    const i = CFG.propostas.indexOf(d.proposta);
    if (i >= 0) CFG.propostas.splice(i, 1); else if (CFG.propostas.length < 4) CFG.propostas.push(d.proposta); else toast('Máximo de 4 propostas.', 'erro');
  } else if (d.duracao) CFG.duracao = d.duracao;
  else if (t.id === 'iniciar') return iniciar(t);
  else return;
  desenhar();
});
document.addEventListener('input', (ev) => {
  if (ev.target.dataset.ap) { CFG.aparencia[ev.target.dataset.ap] = ev.target.value; const svg = $('#form .avatar'); if (svg) svg.outerHTML = avatar(CFG.aparencia); }
});

async function iniciar(btn) {
  if (!CFG.partido) return toast('Escolha um partido.', 'erro');
  if (!CFG.ideologia) return toast('Escolha uma ideologia.', 'erro');
  if (CFG.modo === 'governador' && !CFG.uf) return toast('Escolha um estado.', 'erro');
  btn.disabled = true;
  const r = await api('/api/jogos', CFG);
  if (!r.ok) { btn.disabled = false; return toast(r.erro || 'Erro ao criar partida.', 'erro'); }
  Tokens.set(r.codigo, r.token);
  location.href = '/jogo/' + r.codigo;
}

/* ---- multiplayer ---- */
async function prepararEntrada() {
  const sel = $('#j-papel');
  sel.innerHTML = Object.entries(CAT.papeis).filter(([k]) => k !== 'presidente').map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  const atualizarPais = async () => {
    const box = $('#j-pais-box');
    const lider = sel.value === 'lider';
    box.hidden = !lider;
    if (!lider) return;
    const cod = $('#j-codigo').value.trim().toUpperCase();
    const r = cod.length === 5 ? await api(`/api/jogos/${cod}/resumo`) : null;
    $('#j-pais').innerHTML = r && r.ok ? r.entidades.map((e) => `<option value="${e.cod}">${esc(e.nome)}</option>`).join('') : '<option value="">Informe o código primeiro</option>';
  };
  sel.addEventListener('change', atualizarPais);
  $('#j-codigo').addEventListener('input', atualizarPais);
  $('#j-entrar').addEventListener('click', async () => {
    const cod = $('#j-codigo').value.trim().toUpperCase();
    if (cod.length !== 5) return toast('Informe o código de 5 caracteres.', 'erro');
    const r = await api(`/api/jogos/${cod}/entrar`, { nome: $('#j-nome').value, papel: sel.value, pais: $('#j-pais').value });
    if (!r.ok) return toast(r.erro || 'Não foi possível entrar.', 'erro');
    Tokens.set(cod, r.token);
    location.href = '/jogo/' + cod;
  });
}

async function ranking() {
  const r = await api('/api/ranking');
  const box = $('#ranking');
  if (!Array.isArray(r) || !r.length) { box.textContent = 'Nenhuma RUN concluída ainda. Seja o primeiro!'; return; }
  box.innerHTML = `<table><tbody>${r.map((x, i) => `<tr><td>${i + 1}º</td><td>${esc(x.nome)}<br><span class="suave">${esc(x.modo)} · ${esc(x.duracao)}</span></td><td style="text-align:right"><b>${nf(x.pontuacao, 0)}</b></td></tr>`).join('')}</tbody></table>`;
}

(async function () {
  CAT = await api('/api/catalogo');
  desenhar();
  prepararEntrada();
  ranking();
})();
