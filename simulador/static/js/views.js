/* Renderizadores de cada aba. Estado global: G (pacote da API), CAT (catálogo), UI (estado local de interface). */
const UI = { sel: null, pastaAberta: null, draft: null };
const S_ = () => G.estado;
const NAC = () => G.estado.meta.escopo === 'nacional';
const PODE = () => G.eu.anfitriao && !G.estado.meta.encerrado;
const rotuloPasta = (p) => (CAT.pastas[p][G.estado.meta.escopo] || CAT.pastas[p].nacional);
const cargo = () => (NAC() ? 'Presidente' : 'Governador');

function btn(txt, tipo, params, cls = '', extra = '') {
  return `<button type="button" class="btn ${cls}" data-a="${tipo}" data-p='${esc(JSON.stringify(params || {}))}' ${PODE() ? '' : 'disabled'} ${extra}>${txt}</button>`;
}
const fbtn = (txt, fn, cls = '', extra = '') => `<button type="button" class="btn ${cls}" data-fn="${fn}" ${extra}>${txt}</button>`;
const barra = (v, max = 100, cls = '') => `<div class="barra ${cls}"><i style="width:${clampN((v / max) * 100, 0, 100)}%"></i></div>`;
const classeBoa = (v, ok, ruim) => (v >= ok ? 'bom' : v <= ruim ? 'ruim' : 'alerta');
const linhaBarra = (rot, v, cls, texto) => `<div class="linha-barra"><span>${rot}</span>${barra(v, 100, cls)}<span class="v">${texto ?? nf(v, 0)}</span></div>`;
const kpi = (rot, val, sub = '', cls = '') => `<div class="glass kpi"><small>${rot}</small><strong class="${cls}">${val}</strong><div class="sub suave">${sub}</div></div>`;
const rotaTipo = (k) => ({ emenda: 'Emenda (3/5)', ordinaria: 'Lei ordinária' }[k]);
const pips = (n, max = 8) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="pip ${i < n ? 'on' : ''}"></i>`).join('')}</span>`;

function delta(chave, inverso = false, d = 1) {
  const h = G.estado.historico;
  if (h.length < 2) return '';
  const x = h[h.length - 1][chave] - h[h.length - 2][chave];
  if (Math.abs(x) < 0.05) return '<span class="suave">→ estável</span>';
  const bom = inverso ? x < 0 : x > 0;
  return `<span class="${bom ? 'bom' : 'ruim'}">${x > 0 ? '▲' : '▼'} ${nf(Math.abs(x), d)}</span>`;
}

/* ---------- faixa de indicadores ---------- */
function vKpis() {
  const s = S_(), e = s.economia, c = s.campanha;
  if (s.meta.fase === 'campanha') {
    return `<div class="kpis">${kpi('Reconhecimento', nf(c.reconhecimento, 0) + '%', 'conhecimento do seu nome')}${kpi('Rejeição', nf(c.rejeicao, 0) + '%', 'eleitores que não votam em você', c.rejeicao > 40 ? 'ruim' : '')}
      ${kpi('Fundo de campanha', nf(c.fundo, 0) + ' pts', 'gasto em comícios e TV')}${kpi('Trimestres até a eleição', c.turnos_restantes, 'campanha')}</div>`;
  }
  return `<div class="kpis">
    ${kpi('Popularidade', nf(s.popularidade, 0) + '%', delta('popularidade'), classeBoa(s.popularidade, 55, 35))}
    ${kpi('Crescimento', nf(e.crescimento, 1) + '%', delta('crescimento') + ' a.a.', classeBoa(e.crescimento, 2, 0.5))}
    ${kpi('Inflação', nf(e.inflacao, 1) + '%', delta('inflacao', true), e.inflacao > 6 ? 'ruim' : e.inflacao < 4.5 ? 'bom' : '')}
    ${kpi('Desemprego', nf(e.desemprego, 1) + '%', delta('desemprego', true), e.desemprego > 10 ? 'ruim' : '')}
    ${kpi('Dívida / PIB', nf(e.divida_pib, 0) + '%', delta('divida_pib', true), e.divida_pib > 90 ? 'ruim' : '')}
    ${kpi('Caixa', bi(e.caixa), 'resultado: ' + bi(e.resultado), e.resultado < 0 ? 'alerta' : 'bom')}
    ${kpi(NAC() ? 'Apoio na Câmara' : 'Apoio na Assembleia', nf(G.derivados.apoio_baixa, 0) + '%', G.derivados.apoio_baixa >= 50 ? 'maioria' : 'minoria', classeBoa(G.derivados.apoio_baixa, 50, 30))}
  </div>`;
}

/* ---------- GOVERNO ---------- */
function mapaMundo() {
  const ent = S_().diplomacia.entidades;
  const itens = CAT.paises.map((p) => {
    const eu = p.cod === 'BRA';
    const x = eu ? { rel: 100, guerra: false } : ent[p.cod];
    return { id: p.cod, rotulo: p.cod, col: p.pos[0], row: p.pos[1], fill: eu ? 'var(--acento)' : corRel(x.rel),
      titulo: eu ? 'Brasil' : `${p.nome} · relação ${nf(x.rel, 0)}${x.guerra ? ' · EM GUERRA' : ''}`,
      cls: (eu ? 'eu ' : '') + (x.guerra ? 'guerra ' : '') + (UI.sel === p.cod ? 'sel' : '') };
  });
  return `<div style="overflow-x:auto">${mapaGrade(itens, 13, 6, { fn: 'selecionarEntidade' })}</div>`;
}
function mapaBrasil() {
  const s = S_(), ent = s.diplomacia.entidades;
  const itens = CAT.estados.map((e) => {
    const eu = e.uf === s.meta.uf, x = ent[e.uf];
    return { id: e.uf, rotulo: e.uf, col: e.pos[0], row: e.pos[1], fill: eu ? 'var(--acento)' : corRel(x.rel),
      titulo: eu ? `${e.nome} (seu estado)` : `${e.nome} · relação ${nf(x.rel, 0)}${x.tratado ? ' · consórcio' : ''}`,
      cls: (eu ? 'eu ' : '') + (UI.sel === e.uf ? 'sel' : '') };
  });
  return `<div style="max-width:430px;margin:auto">${mapaGrade(itens, 6, 9, { fn: 'selecionarEntidade' })}</div>`;
}

function painelCampanha() {
  const s = S_(), c = s.campanha;
  if (!c.ativa) return '';
  const titulo = s.meta.fase === 'campanha' ? `Campanha para ${cargo()}` : c.sucessor ? 'Campanha do seu sucessor' : 'Campanha de reeleição';
  const livres = Object.values(s.congresso.partidos).filter((p) => !p.jogador && !c.coalizao.includes(p.sigla));
  const poll = c.pesquisa.map((p) => `<div class="linha-barra"><span>${esc(p.nome)} <small class="suave">${esc(p.partido)}</small></span>${barra(p.pct, 60, p.id === 'jogador' ? 'bom' : '')}<span class="v">${nf(p.pct, 1)}%</span></div>`).join('');
  return `<div class="glass"><h2>🗳️ ${titulo}</h2>
    <h4>Pesquisa de intenção de voto</h4>${poll}
    <div class="row mt"><span class="chip">Fundo: ${nf(c.fundo, 0)} pts</span><span class="chip">Reconhecimento ${nf(c.reconhecimento, 0)}%</span><span class="chip">Rejeição ${nf(c.rejeicao, 0)}%</span>
      <span class="chip">Coalizão: ${c.coalizao.length ? c.coalizao.join(', ') : '—'}</span></div>
    <div class="row mt">${btn('Comício (1 cap · 15 pts)', 'campanha', { acao: 'comicio' })}${btn('TV (1 · 30)', 'campanha', { acao: 'tv' })}
      ${btn('Redes (1 · 10)', 'campanha', { acao: 'redes' })}${btn('Atacar rival (1 · 20)', 'campanha', { acao: 'ataque' })}
      ${btn(c.debate_feito ? 'Debate realizado' : '🎙️ Debate (1 cap)', 'campanha', { acao: 'debate' }, 'prim')}</div>
    <div class="row mt"><select id="ali-sel" style="max-width:260px">${livres.map((p) => `<option value="${p.sigla}">${p.sigla} — ${esc(p.nome)}</option>`).join('')}</select>
      ${PODE() ? fbtn('Buscar aliança (2 cap)', 'fecharAlianca') : ''}</div>
    <p class="suave peq mb0">${s.meta.fase === 'campanha' ? 'O debate só fica disponível nos 2 últimos trimestres. Quando acabar o tempo, acontecem o 1º e, se preciso, o 2º turno.' : 'Seu desempenho no governo pesa mais que a propaganda. A eleição ocorre ao fim do mandato.'}</p></div>`;
}

function vGabinete() {
  const s = S_();
  if (s.meta.fase === 'campanha') return `<div class="glass"><h2>Gabinete</h2><p class="suave">Os ministros são nomeados após a posse.</p></div>`;
  const linhas = Object.keys(s.ministros).map((p) => {
    const m = s.ministros[p];
    const aberto = UI.pastaAberta === p;
    let cands = '';
    if (aberto) {
      cands = `<tr><td colspan="4"><div class="grid gauto">${s.candidatos_ministros[p].map((c, i) => `<div class="cand"><b>${esc(c.nome)}</b><small>${esc(c.partido)} · ${c.idade} anos</small>
        <div class="peq mt">Competência ${c.competencia}${barra(c.competencia, 100, 'bom')}Integridade ${c.integridade}${barra(c.integridade, 100, c.integridade < 50 ? 'ruim' : 'bom')}</div>
        <div class="mt">${btn('Nomear (1 cap)', 'nomear_ministro', { pasta: p, indice: i }, 'mini prim')}</div></div>`).join('')}</div></td></tr>`;
    }
    return `<tr><td><b>${esc(rotuloPasta(p))}</b></td>
      <td>${m ? `${esc(m.nome)} <span class="tag">${esc(m.partido)}</span>` : '<span class="suave">vago (interino)</span>'}</td>
      <td class="peq">${m ? `C ${m.competencia} · I <span class="${m.integridade < 50 ? 'ruim' : ''}">${m.integridade}</span>` : ''}</td>
      <td style="text-align:right;white-space:nowrap">${fbtn(aberto ? 'Fechar' : m ? 'Trocar' : 'Nomear', 'abrirPasta', 'mini', `data-id="${p}"`)} ${m ? btn('Demitir', 'demitir_ministro', { pasta: p }, 'mini perigo') : ''}</td></tr>${cands}`;
  }).join('');
  return `<div class="glass"><h2>${NAC() ? 'Ministérios' : 'Secretarias'}</h2><div style="overflow-x:auto"><table><thead><tr><th>Pasta</th><th>Titular</th><th>C / I</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
    <p class="suave peq mb0">C = competência, I = integridade. Partidos com ministros ficam mais próximos do governo; baixa integridade gera escândalos.</p></div>`;
}

function vNoticias() {
  const n = S_().noticias.slice(0, 12).map((x) => `<div class="noticia ${x.tipo}"><small class="suave">${x.ano} T${x.tri}</small> ${esc(x.texto)}</div>`).join('');
  return `<div class="glass"><h2>📰 Notícias</h2>${n || '<span class="suave">Sem notícias.</span>'}</div>`;
}

function vGoverno() {
  const s = S_();
  const mapa = `<div class="glass"><h2>${NAC() ? '🌐 Mapa-múndi — relações com o Brasil' : '🗺️ Mapa do Brasil — relações do seu estado'}</h2>
    ${NAC() ? mapaMundo() : mapaBrasil()}<div class="legenda"><span>hostil</span><div class="degrade"></div><span>aliado</span></div>
    <p class="suave peq mb0">Clique em um ${NAC() ? 'país' : 'estado'} para abrir a diplomacia.</p></div>`;
  const comunic = s.meta.fase === 'campanha' ? '' : `<div class="glass"><h2>Comunicação</h2><div class="row">
      ${btn('Campanha publicitária (1 cap · R$ 25 bi)', 'publicidade', { tipo: 'tv' })}${btn('Cadeia nacional (2)', 'publicidade', { tipo: 'cadeia' })}${btn('Pressionar mídia (2)', 'publicidade', { tipo: 'pressionar' })}</div></div>`;
  return `<div class="grid g-main"><div class="col">${painelCampanha()}${mapa}${vNoticias()}</div><div class="col">${vGabinete()}${comunic}</div></div>`;
}

/* ---------- ECONOMIA ---------- */
function resetDraft() {
  const s = S_();
  UI.draft = { imp: { ...s.impostos }, gasto: s.orcamento.gasto_pct, aloc: { ...s.orcamento.aloc } };
}
function slider(grp, id, rot, val, min, max, step, suf) {
  return `<div class="linha-barra"><span>${rot}</span><input type="range" data-sl="${grp}:${id}" min="${min}" max="${max}" step="${step}" value="${val}" ${PODE() ? '' : 'disabled'}>
    <span class="v" data-out="${grp}:${id}">${nf(val, step < 1 ? 1 : 0)}${suf}</span></div>`;
}
function vEconomia() {
  const s = S_(), e = s.economia;
  if (!UI.draft) resetDraft();
  const dr = UI.draft;
  const rotImp = NAC() ? { renda: 'Imposto de renda', empresas: 'Imposto sobre empresas', consumo: 'Impostos sobre consumo', importacao: 'Tarifa de importação' }
    : { renda: 'IPVA / ITCMD', empresas: 'Tributação de empresas', consumo: 'ICMS (consumo)' };
  const imps = Object.keys(rotImp).map((k) => slider('imp', k, rotImp[k], dr.imp[k], 0, 45, 0.5, '%')).join('');
  const soma = Object.values(dr.aloc).reduce((a, b) => a + b, 0) || 1;
  const sets = Object.keys(dr.aloc).filter((k) => NAC() || k !== 'defesa').map((k) =>
    `<div class="linha-barra"><span>${CAT.rotulo_setor[k]}</span><input type="range" data-sl="aloc:${k}" min="0" max="60" step="1" value="${dr.aloc[k]}" ${PODE() ? '' : 'disabled'}>
     <span class="v" data-out="aloc:${k}">${nf((dr.aloc[k] / soma) * 100, 0)}%</span></div>`).join('');
  const fisc = [['Receita do trimestre', e.receita], ['Despesas obrigatórias', -e.obrigatorias], ['Despesas discricionárias', -e.discricionarias], ['Juros da dívida', -e.juros], ['Resultado', e.resultado]];
  return `<div class="grid g2"><div class="col">
    <div class="glass"><h2>Indicadores</h2><div class="grid g2">
      ${kpi('PIB', bi(e.pib_bi), NAC() ? 'anual' : 'do estado')}${kpi('Juros (Selic)', nf(e.selic, 2) + '%', NAC() ? 'definida pelo Banco Central' : 'taxa federal')}
      ${kpi('Câmbio', 'R$ ' + nf(e.cambio, 2), 'por dólar')}${kpi('Confiança do mercado', nf(e.confianca, 0), '0–100', classeBoa(e.confianca, 55, 35))}</div>
      ${NAC() ? `<div class="row mt">${btn('Pressionar Banco Central a baixar juros (2 cap)', 'pressionar_bc', {}, 'mini')}</div>` : `<p class="suave peq">A economia do estado acompanha a macroeconomia federal (crescimento federal ${nf(s.federal.crescimento, 1)}%, inflação ${nf(s.federal.inflacao, 1)}%).</p>`}</div>
    <div class="glass"><h2>Resultado fiscal do último trimestre</h2><table><tbody>${fisc.map(([r, v]) => `<tr><td>${r}</td><td style="text-align:right" class="${v < 0 && r === 'Resultado' ? 'ruim' : v > 0 && r === 'Resultado' ? 'bom' : ''}">${bi(v)}</td></tr>`).join('')}</tbody></table>
      <p class="suave peq mb0">Déficit: ${nf(e.deficit_pib, 1)}% do PIB. Carga tributária efetiva: ${nf(G.derivados.carga, 1)}%. Se o caixa acabar, a dívida cresce.</p></div></div>
    <div class="col"><div class="glass"><h2>Impostos</h2>${imps}<div class="row mt">${btn('Aplicar impostos (1 cap)', 'ajustar_impostos', {}, 'prim', 'data-fn="aplicarImpostos"')}</div>
      <p class="suave peq mb0">Mais impostos arrecadam mais, mas reduzem crescimento e popularidade.</p></div>
      <div class="glass"><h2>Orçamento discricionário</h2>${slider('gasto', 'x', 'Nível de gasto', dr.gasto, 15, 45, 0.5, '% da receita')}<hr>
      <h4>Distribuição</h4>${sets}<div class="row mt">${btn('Aplicar orçamento', 'ajustar_orcamento', {}, 'prim', 'data-fn="aplicarOrcamento"')}</div>
      <p class="suave peq mb0">Setores mais bem financiados melhoram; ministros competentes ajudam.</p></div></div></div>`;
}

/* ---------- JUSTIÇA ---------- */
function vJustica() {
  const s = S_(), j = s.justica, imp = j.impeachment;
  const invs = j.investigacoes.filter((i) => i.status === 'aberta').map((i) => `<div class="cand" style="cursor:default"><b>${esc(i.titulo)}</b>
    <small>gravidade ${'●'.repeat(i.gravidade)} · resposta: ${i.resposta || 'nenhuma'}</small>${barra(i.progresso, 100, 'alerta')}
    <div class="row mt">${btn('Cooperar', 'responder_investigacao', { id: i.id, resposta: 'cooperar' }, 'mini')}
    ${i.alvo.startsWith('ministro:') ? btn('Demitir suspeito', 'responder_investigacao', { id: i.id, resposta: 'demitir' }, 'mini') : ''}
    ${btn('Obstruir (2 cap)', 'responder_investigacao', { id: i.id, resposta: 'obstruir' }, 'mini perigo')}</div></div>`).join('');
  const feitas = j.investigacoes.filter((i) => i.status !== 'aberta').slice(-4).map((i) => `<div class="peq suave">• ${esc(i.titulo)} — ${i.status}</div>`).join('');
  const proc = imp.processo;
  const derrubadas = s.congresso.leis_derrubadas.map((l) => esc(CAT.leis[l.id].nome)).join(', ');
  return `<div class="grid g2"><div class="col">
    <div class="glass"><h2>⚖️ Supremo Tribunal Federal</h2>${linhaBarra('Independência', j.independencia, classeBoa(j.independencia, 60, 35))}${linhaBarra('Confiança pública', j.confianca_stf, classeBoa(j.confianca_stf, 55, 35))}
      ${NAC() ? linhaBarra('Autonomia do Banco Central', j.bc_indep, classeBoa(j.bc_indep, 60, 35)) : ''}
      <p class="suave peq">O STF pode derrubar leis inconstitucionais — quanto mais independente, maior o risco para propostas polêmicas.</p>
      <div class="row">${btn('Pressionar o Judiciário (2 cap)', 'pressionar_stf', {}, 'mini perigo')}</div>
      ${j.vaga_stf ? `<div class="noticia evento mt"><b>Vaga aberta no STF.</b> Quem você indica?<div class="row mt">${btn('Jurista técnico', 'indicar_stf', { perfil: 'tecnico' }, 'mini')}${btn('Aliado político', 'indicar_stf', { perfil: 'aliado' }, 'mini')}</div></div>` : ''}
      ${derrubadas ? `<p class="peq suave">Leis derrubadas pelo STF: ${derrubadas}</p>` : ''}</div>
    <div class="glass"><h2>Impeachment</h2>${linhaBarra('Risco', imp.risco, imp.risco > 65 ? 'ruim' : imp.risco > 40 ? 'alerta' : 'bom', nf(imp.risco, 0) + '%')}
      ${proc ? `<div class="noticia ruim"><b>Processo em andamento</b> — etapa: ${proc.etapa === 'baixa' ? (NAC() ? 'Câmara' : 'Assembleia') : 'Senado'}.<div class="row mt">${btn('Negociar com parlamentares (2 cap · R$ 20 bi)', 'negociar_impeachment', {}, 'mini')}</div></div>`
        : '<p class="suave peq mb0">Risco sobe com baixa popularidade, corrupção, investigações e falta de base no Congresso. Acima de 65% e com popularidade baixa, um processo pode ser aberto.</p>'}</div></div>
    <div class="col"><div class="glass"><h2>Corrupção</h2>${linhaBarra('Percepção de corrupção', j.corrupcao, j.corrupcao > 60 ? 'ruim' : j.corrupcao > 40 ? 'alerta' : 'bom')}
      <p class="suave peq mb0">Ministros pouco íntegros e pressão sobre as instituições aumentam a corrupção percebida.</p></div>
      <div class="glass"><h2>Investigações abertas</h2>${invs || '<span class="suave">Nenhuma investigação em curso.</span>'}${feitas ? `<hr><h4>Encerradas</h4>${feitas}` : ''}</div></div></div>`;
}

/* ---------- CONGRESSO ---------- */
function hemiciclo(casa, total) {
  const cor = { base: 'var(--bom)', independente: 'var(--alerta)', 'oposição': 'var(--ruim)' };
  return `<div class="hemiciclo">${G.derivados.partidos.filter((p) => p[casa] > 0).map((p) => `<i style="width:${(p[casa] / total) * 100}%;background:${cor[p.posicao]}" title="${p.sigla}: ${p[casa]}"></i>`).join('')}</div>`;
}
function vCongresso() {
  const s = S_(), c = s.congresso, d = G.derivados;
  const alta = c.total_alta > 0;
  const tab = d.partidos.map((p) => `<tr><td><b>${p.sigla}</b>${p.jogador ? ' ★' : ''}<br><span class="suave peq">${esc(p.nome)}</span></td><td>${p.baixa}${alta ? ' / ' + p.alta : ''}</td>
    <td style="min-width:90px">${barra(p.afin, 100, p.posicao === 'base' ? 'bom' : p.posicao === 'oposição' ? 'ruim' : 'alerta')}<span class="peq suave">${nf(p.afin, 0)} · ${p.posicao}</span></td>
    <td style="white-space:nowrap">${btn('Emendas R$10bi', 'negociar', { tipo: 'emendas', partido: p.sigla, valor: 10 }, 'mini')} ${btn('Pressionar', 'negociar', { tipo: 'pressionar', partido: p.sigla }, 'mini')}</td></tr>`).join('');
  const aprov = new Set(c.leis_aprovadas.map((l) => l.id));
  const recentes = new Set([...c.leis_rejeitadas, ...c.leis_derrubadas].filter((l) => s.meta.turno - l.turno < 2).map((l) => l.id));
  const cats = {};
  Object.entries(CAT.leis).filter(([, l]) => l.escopos.includes(s.meta.escopo)).forEach(([id, l]) => (cats[l.cat] = cats[l.cat] || []).push([id, l]));
  const leis = Object.entries(cats).map(([cat, arr]) => `<h4 class="mt">${cat}</h4><div class="grid gauto">${arr.map(([id, l]) => {
    const feito = aprov.has(id), espera = recentes.has(id);
    return `<div class="cand lei" style="cursor:default"><b>${esc(l.nome)}</b><small>${esc(l.desc)}</small>
      <div class="row peq"><span class="tag">${rotaTipo(l.tipo)}</span><span class="tag">custo ${l.custo} cap</span>${l.risco >= 0.25 ? '<span class="tag ruim">risco no STF</span>' : ''}</div>
      ${feito ? '<span class="tag bom">Em vigor</span>' : btn(espera ? 'Aguarde' : 'Propor ao Congresso', 'propor_lei', { lei: id }, 'mini prim', espera ? 'disabled' : '')}</div>`;
  }).join('')}</div>`).join('');
  const uv = c.ultima_votacao;
  const votacao = uv ? `<div class="noticia evento"><b>Última votação:</b> ${esc(CAT.leis[uv.lei].nome)} — ${Object.entries(uv.resultado).map(([k, r]) => `${k === 'baixa' ? (NAC() ? 'Câmara' : 'Assembleia') : 'Senado'}: ${r.sim}/${r.total} ${r.aprovou ? '✔' : '✖'}`).join(' · ')}</div>` : '';
  return `<div class="grid g-main"><div class="col">
    <div class="glass"><h2>${NAC() ? 'Câmara dos Deputados' : 'Assembleia Legislativa'}</h2>${hemiciclo('baixa', c.total_baixa)}<p class="peq suave">Base do governo: <b>${nf(d.apoio_baixa, 0)}%</b> das cadeiras (${c.total_baixa} no total)</p>
      ${alta ? `<h2 class="mt">Senado</h2>${hemiciclo('alta', c.total_alta)}<p class="peq suave mb0">Base do governo: <b>${nf(d.apoio_alta, 0)}%</b> (${c.total_alta} cadeiras)</p>` : ''}
      <div class="legenda"><span style="color:var(--bom)">■ base</span><span style="color:var(--alerta)">■ independente</span><span style="color:var(--ruim)">■ oposição</span></div></div>
    <div class="glass"><h2>Propor leis</h2>${votacao}<p class="suave peq">Leis ordinárias exigem maioria simples; emendas, 3/5. Capital político disponível: <b>${s.capital}</b></p>${leis}</div></div>
    <div class="col"><div class="glass"><h2>Partidos e negociação</h2><div style="overflow-x:auto"><table><thead><tr><th>Partido</th><th>${alta ? 'Cad. / Sen.' : 'Cadeiras'}</th><th>Afinidade</th><th></th></tr></thead><tbody>${tab}</tbody></table></div></div></div></div>`;
}

/* ---------- DIPLOMACIA ---------- */
function chipsEnt(x) {
  return `${x.alianca ? '<span class="tag bom">aliança</span>' : ''}${x.tratado ? `<span class="tag bom">${NAC() ? 'tratado' : 'consórcio'}</span>` : ''}${x.sancao ? '<span class="tag ruim">sanção</span>' : ''}${x.guerra ? '<span class="tag ruim">GUERRA</span>' : ''}${x.jogador ? `<span class="tag">👤 ${esc(x.jogador)}</span>` : ''}`;
}
function vDiplomacia() {
  const s = S_(), d = s.diplomacia, ent = Object.values(d.entidades).sort((a, b) => b.rel - a.rel);
  if (!UI.sel || !d.entidades[UI.sel]) UI.sel = ent[0].cod;
  const x = d.entidades[UI.sel];
  const lista = `<div class="glass"><h2>${NAC() ? 'Países' : 'Estados'}</h2><div style="max-height:420px;overflow-y:auto"><table><tbody>${ent.map((e) => `<tr data-id="${e.cod}" data-fn="selecionarEntidade" style="cursor:pointer" class="${e.cod === UI.sel ? 'forte-t' : ''}">
    <td>${esc(e.nome)}</td><td style="width:90px">${barra(e.rel, 100, classeBoa(e.rel, 60, 35))}</td><td class="peq">${nf(e.rel, 0)}</td><td>${chipsEnt(e)}</td></tr>`).join('')}</tbody></table></div></div>`;
  if (!NAC()) {
    const f = s.federal;
    return `<div class="grid g2"><div class="col"><div class="glass"><h2>🏛️ Governo Federal</h2>${linhaBarra('Relação com Brasília', f.relacao, classeBoa(f.relacao, 60, 35))}
      <p class="suave peq">Define o volume de repasses. Crescimento federal ${nf(f.crescimento, 1)}% · inflação ${nf(f.inflacao, 1)}% · Selic ${nf(f.selic, 1)}%.</p>
      <div class="row">${btn('Pedir repasse extra (2 cap)', 'pedir_repasse', {}, 'mini')}${btn('Alinhar-se ao governo federal (1 cap)', 'alinhar_federal', {}, 'mini')}</div></div>
      <div class="glass"><h2>${esc(x.nome)}</h2><p class="suave peq">${esc(x.bloco)} · PIB R$ ${nf(x.pib, 0)} bi</p>${linhaBarra('Relação', x.rel, classeBoa(x.rel, 60, 35))}<div class="row">${chipsEnt(x)}</div>
      <div class="row mt">${btn('Missão de cooperação (1 cap)', 'acao_diplomatica', { acao: 'melhorar', alvo: x.cod }, 'mini')}${btn('Firmar consórcio (2 cap)', 'acao_diplomatica', { acao: 'tratado', alvo: x.cod }, 'mini prim')}</div>
      <p class="suave peq mb0">Consórcios exigem relação ≥ 55 e impulsionam o crescimento.</p></div></div><div class="col">${lista}</div></div>`;
  }
  const guerras = d.guerras.map((g) => `<div class="noticia ruim"><b>Guerra contra ${esc(d.entidades[g.cod].nome)}</b> · ${g.turnos} trimestres<div class="linha-barra"><span>Progresso</span>${barra((g.progresso + 100) / 2, 100, g.progresso > 0 ? 'bom' : 'ruim')}<span class="v">${nf(g.progresso, 0)}</span></div></div>`).join('');
  return `<div class="grid g2"><div class="col">
    <div class="glass"><h2>🇺🇳 ONU</h2>${linhaBarra('Prestígio', d.onu, classeBoa(d.onu, 60, 35))}${linhaBarra('Poder militar', d.militar, classeBoa(d.militar, 55, 35))}
      <p class="peq suave">${d.assento_conselho ? '🏅 O Brasil tem assento no Conselho de Segurança.' : 'Prestígio ≥ 70 permite disputar assento no Conselho de Segurança.'}</p>
      <div class="row">${btn('Propor resolução (1)', 'acao_diplomatica', { acao: 'onu_resolucao' }, 'mini')}${btn('Missão de paz (2)', 'acao_diplomatica', { acao: 'onu_missao' }, 'mini')}${btn('Conselho de Segurança (3)', 'acao_diplomatica', { acao: 'onu_conselho' }, 'mini prim')}</div></div>
    <div class="glass"><h2>${esc(x.nome)}</h2><p class="suave peq">${esc(x.bloco)} · ${esc(x.regime)} · PIB US$ ${nf(x.pib, 1)} tri · poder militar ${x.militar}</p>
      ${linhaBarra('Relação', x.rel, classeBoa(x.rel, 60, 35))}<div class="row">${chipsEnt(x)}</div>
      <div class="row mt">${btn('Missão diplomática (1)', 'acao_diplomatica', { acao: 'melhorar', alvo: x.cod }, 'mini')}${btn('Acordo comercial (2)', 'acao_diplomatica', { acao: 'tratado', alvo: x.cod }, 'mini')}${btn('Aliança (2)', 'acao_diplomatica', { acao: 'alianca', alvo: x.cod }, 'mini')}
      ${x.sancao ? btn('Retirar sanções', 'acao_diplomatica', { acao: 'retirar_sancao', alvo: x.cod }, 'mini') : btn('Sancionar (1)', 'acao_diplomatica', { acao: 'sancionar', alvo: x.cod }, 'mini perigo')}
      ${x.guerra ? btn('Negociar paz (1)', 'acao_diplomatica', { acao: 'paz', alvo: x.cod }, 'mini prim') : btn('Declarar guerra (3)', 'acao_diplomatica', { acao: 'declarar_guerra', alvo: x.cod }, 'mini perigo', `data-confirm="Declarar guerra contra ${esc(x.nome)}? Isso derruba o prestígio na ONU e custa caro."`)}</div>
      <p class="suave peq mb0">Acordo exige relação ≥ 55; aliança, ≥ 70. Guerras exigem poder militar ≥ 30.</p></div>
    ${guerras ? `<div class="glass"><h2>⚔️ Guerras em curso</h2>${guerras}</div>` : ''}</div><div class="col">${lista}</div></div>`;
}

/* ---------- POPULAÇÃO ---------- */
function vPopulacao() {
  const s = S_(), d = G.derivados, soc = s.sociedade;
  const grupos = Object.entries(d.grupos).map(([k, v]) => linhaBarra(k, v, classeBoa(v, 55, 35), nf(v, 0) + '%')).join('');
  const setores = s.setores;
  const sets = Object.keys(setores).map((k) => linhaBarra(CAT.rotulo_setor[k], setores[k], classeBoa(setores[k], 60, 40), nf(setores[k], 0))).join('');
  const prom = s.jogador.propostas.map((pid) => {
    const p = CAT.propostas[pid];
    const cum = p.lei ? s.congresso.leis_aprovadas.some((l) => l.id === p.lei) : null;
    return `<div class="row entre"><span>${esc(p.nome)}</span>${cum === null ? '<span class="tag">meta numérica</span>' : cum ? '<span class="tag bom">cumprida</span>' : '<span class="tag alerta">pendente</span>'}</div>`;
  }).join('') || '<span class="suave">Você não fez promessas.</span>';
  return `<div class="grid g2"><div class="col">
    <div class="glass"><h2>Aprovação por grupo</h2>${grupos}<p class="suave peq mb0">Popularidade geral: <b>${nf(s.popularidade, 0)}%</b></p></div>
    <div class="glass"><h2>Promessas de campanha</h2>${prom}</div></div>
    <div class="col"><div class="glass"><h2>Serviços públicos</h2>${sets}</div>
    <div class="glass"><h2>Clima social</h2>${linhaBarra('Protestos', soc.protestos, soc.protestos > 60 ? 'ruim' : soc.protestos > 35 ? 'alerta' : 'bom')}
      ${linhaBarra('Apoio da mídia', (soc.midia + 100) / 2, classeBoa(soc.midia, 15, -20), nf(soc.midia, 0))}${linhaBarra('Polarização', soc.polarizacao, soc.polarizacao > 65 ? 'ruim' : 'alerta')}
      ${linhaBarra('Desigualdade (Gini)', soc.desigualdade, soc.desigualdade > 55 ? 'ruim' : 'alerta', nf(soc.desigualdade / 100, 2))}
      <p class="suave peq mb0">População: ${nf(s.meta.populacao_m, 1)} milhões · Cenário: <b>${esc(CAT.cenarios[s.meta.cenario]?.nome || '')}</b></p></div></div></div>`;
}

/* ---------- ESTATÍSTICAS ---------- */
function vEstatisticas() {
  const s = S_(), h = s.historico;
  const g = (t, k, cor, f) => `<div class="glass"><h3>${t}</h3>${grafico(h, k, cor, f)}</div>`;
  const pct = (v) => nf(v, 1) + '%';
  const eleicoes = s.eleicoes.map((e) => `<tr><td>${e.ano}</td><td>${{ inicial: 'Eleição inicial', reeleicao: 'Reeleição', sucessor: 'Sucessor' }[e.tipo]}</td>
    <td>${e.turno1.map((c) => `${esc(c.partido)} ${nf(c.pct, 0)}%`).join(' · ')}${e.turno2 ? `<br><span class="suave">2º turno: ${e.turno2.map((c) => `${esc(c.partido)} ${nf(c.pct, 0)}%`).join(' × ')}</span>` : ''}</td>
    <td><span class="tag ${e.venceu ? 'bom' : 'ruim'}">${e.venceu ? 'vitória' : 'derrota'}</span></td></tr>`).join('');
  return `<div class="grid g3">${g('Popularidade', 'popularidade', 'var(--acento)', pct)}${g('Crescimento do PIB', 'crescimento', 'var(--bom)', pct)}${g('Inflação', 'inflacao', 'var(--ruim)', pct)}
    ${g('Desemprego', 'desemprego', 'var(--alerta)', pct)}${g('Dívida / PIB', 'divida_pib', 'var(--ruim)', pct)}${g('Confiança do mercado', 'confianca', 'var(--acento)', (v) => nf(v, 0))}
    ${g('Saúde', 'saude', 'var(--bom)', (v) => nf(v, 0))}${g('Segurança', 'seguranca', 'var(--acento)', (v) => nf(v, 0))}${g('Corrupção percebida', 'corrupcao', 'var(--ruim)', (v) => nf(v, 0))}</div>
    <div class="glass mt"><h2>Eleições</h2>${eleicoes ? `<table><thead><tr><th>Ano</th><th>Tipo</th><th>Resultado</th><th></th></tr></thead><tbody>${eleicoes}</tbody></table>` : '<span class="suave">Nenhuma eleição disputada ainda.</span>'}</div>`;
}

/* ---------- CONFIGURAÇÕES ---------- */
function vConfig() {
  const s = S_(), eu = G.eu;
  const link = location.origin + '/jogo/' + G.codigo;
  const t = Tema.get();
  const jogadores = G.jogadores.map((j) => `<div class="row entre peq"><span>${esc(j.nome)}</span><span class="tag">${esc(CAT.papeis[j.papel] || j.papel)}${j.extra.pais ? ' · ' + esc(j.extra.pais) : ''}</span></div>`).join('');
  const chat = G.mensagens.map((m) => `<div class="msg"><b>${esc(m.autor)}</b> ${esc(m.texto)}</div>`).join('') || '<span class="suave peq">Sem mensagens.</span>';
  let pedidoForm = '';
  const campo = {
    governador: `<label class="campo">Valor (R$ bi)<input type="number" id="ped-valor" min="1" max="100" value="10"></label>${fbtn('Pedir repasse', 'enviarPedido', 'prim', 'data-tipo="repasse"')}`,
    parlamentar: `<label class="campo">Emendas (R$ bi)<input type="number" id="ped-valor" min="1" max="100" value="10"></label>${fbtn('Oferecer apoio em troca de emendas', 'enviarPedido', 'prim', 'data-tipo="apoio"')}`,
    ministro: `<label class="campo">Setor<select id="ped-setor">${CAT.setores.map((k) => `<option value="${k}">${CAT.rotulo_setor[k]}</option>`).join('')}</select></label>${fbtn('Pedir mais orçamento', 'enviarPedido', 'prim', 'data-tipo="orcamento"')}`,
    lider: `<label class="campo">Proposta<select id="ped-acao"><option value="tratado">Acordo comercial</option><option value="alianca">Aliança</option><option value="melhorar">Aproximação</option><option value="sancionar">Sanção (contra nós)</option></select></label>${fbtn('Enviar proposta ao governo', 'enviarPedido', 'prim', 'data-tipo="acordo"')}`,
  }[eu.papel];
  if (campo) pedidoForm = `<div class="col mt">${campo}</div>`;
  const pend = G.pedidos.map((p) => `<div class="row entre peq"><span><b>${esc(p.autor)}</b> (${esc(p.papel)}): ${esc(p.tipo)} ${p.payload.valor ? 'R$ ' + p.payload.valor + ' bi' : esc(p.payload.setor || p.payload.acao || '')}</span>
    ${p.status === 'pendente' ? (eu.anfitriao ? `<span>${fbtn('Aprovar', 'decidirPedido', 'mini prim', `data-id="${p.id}" data-ok="1"`)} ${fbtn('Negar', 'decidirPedido', 'mini', `data-id="${p.id}" data-ok="0"`)}</span>` : '<span class="tag">pendente</span>') : `<span class="tag ${p.status === 'aprovado' ? 'bom' : 'ruim'}">${p.status}</span>`}</div>`).join('') || '<span class="suave peq">Sem pedidos.</span>';
  return `<div class="grid g2"><div class="col">
    <div class="glass"><h2>Aparência</h2><div class="row">${['light', 'dark', 'auto'].map((k) => `<button type="button" class="btn ${t === k ? 'prim' : ''}" data-fn="mudarTema" data-tema="${k}">${{ light: '☀️ Claro', dark: '🌙 Escuro', auto: '🖥️ Automático' }[k]}</button>`).join('')}</div></div>
    <div class="glass"><h2>Sua partida</h2><p class="peq"><b>${esc(s.jogador.nome)}</b> (${s.jogador.idade + Math.floor(s.meta.turno / 4)} anos) · ${esc(s.jogador.partido_nome)} · ${esc(CAT.ideologias[s.jogador.ideologia].nome)}<br>
      ${s.meta.modo === 'presidente' ? 'Presidente do Brasil' : 'Governador — ' + esc(s.meta.rotulo)} · RUN ${esc(s.meta.duracao)} · cenário ${esc(CAT.cenarios[s.meta.cenario]?.nome || '')}<br>
      Mandato ${s.meta.mandato}/${s.meta.max_mandatos}${s.meta.duracao === 'longa' ? ' + sucessor' : ''} · ${s.meta.ano} T${s.meta.trimestre}</p>
      <div class="row">${s.meta.encerrado ? fbtn('Ver relatório final', 'verRelatorio', 'prim') : btn('Encerrar partida e ver relatório', 'encerrar_run', {}, 'perigo', 'data-confirm="Encerrar esta partida agora?"')}<a class="btn" href="/">Nova partida</a></div></div>
    <div class="glass"><h2>Multiplayer</h2><p class="peq">Código: <b style="font-size:1.2rem;letter-spacing:.1em">${G.codigo}</b></p><div class="row">${fbtn('Copiar link', 'copiarLink', 'mini', `data-link="${esc(link)}"`)}</div>
      <h4 class="mt">Jogadores</h4>${jogadores}
      <p class="suave peq mb0">Papéis: o anfitrião governa; os demais enviam pedidos (repasses, orçamento, emendas, acordos) e conversam.</p></div></div>
    <div class="col"><div class="glass"><h2>Pedidos</h2>${pend}${pedidoForm}</div>
    <div class="glass"><h2>Chat</h2><div class="chat" id="chat">${chat}</div><div class="row mt"><input type="text" id="msg" maxlength="300" placeholder="Mensagem…" style="flex:1">${fbtn('Enviar', 'enviarMsg', 'prim')}</div></div></div></div>`;
}

const VIEWS = { governo: vGoverno, economia: vEconomia, justica: vJustica, congresso: vCongresso, diplomacia: vDiplomacia, populacao: vPopulacao, estatisticas: vEstatisticas, config: vConfig };
const ABAS = [['governo', 'Governo'], ['economia', 'Economia'], ['justica', 'Justiça'], ['congresso', 'Congresso'], ['diplomacia', 'Diplomacia'], ['populacao', 'População'], ['estatisticas', 'Estatísticas'], ['config', 'Configurações']];
