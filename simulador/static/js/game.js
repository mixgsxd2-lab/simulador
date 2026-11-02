/* Núcleo da tela de jogo: carregamento, ações, modais, multiplayer */
const CODIGO = document.body.dataset.codigo;
let G = null, CAT = null, TAB = 'governo', ocupado = false;
const visto = (k) => { try { return sessionStorage.getItem(k + CODIGO); } catch { return null; } };
const marcar = (k, v) => { try { sessionStorage.setItem(k + CODIGO, v); } catch {} };

async function boot() {
  CAT = await api('/api/catalogo');
  try { TAB = localStorage.getItem('sim_aba') || 'governo'; } catch {}
  if (!VIEWS[TAB]) TAB = 'governo';
  await carregar(true);
  setInterval(() => { if (!document.hidden && G && G.jogadores.length > 1 && !ocupado) carregar(false); }, 5000);
}

function aceitar(r) {
  const mudou = !G || r.versao !== G.versao || r.mensagens.length !== G.mensagens.length || r.pedidos.length !== G.pedidos.length ||
    r.jogadores.length !== G.jogadores.length || JSON.stringify(r.pedidos.map((p) => p.status)) !== JSON.stringify(G.pedidos.map((p) => p.status));
  const novaVersao = !G || r.versao !== G.versao;
  G = r;
  if (novaVersao) UI.draft = null;
  return mudou;
}

async function carregar(forcar) {
  const r = await api(`/api/jogos/${CODIGO}`, undefined, CODIGO);
  if (r._status === 401) return telaEntrar();
  if (!r.ok) { $('#jogo').innerHTML = `<div class="glass"><h2>Partida indisponível</h2><p>${esc(r.erro || 'Erro')}</p><a class="btn prim" href="/">Voltar ao início</a></div>`; return; }
  if (aceitar(r) || forcar) render();
}

async function telaEntrar() {
  const r = await api(`/api/jogos/${CODIGO}/resumo`);
  if (!r.ok) { $('#jogo').innerHTML = `<div class="glass"><h2>Partida não encontrada</h2><a class="btn prim" href="/">Voltar ao início</a></div>`; return; }
  $('#jogo').innerHTML = `<div class="glass" style="max-width:480px;margin:40px auto"><h2>Entrar na partida ${CODIGO}</h2><p class="suave">${esc(r.rotulo)} · modo ${esc(r.modo)}</p>
    <div class="col"><label class="campo">Seu nome<input type="text" id="j-nome" maxlength="30"></label>
    <label class="campo">Papel<select id="j-papel">${Object.entries(CAT.papeis).filter(([k]) => k !== 'presidente').map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
    <label class="campo" id="j-pais-box" hidden>Posição<select id="j-pais">${r.entidades.map((e) => `<option value="${e.cod}">${esc(e.nome)}</option>`).join('')}</select></label>
    <button class="btn prim" id="j-ok">Entrar</button></div></div>`;
  $('#j-papel').onchange = () => { $('#j-pais-box').hidden = $('#j-papel').value !== 'lider'; };
  $('#j-ok').onclick = async () => {
    const j = await api(`/api/jogos/${CODIGO}/entrar`, { nome: $('#j-nome').value, papel: $('#j-papel').value, pais: $('#j-pais').value });
    if (!j.ok) return toast(j.erro || 'Erro ao entrar.', 'erro');
    Tokens.set(CODIGO, j.token);
    carregar(true);
  };
}

/* ---------- render ---------- */
function render() {
  const s = G.estado, m = s.meta;
  const fase = m.fase === 'campanha' ? 'Campanha eleitoral' : m.fase === 'fim' ? 'Partida encerrada' : `${m.mandato}º mandato · trimestre ${m.turno_mandato}/16`;
  const bloqueada = m.fase === 'campanha' && !['governo', 'estatisticas', 'config'].includes(TAB);
  const eu = G.eu;
  const abas = ABAS.map(([k, t]) => `<button type="button" class="aba ${k === TAB ? 'ativa' : ''}" data-fn="mudarAba" data-aba="${k}">${t}</button>`).join('');
  const proximo = m.fase === 'campanha' ? 'Avançar campanha' : 'Avançar trimestre';
  $('#jogo').innerHTML = `
    <header class="topo glass">
      <a class="marca" href="/"><img src="/static/img/logo.jpg" alt="Logo"><div><b>${m.modo === 'presidente' ? 'Presidente do Brasil' : 'Governador — ' + esc(m.rotulo)}</b><span>${fase}</span></div></a>
      <div class="row">${avatar(s.jogador.aparencia)}<div><b>${esc(s.jogador.nome)}</b><br><span class="suave peq">${esc(s.jogador.partido)} · ${s.jogador.idade + Math.floor(m.turno / 4)} anos</span></div></div>
      <div class="espaco"></div>
      <span class="chip">📅 ${m.ano} · T${m.trimestre}</span>
      <span class="chip" title="Capital político">Capital ${pips(s.capital)}</span>
      <span class="chip">${esc(CAT.papeis[eu.papel] || eu.papel)}: ${esc(eu.nome)}</span>
      ${eu.anfitriao && !m.encerrado ? `<button type="button" class="btn prim grande" data-fn="avancar" ${s.evento ? 'disabled' : ''}>${proximo} ▶</button>` : ''}
      <button type="button" class="btn" data-fn="alternarTema" title="Alternar tema">◐</button>
    </header>
    ${vKpis()}
    <nav class="glass abas">${abas}</nav>
    <main id="aba">${bloqueada ? '<div class="glass"><h2>🔒 Disponível após a posse</h2><p class="suave">Vença a eleição para acessar esta área.</p></div>' : VIEWS[TAB]()}</main>`;
  modais();
}

function modais() {
  const raiz = $('#modal-raiz');
  const s = G.estado;
  let html = '';
  if (s.meta.encerrado && visto('rel') !== 'oculto') html = modalRelatorio(s.relatorio);
  else if (s.eleicoes.length > Number(visto('eleicoes') || 0)) html = modalEleicao(s.eleicoes[s.eleicoes.length - 1]);
  else if (s.evento) html = modalEvento(s.evento);
  raiz.innerHTML = html;
}

function modalEvento(ev) {
  const host = G.eu.anfitriao;
  return `<div class="fundo-modal"><div class="glass modal forte"><span class="tag alerta">Evento</span><h2 class="mt">${esc(ev.titulo)}</h2><p>${esc(ev.texto)}</p>
    <div class="col">${host ? ev.escolhas.map((c, i) => `<button type="button" class="cand" data-a="responder_evento" data-p='{"escolha":${i}}'><b>${esc(c.label)}</b><small>${esc(c.desc)}</small></button>`).join('')
    : '<p class="suave">Aguardando a decisão do anfitrião…</p>'}</div></div></div>`;
}

function barrasResultado(lista) {
  return lista.map((c) => `<div class="linha-barra"><span>${esc(c.nome)} <small class="suave">${esc(c.partido)}</small></span>${barra(c.pct, 100, c.id === 'jogador' ? 'bom' : '')}<span class="v">${nf(c.pct, 1)}%</span></div>`).join('');
}
function modalEleicao(e) {
  const titulo = { inicial: 'Resultado da eleição', reeleicao: 'Resultado da reeleição', sucessor: 'Eleição do sucessor' }[e.tipo];
  return `<div class="fundo-modal"><div class="glass modal forte"><h2>🗳️ ${titulo} ${e.ano}</h2>
    <h4>1º turno</h4>${barrasResultado(e.turno1)}${e.turno2 ? `<h4 class="mt">2º turno</h4>${barrasResultado(e.turno2)}` : ''}
    <p class="forte-t ${e.venceu ? 'bom' : 'ruim'}">${e.venceu ? (e.tipo === 'sucessor' ? 'Seu sucessor foi eleito!' : 'Você venceu!') : (e.tipo === 'sucessor' ? 'Seu sucessor perdeu.' : 'Você perdeu.')}</p>
    <button type="button" class="btn prim" data-fn="fecharEleicao">Continuar</button></div></div>`;
}

function modalRelatorio(r) {
  const s = G.estado;
  const sub = (t, v) => `<div class="glass kpi"><small>${t}</small><strong>${v}</strong></div>`;
  return `<div class="fundo-modal"><div class="glass modal largo forte"><span class="tag ${r.pontuacao > 250 ? 'bom' : ''}">Relatório do governo</span><h1 style="margin-top:8px">${esc(r.titulo)}</h1><p class="suave">${esc(r.descricao)}</p>
    <div class="kpis">${sub('Pontuação', nf(r.pontuacao, 0))}${sub('Duração', nf(r.anos, 1) + ' anos')}${sub('Popularidade média', nf(r.medias.popularidade, 0) + '%')}${sub('Crescimento médio', nf(r.medias.crescimento, 1) + '%')}
      ${sub('Inflação média', nf(r.medias.inflacao, 1) + '%')}${sub('Desemprego médio', nf(r.medias.desemprego, 1) + '%')}${sub('Dívida final', nf(r.final.divida_pib, 0) + '% PIB')}${sub('Leis aprovadas', r.leis.length)}</div>
    <div class="grid g2"><div><h4>Promessas</h4>${r.promessas.map((p) => `<div class="peq">${p.cumprida ? '✅' : '❌'} ${esc(p.nome)}</div>`).join('') || '<span class="suave peq">Nenhuma promessa feita.</span>'}
      <h4 class="mt">Leis em vigor</h4>${r.leis.map((l) => `<div class="peq">• ${esc(l.nome)}</div>`).join('') || '<span class="suave peq">Nenhuma.</span>'}</div>
      <div><h4>Eleições</h4>${r.eleicoes.map((e) => `<div class="peq">${e.ano} · ${esc(e.tipo)} — <b class="${e.venceu ? 'bom' : 'ruim'}">${e.venceu ? 'vitória' : 'derrota'}</b></div>`).join('') || '<span class="suave peq">—</span>'}
      <h4 class="mt">Resumo</h4><div class="peq">Cenário: ${esc(r.cenario)}<br>Investigações: ${r.investigacoes} · Leis rejeitadas: ${r.leis_rejeitadas} · Derrubadas pelo STF: ${r.leis_derrubadas}<br>Guerras: ${r.guerras.length}</div></div></div>
    <div class="glass mt"><h4>Popularidade ao longo do tempo</h4>${grafico(r.historico, 'popularidade', 'var(--acento)', (v) => nf(v, 0) + '%')}</div>
    <div class="row mt"><a class="btn prim grande" href="/">Iniciar outra partida</a><button type="button" class="btn" data-fn="fecharRelatorio">Fechar</button></div></div></div>`;
}

/* ---------- ações ---------- */
async function enviar(url, corpo) {
  ocupado = true;
  const r = await api(url, corpo, CODIGO);
  ocupado = false;
  if (r.estado) { aceitar(r); render(); }
  if (r.msg || r.erro) toast(r.msg || r.erro, r.ok ? 'ok' : 'erro');
  return r;
}
const agir = (tipo, params) => enviar(`/api/jogos/${CODIGO}/acao`, { tipo, params });

const FN = {
  mudarAba(el) { TAB = el.dataset.aba; try { localStorage.setItem('sim_aba', TAB); } catch {} render(); },
  mudarTema(el) { Tema.set(el.dataset.tema); render(); },
  alternarTema() { Tema.alternar(); },
  avancar() { agir('avancar_turno', {}); },
  abrirPasta(el) { UI.pastaAberta = UI.pastaAberta === el.dataset.id ? null : el.dataset.id; render(); },
  selecionarEntidade(el) {
    const id = el.dataset.id;
    if (!id || !G.estado.diplomacia.entidades[id]) return;
    UI.sel = id;
    if (TAB === 'governo') { TAB = 'diplomacia'; }
    render();
  },
  fecharAlianca() { const v = $('#ali-sel') && $('#ali-sel').value; if (v) agir('campanha', { acao: 'alianca', partido: v }); },
  aplicarImpostos() { agir('ajustar_impostos', UI.draft.imp); },
  aplicarOrcamento() { agir('ajustar_orcamento', { gasto_pct: UI.draft.gasto, aloc: UI.draft.aloc }); },
  fecharEleicao() { marcar('eleicoes', G.estado.eleicoes.length); modais(); },
  fecharRelatorio() { marcar('rel', 'oculto'); modais(); },
  verRelatorio() { marcar('rel', ''); modais(); },
  copiarLink(el) { navigator.clipboard?.writeText(el.dataset.link).then(() => toast('Link copiado!'), () => toast(el.dataset.link)); },
  async enviarMsg() {
    const i = $('#msg'); if (!i || !i.value.trim()) return;
    const r = await api(`/api/jogos/${CODIGO}/mensagem`, { texto: i.value }, CODIGO);
    if (!r.ok) return toast(r.erro, 'erro');
    i.value = ''; carregar(true);
  },
  async enviarPedido(el) {
    const tipo = el.dataset.tipo;
    const payload = { valor: $('#ped-valor')?.value, setor: $('#ped-setor')?.value, acao: $('#ped-acao')?.value };
    const r = await api(`/api/jogos/${CODIGO}/pedidos`, { tipo, payload }, CODIGO);
    toast(r.ok ? 'Pedido enviado ao anfitrião.' : r.erro, r.ok ? 'ok' : 'erro');
    if (r.ok) carregar(true);
  },
  decidirPedido(el) { enviar(`/api/jogos/${CODIGO}/pedidos/${el.dataset.id}/decidir`, { aprovar: el.dataset.ok === '1' }); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-fn],[data-a]');
  if (!el || el.disabled) return;
  if (el.dataset.confirm && !confirm(el.dataset.confirm)) return;
  if (el.dataset.fn && FN[el.dataset.fn]) return FN[el.dataset.fn](el);
  if (el.dataset.fn && window[el.dataset.fn]) return window[el.dataset.fn](el);
  if (el.dataset.a) {
    let p = {};
    try { p = JSON.parse(el.dataset.p || '{}'); } catch {}
    agir(el.dataset.a, p);
  }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.id === 'msg') FN.enviarMsg(); });

/* sliders de impostos/orçamento: mantêm rascunho local até "Aplicar" */
document.addEventListener('input', (ev) => {
  const sl = ev.target.dataset && ev.target.dataset.sl;
  if (!sl || !UI.draft) return;
  const [grp, id] = sl.split(':');
  const v = Number(ev.target.value);
  if (grp === 'imp') { UI.draft.imp[id] = v; $(`[data-out="${sl}"]`).textContent = nf(v, 1) + '%'; }
  else if (grp === 'gasto') { UI.draft.gasto = v; $(`[data-out="${sl}"]`).textContent = nf(v, 1) + '% da receita'; }
  else if (grp === 'aloc') {
    UI.draft.aloc[id] = v;
    const soma = Object.entries(UI.draft.aloc).filter(([k]) => NAC() || k !== 'defesa').reduce((a, [, x]) => a + x, 0) || 1;
    $$('[data-out^="aloc:"]').forEach((o) => { o.textContent = nf((UI.draft.aloc[o.dataset.out.split(':')[1]] / soma) * 100, 0) + '%'; });
  }
});

boot();
