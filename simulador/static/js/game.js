/* Tela de jogo: carregamento, estrutura, modais, ações e sincronização multiplayer */
const CODIGO = document.body.dataset.codigo;
let G = null, CAT = null, TAB = 'governo', ocupado = false, modalLocal = null;
const visto = (k) => { try { return sessionStorage.getItem(k + CODIGO); } catch { return null; } };
const marcar = (k, v) => { try { sessionStorage.setItem(k + CODIGO, v); } catch {} };

async function boot() {
  CAT = await api('/api/catalogo');
  const salva = guardar.get('sim_aba');
  TAB = salva || 'governo';
  if (!VIEWS[TAB]) TAB = 'governo';
  await carregar(true);
  if (G && !G.eu.governa && !salva) { TAB = 'sala'; render(false); }
  sincronizar();
}
/* Multiplayer: a cada 3 s pergunta ao servidor só uma "assinatura" (versão, jogadores, chat, pedidos);
   a partida inteira só é baixada quando algo mudou. Roda sempre, mesmo com um jogador só,
   para o anfitrião ver quem acabou de entrar. */
let assinatura = null;
async function sincronizar() {
  try {
    if (G && !document.hidden && !ocupado) {
      const r = await api(`/api/jogos/${CODIGO}/sinal`, undefined, CODIGO);
      if (r.ok && assinatura !== null && r.assinatura !== assinatura && !ocupado) await carregar(false);
      if (r.ok) assinatura = r.assinatura;
    }
  } finally { setTimeout(sincronizar, 3000); }
}
function avisos(antigo, novo) {
  if (!antigo) return;
  const eu = novo.eu;
  const nomes = new Set(antigo.jogadores.map((j) => j.nome + j.papel));
  novo.jogadores.filter((j) => !nomes.has(j.nome + j.papel)).forEach((j) => toast(`${j.nome} entrou na sala como ${CAT.papeis[j.papel] || j.papel}.`));
  const ultima = antigo.mensagens[antigo.mensagens.length - 1]?.ts || 0;
  novo.mensagens.filter((m) => m.ts > ultima && m.autor !== eu.nome).slice(-2).forEach((m) => { if (TAB !== 'sala') toast(`${m.autor}: ${m.texto}`); });
  const antes = Object.fromEntries(antigo.pedidos.map((p) => [p.id, p.status]));
  novo.pedidos.forEach((p) => {
    if (euDecido(p, eu) && !(p.id in antes) && p.status === 'pendente') toast(`${p.nome}: ${p.autor} aguarda sua decisão na aba Sala.`);
    if (p.autor_id === eu.id && antes[p.id] === 'pendente' && p.status !== 'pendente') toast(`${p.nome}: ${p.status === 'aprovado' ? 'aceito' : 'recusado'}.`, p.status === 'aprovado' ? 'ok' : 'erro');
  });
  const novas = (novo.mp.propostas_para_mim || []).length - (antigo.mp?.propostas_para_mim || []).length;
  if (novas > 0) toast('Você recebeu uma proposta de acordo. Veja a aba Sala.');
  if (novo.estado.meta.turno !== antigo.estado.meta.turno && antigo.mp.pronto.total > 1) toast(`Todos prontos: ${novo.estado.meta.ano} · ${novo.estado.meta.trimestre}º trimestre.`);
}
function aceitar(r) {
  const mudou = !G || r.versao !== G.versao || r.mensagens.length !== G.mensagens.length || JSON.stringify(r.jogadores) !== JSON.stringify(G.jogadores)
    || JSON.stringify(r.pedidos.map((p) => p.status)) !== JSON.stringify(G.pedidos.map((p) => p.status));
  if (!G || r.versao !== G.versao) UI.draft = null;
  avisos(G, r);
  G = r;
  return mudou;
}
async function carregar(forcar) {
  const r = await api(`/api/jogos/${CODIGO}`, undefined, CODIGO);
  if (r._status === 401) return telaEntrar();
  if (!r.ok) { $('#jogo').innerHTML = `<div class="veu"><div class="vidro modal">${UIc.vazio(esc(r.erro || 'Erro'), 'alerta')}<a class="btn btn-ouro" href="/">Voltar ao menu</a></div></div>`; return; }
  // quem entra numa sala já em andamento só vê os resultados das eleições futuras
  if (!G && !r.eu.governa && visto('eleicoes') === null) marcar('eleicoes', r.estado.eleicoes.length);
  if (aceitar(r) || forcar) render(forcar);
}
async function telaEntrar() {
  const r = await api(`/api/jogos/${CODIGO}/resumo`);
  if (!r.ok) { $('#jogo').innerHTML = `<div class="veu"><div class="vidro modal">${UIc.vazio('Partida não encontrada.', 'alerta')}<a class="btn btn-ouro" href="/">Voltar ao menu</a></div></div>`; return; }
  $('#jogo').innerHTML = `<div class="veu"><div class="vidro modal"><span class="rotulo">Partida ${CODIGO}</span><h2 class="titulo-display" style="font-size:1.7rem">Entrar na partida</h2><p class="suave">${esc(r.rotulo)} · ${esc(r.modo)}</p>
    <div class="coluna" style="gap:12px"><label class="campo">Seu nome<input type="text" id="j-nome" maxlength="30"></label>
    <label class="campo">Papel<select id="j-papel">${Object.entries(CAT.papeis).filter(([k]) => k !== 'presidente').map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
    <label class="campo" id="j-pais-box" hidden>Posição<select id="j-pais">${r.entidades.map((e) => `<option value="${e.cod}">${esc(e.nome)}</option>`).join('')}</select></label>
    <div id="j-gov-box">${camposGovernador(r)}</div>
    <button type="button" class="btn btn-ouro btn-grande" id="j-ok">Entrar</button></div></div></div>`;
  const papel = () => $('#j-papel').value;
  $('#j-papel').value = r.modo === 'presidente' ? 'governador' : 'ministro';
  const ver = () => { $('#j-pais-box').hidden = papel() !== 'lider'; $('#j-gov-box').hidden = papel() !== 'governador'; };
  $('#j-papel').onchange = ver; ver();
  $('#j-ok').onclick = async () => {
    const j = await api(`/api/jogos/${CODIGO}/entrar`, { nome: $('#j-nome').value, papel: papel(), pais: $('#j-pais').value, uf: $('#j-uf')?.value, partido: $('#j-partido')?.value, ideologia: $('#j-ideo')?.value });
    if (!j.ok) return toast(j.erro || 'Erro ao entrar.', 'erro');
    Tokens.set(CODIGO, j.token); carregar(true);
  };
}

/* ---------- pronto ----------
   Sozinho na sala, o botão avança na hora. Com outros jogadores online, cada um marca "Pronto"
   e o trimestre avança quando todos estiverem prontos. */
const euDecido = (p, eu = G.eu) => (p.destino ? p.destino === eu.id : eu.anfitriao);
function botaoPronto(prox) {
  const s = G.estado, pr = G.mp.pronto, eu = G.eu;
  if (s.meta.encerrado && eu.governa) return '';
  if (pr.total <= 1) return `<button type="button" class="btn btn-ouro btn-turno" data-fn="avancar" ${s.evento && eu.governa ? 'disabled title="Responda ao evento primeiro"' : ''}>${prox}${icone('dir', 'p')}</button>`;
  const faltam = pr.faltam.filter((n) => n !== eu.nome);
  const dica = faltam.length ? `Aguardando: ${faltam.join(', ')}` : 'Todos prontos';
  return `<button type="button" class="btn btn-turno ${eu.pronto ? 'pronto-on' : 'btn-ouro'}" data-fn="avancar" title="${esc(dica)}" ${s.evento && eu.governa && !eu.pronto ? 'disabled' : ''}>
    ${eu.pronto ? icone('check', 'p') + ' Pronto' : 'Estou pronto'} <span class="contagem">${pr.prontos}/${pr.total}</span></button>`;
}

/* ---------- estrutura ---------- */
function render(animar) {
  const s = G.estado, m = s.meta, eu = G.eu;
  const fase = m.fase === 'campanha' ? 'Campanha eleitoral' : m.fase === 'fim' ? 'Partida encerrada' : `${m.mandato}º mandato · trimestre ${m.turno_mandato} de 16`;
  const bloqueada = (k) => m.fase === 'campanha' && !['governo', 'estatisticas', 'config', 'diplomacia', 'sala'].includes(k);
  const badges = { sala: pendenciasSala(), diplomacia: (s.diplomacia.propostas || []).length };
  const navs = ABAS.map(([k, ic, t]) => `<button type="button" class="nav-item ${k === TAB ? 'ativa' : ''} ${bloqueada(k) ? 'bloq' : ''}" data-fn="mudarAba" data-aba="${k}" aria-current="${k === TAB ? 'page' : 'false'}">${icone(ic)}<span>${t}</span>${badges[k] ? `<i class="badge">${badges[k]}</i>` : ''}</button>`).join('');
  const prox = m.fase === 'campanha' ? 'Avançar campanha' : 'Encerrar trimestre';
  const scroll = window.scrollY;
  // preserva o que o jogador está digitando (chat, valores) quando a tela é redesenhada pela sincronização
  const campos = $$('#jogo input[id], #jogo select[id], #jogo textarea[id]').map((el) => [el.id, el.value]);
  const foco = document.activeElement && document.activeElement.id;
  const chatAntes = $('#chat');
  const chatNoFim = !chatAntes || chatAntes.scrollTop + chatAntes.clientHeight >= chatAntes.scrollHeight - 30;
  $('#jogo').innerHTML = `<div class="app">
    <aside class="vidro lateral"><a href="/" title="Menu inicial"><img class="logo" src="/static/img/logo.jpg" alt="Menu inicial"></a>${navs}<span class="espaco"></span>
      <button type="button" class="nav-item" data-fn="abrirTutorial" aria-label="Tutorial">${icone('info')}<span>Tutorial</span></button>
      <button type="button" class="nav-item" data-fn="alternarTema" aria-label="Alternar tema">${icone(document.documentElement.dataset.theme === 'dark' ? 'sol' : 'lua')}<span>Tema</span></button></aside>
    <div class="principal">
      <header class="vidro barra-topo"><div class="governante">${avJogador()}<div class="flex1" style="min-width:0"><b>${esc(s.jogador.nome)}</b>
        <div class="sub">${selo(s.jogador.partido)}<span>${m.modo === 'presidente' ? (m.fase === 'governo' ? 'Presidente da República' : 'Candidato(a) à Presidência') : (m.fase === 'governo' ? 'Governador(a) — ' : 'Candidato(a) — ') + esc(m.rotulo)}</span></div></div></div>
        <div class="topo-info"><button type="button" class="chip" style="cursor:pointer" data-fn="copiarLink" data-link="${esc(location.origin + '/jogo/' + G.codigo)}" title="Copiar convite multiplayer">${icone('link', 'p')}Sala <b style="letter-spacing:.15em;color:var(--ouro)">${G.codigo}</b> · ${G.jogadores.length} jogador${G.jogadores.length > 1 ? 'es' : ''}</button><span class="chip">${icone('calendario', 'p')}${m.ano} · ${m.trimestre}º tri</span><span class="chip">${esc(fase)}</span>
          <span class="capital" title="Capital político: gasto em leis, nomeações, negociações e diplomacia">${icone('raio', 'p')}Capital <span class="pips">${Array.from({ length: 8 }, (_, i) => `<i class="pip ${i < s.capital ? 'on' : ''}"></i>`).join('')}</span></span>
          ${m.fase !== 'campanha' ? `<div class="mini-anel" title="Popularidade">${UIc.anel(s.popularidade, 100, '', corEstado(s.popularidade, 55, 35), 46, pct(s.popularidade))}</div>` : ''}
          ${botaoPronto(prox)}
          ${!eu.governa ? `<span class="selo">${esc(CAT.papeis[eu.papel] || eu.papel)} · ${esc(eu.nome)}</span>` : ''}</div></header>
      ${vKpis()}
      <main id="aba" class="${animar ? '' : 'sem-anim'}">${bloqueada(TAB) ? `<section class="vidro painel">${UIc.vazio('Disponível após a posse. Vença a eleição para governar.', 'urna')}</section>` : VIEWS[TAB]()}</main>
    </div></div>
    <nav class="vidro nav-inferior" aria-label="Abas">${navs}</nav>`;
  if (!animar) $('#aba').style.animation = 'none';
  for (const [id, v] of campos) {
    const el = document.getElementById(id);
    if (!el || el.type === 'range' || v === '') continue;
    if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === v)) continue;
    el.value = v;
  }
  if (foco) { const el = document.getElementById(foco); if (el && el.focus) { el.focus(); if (el.type === 'text' && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length); } }
  const chat = $('#chat');
  if (chat && chatNoFim) chat.scrollTop = chat.scrollHeight;
  window.scrollTo(0, scroll);
  POS_RENDER[TAB]?.();
  Retratos.carregar($('#jogo'));
  modais();
  if (typeof Tutorial !== 'undefined') Tutorial.reposicionar();
}

/* ---------- modais ---------- */
function modais() {
  const s = G.estado, raiz = $('#modal-raiz');
  let html = '';
  if (modalLocal) html = modalLocal();
  else if (s.meta.encerrado && visto('rel') !== 'oculto') html = modalRelatorio(s.relatorio);
  else if (s.eleicoes.length > Number(visto('eleicoes') || 0)) html = modalEleicao(s.eleicoes[s.eleicoes.length - 1]);
  else if (s.evento && (G.eu.governa || visto('ev') !== s.evento.titulo)) html = modalEvento(s.evento);
  raiz.innerHTML = html;
  Retratos.carregar(raiz);
  // primeira partida: abre o tutorial quando não há nenhuma janela na frente
  if (!html && G.eu.governa && !guardar.get('sim_tutorial') && typeof Tutorial !== 'undefined' && !Tutorial.ativo) Tutorial.iniciar();
}
function modalEvento(ev) {
  const tag = ev.obrigatorio ? `<span class="selo ouro tag-ev">${icone('globo', 'p')} Cúpula internacional · participação obrigatória</span>` : `<span class="selo alerta tag-ev">${icone('raio', 'p')} Evento · simulado</span>`;
  return `<div class="veu"><div class="vidro modal evento-modal" role="dialog" aria-modal="true">${tag}
    <h2>${esc(ev.titulo)}</h2><p class="suave">${esc(ev.texto)}</p>
    ${G.eu.governa ? ev.escolhas.map((c, i) => `<button type="button" class="opcao-ev" data-a="responder_evento" data-p='{"escolha":${i}}'><span class="n">${i + 1}</span><span class="flex1"><b>${esc(c.label)}</b><div class="mini fraco">${esc(c.desc)}</div></span>${icone('dir', 'p')}</button>`).join('')
    : `<div class="vazio"><span class="spinner"></span>Aguardando a decisão do anfitrião…</div><div class="linha" style="justify-content:flex-end"><button type="button" class="btn btn-mini" data-fn="fecharEvento">Fechar</button></div>`}</div></div>`;
}
function modalEleicao(e) {
  const titulo = e.historica ? `Eleição de ${e.ano}` : { inicial: 'Resultado da eleição', reeleicao: `Eleição de ${e.ano}: reeleição`, sucessor: `Eleição de ${e.ano}: sucessão` }[e.tipo];
  const lista = (l) => { const max = Math.max(...l.map((c) => c.pct)); return l.map((c) => `<div class="candidato-linha ${c.id === 'jogador' ? 'eu' : ''}">${avCand(c)}<div><b class="peq">${esc(c.nome)}</b><div class="mini fraco">${selo(c.partido)} ${esc(c.partido)}</div></div>${UIc.medidor(c.pct, max * 1.05, c.id === 'jogador' ? 'var(--ouro)' : partidoDe(c.partido).cor)}<b class="num" style="text-align:right">${nf(c.pct, 1)}%</b></div>`).join(''); };
  const ganhou = e.venceu;
  return `<div class="veu"><div class="vidro modal largo" role="dialog" aria-modal="true"><span class="selo ouro">${icone('urna', 'p')} ${e.ano}</span><h2 class="titulo-display" style="font-size:2rem;margin:10px 0">${titulo}</h2>
    <div class="grade ${e.turno2 ? 'g2' : ''}"><div><div class="rotulo">1º turno</div>${lista(e.turno1)}</div>${e.turno2 ? `<div><div class="rotulo">2º turno</div>${lista(e.turno2)}</div>` : ''}</div>
    <div class="vencedor ${ganhou ? '' : 'derrota'}"><div class="titulo-display" style="font-size:1.6rem">${ganhou ? (e.tipo === 'sucessor' ? 'Seu sucessor foi eleito!' : 'Vitória!') : (e.tipo === 'sucessor' ? 'Seu sucessor foi derrotado' : 'Derrota nas urnas')}</div>
      <div class="suave peq">${e.historica ? `Cenário alternativo: ${S().meta.escopo === 'nacional' ? 'os percentuais são os oficiais do TSE, mas ' : ''}você ocupa o lugar do vencedor. Posse em 1º de janeiro de ${e.ano + 1}; a próxima eleição é em ${e.ano + 4}.`
        : ganhou ? (e.tipo === 'inicial' ? 'Prepare-se para a posse e monte seu gabinete.' : 'O eleitorado aprovou seu governo.') : 'O eleitorado escolheu outro caminho.'}</div></div>
    <div class="linha mt" style="justify-content:flex-end"><button type="button" class="btn btn-ouro btn-grande" data-fn="fecharEleicao">Continuar ${icone('dir', 'p')}</button></div></div></div>`;
}
function modalRelatorio(r) {
  const k = (t, v) => `<div class="vidro kpi"><div class="rotulo">${t}</div><div class="valor" style="font-size:1.3rem">${v}</div></div>`;
  return `<div class="veu"><div class="vidro modal largo" role="dialog" aria-modal="true">
    <div class="rel-cab">${avJogador()}<div><span class="selo ouro">${icone('trofeu', 'p')} Relatório do governo</span><h2 class="titulo-display" style="font-size:2.1rem;margin:8px 0 4px">${esc(r.titulo)}</h2><p class="suave mb0">${esc(r.descricao)}</p></div>
      ${UIc.anel(Math.min(r.pontuacao, 600), 600, 'pontos', 'var(--ouro)', 120, nf(r.pontuacao, 0))}</div>
    <div class="faixa-kpi mt">${k('Duração', nf(r.anos, 1) + ' anos')}${k('Mandatos', r.mandatos)}${k('Popularidade média', pct(r.medias.popularidade))}${k('Crescimento médio', pct(r.medias.crescimento, 1))}
      ${k('Inflação média', pct(r.medias.inflacao, 1))}${k('Dívida final', pct(r.final.divida_pib) + ' PIB')}${k('Leis aprovadas', r.leis.length)}</div>
    <div class="grade g2"><section class="vidro painel"><div class="rotulo">Promessas</div>${r.promessas.map((p) => `<div class="peq" style="padding:4px 0">${p.cumprida ? '<span class="bom">✔</span>' : '<span class="ruim">✖</span>'} ${esc(p.nome)}</div>`).join('') || '<div class="fraco peq">Nenhuma.</div>'}
      <div class="rotulo mt">Leis em vigor</div>${r.leis.map((l) => `<div class="peq" style="padding:3px 0">• ${esc(l.nome)}</div>`).join('') || '<div class="fraco peq">Nenhuma.</div>'}</section>
      <section class="vidro painel"><div class="rotulo">Popularidade</div>${graficoArea(r.historico, 'popularidade', 'var(--ouro)', (v) => pct(v))}
      <div class="rotulo mt">Eleições</div>${r.eleicoes.map((e) => `<div class="peq">${e.ano} · ${esc(e.tipo)} — <b class="${e.venceu ? 'bom' : 'ruim'}">${e.venceu ? 'vitória' : 'derrota'}</b></div>`).join('') || '<div class="fraco peq">—</div>'}
      <div class="mini fraco mt">Cenário: ${esc(r.cenario)} · investigações: ${r.investigacoes} · leis rejeitadas: ${r.leis_rejeitadas} · derrubadas pelo STF: ${r.leis_derrubadas} · guerras: ${r.guerras.length}</div></section></div>
    <div class="linha mt" style="justify-content:flex-end"><button type="button" class="btn" data-fn="fecharRelatorio">Fechar</button><a class="btn btn-ouro btn-grande" href="/#novo">${icone('play', 'p')} Nova partida</a></div></div></div>`;
}
function modalMinistro(pasta) {
  return () => {
    const s = G.estado, m = s.ministros[pasta], cands = s.candidatos_ministros[pasta] || [];
    const linha = (c, i) => `<div class="vidro forte painel"><div class="linha nw">${avNPC(c.nome, c.idade).replace('avatar-moldura', 'avatar-moldura" style="width:64px')}<div class="flex1"><b>${esc(c.nome)}</b><div class="mini fraco">${selo(c.partido)} ${esc(c.partido)} · ${c.idade} anos</div></div></div>
      ${UIc.barra('Competência', c.competencia, 'var(--azul)')}${UIc.barra('Integridade', c.integridade, c.integridade < 50 ? 'var(--vermelho)' : 'var(--verde)')}${UIc.barra('Carisma', c.carisma, 'var(--roxo)')}
      ${i !== undefined ? bA('Nomear (1 capital)', 'nomear_ministro', { pasta, indice: i }, 'btn-ouro btn-mini', '', 'check') : ''}</div>`;
    return `<div class="veu" data-fn="fecharModal"><div class="vidro modal largo" role="dialog" aria-modal="true" data-parar="1"><div class="linha entre nw"><div><span class="rotulo">${icone(ICO_PASTA[pasta] || 'pasta', 'p')} Gabinete</span><h2 class="titulo-display" style="font-size:1.7rem;margin:6px 0">${esc(rotuloPasta(pasta))}</h2></div>
      ${bF('', 'fecharModal', 'btn-icone btn-fantasma', 'aria-label="Fechar"', 'x')}</div>
      ${m ? `<div class="rotulo">Titular atual</div><div class="grade g2 mt">${linha(m)}<div class="coluna" style="justify-content:center">${bA('Exonerar', 'demitir_ministro', { pasta }, 'btn-perigo', '', 'sair')}<p class="mini fraco">Exonerar reduz a afinidade do partido do ministro.</p></div></div>` : '<p class="alerta">Pasta vaga — o setor piora a cada trimestre.</p>'}
      <div class="rotulo mt-g">Candidatos indicados</div><div class="grade g3 mt">${cands.map((c, i) => linha(c, i)).join('')}</div></div></div>`;
  };
}

/* ---------- ações ---------- */
async function enviar(url, corpo) {
  ocupado = true;
  const r = await api(url, corpo, CODIGO);
  ocupado = false;
  if (r.estado) { aceitar(r); render(false); }
  if (r.msg || r.erro) toast(r.msg || r.erro, r.ok ? 'ok' : 'erro');
  return r;
}
const agir = (tipo, params) => enviar(`/api/jogos/${CODIGO}/acao`, { tipo, params });

const FN = {
  mudarAba(el) { TAB = el.dataset.aba; guardar.set('sim_aba', TAB); render(true); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  mudarTema(el) { Tema.set(el.dataset.tema); render(false); },
  alternarTema() { Tema.alternar(); render(false); },
  async avancar(el) {
    el.disabled = true; el.innerHTML = '<span class="spinner"></span>';
    await enviar(`/api/jogos/${CODIGO}/pronto`, { pronto: !G.eu.pronto });
  },
  forcarAvanco() { enviar(`/api/jogos/${CODIGO}/pronto`, { forcar: true }); },
  irSala() { TAB = 'sala'; guardar.set('sim_aba', TAB); render(true); },
  acaoGov(el) {
    const id = el.dataset.id, tipo = el.dataset.tipo;
    const payload = { governador: id, valor: $(`#gv-valor-${id}`)?.value, setor: $(`#gv-setor-${id}`)?.value };
    enviar(`/api/jogos/${CODIGO}/pedidos`, { tipo, payload });
  },
  pedirPresidente(el) {
    enviar(`/api/jogos/${CODIGO}/pedidos`, { tipo: el.dataset.tipo, payload: { valor: $('#pp-valor')?.value, setor: $('#pp-setor')?.value } });
  },
  abrirPasta(el) { if (G.estado.meta.fase === 'campanha') return; modalLocal = modalMinistro(el.dataset.id); modais(); },
  fecharModal(el, ev) { if (ev && ev.target.closest('[data-parar]') && !ev.target.closest('[data-fn="fecharModal"].btn')) return; modalLocal = null; modais(); },
  selecionarEnt(el) { UI.sel = el.dataset.id; render(false); },
  fecharSel() { UI.sel = null; $('#sel-gov').innerHTML = ''; $$('.mapa-forma.sel').forEach((p) => p.classList.remove('sel')); },
  irDiplomacia() { TAB = 'diplomacia'; guardar.set('sim_aba', TAB); render(true); },
  destacar(el) { UI.destaque = el.dataset.v || null; render(false); },
  catLei(el) { UI.catLei = el.dataset.v; render(false); },
  fecharAlianca() { const v = $('#ali-sel')?.value; if (v) agir('campanha', { acao: 'alianca', partido: v }); },
  aplicarImpostos() { agir('ajustar_impostos', UI.draft.imp); },
  aplicarOrcamento() { agir('ajustar_orcamento', { gasto_pct: UI.draft.gasto, aloc: UI.draft.aloc }); },
  fecharEleicao() { marcar('eleicoes', G.estado.eleicoes.length); modais(); },
  fecharRelatorio() { marcar('rel', 'oculto'); modais(); },
  verRelatorio() { marcar('rel', ''); modais(); },
  copiarLink(el) { const t = `Entre na minha partida do Simulador Presidencial: ${el.dataset.link} (código ${G.codigo})`; navigator.clipboard?.writeText(t).then(() => toast('Convite copiado! Envie aos amigos.'), () => toast(el.dataset.link)); },
  async enviarMsg() {
    const i = $('#msg'); if (!i || !i.value.trim()) return;
    const r = await api(`/api/jogos/${CODIGO}/mensagem`, { texto: i.value }, CODIGO);
    if (!r.ok) return toast(r.erro, 'erro');
    i.value = ''; carregar(true);
  },
  async enviarPedido(el) {
    const [pauta, proposta] = ($('#ped-prop')?.value || ':').split(':');
    const payload = { valor: $('#ped-valor')?.value, setor: $('#ped-setor')?.value, acao: $('#ped-acao')?.value, pauta, proposta };
    const r = await api(`/api/jogos/${CODIGO}/pedidos`, { tipo: el.dataset.tipo, payload }, CODIGO);
    toast(r.ok ? 'Pedido enviado ao anfitrião.' : r.erro, r.ok ? 'ok' : 'erro');
    if (r.ok) carregar(true);
  },
  decidirPedido(el) { enviar(`/api/jogos/${CODIGO}/pedidos/${el.dataset.id}/decidir`, { aprovar: el.dataset.ok === '1' }); },
  responderLider(el) { enviar(`/api/jogos/${CODIGO}/propostas/${el.dataset.id}/responder`, { aceitar: el.dataset.ok === '1', origem: el.dataset.origem ? Number(el.dataset.origem) : null }); },
  propConsorcio(el) { enviar(`/api/jogos/${CODIGO}/pedidos`, { tipo: 'consorcio', payload: { governador: el.dataset.id } }); },
  fecharEvento() { marcar('ev', G.estado.evento?.titulo || ''); modais(); },
  abrirTutorial() { Tutorial.iniciar(true); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-fn],[data-a]');
  if (!el || el.disabled) return;
  if (el.dataset.fn === 'fecharModal') { if (el.classList.contains('veu') && ev.target !== el) return; return FN.fecharModal(); }
  if (el.dataset.confirmar && !confirm(el.dataset.confirmar)) return;
  if (el.dataset.fn && FN[el.dataset.fn]) return FN[el.dataset.fn](el, ev);
  if (el.dataset.a) {
    let p = {};
    try { p = JSON.parse(el.dataset.p || '{}'); } catch {}
    if (el.dataset.a === 'nomear_ministro' || el.dataset.a === 'demitir_ministro') modalLocal = null;
    agir(el.dataset.a, p);
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.id === 'msg') FN.enviarMsg();
  if (ev.key === 'Escape' && modalLocal) { modalLocal = null; modais(); }
});

/* controles deslizantes: rascunho local até “Aplicar” */
document.addEventListener('input', (ev) => {
  const sl = ev.target.dataset && ev.target.dataset.sl;
  if (!sl || !UI.draft) return;
  const [grp, id] = sl.split(':'), t = ev.target, v = Number(t.value);
  t.style.setProperty('--p', `${((v - t.min) / (t.max - t.min)) * 100}%`);
  if (grp === 'imp') { UI.draft.imp[id] = v; $(`[data-out="${sl}"]`).textContent = pct(v, 1); }
  else if (grp === 'gasto') { UI.draft.gasto = v; $(`[data-out="${sl}"]`).textContent = pct(v, 1); }
  else if (grp === 'aloc') {
    UI.draft.aloc[id] = v;
    const soma = Object.entries(UI.draft.aloc).filter(([k]) => NAC() || k !== 'defesa').reduce((a, [, x]) => a + x, 0) || 1;
    $$('[data-out^="aloc:"]').forEach((o) => { o.textContent = pct((UI.draft.aloc[o.dataset.out.split(':')[1]] / soma) * 100); });
    $('#rosca').innerHTML = rosca(UI.draft.aloc);
  }
});

boot();
