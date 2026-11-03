/* Abas da tela de jogo. Estado global: G (pacote da API), CAT (catálogo), UI (estado local de interface). */
const UI = { sel: null, nomeSel: '', destaque: null, catLei: 'todas', vista: {}, draft: null, subMais: 'povo', abertos: new Set() };
const S = () => G.estado;
const D = () => G.derivados;
const NAC = () => G.estado.meta.escopo === 'nacional';
const PODE = () => G.eu.governa && !G.estado.meta.encerrado;  // presidente (anfitrião) ou governador com estado próprio
const cargo = () => (NAC() ? 'Presidente' : 'Governador');
const rotuloPasta = (p) => CAT.pastas[p][S().meta.escopo] || CAT.pastas[p].nacional;
const ICO_SETOR = { saude: 'coracao', educacao: 'capelo', seguranca: 'escudo', infraestrutura: 'predio', social: 'pessoas', meio_ambiente: 'folha', defesa: 'escudo' };
const ICO_PASTA = { fazenda: 'moedas', casa_civil: 'palacio', saude: 'coracao', educacao: 'capelo', seguranca: 'escudo', infraestrutura: 'predio', meio_ambiente: 'folha', desenvolvimento_social: 'pessoas', defesa: 'mira', relacoes_exteriores: 'globo' };
const ICO_CAT = { Economia: 'moedas', Social: 'coracao', Infraestrutura: 'predio', 'Meio ambiente': 'folha', Justiça: 'justica', Tecnologia: 'raio', Defesa: 'escudo' };

function bA(txt, tipo, params, cls = '', extra = '', ico = '') {
  return `<button type="button" class="btn ${cls}" data-a="${tipo}" data-p='${esc(JSON.stringify(params || {}))}' ${PODE() ? '' : 'disabled'} ${extra}>${ico ? icone(ico, 'p') : ''}${txt}</button>`;
}
const bF = (txt, fn, cls = '', extra = '', ico = '') => `<button type="button" class="btn ${cls}" data-fn="${fn}" ${extra}>${ico ? icone(ico, 'p') : ''}${txt}</button>`;
const apJogador = () => {
  const s = S(), ap = s.jogador.aparencia || {};
  // governador que entrou numa sala não passou pelo criador de personagem: rosto sorteado pelo nome
  const base = Object.keys(ap).length ? ap : Avatar.aleatoria(s.jogador.nome);
  return { ...base, ...(s.meta.modo === 'presidente' && s.meta.mandato > 0 ? { faixa: 'sim' } : {}) };
};
const avJogador = (cls = '') => `<div class="avatar-moldura ${cls}">${Avatar.svg(apJogador(), { idade: S().jogador.idade + Math.floor(S().meta.turno / 4), partidoCor: partidoDe(S().jogador.partido).cor })}</div>`;
const avNPC = (nome, idade = 52) => `<div class="avatar-moldura">${Avatar.svg(Avatar.aleatoria(nome), { idade })}</div>`;
/* candidato: o jogador, um político real (foto da Wikipédia sobre o avatar) ou um personagem fictício */
const avCand = (c) => (c.id === 'jogador' ? avJogador() : c.wiki
  ? `<div class="avatar-moldura foto-real" data-wiki="${esc(c.wiki)}" data-alt="${esc(c.nome)}">${Avatar.svg(Avatar.aleatoria(c.nome), { idade: 60 })}</div>` : avNPC(c.nome));
const partidoDe = (sigla) => S().congresso.partidos[sigla] || { sigla, cor: '#777' };
const selo = (sigla) => { const p = partidoDe(sigla); return UIc.partido(p.sigla, p.cor, p.numero); };
const pct = (v, d = 0) => nf(v, d) + '%';

function delta(chave, inverso = false, d = 1) {
  const h = S().historico;
  if (h.length < 2) return '<span class="fraco">—</span>';
  const x = h[h.length - 1][chave] - h[h.length - 2][chave];
  if (Math.abs(x) < 0.05) return '<span class="fraco">estável</span>';
  return `<span class="${(inverso ? x < 0 : x > 0) ? 'bom' : 'ruim'}">${x > 0 ? '▲' : '▼'} ${nf(Math.abs(x), d)}</span>`;
}
const serie = (k) => S().historico.slice(-12).map((x) => x[k]);

/* ---------- faixa de indicadores ---------- */
const NIVEL_COR = { 'var(--verde)': 'bom', 'var(--ambar)': 'atenção', 'var(--vermelho)': 'ruim' };
function vKpis() {
  const s = S(), e = s.economia, c = s.campanha;
  const k = (rot, ico, val, cor, extra = '', dica = '') => `<div class="vidro kpi" title="${esc(dica)}"><div class="rotulo">${icone(ico, 'p')}${rot}</div><div class="valor" style="color:${cor || 'inherit'}">${val}</div>
    <div class="delta">${NIVEL_COR[cor] ? `<b style="color:${cor}">${NIVEL_COR[cor]}</b> ` : ''}${extra}</div></div>`;
  if (s.meta.fase === 'campanha') {
    const pos = c.pesquisa.findIndex((x) => x.id === 'jogador') + 1;
    return `<div class="faixa-kpi">${k('Pesquisa', 'urna', pos + 'º lugar', pos === 1 ? 'var(--verde)' : 'var(--ambar)', pct(c.pesquisa[pos - 1]?.pct || 0, 1))}
      ${k('Reconhecimento', 'olho', pct(c.reconhecimento), '', 'conhecem você')}${k('Rejeição', 'alerta', pct(c.rejeicao), corEstado(c.rejeicao, 25, 40, true))}
      ${k('Fundo', 'moedas', nf(c.fundo, 0), '', 'para campanha')}${k('Eleição', 'calendario', c.turnos_restantes, '', 'trimestres')}</div>`;
  }
  return `<div class="faixa-kpi kpi-5">
    ${k('Popularidade', 'coracao', pct(s.popularidade), corEstado(s.popularidade, 50, 35), delta('popularidade'), 'Decide a eleição. Tente manter acima de 50%.')}
    ${k('Economia', 'economia', pct(e.crescimento, 1), corEstado(e.crescimento, 2, .5), 'crescimento', 'Crescimento do PIB por ano.')}
    ${k('Inflação', 'grafico', pct(e.inflacao, 1), corEstado(e.inflacao, 4.5, 6.5, true), 'ao ano', 'Preços subindo. Acima de 6,5% irrita o eleitor.')}
    ${k('Caixa', 'moedas', bi(e.caixa), e.caixa > 50 && e.resultado >= -20 ? 'var(--verde)' : e.caixa > 0 ? 'var(--ambar)' : 'var(--vermelho)', '', 'Dinheiro disponível. Sem caixa, o governo se endivida.')}
    ${k(NAC() ? 'Congresso' : 'Assembleia', 'congresso', pct(D().apoio_baixa), corEstado(D().apoio_baixa, 50, 30), D().apoio_baixa >= 50 ? 'maioria' : 'minoria', 'Parte dos deputados que apoia o governo. Com maioria, suas leis passam.')}</div>`;
}

/* ---------- objetivo e "o que fazer agora" ---------- */
function leisRecomendadas(n = 3) {
  const s = S(), em = new Set(s.congresso.leis_aprovadas.map((l) => l.id)), ch = D().chance_leis || {};
  const recentes = new Set([...s.congresso.leis_rejeitadas, ...s.congresso.leis_derrubadas].filter((l) => s.meta.turno - l.turno < 2).map((l) => l.id));
  return Object.entries(ch).filter(([id, c]) => !em.has(id) && !recentes.has(id) && c >= 0.5 && CAT.leis[id].custo <= Math.max(s.capital, 1))
    .sort((a, b) => (CAT.leis[b[0]].pop > 0) - (CAT.leis[a[0]].pop > 0) || b[1] - a[1]).slice(0, n).map(([id, c]) => ({ id, chance: c, ...CAT.leis[id] }));
}
function dicas() {
  const s = S(), e = s.economia, j = s.justica, out = [];
  const add = (urg, ico, txt, aba, extra = '') => out.push({ urg, ico, txt, aba, extra });
  if (j.impeachment.processo) add(10, 'alerta', 'Há um processo de impeachment! Negocie votos para se salvar.', 'mais', 'data-sub="justica"');
  if (s.campanha.ativa) add(9, 'urna', 'Campanha em andamento: faça comícios, TV e o debate (painel acima).', 'governo');
  const vagos = Object.values(s.ministros).filter((m) => !m).length;
  if (vagos && s.meta.fase !== 'campanha') add(8, 'pasta', `${vagos} ministério(s) sem titular: toque no cartão vazio e nomeie alguém.`, 'governo');
  if (j.investigacoes.some((i) => i.status === 'aberta' && !i.resposta)) add(7, 'justica', 'Há uma investigação sem resposta. Cooperar costuma ser o mais seguro.', 'mais', 'data-sub="justica"');
  if (D().apoio_baixa < 50) add(7, 'congresso', 'Você não tem maioria: use "Negociar apoio" na aba Leis.', 'congresso');
  if (e.inflacao > 6.5) add(6, 'grafico', 'Inflação alta: na Economia, aumente impostos ou reduza o nível de gasto.', 'economia');
  if (e.caixa <= 0 || e.resultado < -60) add(6, 'moedas', 'O caixa está no vermelho: na Economia, reduza o nível de gasto ou aumente impostos.', 'economia');
  if (e.crescimento < 1) add(5, 'economia', 'Economia fraca: na Economia, reduza impostos ou invista mais em infraestrutura.', 'economia');
  if (j.vaga_stf) add(5, 'justica', 'Abriu uma vaga no STF: indique um ministro.', 'mais', 'data-sub="justica"');
  if ((s.diplomacia.propostas || []).length) add(4, 'globo', 'Um país enviou uma proposta: responda na aba Mundo.', 'diplomacia');
  const promessa = s.jogador.propostas.map((pid) => CAT.propostas[pid]).find((p) => p.lei && !s.congresso.leis_aprovadas.some((l) => l.id === p.lei));
  if (promessa && s.meta.fase !== 'campanha') add(4, 'urna', `Cumpra sua promessa: aprove "${CAT.leis[promessa.lei].nome}".`, 'congresso');
  const rec = leisRecomendadas(1)[0];
  if (rec && s.capital >= 2 && s.meta.fase !== 'campanha') add(s.popularidade < 50 ? 6 : 3, 'livro', `Boa lei para aprovar agora: "${rec.nome}" (${nf(rec.chance * 100, 0)}% de chance${rec.pop > 0 ? ', agrada o eleitor' : ''}).`, 'congresso');
  if (s.popularidade < 45 && s.meta.fase !== 'campanha') add(5, 'megafone', 'Popularidade baixa: faça publicidade (painel Comunicação) e aprove leis populares.', 'governo');
  return out.sort((a, b) => b.urg - a.urg).slice(0, 3);
}
function painelObjetivo() {
  const s = S(), m = s.meta;
  if (m.fase !== 'governo' || m.encerrado) return '';
  const disputa = m.mandato < 2 || m.duracao === 'longa';
  const falta = 16 - m.turno_mandato, anoEleicao = m.ano + Math.floor((m.trimestre + 14 - m.turno_mandato) / 4);
  const quem = disputa && m.mandato >= 2 ? 'Eleja seu sucessor' : disputa ? 'Vença a reeleição' : 'Termine o mandato com o país em ordem';
  const lista = dicas().map((d) => `<button type="button" class="dica" data-fn="mudarAba" data-aba="${d.aba}" ${d.extra}>${icone(d.ico, 'p')}<span class="flex1">${esc(d.txt)}</span>${icone('dir', 'p')}</button>`).join('')
    || `<div class="dica ok">${icone('check', 'p')}<span>Tudo em ordem. Aprove leis, faça diplomacia ou guarde ações e encerre o trimestre.</span></div>`;
  return `<section class="vidro painel objetivo"><div class="linha entre nw"><div><span class="rotulo">${icone('trofeu', 'p')} Objetivo</span>
      <h2 class="titulo-display" style="font-size:1.25rem;margin:4px 0">${quem}${disputa ? ` em ${anoEleicao}` : ''}</h2>
      <div class="mini fraco">${disputa ? `Faltam ${falta} trimestre(s). Mantenha a popularidade em 50% ou mais.` : `Faltam ${falta} trimestre(s) para o fim do mandato.`}</div></div></div>
    <div class="rotulo mt">O que fazer agora</div><div class="dicas">${lista}</div>
    </section>`;
}

/* ---------- mapas ---------- */
function dicaEnt(cod, nome) {
  const s = S(), x = s.diplomacia.entidades[cod];
  if (cod === (NAC() ? 'BRA' : s.meta.uf)) return `<b>${NAC() ? 'Brasil' : esc(s.meta.rotulo)}</b><span class="ouro">Você governa aqui</span>`;
  if (!x) return `<b>${esc(nome)}</b><span class="fraco">Sem relações bilaterais modeladas</span>`;
  const st = [x.alianca && 'aliança', x.tratado && (NAC() ? 'acordo' : 'consórcio'), x.sancao && 'sanção', x.guerra && 'GUERRA'].filter(Boolean).join(' · ');
  return `<b>${esc(x.nome)}</b>Relação <b style="display:inline;color:${corRelacao(x.rel)}">${nf(x.rel, 0)}</b> · ${esc(x.bloco)}${x.lider ? `<br><span class="fraco">Gov.: ${esc(x.lider)}</span>` : ''}${st ? `<br><span class="ouro">${st}</span>` : ''}`;
}
async function montarMapa(id, aoSelecionar) {
  const el = document.getElementById(id);
  if (!el) return;
  const s = S(), ent = s.diplomacia.entidades, eu = NAC() ? 'BRA' : s.meta.uf;
  const m = new Mapas.Mapa(el, {
    tipo: NAC() ? 'mundo' : 'brasil', rotulos: !NAC(), selecionado: UI.sel,
    cor: (cod) => (cod === eu ? 'var(--ouro)' : ent[cod] ? corRelacao(ent[cod].rel) : null),
    classe: (cod) => [cod === eu && 'eu', ent[cod]?.guerra && 'guerra', (ent[cod]?.alianca || ent[cod]?.tratado) && 'aliado'].filter(Boolean).join(' '),
    dica: dicaEnt,
    aoClicar: (cod, mapa) => { UI.sel = cod; UI.nomeSel = mapa.nome(cod); mapa.selecionar(cod, false); aoSelecionar(); },
  });
  await m.montar();
  const v = UI.vista[id];
  if (v) { m.z = v.z; m.tx = v.tx; m.ty = v.ty; m._aplicar(); }
  const salvar = () => { UI.vista[id] = { z: m.z, tx: m.tx, ty: m.ty }; };
  el.addEventListener('pointerup', salvar); el.addEventListener('wheel', salvar, { passive: true }); el.addEventListener('click', () => setTimeout(salvar, 700));
}

/* ---------- GOVERNO ---------- */
function painelCampanha() {
  const s = S(), c = s.campanha;
  if (!c.ativa) return '';
  const titulo = s.meta.fase === 'campanha' ? `Campanha para ${cargo()}` : c.sucessor ? 'Campanha do seu sucessor' : 'Campanha de reeleição';
  const livres = Object.values(s.congresso.partidos).filter((p) => !p.jogador && !c.coalizao.includes(p.sigla)).sort((a, b) => b.baixa - a.baixa);
  const lider = c.pesquisa[0]?.pct || 1;
  const linhas = c.pesquisa.map((p) => `<div class="candidato-linha ${p.id === 'jogador' ? 'eu' : ''}">${avCand(p)}
    <div><b class="peq">${esc(p.nome)}</b><div class="mini fraco">${selo(p.partido)} ${esc(p.partido)}${p.wiki ? ' <span class="selo real">real</span>' : ''}</div></div>${UIc.medidor(p.pct, lider * 1.1, p.id === 'jogador' ? 'var(--ouro)' : partidoDe(p.partido).cor)}<b class="num" style="text-align:right">${nf(p.pct, 1)}%</b></div>`).join('');
  const acao = (a, ic, t, custo) => `<button type="button" class="acao-c" data-a="campanha" data-p='{"acao":"${a}"}' ${PODE() ? '' : 'disabled'}>${icone(ic)}<b>${t}</b><small>${custo}</small></button>`;
  return `<section class="vidro campanha-hero entra"><div class="painel-cab"><span class="ico-caixa">${icone('urna')}</span><div class="flex1"><h2>${titulo}</h2>
      <div class="mini fraco">${c.reais ? 'Eleição de 2026: candidaturas reais registradas no TSE · votação simulada' : 'Adversários são fictícios, de partidos reais'}</div></div><span class="selo ouro">${s.meta.fase === 'campanha' ? c.turnos_restantes + ' trim. até a eleição' : 'Eleição ao fim do mandato'}</span></div>
    <div class="rotulo">Pesquisa de intenção de voto</div>${linhas}
    <div class="linha mt"><span class="chip">${icone('moedas', 'p')} Fundo ${nf(c.fundo, 0)}</span><span class="chip">${icone('olho', 'p')} Reconhecimento ${pct(c.reconhecimento)}</span>
      <span class="chip">${icone('alerta', 'p')} Rejeição ${pct(c.rejeicao)}</span><span class="chip">${icone('aperto', 'p')} Coalizão: ${c.coalizao.length ? c.coalizao.join(', ') : '—'}</span></div>
    <div class="acoes-campanha mt">${acao('comicio', 'megafone', 'Comício', '1 ação · 15 fundo')}${acao('tv', 'olho', 'Propaganda na TV', '1 ação · 30 fundo')}${acao('redes', 'chat', 'Redes sociais', '1 ação · 10 fundo')}
      ${acao('ataque', 'mira', 'Atacar rival', '1 ação · 20 fundo')}${acao('debate', 'pessoas', c.debate_feito ? 'Debate feito' : 'Debate na TV', s.meta.fase === 'campanha' ? 'últimos 2 trimestres' : '1 ação')}</div>
    <div class="linha mt nw"><select id="ali-sel">${livres.map((p) => `<option value="${esc(p.sigla)}">${esc(p.sigla)} — ${esc(p.nome)} (${p.baixa} dep.)</option>`).join('')}</select>
      ${PODE() ? bF('Aliança (2)', 'fecharAlianca', 'btn-ouro', '', 'aperto') : ''}</div></section>`;
}
function vGabinete() {
  const s = S();
  if (s.meta.fase === 'campanha') return UIc.painel(NAC() ? 'Ministérios' : 'Secretarias', 'pasta', UIc.vazio('O gabinete é montado após a posse.', 'pasta'));
  const cards = Object.keys(s.ministros).map((p) => {
    const m = s.ministros[p];
    return `<button type="button" class="ministro ${m ? '' : 'vago'}" data-fn="abrirPasta" data-id="${p}"><div class="topo-m">${m ? avNPC(m.nome, m.idade) : `<span class="inicial">${icone(ICO_PASTA[p] || 'pasta', 'p')}</span>`}
      <div class="flex1"><div class="pasta">${esc(rotuloPasta(p).replace(/^(Ministério|Secretaria) (da |de |do )?/, ''))}</div><b>${m ? esc(m.nome) : 'Vago'}</b></div></div>
      ${m ? `<div class="linha nw mini">${selo(m.partido)}<span class="fraco">C</span>${UIc.medidor(m.competencia, 100, 'var(--azul)', true)}<span class="fraco">I</span>${UIc.medidor(m.integridade, 100, m.integridade < 50 ? 'var(--vermelho)' : 'var(--verde)', true)}</div>` : '<span class="mini alerta">Nomear titular</span>'}</button>`;
  }).join('');
  return UIc.painel(NAC() ? 'Ministérios' : 'Secretarias', 'pasta', `<div class="gabinete">${cards}</div>`, { sub: 'Toque para trocar · C competência · I integridade' });
}
function vManchetes(n = 4) {
  const ic = { bom: 'check', ruim: 'alerta', evento: 'raio', info: 'jornal' };
  const l = S().noticias.slice(0, n).map((x) => `<div class="manchete ${x.tipo}"><span class="ic">${icone(ic[x.tipo] || 'jornal', 'p')}</span><div><div class="data">${x.ano} · ${x.tri}º TRIMESTRE</div><p>${esc(x.texto)}</p></div></div>`).join('');
  return UIc.painel('Manchetes', 'jornal', l || UIc.vazio('Sem notícias ainda.'));
}
function vGoverno() {
  const s = S();
  const comunic = s.meta.fase === 'campanha' ? '' : UIc.painel('Comunicação', 'megafone', `<div class="grupo-btn">${bA('Publicidade', 'publicidade', { tipo: 'tv' }, 'btn-mini', '', 'olho')}${bA('Cadeia nacional', 'publicidade', { tipo: 'cadeia' }, 'btn-mini', '', 'megafone')}${bA('Pressionar mídia', 'publicidade', { tipo: 'pressionar' }, 'btn-mini btn-perigo', '', 'jornal')}</div>
`, { sub: 'Sobe a popularidade' });
  return `${painelObjetivo()}${painelCampanha() ? `<div class="mb0" style="margin-bottom:16px">${painelCampanha()}</div>` : ''}
    <div class="layout-gov"><div class="coluna">${vGabinete()}${comunic}</div><div class="coluna">${vManchetes()}</div></div>`;
}

/* ---------- ECONOMIA ---------- */
function resetDraft() { const s = S(); UI.draft = { imp: { ...s.impostos }, gasto: s.orcamento.gasto_pct, aloc: { ...s.orcamento.aloc } }; }
const CORES_SETOR = { saude: '#3cc48f', educacao: '#6aa6ff', seguranca: '#a98bfa', infraestrutura: '#f1b34a', social: '#ef7d9a', defesa: '#8b93a3', meio_ambiente: '#4cc9d6' };
function rosca(aloc) {
  const ent = Object.entries(aloc).filter(([k, v]) => v > 0 && (NAC() || k !== 'defesa'));
  const tot = ent.reduce((a, [, v]) => a + v, 0) || 1, r = 52, c = 2 * Math.PI * r;
  let off = 0;
  const seg = ent.map(([k, v]) => { const l = (v / tot) * c; const s = `<circle cx="70" cy="70" r="${r}" stroke="${CORES_SETOR[k]}" stroke-dasharray="${l - 2} ${c - l + 2}" stroke-dashoffset="${-off}"/>`; off += l; return s; }).join('');
  return `<div class="linha rosca-caixa" style="gap:20px"><svg class="rosca" viewBox="0 0 140 140" style="transform:rotate(-90deg)"><circle cx="70" cy="70" r="${r}" stroke="var(--vidro-3)"/>${seg}</svg>
    <div class="legenda-rosca flex1">${ent.map(([k, v]) => `<span><i style="background:${CORES_SETOR[k]}"></i>${CAT.rotulo_setor[k]} <b>${nf((v / tot) * 100, 0)}%</b></span>`).join('')}</div></div>`;
}
const controle = (grp, id, rot, val, min, max, step, txt) => `<div class="controle"><span class="suave">${rot}</span><input type="range" data-sl="${grp}:${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="--p:${((val - min) / (max - min)) * 100}%" ${PODE() ? '' : 'disabled'}><span class="v" data-out="${grp}:${id}">${txt}</span></div>`;
const aberto = (id) => (UI.abertos.has(id) ? 'open' : '');
function vEconomia() {
  const s = S(), e = s.economia;
  if (!UI.draft) resetDraft();
  const dr = UI.draft;
  const rotImp = NAC() ? { renda: 'Imposto de renda', empresas: 'Tributos sobre empresas', consumo: 'Tributos sobre consumo', importacao: 'Tarifa de importação' } : { renda: 'IPVA / ITCMD', empresas: 'Tributos sobre empresas', consumo: 'ICMS (consumo)' };
  const soma = Object.entries(dr.aloc).filter(([k]) => NAC() || k !== 'defesa').reduce((a, [, v]) => a + v, 0) || 1;
  const maxF = Math.max(e.receita, e.despesa, 1);
  const fluxo = [['Receita', e.receita, 'var(--verde)'], ['Obrigatórias', e.obrigatorias, 'var(--vermelho)'], ['Discricionárias', e.discricionarias, 'var(--ambar)'], ['Juros da dívida', e.juros, 'var(--roxo)']]
    .map(([r, v, c]) => `<div class="fluxo-linha"><span class="suave">${r}</span>${UIc.medidor(v, maxF, c)}<span class="v">${bi(v)}</span></div>`).join('');
  return `<div class="grade g2"><div class="coluna">
    ${UIc.painel('Indicadores macroeconômicos', 'economia', `<div class="linha" style="justify-content:space-around;gap:18px">
      ${UIc.anel(e.confianca, 100, 'Confiança', corEstado(e.confianca, 55, 35))}${UIc.anel(e.selic, 20, 'Selic', 'var(--azul)', 112, pct(e.selic, 1))}${UIc.anel(D().carga, 50, 'Carga trib.', 'var(--ambar)', 112, pct(D().carga, 1))}</div>
      <div class="grade g2 mt"><div><div class="rotulo">PIB anual</div><b class="titulo-display" style="font-size:1.4rem">${bi(e.pib_bi)}</b></div><div><div class="rotulo">Câmbio</div><b class="titulo-display" style="font-size:1.4rem">R$ ${nf(e.cambio, 2)}</b></div></div>
      ${NAC() ? `<div class="sep"></div><div class="linha entre"><span class="peq suave">Banco Central: autonomia ${nf(s.justica.bc_indep, 0)}%</span>${bA('Pressionar por juros menores (2)', 'pressionar_bc', {}, 'btn-mini btn-perigo', '', 'alerta')}</div>`
      : `<p class="mini fraco mt mb0">A economia estadual acompanha a federal: crescimento ${pct(s.federal.crescimento, 1)}, inflação ${pct(s.federal.inflacao, 1)}, Selic ${pct(s.federal.selic, 1)}.</p>`}`)}
    ${UIc.painel('Resultado fiscal do trimestre', 'moedas', `<div class="fluxo">${fluxo}</div><div class="sep"></div><div class="linha entre"><span class="rotulo">Resultado</span>
      <b class="titulo-display ${e.resultado < 0 ? 'ruim' : 'bom'}" style="font-size:1.5rem">${bi(e.resultado)}</b></div><p class="mini fraco mb0">Déficit de ${pct(e.deficit_pib, 1)} do PIB. Sem caixa, o déficit vira dívida.</p>`)}</div>
    <div class="coluna">${UIc.painel('Impostos', 'justica', Object.keys(rotImp).map((k) => controle('imp', k, rotImp[k], dr.imp[k], 0, 45, .5, pct(dr.imp[k], 1))).join('') +
      `<div class="linha entre mt"><span class="mini fraco">Mais impostos: mais caixa, menos crescimento e popularidade.</span>${bA('Aplicar (1 ação)', 'ajustar_impostos', {}, 'btn-ouro btn-mini', 'data-fn="aplicarImpostos"', 'check')}</div>`)}
    ${UIc.painel('Orçamento discricionário', 'grafico', `${controle('gasto', 'x', 'Nível de gasto', dr.gasto, 15, 45, .5, pct(dr.gasto, 1))}<div class="sep"></div>
      <div id="rosca">${rosca(dr.aloc)}</div><div class="mt">${Object.keys(dr.aloc).filter((k) => NAC() || k !== 'defesa').map((k) => controle('aloc', k, CAT.rotulo_setor[k], dr.aloc[k], 0, 60, 1, pct((dr.aloc[k] / soma) * 100))).join('')}</div>
      <div class="linha entre mt"><span class="mini fraco">Áreas bem financiadas melhoram a cada trimestre.</span>${bA('Aplicar orçamento', 'ajustar_orcamento', {}, 'btn-ouro btn-mini', 'data-fn="aplicarOrcamento"', 'check')}</div>`)}</div></div>`;
}

/* ---------- JUSTIÇA ---------- */
function vJustica() {
  const s = S(), j = s.justica, imp = j.impeachment, proc = imp.processo;
  const abertas = j.investigacoes.filter((i) => i.status === 'aberta').map((i) => `<div class="dossie ${i.gravidade >= 3 ? 'grave' : ''}"><div class="linha entre nw"><b>${esc(i.titulo)}</b><span class="selo ${i.gravidade >= 3 ? 'ruim' : 'alerta'}">gravidade ${i.gravidade}</span></div>
    <div class="mini fraco" style="margin:4px 0 8px">Resposta do governo: ${i.resposta || 'nenhuma'} · andamento ${nf(i.progresso, 0)}%</div>${UIc.medidor(i.progresso, 100, 'var(--ambar)', true)}
    <div class="grupo-btn mt">${bA('Cooperar', 'responder_investigacao', { id: i.id, resposta: 'cooperar' }, 'btn-mini', '', 'aperto')}${i.alvo.startsWith('ministro:') ? bA('Demitir suspeito', 'responder_investigacao', { id: i.id, resposta: 'demitir' }, 'btn-mini', '', 'sair') : ''}
    ${bA('Obstruir (2)', 'responder_investigacao', { id: i.id, resposta: 'obstruir' }, 'btn-mini btn-perigo', '', 'alerta')}</div></div>`).join('');
  const encerradas = j.investigacoes.filter((i) => i.status !== 'aberta').slice(-5).reverse().map((i) => `<div class="linha entre peq" style="padding:6px 0"><span class="suave">${esc(i.titulo)}</span><span class="selo">${esc(i.status)}</span></div>`).join('');
  const derrubadas = s.congresso.leis_derrubadas.map((l) => `<span class="selo ruim">${esc(CAT.leis[l.id].nome)}</span>`).join(' ');
  return `<div class="grade g2"><div class="coluna">
    ${UIc.painel('Supremo Tribunal Federal', 'justica', `${UIc.barra('Independência', j.independencia, corEstado(j.independencia, 60, 35))}${UIc.barra('Confiança pública', j.confianca_stf, corEstado(j.confianca_stf, 55, 35))}
      ${NAC() ? UIc.barra('Autonomia do BC', j.bc_indep, corEstado(j.bc_indep, 60, 35)) : ''}<p class="mini fraco">Quanto mais independente, maior a chance de o STF derrubar leis com risco constitucional.</p>
      ${j.vaga_stf ? `<div class="dossie"><b>${icone('estrela', 'p')} Vaga aberta no STF</b><div class="grupo-btn mt">${bA('Indicar jurista técnico', 'indicar_stf', { perfil: 'tecnico' }, 'btn-mini btn-ouro')}${bA('Indicar aliado político', 'indicar_stf', { perfil: 'aliado' }, 'btn-mini')}</div></div>` : ''}
      <div class="grupo-btn">${bA('Pressionar o Judiciário (2)', 'pressionar_stf', {}, 'btn-mini btn-perigo', '', 'alerta')}</div>${derrubadas ? `<div class="mt"><div class="rotulo">Leis derrubadas</div><div class="linha mt">${derrubadas}</div></div>` : ''}`)}
    ${UIc.painel('Impeachment', 'alerta', `<div class="linha nw" style="gap:20px">${UIc.anel(imp.risco, 100, 'Risco', corEstado(imp.risco, 40, 65, true))}
      <div class="flex1">${proc ? `<div class="processo"><b class="ruim">Processo em andamento</b><div class="peq">Etapa: ${proc.etapa === 'baixa' ? (NAC() ? 'Câmara dos Deputados' : 'Assembleia Legislativa') : 'Senado Federal'} · são necessários 2/3 dos votos.</div>
        <div class="mt">${bA('Negociar votos (2 · R$ 20 bi)', 'negociar_impeachment', {}, 'btn-mini btn-ouro', '', 'aperto')}</div></div>`
        : '<p class="peq suave mb0">O risco cresce com popularidade baixa, corrupção, investigações e falta de base. Acima de 65% e com popularidade baixa, a oposição pode abrir um processo.</p>'}</div></div>`)}</div>
    <div class="coluna">${UIc.painel('Corrupção percebida', 'olho', `${UIc.barra('Índice', j.corrupcao, corEstado(j.corrupcao, 40, 60, true))}<p class="mini fraco mb0">Ministros pouco íntegros e pressão sobre instituições aumentam a percepção de corrupção.</p>`)}
    ${UIc.painel('Investigações', 'pasta', (abertas || UIc.vazio('Nenhuma investigação em curso.', 'check')) + (encerradas ? `<div class="sep"></div><div class="rotulo">Encerradas</div>${encerradas}` : ''), { sub: 'Polícia Federal e Ministério Público (simulados)' })}</div></div>`;
}

/* ---------- CONGRESSO ---------- */
function cartaoLei(id, l, chance, i = 0) {
  const s = S(), c = s.congresso, vig = c.leis_aprovadas.some((x) => x.id === id);
  const esp = [...c.leis_rejeitadas, ...c.leis_derrubadas].some((x) => x.id === id && s.meta.turno - x.turno < 2);
  const pc = Math.round((chance || 0) * 100), cor = corEstado(pc, 65, 35);
  const efeito = l.pop > 0 ? '<span class="selo bom">agrada o eleitor</span>' : l.pop < 0 ? '<span class="selo alerta">impopular</span>' : '';
  return `<div class="lei-card ${vig ? 'vigor' : ''}"><div class="linha nw">${icone(ICO_CAT[l.cat] || 'livro')}<b class="flex1">${esc(l.nome)}</b></div><small>${esc(l.desc)}</small>
    <div class="linha">${efeito}<span class="selo ouro">${icone('raio', 'p')}${l.custo} ${l.custo > 1 ? 'ações' : 'ação'}</span></div>
    ${vig ? `<span class="selo bom">${icone('check', 'p')} Em vigor</span>` : `<div class="chance-lei"><span class="mini">Chance de aprovar</span>${UIc.medidor(pc, 100, cor)}<b style="color:${cor}">${pc}%</b></div>
      ${bA(esp ? 'Aguarde 2 trimestres' : 'Enviar ao Congresso', 'propor_lei', { lei: id }, 'btn-mini btn-ouro', esp ? 'disabled' : '', 'seta')}`}</div>`;
}
function vCongresso() {
  const s = S(), c = s.congresso, d = D(), alta = c.total_alta > 0, ch = d.chance_leis || {};
  const indecisos = d.partidos.filter((p) => p.posicao === 'independente' && !p.jogador).length;
  const resumo = UIc.painel(NAC() ? 'Seu apoio no Congresso' : 'Seu apoio na Assembleia', 'congresso', `<div class="linha nw" style="gap:18px">${UIc.anel(d.apoio_baixa, 100, 'apoio', corEstado(d.apoio_baixa, 50, 30), 92, pct(d.apoio_baixa))}
      <div class="flex1"><b>${d.apoio_baixa >= 50 ? 'Você tem maioria.' : 'Você não tem maioria.'}</b><p class="peq suave mb0">${d.apoio_baixa >= 50 ? 'A maioria das suas leis deve passar.' : 'Leis polêmicas tendem a ser rejeitadas.'} Há ${indecisos} partido(s) indeciso(s).</p></div></div>
    <div class="linha mt">${bA('Negociar apoio (R$ 20 bi · 1 ação)', 'negociar_base', {}, 'btn-ouro', indecisos ? '' : 'disabled', 'aperto')}</div>
`);
  const uv = c.ultima_votacao;
  const votacao = uv ? `<div class="vidro forte painel" style="margin-bottom:14px"><div class="rotulo">Última votação · ${esc(CAT.leis[uv.lei].nome)}</div><div class="votacao mt">${Object.entries(uv.resultado).map(([k, r]) => `<b>${k === 'baixa' ? (NAC() ? 'Câmara' : 'Assembleia') : 'Senado'}</b>${UIc.medidor(r.sim, r.total, r.aprovou ? 'var(--verde)' : 'var(--vermelho)')}<span class="num">${r.sim}/${r.total} ${r.aprovou ? '✔' : '✖'}</span>`).join('')}</div></div>` : '';
  const recs = leisRecomendadas(3);
  const recomendadas = recs.length ? `<div class="rotulo">Recomendadas agora</div><div class="grade gauto mt">${recs.map((l) => cartaoLei(l.id, CAT.leis[l.id], l.chance)).join('')}</div>` : '';
  const leisEsc = Object.entries(CAT.leis).filter(([, l]) => l.escopos.includes(s.meta.escopo));
  const cats = [...new Set(leisEsc.map(([, l]) => l.cat))];
  const grupos = cats.map((cat) => {
    const doTema = leisEsc.filter(([, l]) => l.cat === cat).sort((a, b) => (ch[b[0]] || 0) - (ch[a[0]] || 0));
    const vig = doTema.filter(([id]) => c.leis_aprovadas.some((x) => x.id === id)).length;
    return `<details class="tema" data-det="lei-${esc(cat)}" ${aberto('lei-' + cat)}><summary>${icone(ICO_CAT[cat] || 'livro', 'p')}<b class="flex1">${esc(cat)}</b><span class="mini fraco">${doTema.length} leis${vig ? ` · ${vig} em vigor` : ''}</span></summary>
      <div class="grade gauto mt">${doTema.map(([id, l]) => cartaoLei(id, l, ch[id])).join('')}</div></details>`;
  }).join('');
  const legenda = d.partidos.filter((p) => p.baixa >= (alta ? 8 : 2)).map((p) => `<span><i style="background:${p.cor}"></i>${esc(p.sigla)} ${p.baixa}</span>`).join('');
  const casa = (nome, k, total, ap) => `<div class="casa">${hemiciclo(d.partidos, k, total, UI.destaque)}<div class="num-casa">${total}</div><div class="rotulo">${nome}</div><div class="peq mt">Base do governo: <b style="color:${corEstado(ap, 50, 30)}">${pct(ap)}</b></div></div>`;
  const tabela = d.partidos.map((p) => `<tr><td><div class="linha nw">${UIc.logo(p, 34)}<div><b>${esc(p.sigla)}</b>${p.jogador ? ' <span class="selo ouro">seu partido</span>' : ''}<div class="mini fraco">${esc(p.nome)}</div></div></div></td>
    <td class="num">${p.baixa}${alta ? ` / ${p.alta}` : ''}</td><td style="min-width:120px">${UIc.medidor(p.afin, 100, p.posicao === 'base' ? 'var(--verde)' : p.posicao === 'oposição' ? 'var(--vermelho)' : 'var(--ambar)', true)}<span class="mini fraco">${p.posicao}</span></td>
    <td style="white-space:nowrap;text-align:right">${bA('Emendas', 'negociar', { tipo: 'emendas', partido: p.sigla, valor: 10 }, 'btn-mini', 'title="R$ 10 bi · 1 ação"', 'moedas')} ${bA('', 'negociar', { tipo: 'pressionar', partido: p.sigla }, 'btn-mini btn-icone', 'title="Pressionar (1 ação)" aria-label="Pressionar"', 'megafone')}</td></tr>`).join('');
  return `<div class="grade g2 layout-cong"><div class="coluna">${resumo}
    ${UIc.painel('Projetos de lei', 'livro', `${votacao}${recomendadas}<div class="rotulo mt-g">Todas as leis por tema</div>${grupos}
`)}</div>
    <div class="coluna"><details class="avancado" data-det="plenario" ${aberto('plenario')}><summary>${icone('congresso', 'p')} Ver o plenário</summary><div class="casas">${casa(NAC() ? 'Câmara dos Deputados' : 'Deputados estaduais', 'baixa', c.total_baixa, d.apoio_baixa)}${alta ? casa('Senado Federal', 'alta', c.total_alta, d.apoio_alta) : ''}</div>
      <div class="legenda-partidos">${legenda}</div></details>
    <details class="avancado" data-det="partidos" ${aberto('partidos')}><summary>${icone('aperto', 'p')} Negociar partido a partido (avançado)</summary>
      <div class="rolagem" style="max-height:640px;overflow-x:auto"><table class="tabela"><thead><tr><th>Partido</th><th>${alta ? 'Dep./Sen.' : 'Cadeiras'}</th><th>Posição</th><th></th></tr></thead><tbody>${tabela}</tbody></table></div></details></div></div>`;
}

/* ---------- DIPLOMACIA ---------- */
function chipsEnt(x) {
  return [x.alianca && '<span class="selo bom">aliança</span>', x.tratado && `<span class="selo bom">${NAC() ? 'acordo' : 'consórcio'}</span>`, x.sancao && '<span class="selo ruim">sanção</span>',
    x.guerra && '<span class="selo ruim">guerra</span>', x.jogador && `<span class="selo ouro">${icone('usuario', 'p')}${esc(x.jogador)}</span>`].filter(Boolean).join(' ');
}
function painelEntidade() {
  const s = S(), d = s.diplomacia, eu = NAC() ? 'BRA' : s.meta.uf;
  if (!UI.sel) return UIc.vazio(`Clique em um ${NAC() ? 'país' : 'estado'} no mapa ou na lista.`, NAC() ? 'globo' : 'mapa');
  if (UI.sel === eu) return `<span class="rotulo">Seu território</span><h2 class="titulo-display" style="font-size:1.6rem">${NAC() ? 'Brasil' : esc(s.meta.rotulo)}</h2>${NAC() ? UIc.barra('Prestígio na ONU', d.onu, corEstado(d.onu, 60, 35)) + UIc.barra('Poder militar', d.militar, 'var(--azul)') : UIc.barra('Relação com Brasília', s.federal.relacao, corEstado(s.federal.relacao, 60, 35))}`;
  const x = d.entidades[UI.sel];
  if (!x) return `<span class="rotulo">País</span><h2 class="titulo-display" style="font-size:1.6rem">${esc(UI.nomeSel || UI.sel)}</h2><p class="suave peq">Este país não tem relações bilaterais modeladas na simulação. Os ${Object.keys(d.entidades).length} parceiros principais aparecem coloridos no mapa.</p>`;
  const st = `<span class="rotulo">${esc(x.bloco)}${x.regime ? ' · ' + esc(x.regime) : ''}</span><h2 class="titulo-display" style="font-size:1.6rem;margin:.2em 0">${esc(x.nome)}</h2><div class="linha">${chipsEnt(x)}</div>
    ${UIc.barra('Relação', x.rel, corRelacao(x.rel))}`;
  if (!NAC()) {
    const humano = x.jogador && (G.mp?.governadores || []).find((g) => g.uf === x.cod);
    const acoes = humano
      ? `<p class="mini fraco mt">${esc(x.jogador)} é um jogador: ele aceita ou recusa o consórcio em Mais › Sala.</p>${bF(x.tratado ? 'Consórcio em vigor' : 'Propor consórcio', 'propConsorcio', 'btn-mini btn-ouro', `data-id="${humano.id}" ${x.tratado || !PODE() ? 'disabled' : ''}`, 'link')}`
      : `<div class="grupo-btn mt">${bA('Missão de cooperação (1)', 'acao_diplomatica', { acao: 'melhorar', alvo: x.cod }, 'btn-mini', '', 'aperto')}${bA('Firmar consórcio (2)', 'acao_diplomatica', { acao: 'tratado', alvo: x.cod }, 'btn-mini btn-ouro', '', 'link')}</div><p class="mini fraco mt mb0">Consórcio exige relação ≥ 55.</p>`;
    return `${st}<div class="grade g2 peq"><div><div class="rotulo">PIB</div><b>R$ ${nf(x.pib, 0)} bi</b></div><div><div class="rotulo">${x.jogador ? 'Governador (jogador)' : 'Governador (eleito em 2022)'}</div><b>${esc(x.jogador || x.lider || '—')}</b></div></div>${acoes}${acordosCom(x)}`;
  }
  const g = d.guerras.find((w) => w.cod === x.cod);
  return `${st}<div class="grade g3 peq"><div><div class="rotulo">PIB</div><b>US$ ${nf(x.pib, 2)} tri</b></div><div><div class="rotulo">Militar</div><b>${x.militar}</b></div><div><div class="rotulo">Seu poder</div><b>${nf(d.militar, 0)}</b></div></div>
    ${g ? `<div class="guerra-card mt"><b class="ruim">${icone('mira', 'p')} Em guerra · ${g.turnos} trimestres</b>${UIc.barra('Front', (g.progresso + 100) / 2, g.progresso >= 0 ? 'var(--verde)' : 'var(--vermelho)', nf(g.progresso, 0))}</div>` : ''}
    <div class="grupo-btn mt">${bA('Missão diplomática (1)', 'acao_diplomatica', { acao: 'melhorar', alvo: x.cod }, 'btn-mini', '', 'aperto')}${bA('Acordo comercial (2)', 'acao_diplomatica', { acao: 'tratado', alvo: x.cod }, 'btn-mini', '', 'link')}${bA('Aliança (2)', 'acao_diplomatica', { acao: 'alianca', alvo: x.cod }, 'btn-mini', '', 'escudo')}
      ${x.sancao ? bA('Retirar sanções', 'acao_diplomatica', { acao: 'retirar_sancao', alvo: x.cod }, 'btn-mini') : bA('Sancionar (1)', 'acao_diplomatica', { acao: 'sancionar', alvo: x.cod }, 'btn-mini btn-perigo', '', 'alerta')}
      ${x.guerra ? bA('Negociar paz (1)', 'acao_diplomatica', { acao: 'paz', alvo: x.cod }, 'btn-mini btn-ouro', '', 'bandeira') : bA('Declarar guerra (3)', 'acao_diplomatica', { acao: 'declarar_guerra', alvo: x.cod }, 'btn-mini btn-perigo', `data-confirmar="Declarar guerra contra ${esc(x.nome)}? O prestígio na ONU despenca e o custo é alto."`, 'mira')}</div>
    ${acordosCom(x)}<p class="mini fraco mt mb0">Acordo: relação ≥ 55 · Aliança: ≥ 70.</p>`;
}
const nomeProp = (pauta, k) => CAT.diplomacia.pautas[pauta]?.propostas[k]?.nome || k;
const efeitosProp = (pauta, k) => (CAT.diplomacia.pautas[pauta]?.propostas[k]?.efeitos || []).join(' · ');
/* acordos antigos (de partidas anteriores ou de pedidos de líderes estrangeiros no multiplayer) */
function linhaAcordo(a) {
  return `<div class="acordo-linha">${icone(CAT.diplomacia.pautas[a.pauta]?.ico || 'link', 'p')}<div class="flex1"><b class="peq">${esc(a.nome)}</b><div class="mini fraco">${esc(a.pais)} · desde ${a.ano} · ${esc(efeitosProp(a.pauta, a.proposta))}</div></div>
    ${bA('Sair (1)', 'denunciar_acordo', { id: a.id }, 'btn-mini btn-fantasma', `data-confirmar="Sair do acordo '${esc(a.nome)}'? A relação com ${esc(a.pais)} piora e o prestígio cai."`)}</div>`;
}
const acordosCom = (x) => { const l = (S().diplomacia.acordos || []).filter((a) => a.cod === x.cod); return l.length ? `<div class="rotulo mt-g">Acordos com ${esc(x.nome)}</div>${l.map(linhaAcordo).join('')}` : ''; };

/* cúpulas obrigatórias: próximas datas e posições já tomadas */
function proximasCupulas(n = 4) {
  const m = S().meta, out = [];
  let ano = m.ano, tri = m.trimestre;
  for (let k = 0; k < 12 && out.length < n; k++) {
    tri++; if (tri > 4) { tri = 1; ano++; }
    for (const [id, c] of Object.entries(CAT.cupulas)) {
      const vale = c.datas ? c.datas.some(([a, t]) => a === ano && t === tri) : c.trimestres.includes(tri);
      if (vale) out.push({ id, nome: c.nome, ano, tri });
    }
  }
  return out.slice(0, n);
}
function painelCupulas() {
  const s = S(), hist = s.cupulas_hist || [];
  const ico = { mercosul: 'aperto', brics: 'globo', onu: 'bandeira', cop30: 'folha' };
  const prox = proximasCupulas().map((c) => `<div class="linha entre nw peq" style="padding:6px 0;border-bottom:1px solid var(--borda)"><span>${icone(ico[c.id] || 'globo', 'p')} <b>${esc(c.nome)}</b></span><span class="selo">${c.ano} · ${c.tri}º tri</span></div>`).join('');
  const feitas = hist.slice(0, 6).map((h) => `<div class="peq" style="padding:5px 0;border-bottom:1px solid var(--borda)">${h.ano} T${h.tri} · <b>${esc(h.nome)}</b><div class="mini fraco">Posição do Brasil: ${esc(h.posicao)}</div></div>`).join('');
  return UIc.painel('Cúpulas obrigatórias', 'calendario', `<p class="mini fraco">Mercosul, BRICS e ONU: quando chegam, você escolhe a posição do Brasil.</p>
    <div class="rotulo mt">Próximas</div>${prox || '<div class="fraco peq">—</div>'}${feitas ? `<div class="rotulo mt-g">Participações</div>${feitas}` : ''}`);
}

function vDiplomacia() {
  const s = S(), d = s.diplomacia, ent = Object.values(d.entidades).sort((a, b) => b.rel - a.rel);
  const lista = `<div class="rolagem lista-ent" style="overflow-x:auto"><table class="tabela"><tbody>${ent.map((e) => `<tr data-fn="selecionarEnt" data-id="${e.cod}" class="${e.cod === UI.sel ? 'ativa' : ''}">
    <td><b>${esc(e.nome)}</b><div class="mini fraco">${esc(e.bloco)}</div></td><td style="width:110px">${UIc.medidor(e.rel, 100, corRelacao(e.rel), true)}</td><td class="num peq">${nf(e.rel, 0)}</td><td>${chipsEnt(e)}</td></tr>`).join('')}</tbody></table></div>`;
  const extra = NAC() ? UIc.painel('Nações Unidas', 'globo', `${UIc.barra('Prestígio', d.onu, corEstado(d.onu, 60, 35))}${UIc.barra('Poder militar', d.militar, 'var(--azul)')}
      <p class="mini fraco">${d.assento_conselho ? '🏅 O Brasil tem assento no Conselho de Segurança.' : 'Prestígio ≥ 70 permite disputar assento no Conselho de Segurança.'}</p>
      <div class="grupo-btn">${bA('Propor resolução (1)', 'acao_diplomatica', { acao: 'onu_resolucao' }, 'btn-mini')}${bA('Missão de paz (2)', 'acao_diplomatica', { acao: 'onu_missao' }, 'btn-mini')}${bA('Conselho de Segurança (3)', 'acao_diplomatica', { acao: 'onu_conselho' }, 'btn-mini btn-ouro')}</div>`)
    : s.federal.vinculado ? UIc.painel('Governo Federal', 'palacio', `${UIc.barra('Relação com Brasília', s.federal.relacao, corEstado(s.federal.relacao, 60, 35))}
      <p class="mini fraco">O presidente é um jogador: <b>${esc(s.federal.presidente || '')}</b> (${esc(s.federal.partido_pres || '')}). A economia do estado segue a política econômica dele: crescimento ${pct(s.federal.crescimento, 1)}, inflação ${pct(s.federal.inflacao, 1)}, Selic ${pct(s.federal.selic, 1)}.</p>
      ${bF('Negociar com o presidente', 'irSala', 'btn-mini btn-ouro', '', 'aperto')}`)
    : UIc.painel('Governo Federal', 'palacio', `${UIc.barra('Relação com Brasília', s.federal.relacao, corEstado(s.federal.relacao, 60, 35))}<p class="mini fraco">Define o volume de repasses ao estado.</p>
      <div class="grupo-btn">${bA('Pedir repasse extra (2)', 'pedir_repasse', {}, 'btn-mini btn-ouro', '', 'moedas')}${bA('Alinhar-se a Brasília (1)', 'alinhar_federal', {}, 'btn-mini', '', 'aperto')}</div>`);
  const turno = s.meta.turno;
  const recebidas = (d.propostas || []).map((p) => `<div class="proposta-card"><div class="linha entre nw"><b>${esc(p.pais)}</b><span class="selo alerta">${icone('relogio', 'p')} expira em ${Math.max(0, p.expira - turno)} trim.</span></div>
    <div class="peq mt">${esc(p.nome)}</div><div class="mini fraco">${esc(efeitosProp(p.pauta, p.proposta))}</div>
    <div class="grupo-btn mt">${bA('Aceitar', 'responder_proposta', { id: p.id, aceitar: true }, 'btn-mini btn-ouro', '', 'check')}${bA('Recusar', 'responder_proposta', { id: p.id, aceitar: false }, 'btn-mini', '', 'x')}</div></div>`).join('');
  const painelRecebidas = recebidas ? UIc.painel('Propostas pendentes', 'jornal', recebidas) : '';
  const acs = d.acordos || [];
  const painelAcordos = acs.length ? UIc.painel('Acordos em vigor', 'link', acs.map(linhaAcordo).join(''), { sub: `${acs.length} em vigor` }) : '';
  const guerras = d.guerras.length ? UIc.painel('Conflitos', 'mira', d.guerras.map((g) => `<div class="guerra-card"><b>${esc(d.entidades[g.cod].nome)}</b> · ${g.turnos} trimestres${UIc.barra('Front', (g.progresso + 100) / 2, g.progresso >= 0 ? 'var(--verde)' : 'var(--vermelho)', nf(g.progresso, 0))}</div>`).join('')) : '';
  return `<div class="layout-diplo"><div class="coluna"><section class="vidro mapa-painel"><div class="painel-cab"><span class="ico-caixa">${icone(NAC() ? 'globo' : 'mapa')}</span><div class="flex1"><h2>${NAC() ? 'Relações internacionais' : 'Relações federativas'}</h2>
      <div class="mini fraco">${NAC() ? '194 países · parceiros principais coloridos' : '26 estados e DF'}</div></div></div><div id="mapa-diplo"></div><div class="legenda-rel"><span>hostil</span><i></i><span>aliado</span></div></section>${guerras}
    ${NAC() ? painelCupulas() : ''}${painelAcordos}</div>
    <div class="coluna"><section class="vidro max painel" id="painel-ent">${painelEntidade()}</section>${painelRecebidas}${extra}${UIc.painel(NAC() ? 'Parceiros' : 'Estados', 'bandeira', lista)}</div></div>`;
}

/* ---------- POPULAÇÃO ---------- */
function vPopulacao() {
  const s = S(), soc = s.sociedade;
  const grupos = Object.entries(D().grupos).map(([k, v]) => UIc.barra(k, v, corEstado(v, 55, 35), pct(v))).join('');
  const setores = Object.entries(s.setores).map(([k, v]) => UIc.barra(CAT.rotulo_setor[k], v, corEstado(v, 60, 40))).join('');
  const prom = s.jogador.propostas.map((pid) => { const p = CAT.propostas[pid]; const ok = p.lei ? s.congresso.leis_aprovadas.some((l) => l.id === p.lei) : null;
    return `<div class="linha entre" style="padding:8px 0;border-bottom:1px solid var(--borda)"><span>${esc(p.nome)}</span>${ok === null ? '<span class="selo">meta</span>' : ok ? '<span class="selo bom">cumprida</span>' : '<span class="selo alerta">pendente</span>'}</div>`; }).join('');
  return `<div class="grade g2"><div class="coluna">${UIc.painel('Aprovação por grupo', 'pessoas', grupos + `<p class="mini fraco mb0">Popularidade geral: <b>${pct(s.popularidade)}</b> · ${nf(s.meta.populacao_m, 1)} milhões de habitantes</p>`)}
    ${prom ? UIc.painel('Promessas de campanha', 'urna', prom) : ''}</div>
    <div class="coluna">${UIc.painel('Serviços públicos', 'predio', setores)}
    ${UIc.painel('Clima social', 'megafone', `${UIc.barra('Protestos', soc.protestos, corEstado(soc.protestos, 30, 60, true))}${UIc.barra('Apoio da mídia', (soc.midia + 100) / 2, corEstado(soc.midia, 15, -20), nf(soc.midia, 0))}
      ${UIc.barra('Polarização', soc.polarizacao, corEstado(soc.polarizacao, 45, 65, true))}${UIc.barra('Desigualdade (Gini)', soc.desigualdade, corEstado(soc.desigualdade, 48, 55, true), nf(soc.desigualdade / 100, 2))}
      <p class="mini fraco mb0">Cenário da partida: <b>${esc(CAT.cenarios[s.meta.cenario]?.nome || '')}</b> <span class="selo sim">simulado</span></p>`)}</div></div>`;
}

/* ---------- ESTATÍSTICAS ---------- */
function vEstatisticas() {
  const s = S(), h = s.historico;
  const g = (t, k, cor, f) => `<section class="vidro painel"><div class="rotulo">${t}</div>${graficoArea(h, k, cor, f)}</section>`;
  const p = (v) => pct(v, 1), n0 = (v) => nf(v, 0);
  const el = s.eleicoes.map((e) => `<tr><td>${e.ano}</td><td>${e.historica ? 'Eleição (2022)' : { inicial: 'Eleição', reeleicao: 'Reeleição', sucessor: 'Sucessão' }[e.tipo]}</td>
    <td>${e.turno1.slice(0, 3).map((c) => `${selo(c.partido)} ${nf(c.pct, 0)}%`).join(' &nbsp; ')}${e.turno2 ? `<div class="mini fraco mt">2º turno: ${e.turno2.map((c) => `${esc(c.partido)} ${nf(c.pct, 0)}%`).join(' × ')}</div>` : ''}</td>
    <td><span class="selo ${e.venceu ? 'bom' : 'ruim'}">${e.venceu ? 'vitória' : 'derrota'}</span></td></tr>`).join('');
  return `<div class="grade g3">${g('Popularidade', 'popularidade', 'var(--ouro)', p)}${g('Crescimento do PIB', 'crescimento', 'var(--verde)', p)}${g('Inflação', 'inflacao', 'var(--vermelho)', p)}
    ${g('Desemprego', 'desemprego', 'var(--ambar)', p)}${g('Dívida / PIB', 'divida_pib', 'var(--roxo)', p)}${g('Confiança do mercado', 'confianca', 'var(--azul)', n0)}
    ${g('Saúde', 'saude', 'var(--verde)', n0)}${g('Segurança', 'seguranca', 'var(--azul)', n0)}${g('Corrupção percebida', 'corrupcao', 'var(--vermelho)', n0)}</div>
    <div class="mt">${UIc.painel('Histórico eleitoral', 'urna', el ? `<div style="overflow-x:auto"><table class="tabela"><thead><tr><th>Ano</th><th>Disputa</th><th>Resultado</th><th></th></tr></thead><tbody>${el}</tbody></table></div>` : UIc.vazio('Nenhuma eleição disputada ainda.', 'urna'))}</div>`;
}

/* ---------- MAIS: povo, justiça, gráficos, sala (multiplayer) e ajustes ---------- */
const SUBS_MAIS = [['povo', 'pessoas', 'Povo'], ['justica', 'justica', 'Justiça'], ['graficos', 'grafico', 'Gráficos'], ['sala', 'link', 'Sala'], ['ajustes', 'ajustes', 'Ajustes']];
function vMais() {
  const s = S(), j = s.justica, sub = UI.subMais || 'povo';
  const alerta = { justica: j.impeachment.processo || j.vaga_stf || j.investigacoes.some((i) => i.status === 'aberta' && !i.resposta), sala: pendenciasSala() };
  const abas = SUBS_MAIS.map(([k, ic, t]) => `<button type="button" class="filtro ${sub === k ? 'ativo' : ''}" data-fn="subMais" data-v="${k}">${icone(ic, 'p')} ${t}${alerta[k] ? ' <span class="selo ruim">!</span>' : ''}</button>`).join('');
  return `<div class="filtros">${abas}</div>${{ povo: vPopulacao, justica: vJustica, graficos: vEstatisticas, sala: vSala, ajustes: vConfig }[sub]()}`;
}

/* ---------- SALA (MULTIPLAYER) ---------- */
function pendenciasSala() {
  return G.pedidos.filter((p) => p.status === 'pendente' && euDecido(p)).length + (G.mp.propostas_para_mim || []).length;
}
const opcoesSetor = (id) => `<select id="${id}">${CAT.setores.map((k) => `<option value="${k}">${CAT.rotulo_setor[k]}</option>`).join('')}</select>`;
const avResumo = (r) => `<div class="avatar-moldura" style="width:46px;height:46px;border-radius:13px">${Avatar.svg(Object.keys(r.aparencia || {}).length ? r.aparencia : Avatar.aleatoria(r.nome), { idade: r.idade || 50, partidoCor: partidoDe(r.partido).cor })}</div>`;

/* presidente: painel dos governadores jogadores, com as ações sobre cada estado */
function painelGovernadores() {
  const gs = G.mp.governadores;
  if (!gs.length) return UIc.painel('Governadores', 'mapa', UIc.vazio('Nenhum governador na sala ainda. Convide amigos: eles escolhem um estado e governam por conta própria, negociando com você.', 'mapa'));
  const pode = PODE();
  const cartao = (g) => {
    const jog = G.jogadores.find((j) => j.id === g.id) || {};
    return `<div class="gov-card"><div class="linha nw">${avResumo(g)}<div class="flex1"><b>${esc(g.nome)}</b> <span class="selo">${esc(g.uf)}</span>${jog.pronto ? ' <span class="selo bom">pronto</span>' : ''}
      <div class="mini fraco">${selo(g.partido)} ${esc(g.partido)} · ${esc(g.rotulo)} · ${jog.online ? '<span class="bom">online</span>' : 'offline'}${g.encerrado ? ' · <span class="ruim">partida encerrada</span>' : ''}</div></div></div>
      <div class="grade g3 peq mt"><div><div class="rotulo">Aprovação</div><b>${pct(g.popularidade)}</b></div><div><div class="rotulo">Caixa</div><b>${bi(g.caixa)}</b></div><div><div class="rotulo">Relação</div><b style="color:${corEstado(g.relacao, 60, 35)}">${nf(g.relacao, 0)}</b></div></div>
      ${UIc.barra('Relação com você', g.relacao, corEstado(g.relacao, 60, 35))}
      ${pode && !g.encerrado ? `<div class="gov-acoes"><label class="campo">R$ bi<input type="number" id="gv-valor-${g.id}" min="1" max="100" value="10"></label><label class="campo">Área${opcoesSetor(`gv-setor-${g.id}`)}</label></div>
      <div class="grupo-btn mt">${bF('Enviar verba', 'acaoGov', 'btn-mini btn-ouro', `data-id="${g.id}" data-tipo="verba" title="Transfere na hora do caixa federal para o estado"`, 'moedas')}
        ${bF('Propor convênio', 'acaoGov', 'btn-mini', `data-id="${g.id}" data-tipo="convenio" title="Programa federal na área escolhida; o governador aceita ou recusa"`, 'aperto')}
        ${bF('Pedir apoio político', 'acaoGov', 'btn-mini', `data-id="${g.id}" data-tipo="pede_apoio" title="Se aceitar, a bancada do estado se aproxima do governo no Congresso"`, 'congresso')}</div>` : ''}</div>`;
  };
  return UIc.painel('Governadores', 'mapa', `<div class="gov-lista">${gs.map(cartao).join('')}</div>
    <p class="mini fraco mt mb0">Verba vale na hora. Convênio e pedido de apoio esperam a resposta do governador. Boa relação rende apoio no Congresso; relação ruim vira oposição.</p>`, { sub: 'Cada um governa o próprio estado' });
}

/* governador: painel da Presidência e dos colegas */
function painelPresidencia() {
  const s = S(), pr = G.mp.presidente, pode = PODE();
  const colegas = G.mp.governadores.filter((g) => g.id !== G.eu.id).map((g) => `<div class="linha entre nw peq" style="padding:6px 0;border-bottom:1px solid var(--borda)"><span>${selo(g.partido)} <b>${esc(g.nome)}</b> · ${esc(g.rotulo)}</span><span class="fraco">${pct(g.popularidade)} aprovação</span></div>`).join('');
  return UIc.painel('Presidência da República', 'palacio', `<div class="linha nw">${avResumo(pr)}<div class="flex1"><b>${esc(pr.nome)}</b><div class="mini fraco">${selo(pr.partido)} ${esc(pr.partido)} · aprovação ${pct(pr.popularidade)}</div></div></div>
    <div class="grade g3 peq mt"><div><div class="rotulo">Crescimento</div><b>${pct(pr.crescimento, 1)}</b></div><div><div class="rotulo">Inflação</div><b>${pct(pr.inflacao, 1)}</b></div><div><div class="rotulo">Selic</div><b>${pct(pr.selic, 1)}</b></div></div>
    ${UIc.barra('Sua relação com Brasília', s.federal.relacao, corEstado(s.federal.relacao, 60, 35))}
    ${pode && !pr.encerrado ? `<div class="gov-acoes"><label class="campo">R$ bi<input type="number" id="pp-valor" min="1" max="100" value="10"></label><label class="campo">Área${opcoesSetor('pp-setor')}</label></div>
    <div class="grupo-btn mt">${bF('Pedir repasse', 'pedirPresidente', 'btn-mini btn-ouro', 'data-tipo="repasse"', 'moedas')}${bF('Pedir programa federal', 'pedirPresidente', 'btn-mini', 'data-tipo="obra" title="R$ 20 bi do governo federal na área escolhida"', 'predio')}
      ${bF('Pedir Força Nacional', 'pedirPresidente', 'btn-mini', 'data-tipo="forca_nacional"', 'escudo')}${bF('Oferecer apoio político', 'pedirPresidente', 'btn-mini', 'data-tipo="apoio_politico" title="Melhora muito a relação; a polarização no estado sobe um pouco"', 'aperto')}</div>` : ''}
    ${colegas ? `<div class="rotulo mt-g">Outros governadores</div>${colegas}<p class="mini fraco mb0">Proponha consórcios clicando no estado deles na aba Diplomacia: o outro jogador aceita ou recusa.</p>` : ''}`, { sub: 'Seu estado depende de Brasília' });
}

function vSala() {
  const s = S(), eu = G.eu, link = location.origin + '/jogo/' + G.codigo, pr = G.mp.pronto;
  const online = G.jogadores.filter((j) => j.online).length;
  const jogadores = G.jogadores.map((j) => `<div class="jogador-linha"><span class="inicial">${esc(iniciais(j.nome))}<i class="ponto-on ${j.online ? 'on' : ''}" title="${j.online ? 'online' : 'offline'}"></i></span><div class="flex1"><b class="peq">${esc(j.nome)}</b>${j.id === eu.id ? ' <span class="selo">você</span>' : ''}
    <div class="mini fraco">${esc(CAT.papeis[j.papel] || j.papel)}${j.extra.uf ? ' · ' + esc(j.extra.uf) : ''}${j.extra.pais ? ' · ' + esc(j.extra.pais) : ''} · ${j.online ? '<span class="bom">online</span>' : 'offline'}</div></div>
    ${j.pronto ? '<span class="selo bom">' + icone('check', 'p') + ' pronto</span>' : j.online ? '<span class="selo">jogando</span>' : ''}${j.anfitriao ? ' <span class="selo ouro">presidente</span>' : ''}</div>`).join('');
  const prontidao = pr.total > 1 ? `<div class="pronto-box"><div class="linha entre nw"><b class="peq">${icone('relogio', 'p')} Próximo trimestre: ${pr.prontos} de ${pr.total} prontos</b>
      ${eu.anfitriao && pr.faltam.length ? bF('Forçar avanço', 'forcarAvanco', 'btn-mini btn-perigo', 'data-confirmar="Avançar sem esperar? Eventos pendentes dos outros jogadores serão decididos automaticamente."', 'dir') : ''}</div>
      ${UIc.medidor(pr.prontos, pr.total, 'var(--verde)')}<div class="mini fraco">${pr.faltam.length ? 'Aguardando: ' + pr.faltam.map(esc).join(', ') : 'Todos prontos.'}</div></div>` : '';
  const chat = G.mensagens.map((m) => `<div class="msg"><b>${esc(m.autor)}</b>${esc(m.texto)}</div>`).join('') || UIc.vazio('Sem mensagens. Diga olá!', 'chat');
  const campo = {
    ministro: `<label class="campo">Área<select id="ped-setor">${CAT.setores.map((k) => `<option value="${k}">${CAT.rotulo_setor[k]}</option>`).join('')}</select></label>${bF('Pedir mais orçamento', 'enviarPedido', 'btn-ouro', 'data-tipo="orcamento"', 'grafico')}`,
    parlamentar: `<label class="campo">Emendas (R$ bi)<input type="number" id="ped-valor" min="1" max="100" value="10"></label>${bF('Oferecer apoio por emendas', 'enviarPedido', 'btn-ouro', 'data-tipo="apoio"', 'aperto')}`,
    lider: `<label class="campo">Proposta ao presidente<select id="ped-acao"><option value="tratado">Acordo comercial</option><option value="melhorar">Aproximação</option><option value="alianca">Aliança militar</option><option value="sancionar">Pedir sanções ao seu país</option></select></label>${bF('Enviar', 'enviarPedido', 'btn-ouro', 'data-tipo="acordo"', 'globo')}`,
  }[eu.governa ? '' : eu.papel];
  const detalhe = (p) => [p.payload.valor && bi(p.payload.valor), p.payload.setor && CAT.rotulo_setor[p.payload.setor], p.payload.uf, p.payload.para && 'com ' + p.payload.para,
    p.tipo === 'reuniao' && nomeProp(p.payload.pauta, p.payload.proposta), p.payload.acao].filter(Boolean).map(esc).join(' · ');
  const para = (p) => (p.destino ? G.jogadores.find((j) => j.id === p.destino)?.nome || '' : 'presidente');
  const pedidos = G.pedidos.map((p) => `<div class="jogador-linha"><div class="flex1 peq"><b>${esc(p.autor)}</b> <span class="fraco">→ ${esc(para(p))}</span><div class="mini">${esc(p.nome)}${detalhe(p) ? ' · ' + detalhe(p) : ''}</div></div>
    ${p.status === 'pendente' ? (euDecido(p) && !s.meta.encerrado ? `${bF('Aceitar', 'decidirPedido', 'btn-mini btn-ouro', `data-id="${p.id}" data-ok="1"`)} ${bF('Recusar', 'decidirPedido', 'btn-mini', `data-id="${p.id}" data-ok="0"`)}` : '<span class="selo alerta">pendente</span>') : `<span class="selo ${p.status === 'aprovado' ? 'bom' : 'ruim'}">${p.status === 'aprovado' ? 'aceito' : 'recusado'}</span>`}</div>`).join('')
    || UIc.vazio('Nenhum pedido ainda.', 'pasta');
  const meus = G.mp.propostas_para_mim || [];
  const propostas = meus.length ? UIc.painel('Propostas de acordo para você', 'aperto', meus.map((a) => `<div class="proposta-card"><b>${esc(a.nome)}</b><div class="mini fraco">De ${esc(a.de)} · ${esc(efeitosProp(a.pauta, a.proposta))}</div>
    <div class="grupo-btn mt">${bF('Aceitar', 'responderLider', 'btn-mini btn-ouro', `data-id="${a.id}" data-ok="1" data-origem="${a.origem ?? ''}"`, 'check')}${bF('Recusar', 'responderLider', 'btn-mini', `data-id="${a.id}" data-ok="0" data-origem="${a.origem ?? ''}"`, 'x')}</div></div>`).join(''), { sub: 'Aceitar assina o acordo para os dois lados' }) : '';
  const papelTxt = { ministro: 'Peça mais orçamento para sua área.', parlamentar: 'Ofereça apoio no Congresso em troca de emendas.', lider: 'Proponha acordos, alianças ou sanções ao presidente.' }[eu.papel];
  const especial = eu.anfitriao ? painelGovernadores() : eu.governa ? painelPresidencia() : '';
  return `<div class="grade g2"><div class="coluna">
    ${UIc.painel('Sala multiplayer', 'link', `<div class="linha entre"><div><div class="rotulo">Código da sala</div><div class="codigo-grande">${G.codigo}</div></div>${bF('Copiar convite', 'copiarLink', 'btn-ouro btn-mini', `data-link="${esc(link)}"`, 'copiar')}</div>
      <p class="mini fraco mt">Os amigos entram pelo menu <b>Multiplayer</b> com o código. Como <b>governador</b>, cada um governa o próprio estado. O trimestre só avança quando <b>todos os jogadores online</b> clicam em <b>Estou pronto</b>.</p>
      ${prontidao}<div class="sep"></div><div class="linha entre"><span class="rotulo">Jogadores</span><span class="selo ${online > 1 ? 'bom' : ''}">${online} online de ${G.jogadores.length}</span></div>${jogadores}`)}
    ${propostas}${especial}</div>
    <div class="coluna">${UIc.painel('Pedidos e propostas', 'pasta', (papelTxt ? `<p class="mini fraco">${esc(papelTxt)}</p>` : '') + pedidos + (campo && !s.meta.encerrado ? `<div class="coluna mt" style="gap:10px">${campo}</div>` : ''))}
    ${UIc.painel('Chat', 'chat', `<div class="chat rolagem" id="chat">${chat}</div><div class="linha nw mt"><input type="text" id="msg" maxlength="300" placeholder="Escreva uma mensagem…" autocomplete="off">${bF('', 'enviarMsg', 'btn-ouro btn-icone', 'aria-label="Enviar"', 'seta')}</div>`)}</div></div>`;
}

/* ---------- CONFIGURAÇÕES ---------- */
function vConfig() {
  const s = S(), t = Tema.get(), m = s.meta;
  const origem = m.antecessor ? `antecessor real: ${esc(m.antecessor)}` : '';
  return `<div class="grade g2"><div class="coluna">
    ${UIc.painel('Aparência', 'sol', `<div class="grupo-btn">${[['light', 'sol', 'Claro'], ['dark', 'lua', 'Escuro'], ['auto', 'ajustes', 'Automático']].map(([k, ic, n]) => `<button type="button" class="btn ${t === k ? 'btn-ouro' : ''}" data-fn="mudarTema" data-tema="${k}">${icone(ic, 'p')}${n}</button>`).join('')}</div>`)}
    ${UIc.painel('Tutorial', 'info', `<p class="peq suave">Um passeio guiado pelas abas: governar, criar leis, administrar o país, diplomacia e eleições.</p>${bF('Iniciar tutorial', 'abrirTutorial', 'btn-ouro', '', 'play')}`)}</div>
    <div class="coluna">${UIc.painel('Sua partida', 'bandeira', `<div class="linha nw">${avJogador('av-ficha')}<div class="flex1" style="min-width:0"><b class="titulo-display" style="font-size:1.2rem">${esc(s.jogador.nome)}</b><div class="peq suave">${s.jogador.idade + Math.floor(m.turno / 4)} anos · ${esc(s.jogador.partido_nome)} · ${esc(CAT.ideologias[s.jogador.ideologia].nome)}</div>
      <div class="mini fraco">${m.modo === 'presidente' ? 'Presidência da República' : 'Governo de ' + esc(m.rotulo)} · RUN ${esc(m.duracao)} · mandato ${m.mandato}/${m.max_mandatos}${origem ? ' · ' + origem : ''}</div>
      ${m.substitui ? `<div class="mini fraco">Cenário alternativo: você venceu a eleição de 2022 no lugar de ${esc(m.substitui)}.</div>` : ''}</div></div>
      <div class="grupo-btn mt">${m.encerrado ? bF('Ver relatório final', 'verRelatorio', 'btn-ouro', '', 'trofeu') : bA('Encerrar partida', 'encerrar_run', {}, 'btn-perigo', 'data-confirmar="Encerrar esta partida agora e ver o relatório?"', 'sair')}<a class="btn" href="/">${icone('palacio', 'p')}Menu inicial</a></div>`)}</div></div>`;
}

const VIEWS = { governo: vGoverno, economia: vEconomia, congresso: vCongresso, diplomacia: vDiplomacia, mais: vMais };
const ABAS = [['governo', 'palacio', 'Início'], ['economia', 'economia', 'Economia'], ['congresso', 'congresso', 'Leis'], ['diplomacia', 'globo', 'Mundo'], ['mais', 'ajustes', 'Mais']];
/* abas antigas (salvas no navegador) -> nova aba e sub-aba */
const ABAS_ANTIGAS = { justica: ['mais', 'justica'], populacao: ['mais', 'povo'], estatisticas: ['mais', 'graficos'], pais: ['mais', 'povo'], sala: ['mais', 'sala'], config: ['mais', 'ajustes'] };
const POS_RENDER = {
  diplomacia: () => montarMapa('mapa-diplo', () => { $('#painel-ent').innerHTML = painelEntidade(); $$('.lista-ent tr').forEach((r) => r.classList.toggle('ativa', r.dataset.id === UI.sel)); }),
};
