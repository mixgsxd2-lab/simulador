/* Menu inicial: tela título, assistente de nova campanha, criador de personagem, continuar, multiplayer, galeria, ranking, ajustes */
let CAT = null;
const CFG = { modo: 'presidente', uf: null, partido: null, partido_novo: false, partido_nome: '', partido_cor: '#7c5cff', partido_numero: '',
  ideologia: null, propostas: [], duracao: 'media', cenario: 'aleatorio', nome: '', idade: 35, genero: 'neutro', aparencia: { ...Avatar.PADRAO } };
const UIm = { passo: 0, abaC: 'identidade', filtro: 'todos', era: 'todas', mapaUF: null };

const PASSOS = [
  { id: 'cargo', t: 'Cargo', sub: 'Escolha onde você quer governar.' },
  { id: 'territorio', t: 'Território', sub: 'Clique em um estado no mapa oficial do IBGE.', so: 'governador' },
  { id: 'partido', t: 'Partido', sub: 'Partidos reais, com bancadas eleitas em 2022 — ou funde o seu.' },
  { id: 'ideologia', t: 'Ideologia', sub: 'Sua posição define aliados, adversários e o humor do mercado.' },
  { id: 'plataforma', t: 'Plataforma', sub: 'Até 4 promessas. Cumpri-las rende votos na reeleição.' },
  { id: 'personagem', t: 'Personagem', sub: 'Crie a figura pública que vai subir a rampa.' },
  { id: 'run', t: 'Partida', sub: 'Duração da RUN e cenário inicial.' },
  { id: 'revisao', t: 'Candidatura', sub: 'Revise e registre sua candidatura.' },
];
const ICO_PROPOSTA = { reforma_tributaria: 'moedas', reforma_previdencia: 'relogio', renda_basica: 'coracao', anticorrupcao: 'justica', seguranca: 'escudo', saude: 'coracao',
  educacao: 'capelo', infra: 'predio', privatizar: 'economia', ambiente: 'folha', emprego: 'pasta', inflacao: 'grafico', divida: 'moedas', desigualdade: 'pessoas' };
const ICO_CENARIO = { estabilidade: 'check', crise_fiscal: 'moedas', boom_commodities: 'economia', polarizacao: 'megafone', escandalos: 'jornal', seca: 'folha', crise_global: 'globo' };
const DURACOES = { curta: ['Curta', '1 mandato · 4 anos', 'Campanha, governo e a disputa pela reeleição.'], media: ['Média', 'até 2 mandatos · 8 anos', 'O limite constitucional de dois mandatos consecutivos.'],
  longa: ['Longa', '2 mandatos + sucessão', 'Governe 8 anos e tente eleger seu sucessor.'] };
const espectroDe = (p) => (p.eco < -0.25 ? 'esquerda' : p.eco > 0.25 ? 'direita' : 'centro');
const partidoAtual = () => (CFG.partido_novo ? { sigla: CFG.partido || 'NOVO?', nome: CFG.partido_nome || 'Novo partido', cor: CFG.partido_cor, numero: CFG.partido_numero || '—' } : CAT.partidos.find((p) => p.sigla === CFG.partido));
const passosAtivos = () => PASSOS.filter((p) => !p.so || p.so === CFG.modo);
const idadeMin = () => (CFG.modo === 'presidente' ? 35 : 30);
const cargoTxt = () => (CFG.modo === 'presidente' ? 'Presidência da República' : 'Governo de ' + (CAT.estados.find((e) => e.uf === CFG.uf)?.nome || 'estado'));

/* ---------- roteamento ---------- */
const RENDER = {};
function mostrar() {
  const t = location.hash.slice(1) || 'titulo';
  const alvo = $('#tela-' + t) ? t : 'titulo';
  $$('.tela').forEach((el) => el.classList.toggle('ativa', el.id === 'tela-' + alvo));
  RENDER[alvo]?.();
  window.scrollTo(0, 0);
}
const topoTela = (titulo, sub) => `<header class="topo-tela"><button type="button" class="btn btn-icone" data-ir="titulo" aria-label="Voltar ao menu">${icone('esq')}</button>
  <img class="mini-logo" src="/static/img/logo.jpg" alt=""><div><h1>${titulo}</h1>${sub ? `<div class="suave peq">${sub}</div>` : ''}</div></header>`;

/* ---------- cena de fundo ---------- */
async function montarCena() {
  const d = await Mapas.carregar('mundo');
  $('#cena-mapa').innerHTML = `<svg viewBox="0 0 ${d.largura} ${d.altura}">${d.paises.map((p) => `<path d="${p.d}"/>`).join('')}</svg>`;
  $('#cena-particulas').innerHTML = Array.from({ length: 22 }, () => `<i class="particula" style="left:${Math.random() * 100}%;top:${100 + Math.random() * 20}%;animation-delay:${-Math.random() * 14}s;animation-duration:${10 + Math.random() * 10}s"></i>`).join('');
}

/* ---------- TÍTULO ---------- */
RENDER.titulo = () => {
  const salvos = Tokens.codigos().length;
  $('#item-continuar').hidden = !salvos;
  $('#item-continuar small').textContent = `${salvos} partida${salvos > 1 ? 's' : ''} salva${salvos > 1 ? 's' : ''} neste navegador`;
  const ps = CAT.presidentes;
  const p = ps[Math.floor(Math.random() * ps.length)];
  $('#vitrine').innerHTML = `<div class="linha entre"><span class="rotulo">Galeria presidencial</span><span class="selo fato">${icone('livro', 'p')} Fato histórico</span></div>
    <div class="vitrine-pres mt"><div class="retrato" data-wiki="${esc(p.wiki)}" data-alt="${esc(p.nome)}">${esc(iniciais(p.nome))}</div>
    <div><div class="ouro forte">${p.inicio}${p.fim !== p.inicio ? '–' + p.fim : ''}</div><h2 class="titulo-display" style="font-size:1.6rem;margin:.2em 0">${esc(p.nome)}</h2>
    <p class="suave peq">${esc(CAT.eras[p.era])}${p.partido ? ' · ' + esc(p.partido) : ''}</p><p class="peq">${esc(p.nota)}</p>
    <button type="button" class="btn btn-mini" data-ir="galeria">${icone('livro', 'p')} Ver todos os ${ps.length}</button></div></div>
    <div class="sep"></div><div class="grade g3 peq">
      <div><div class="rotulo">Partidos</div><b class="titulo-display" style="font-size:1.5rem">${CAT.partidos.length}</b><div class="fraco mini">reais, bancadas 2022</div></div>
      <div><div class="rotulo">Países</div><b class="titulo-display" style="font-size:1.5rem">194</b><div class="fraco mini">no mapa-múndi</div></div>
      <div><div class="rotulo">Estados</div><b class="titulo-display" style="font-size:1.5rem">27</b><div class="fraco mini">malha do IBGE</div></div></div>`;
  Retratos.carregar($('#vitrine'));
};

/* ---------- ASSISTENTE ---------- */
function validar(id) {
  if (id === 'territorio' && !CFG.uf) return 'Escolha um estado no mapa.';
  if (id === 'partido') {
    if (!CFG.partido_novo && !CFG.partido) return 'Escolha um partido.';
    if (CFG.partido_novo && !/^[A-Z0-9]{2,6}$/.test(CFG.partido)) return 'A sigla do novo partido deve ter de 2 a 6 letras ou números.';
    if (CFG.partido_novo && !CFG.partido_nome.trim()) return 'Dê um nome ao novo partido.';
  }
  if (id === 'ideologia' && !CFG.ideologia) return 'Escolha uma ideologia.';
  if (id === 'personagem' && (CFG.idade < idadeMin() || CFG.idade > 80)) return `Idade mínima para o cargo: ${idadeMin()} anos.`;
  return null;
}
function renderNovo() {
  const ps = passosAtivos();
  UIm.passo = clampN(UIm.passo, 0, ps.length - 1);
  const p = ps[UIm.passo];
  const nav = ps.map((x, i) => `<button type="button" class="passo-item ${i === UIm.passo ? 'atual' : ''} ${i < UIm.passo ? 'feito' : ''}" data-passo="${i}">
    <span class="n">${i < UIm.passo ? icone('check', 'p') : i + 1}</span><span class="t">${x.t}</span></button>`).join('');
  $('#tela-novo').innerHTML = `<div class="conteudo">${topoTela('Nova campanha', 'Monte sua candidatura passo a passo')}
    <div class="assistente">
      <nav class="vidro passos" aria-label="Etapas"><span class="rotulo" style="padding:4px 8px">Etapa ${UIm.passo + 1} de ${ps.length}</span>
        <div class="progresso-passos"><i style="width:${((UIm.passo + 1) / ps.length) * 100}%"></i></div>${nav}</nav>
      <section class="vidro palco"><div class="palco-cab"><span class="rotulo">${String(UIm.passo + 1).padStart(2, '0')} · ${p.t}</span><h2>${tituloPasso(p.id)}</h2><p>${p.sub}</p></div>
        <div class="palco-corpo" id="corpo-passo">${PASSO[p.id]()}</div>
        <div class="navegacao"><button type="button" class="btn" data-nav="voltar" ${UIm.passo === 0 ? 'disabled' : ''}>${icone('esq', 'p')} Voltar</button>
          ${p.id === 'revisao' ? `<button type="button" class="btn btn-ouro btn-grande" data-nav="iniciar">${icone('urna')} Registrar candidatura</button>`
          : `<button type="button" class="btn btn-ouro" data-nav="proximo">Continuar ${icone('dir', 'p')}</button>`}</div></section>
      <aside class="vidro ficha" id="ficha">${ficha()}</aside></div></div>`;
  posPasso(p.id);
}
const tituloPasso = (id) => ({ cargo: 'Qual cargo você vai disputar?', territorio: 'Escolha seu estado', partido: 'Filie-se a um partido', ideologia: 'Defina sua ideologia',
  plataforma: 'Plataforma de governo', personagem: 'Criador de personagem', run: 'Configure a partida', revisao: 'Pronto para a disputa' }[id]);
function atualizarParcial() { const c = $('#corpo-passo'); if (!c) return; const id = passosAtivos()[UIm.passo].id; c.innerHTML = PASSO[id](); $('#ficha').innerHTML = ficha(); posPasso(id); }

function ficha() {
  const p = CFG.partido || CFG.partido_novo ? partidoAtual() : null;
  const ideo = CFG.ideologia ? CAT.ideologias[CFG.ideologia].nome : '—';
  return `<div class="rotulo" style="margin-bottom:10px">Ficha do candidato</div>
    <div class="avatar-moldura">${Avatar.svg(CFG.aparencia, { idade: CFG.idade, partidoCor: p?.cor })}</div>
    <b class="titulo-display" style="font-size:1.15rem">${esc(CFG.nome || 'Nome a definir')}</b><div class="fraco peq">${CFG.idade} anos · ${esc(cargoTxt())}</div>
    <div class="sep"></div><dl><dt>Partido</dt><dd>${p ? `${UIc.partido(p.sigla, p.cor, p.numero)} ${esc(p.sigla)}` : '—'}</dd><dt>Ideologia</dt><dd>${esc(ideo)}</dd>
    <dt>Promessas</dt><dd>${CFG.propostas.length}/4</dd><dt>Partida</dt><dd>${DURACOES[CFG.duracao][0]}</dd>
    <dt>Cenário</dt><dd>${CFG.cenario === 'aleatorio' ? 'Aleatório' : esc(CAT.cenarios[CFG.cenario].nome)}</dd></dl>`;
}

const PASSO = {
  cargo() {
    const card = (modo, titulo, txt, tags) => `<button type="button" class="escolha cargo ${CFG.modo === modo ? 'sel' : ''}" data-set="modo" data-v="${modo}">
      <div class="arte" id="arte-${modo}"></div><div class="txt"><b>${titulo}</b><small>${txt}</small><div class="linha mt">${tags.map((t) => `<span class="selo">${t}</span>`).join('')}</div></div></button>`;
    return `<div class="cargos">${card('presidente', 'Presidente da República', 'Campanha nacional, debates na TV e segundo turno. Congresso, STF, economia e diplomacia com 194 países.', ['Mapa-múndi', 'Idade mínima 35'])}
      ${card('governador', 'Governador · modo Hard', 'Administre qualquer um dos 26 estados ou o DF: orçamento apertado, Assembleia Legislativa e dependência de Brasília.', ['Mapa do Brasil', 'Idade mínima 30', 'Difícil'])}</div>`;
  },
  territorio() {
    return `<div class="territorio"><div id="mapa-uf"></div><div class="vidro forte uf-info" id="uf-info">${infoUF()}</div></div>`;
  },
  partido() {
    const filtros = [['todos', 'Todos'], ['esquerda', 'Esquerda'], ['centro', 'Centro'], ['direita', 'Direita']].map(([k, t]) => `<button type="button" class="filtro ${UIm.filtro === k ? 'ativo' : ''}" data-filtro="${k}">${t}</button>`).join('');
    const lista = CAT.partidos.filter((p) => UIm.filtro === 'todos' || espectroDe(p) === UIm.filtro).map((p, i) => `<button type="button" class="escolha partido-card entra ${CFG.partido === p.sigla && !CFG.partido_novo ? 'sel' : ''}" style="--i:${i}" data-partido="${esc(p.sigla)}">
      <span class="partido-num" style="--pc:${p.cor}">${p.numero}</span><span class="info"><b>${esc(p.sigla)}</b><small>${esc(p.nome)}</small>
      <small class="fraco">${esc(p.espectro)} · ${p.peso} dep. · ${p.alta} sen.</small></span></button>`).join('');
    const novo = `<button type="button" class="escolha partido-card ${CFG.partido_novo ? 'sel' : ''}" data-partido-novo="1"><span class="partido-num" style="--pc:${CFG.partido_cor}">${icone('mais', 'g')}</span>
      <span class="info"><b>Fundar partido</b><small>Comece pequeno, com identidade própria</small></span></button>`;
    const form = CFG.partido_novo ? `<div class="vidro forte painel mt"><div class="grade g4">
      <label class="campo">Sigla<input type="text" id="p-sigla" maxlength="6" value="${esc(CFG.partido)}" style="text-transform:uppercase" placeholder="EX: PNB"></label>
      <label class="campo" style="grid-column:span 2">Nome<input type="text" id="p-nome" maxlength="50" value="${esc(CFG.partido_nome)}" placeholder="Partido Nacional…"></label>
      <label class="campo">Número (10–99)<input type="number" id="p-num" min="10" max="99" value="${esc(CFG.partido_numero)}"></label></div>
      <div class="campo mt">Cor do partido<div class="amostras">${['#7c5cff', '#e0453c', '#1f9d74', '#f2b705', '#1565c0', '#ff6a13', '#a3238e', '#2b2f36'].map((c) => `<button type="button" class="amostra ${CFG.partido_cor === c ? 'sel' : ''}" style="--c:${c}" data-pcor="${c}" aria-label="Cor ${c}"></button>`).join('')}
      <input type="color" id="p-cor" value="${CFG.partido_cor}" aria-label="Cor personalizada"></div></div></div>` : '';
    return `<div class="filtros">${filtros}<span class="selo fato" style="margin-left:auto">${icone('info', 'p')} Bancadas: TSE 2022, com fusões</span></div>
      <div class="grade gauto">${lista}${novo}</div>${form}
      <p class="mini fraco mt mb0">Números eleitorais e bancadas são dados reais; cores dos selos e posições ideológicas são aproximações da simulação.</p>`;
  },
  ideologia() {
    const p = CFG.partido && !CFG.partido_novo ? partidoAtual() : null;
    const X = (e) => 150 + e * 120, Y = (s) => 150 - s * 120;
    const pts = Object.entries(CAT.ideologias).map(([k, i]) => `<circle class="pt ${CFG.ideologia === k ? 'sel' : ''}" cx="${X(i.eco)}" cy="${Y(i.soc)}" r="${CFG.ideologia === k ? 9 : 6}" fill="var(--texto-3)" data-set="ideologia" data-v="${k}"><title>${esc(i.nome)}</title></circle>`).join('');
    const partidos = CAT.partidos.map((x) => `<circle cx="${X(x.eco)}" cy="${Y(x.soc)}" r="${x.sigla === p?.sigla ? 6 : 3}" fill="${x.cor}" opacity="${x.sigla === p?.sigla ? 1 : .45}"><title>${esc(x.sigla)}</title></circle>`).join('');
    const bussola = `<div class="vidro forte bussola"><svg viewBox="0 0 300 300"><rect x="30" y="30" width="240" height="240" rx="12" class="quad"/>
      <path d="M150 30V270M30 150H270" stroke="var(--borda-2)"/>${partidos}${pts}
      <text x="150" y="22" text-anchor="middle">CONSERVADOR</text><text x="150" y="290" text-anchor="middle">PROGRESSISTA</text>
      <text x="26" y="153" text-anchor="end" transform="rotate(-90 26 153)" style="text-anchor:middle">ESTADO</text><text x="276" y="153" transform="rotate(90 276 153)" style="text-anchor:middle">MERCADO</text></svg>
      <p class="mini fraco mb0">Pontos coloridos: partidos reais (posição estimada).${p ? ` Destaque: ${esc(p.sigla)}.` : ''}</p></div>`;
    const cards = Object.entries(CAT.ideologias).map(([k, i], n) => `<button type="button" class="escolha entra ${CFG.ideologia === k ? 'sel' : ''}" style="--i:${n}" data-set="ideologia" data-v="${k}"><b>${esc(i.nome)}</b><small>${esc(i.desc)}</small></button>`).join('');
    return `<div class="ideologia-grade">${bussola}<div class="grade gauto">${cards}</div></div>`;
  },
  plataforma() {
    return `<div class="linha entre mb0" style="margin-bottom:14px"><span class="chip">${icone('urna', 'p')} ${CFG.propostas.length}/4 promessas</span><span class="mini fraco">Leis exigem aprovação no Congresso; metas são medidas ao fim do mandato.</span></div>
      <div class="grade gauto">${Object.entries(CAT.propostas).map(([k, p], i) => `<button type="button" class="escolha entra ${CFG.propostas.includes(k) ? 'sel' : ''}" style="--i:${i}" data-proposta="${k}">
      <span class="linha nw">${icone(ICO_PROPOSTA[k] || 'estrela', 'g')}<b>${esc(p.nome)}</b></span><small>${p.lei ? 'Aprovar lei no Congresso' : 'Meta numérica até a eleição'}</small></button>`).join('')}</div>`;
  },
  personagem() {
    const p = CFG.partido || CFG.partido_novo ? partidoAtual() : null;
    const abas = [['identidade', 'usuario', 'Identidade'], ['rosto', 'olho', 'Rosto'], ['cabelo', 'pincel', 'Cabelo'], ['barba', 'pincel', 'Barba'], ['traje', 'pasta', 'Traje'], ['acessorios', 'estrela', 'Acessórios']]
      .map(([k, ic, t]) => `<button type="button" class="aba-c ${UIm.abaC === k ? 'ativa' : ''}" data-aba-c="${k}">${icone(ic, 'p')}${t}</button>`).join('');
    return `<div class="criador"><div class="vidro forte vitrine-av"><div class="palco-av" id="palco-av">${Avatar.svg(CFG.aparencia, { idade: CFG.idade, partidoCor: p?.cor, rotulo: CFG.nome })}</div>
      <div class="placa"><b id="placa-nome">${esc(CFG.nome || 'Seu nome')}</b><span class="mini fraco">${p ? esc(p.sigla) + ' · ' : ''}${CFG.idade} anos</span></div>
      <div class="grupo-btn mt" style="justify-content:center"><button type="button" class="btn btn-mini" data-av="aleatorio">${icone('dados', 'p')} Aleatório</button><button type="button" class="btn btn-mini btn-fantasma" data-av="restaurar">Restaurar</button></div></div>
      <div><div class="abas-criador" role="tablist">${abas}</div><div id="controles-c">${CRIADOR[UIm.abaC]()}</div></div></div>`;
  },
  run() {
    const dur = Object.entries(DURACOES).map(([k, [t, s, d]]) => `<button type="button" class="escolha ${CFG.duracao === k ? 'sel' : ''}" data-set="duracao" data-v="${k}"><span class="rotulo">${s}</span><b class="titulo-display" style="font-size:1.3rem">${t}</b><small>${d}</small></button>`).join('');
    const cen = [['aleatorio', { nome: 'Aleatório', desc: 'Sorteado ao começar — cada RUN é diferente.' }], ...Object.entries(CAT.cenarios)].map(([k, c], i) => `<button type="button" class="escolha entra ${CFG.cenario === k ? 'sel' : ''}" style="--i:${i}" data-set="cenario" data-v="${k}">
      <span class="linha nw">${icone(k === 'aleatorio' ? 'dados' : ICO_CENARIO[k] || 'globo', 'g')}<b>${esc(c.nome)}</b></span><small>${esc(c.desc)}</small></button>`).join('');
    return `<span class="rotulo">Duração</span><div class="grade g3 mt">${dur}</div><span class="rotulo" style="display:block;margin-top:26px">Cenário inicial <span class="selo sim">Simulado</span></span><div class="grade gauto mt">${cen}</div>`;
  },
  revisao() {
    const p = partidoAtual();
    const props = CFG.propostas.map((k) => `<span class="chip">${icone(ICO_PROPOSTA[k] || 'estrela', 'p')}${esc(CAT.propostas[k].nome)}</span>`).join('') || '<span class="fraco">Nenhuma promessa.</span>';
    return `<div class="revisao"><div class="avatar-moldura" style="aspect-ratio:5/6">${Avatar.svg(CFG.aparencia, { idade: CFG.idade, partidoCor: p?.cor })}</div>
      <div><span class="rotulo">Candidatura à ${esc(cargoTxt())}</span><h2 class="titulo-display" style="font-size:2.2rem;margin:.2em 0">${esc(CFG.nome || 'Nome sorteado')}</h2>
      <div class="linha">${p ? `${UIc.partido(p.sigla, p.cor, p.numero)}<b>${esc(p.sigla)}</b><span class="suave">${esc(p.nome)}</span>` : ''}</div>
      <div class="grade g3 mt"><div class="vidro forte painel"><div class="rotulo">Ideologia</div><b>${esc(CAT.ideologias[CFG.ideologia]?.nome || '—')}</b></div>
        <div class="vidro forte painel"><div class="rotulo">Idade</div><b>${CFG.idade} anos</b></div><div class="vidro forte painel"><div class="rotulo">Partida</div><b>${DURACOES[CFG.duracao][0]}</b></div></div>
      <div class="rotulo mt-g">Promessas</div><div class="linha mt">${props}</div>
      <p class="peq suave mt-g">A campanha dura 4 trimestres: comícios, TV, alianças e debate. Depois vêm o 1º e, se necessário, o 2º turno. Adversários são candidatos fictícios de partidos reais.</p></div></div>`;
  },
};

const CRIADOR = {
  identidade() {
    return `<label class="campo grupo-op">Nome público<input type="text" id="c-nome" maxlength="40" value="${esc(CFG.nome)}" placeholder="Deixe em branco para sortear"></label>
      <div class="grupo-op"><span class="rotulo">Idade</span><div class="linha nw"><span class="idade-mostrador" id="c-idade-v">${CFG.idade}</span>
        <input type="range" id="c-idade" min="${idadeMin()}" max="80" value="${CFG.idade}" style="--p:${((CFG.idade - idadeMin()) / (80 - idadeMin())) * 100}%"></div>
        <p class="mini fraco mb0">${icone('info', 'p')} Idade mínima constitucional: ${idadeMin()} anos para ${CFG.modo === 'presidente' ? 'Presidente' : 'Governador'} (CF/88, art. 14, §3º, VI). A idade também envelhece o rosto.</p></div>
      <div class="grupo-op"><span class="rotulo">Tratamento</span><div class="opcoes">${[['m', 'Senhor'], ['f', 'Senhora'], ['neutro', 'Neutro']].map(([k, t]) => `<button type="button" class="op texto ${CFG.genero === k ? 'sel' : ''}" data-set="genero" data-v="${k}">${t}</button>`).join('')}</div></div>`;
  },
  rosto() { return grupoThumbs('Formato do rosto', 'rosto', true) + grupoCores('Tom de pele', 'pele') + grupoThumbs('Olhos', 'olhos', true) + grupoCores('Cor dos olhos', 'cor_olhos', false) + grupoThumbs('Sobrancelhas', 'sobrancelha', true) + grupoThumbs('Expressão', 'boca', true); },
  cabelo() { return grupoThumbs('Estilo', 'cabelo', true) + grupoCores('Cor', 'cor_cabelo'); },
  barba() { return grupoThumbs('Barba e bigode', 'barba', true) + grupoCores('Cor dos pelos (segue o cabelo)', 'cor_cabelo'); },
  traje() {
    const gr = Avatar.OPC.gravata.map(([v, t]) => `<button type="button" class="op texto ${CFG.aparencia.gravata === v ? 'sel' : ''}" data-ap="gravata" data-v="${v}">${v.startsWith('#') ? `<i class="amostra" style="--c:${v};width:14px;height:14px;display:inline-block;vertical-align:-2px;margin-right:4px"></i>` : ''}${t}</button>`).join('');
    return grupoThumbs('Traje', 'traje', false) + grupoCores('Cor do traje', 'cor_traje') + `<div class="grupo-op"><span class="rotulo">Gravata</span><div class="opcoes">${gr}</div></div>`;
  },
  acessorios() { return grupoThumbs('Óculos', 'oculos', true) + grupoThumbs('Acessório', 'acessorio', false) + grupoThumbs('Faixa presidencial', 'faixa', false) + grupoThumbs('Fundo do retrato', 'fundo', false); },
};
function grupoThumbs(titulo, chave, cabeca) {
  const p = CFG.partido || CFG.partido_novo ? partidoAtual() : null;
  const ops = Avatar.OPC[chave].map(([v, t]) => `<button type="button" class="op ${cabeca ? 'cabeca' : ''} ${CFG.aparencia[chave] === v ? 'sel' : ''}" data-ap="${chave}" data-v="${v}" aria-label="${esc(t)}">
    ${Avatar.svg({ ...CFG.aparencia, [chave]: v }, { idade: CFG.idade, partidoCor: p?.cor })}<span>${t}</span></button>`).join('');
  return `<div class="grupo-op"><span class="rotulo">${titulo}</span><div class="opcoes">${ops}</div></div>`;
}
function grupoCores(titulo, chave, livre = true) {
  const v = CFG.aparencia[chave];
  return `<div class="grupo-op"><span class="rotulo">${titulo}</span><div class="amostras">${Avatar.OPC[chave].map((c) => `<button type="button" class="amostra ${v === c ? 'sel' : ''}" style="--c:${c}" data-ap="${chave}" data-v="${c}" aria-label="${c}"></button>`).join('')}
    ${livre ? `<input type="color" data-apcor="${chave}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#888888'}" aria-label="Cor personalizada">` : ''}</div></div>`;
}

function infoUF() {
  const e = CAT.estados.find((x) => x.uf === CFG.uf);
  if (!e) return UIc.vazio('Passe o mouse e clique em um estado no mapa.', 'mapa');
  const g = CAT.governadores[e.uf];
  const p = CAT.partidos.find((x) => x.sigla === g.partido);
  return `<div class="sigla">${e.uf}</div><h2 class="titulo-display" style="font-size:1.5rem;margin:.3em 0 .1em">${esc(e.nome)}</h2><div class="suave peq">Região ${esc(e.regiao)}</div>
    <div class="grade g2 mt"><div><div class="rotulo">População</div><b>${nf(e.pop, 1)} mi</b></div><div><div class="rotulo">PIB</div><b>R$ ${nf(e.pib, 0)} bi</b></div></div>
    <div class="sep"></div><div class="linha entre"><span class="rotulo">Governador eleito em 2022</span><span class="selo fato">Fato</span></div>
    <div class="linha mt">${p ? UIc.partido(p.sigla, p.cor, p.numero) : ''}<b>${esc(g.nome)}</b><span class="fraco peq">${esc(g.partido)}</span></div>
    <p class="mini fraco mt mb0">Na simulação, você assume o governo após a eleição. População e PIB arredondados.</p>`;
}

async function posPasso(id) {
  if (id === 'cargo') {
    const [m, b] = await Promise.all([Mapas.carregar('mundo'), Mapas.carregar('brasil')]);
    const a1 = $('#arte-presidente'), a2 = $('#arte-governador');
    if (a1) a1.innerHTML = `<svg viewBox="0 0 ${m.largura} ${m.altura}">${m.paises.map((p) => `<path d="${p.d}" ${p.id === 'BRA' ? 'style="fill:var(--ouro)"' : ''}/>`).join('')}</svg>`;
    if (a2) a2.innerHTML = `<svg viewBox="0 0 ${b.largura} ${b.altura}">${b.estados.map((e) => `<path d="${e.d}" stroke="var(--bg)" stroke-width="3"/>`).join('')}</svg>`;
  }
  if (id === 'territorio') {
    const regiaoCor = { Norte: '#3d8f6a', Nordeste: '#c4842f', 'Centro-Oeste': '#b8a03a', Sudeste: '#4f7fc4', Sul: '#7d65c2' };
    UIm.mapaUF = await new Mapas.Mapa($('#mapa-uf'), {
      tipo: 'brasil', rotulos: true, selecionado: CFG.uf,
      cor: (uf) => (uf === CFG.uf ? 'var(--ouro)' : regiaoCor[CAT.estados.find((e) => e.uf === uf)?.regiao]),
      dica: (uf) => { const e = CAT.estados.find((x) => x.uf === uf), g = CAT.governadores[uf]; return `<b>${esc(e.nome)}</b>${nf(e.pop, 1)} mi hab. · ${esc(e.regiao)}<br><span class="fraco">Gov.: ${esc(g.nome)} (${esc(g.partido)})</span>`; },
      aoClicar: (uf, m) => { CFG.uf = uf; m.colorir(); m.selecionar(uf, false); $('#uf-info').innerHTML = infoUF(); $('#ficha').innerHTML = ficha(); },
    }).montar();
  }
}

/* ---------- interação do assistente ---------- */
function irPasso(n) {
  const ps = passosAtivos();
  if (n > UIm.passo) for (let i = UIm.passo; i < n; i++) { const e = validar(ps[i].id); if (e) { UIm.passo = i; renderNovo(); return toast(e, 'erro'); } }
  UIm.passo = clampN(n, 0, ps.length - 1);
  renderNovo();
  $('.palco')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function lerInputs() {
  const v = (id) => document.getElementById(id);
  if (v('p-sigla')) CFG.partido = v('p-sigla').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (v('p-nome')) CFG.partido_nome = v('p-nome').value;
  if (v('p-num')) CFG.partido_numero = v('p-num').value;
}
function atualizarPreview() {
  const p = CFG.partido || CFG.partido_novo ? partidoAtual() : null;
  const palco = $('#palco-av');
  if (palco) palco.innerHTML = Avatar.svg(CFG.aparencia, { idade: CFG.idade, partidoCor: p?.cor, rotulo: CFG.nome });
  if ($('#ficha')) $('#ficha').innerHTML = ficha();
}

async function iniciar() {
  const ps = passosAtivos();
  for (let i = 0; i < ps.length; i++) { const e = validar(ps[i].id); if (e) { UIm.passo = i; renderNovo(); return toast(e, 'erro'); } }
  const ov = $('#carregando');
  ov.hidden = false;
  const msgs = ['Registrando candidatura no TSE…', 'Convocando a bancada de ' + (partidoAtual()?.sigla || 'seu partido') + '…', 'Montando o Congresso Nacional…', 'Carregando o mapa e as relações internacionais…', 'Abrindo as pesquisas de intenção de voto…'];
  let i = 0;
  const barra = $('#carregando .medidor i');
  const tick = setInterval(() => { i = Math.min(i + 1, msgs.length - 1); $('#carregando .msg').textContent = msgs[i]; barra.style.width = `${((i + 1) / msgs.length) * 100}%`; }, 520);
  $('#carregando .msg').textContent = msgs[0]; barra.style.width = '12%';
  const corpo = { ...CFG, partido_numero: CFG.partido_numero ? Number(CFG.partido_numero) : null };
  const [r] = await Promise.all([api('/api/jogos', corpo), new Promise((ok) => setTimeout(ok, 2700))]);
  clearInterval(tick);
  if (!r.ok) { ov.hidden = true; return toast(r.erro || 'Erro ao criar a partida.', 'erro'); }
  barra.style.width = '100%'; $('#carregando .msg').textContent = 'Tudo pronto. Boa campanha!';
  Tokens.set(r.codigo, r.token);
  setTimeout(() => { location.href = '/jogo/' + r.codigo; }, 400);
}

/* ---------- CONTINUAR ---------- */
RENDER.continuar = async () => {
  const el = $('#tela-continuar');
  el.innerHTML = `<div class="conteudo">${topoTela('Continuar', 'Partidas salvas neste navegador')}<div id="lista-salvos" class="grade gauto">${'<div class="vidro esqueleto" style="height:150px"></div>'.repeat(3)}</div></div>`;
  const r = await api('/api/jogos/resumos', { codigos: Tokens.codigos() });
  const lista = Array.isArray(r) ? r : [];
  $('#lista-salvos').innerHTML = lista.length ? lista.map((j, i) => `<article class="vidro painel entra" style="--i:${i}"><div class="linha nw"><div class="avatar-moldura" style="width:72px">${Avatar.svg(j.aparencia)}</div>
    <div class="flex1"><b>${esc(j.nome)}</b><div class="fraco peq">${esc(j.partido)} · ${j.modo === 'presidente' ? 'Presidente' : 'Governador — ' + esc(j.rotulo)}</div>
    <div class="linha mt"><span class="selo">${icone('calendario', 'p')} ${j.ano} T${j.tri}</span>${j.encerrado ? '<span class="selo">Encerrada</span>' : `<span class="selo ${j.popularidade >= 50 ? 'bom' : 'alerta'}">${j.popularidade}% aprovação</span>`}</div></div></div>
    <div class="grupo-btn mt"><a class="btn btn-ouro btn-mini" href="/jogo/${esc(j.codigo)}">${icone('play', 'p')} ${j.encerrado ? 'Ver relatório' : 'Continuar'}</a>
    <button type="button" class="btn btn-mini btn-fantasma" data-esquecer="${esc(j.codigo)}">${icone('lixo', 'p')} Esquecer</button><span class="mini fraco" style="margin-left:auto">${esc(j.codigo)}</span></div></article>`).join('')
    : `<div class="vidro painel">${UIc.vazio('Nenhuma partida salva ainda.', 'urna')}<div style="text-align:center"><button type="button" class="btn btn-ouro" data-ir="novo">Começar uma campanha</button></div></div>`;
};

/* ---------- MULTIPLAYER ---------- */
RENDER.multi = () => {
  const papeis = [['governador', 'mapa', 'Pede repasses ao governo federal.'], ['ministro', 'pasta', 'Pede mais orçamento para sua área.'], ['parlamentar', 'congresso', 'Troca apoio por emendas.'], ['lider', 'globo', 'Propõe acordos, alianças ou sanções.']];
  $('#tela-multi').innerHTML = `<div class="conteudo">${topoTela('Multiplayer', 'Entre na partida de um amigo pelo código')}
    <div class="grade g2"><section class="vidro painel"><div class="painel-cab"><span class="ico-caixa">${icone('link')}</span><h2>Entrar na partida</h2></div>
      <div class="coluna" style="gap:12px"><label class="campo">Código da partida<input type="text" id="j-codigo" maxlength="5" placeholder="ABC12" style="text-transform:uppercase;font-size:1.3rem;letter-spacing:.3em;font-weight:700"></label>
      <label class="campo">Seu nome<input type="text" id="j-nome" maxlength="30"></label>
      <label class="campo">Papel<select id="j-papel">${papeis.map(([k]) => `<option value="${k}">${esc(CAT.papeis[k])}</option>`).join('')}</select></label>
      <label class="campo" id="j-pais-box" hidden>País ou estado que você representa<select id="j-pais"></select></label>
      <button type="button" class="btn btn-ouro btn-grande" id="j-entrar">${icone('seta')} Entrar</button></div></section>
    <section class="vidro painel"><div class="painel-cab"><span class="ico-caixa">${icone('pessoas')}</span><h2>Como funciona</h2></div>
      <p class="suave peq">Quem cria a partida é o anfitrião e governa. Os demais jogadores enviam pedidos que ele aprova ou nega, e todos conversam pelo chat.</p>
      <div class="coluna" style="gap:10px">${papeis.map(([k, ic, d]) => `<div class="linha nw"><span class="ico-caixa" style="width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:var(--vidro-3);color:var(--ouro)">${icone(ic)}</span><div><b>${esc(CAT.papeis[k])}</b><div class="fraco peq">${d}</div></div></div>`).join('')}</div></section></div></div>`;
  const sel = $('#j-papel');
  const atualizar = async () => {
    const lider = sel.value === 'lider'; $('#j-pais-box').hidden = !lider; if (!lider) return;
    const cod = $('#j-codigo').value.trim().toUpperCase();
    const r = cod.length === 5 ? await api(`/api/jogos/${cod}/resumo`) : null;
    $('#j-pais').innerHTML = r && r.ok ? r.entidades.map((e) => `<option value="${e.cod}">${esc(e.nome)}</option>`).join('') : '<option value="">Informe o código primeiro</option>';
  };
  sel.onchange = atualizar; $('#j-codigo').oninput = atualizar;
  $('#j-entrar').onclick = async () => {
    const cod = $('#j-codigo').value.trim().toUpperCase();
    if (cod.length !== 5) return toast('Informe o código de 5 caracteres.', 'erro');
    const r = await api(`/api/jogos/${cod}/entrar`, { nome: $('#j-nome').value, papel: sel.value, pais: $('#j-pais').value });
    if (!r.ok) return toast(r.erro || 'Não foi possível entrar.', 'erro');
    Tokens.set(cod, r.token); location.href = '/jogo/' + cod;
  };
};

/* ---------- GALERIA ---------- */
RENDER.galeria = () => {
  const eras = [...new Set(CAT.presidentes.map((p) => p.era))].map((k) => [k, CAT.eras[k]]); // ordem cronológica
  const filtros = [['todas', 'Todas'], ...eras.map(([k, v]) => [k, v.split(' (')[0]])].map(([k, t]) => `<button type="button" class="filtro ${UIm.era === k ? 'ativo' : ''}" data-era="${k}">${esc(t)}</button>`).join('');
  let n = 0;
  const blocos = eras.filter(([k]) => UIm.era === 'todas' || UIm.era === k).map(([k, nome]) => `<div class="linha-tempo-era"><h2>${esc(nome)}</h2></div><div class="galeria">${CAT.presidentes.filter((p) => p.era === k).map((p) => `
    <article class="vidro pres-card" style="--i:${n++}"><div class="retrato" data-wiki="${esc(p.wiki)}" data-alt="${esc(p.nome)}">${esc(iniciais(p.nome))}</div>
    <span class="ano">${p.inicio}${p.fim !== p.inicio ? ' – ' + p.fim : ''}</span><b>${esc(p.nome)}</b>${p.partido ? `<span class="selo">${esc(p.partido)}</span>` : ''}<small class="suave peq">${esc(p.nota)}</small></article>`).join('')}</div>`).join('');
  const govs = CAT.estados.map((e) => { const g = CAT.governadores[e.uf], p = CAT.partidos.find((x) => x.sigla === g.partido); return `<tr><td><b>${e.uf}</b></td><td>${esc(e.nome)}</td><td>${esc(g.nome)}</td><td>${p ? UIc.partido(p.sigla, p.cor, p.numero) : ''} ${esc(g.partido)}</td></tr>`; }).join('');
  $('#tela-galeria').innerHTML = `<div class="conteudo">${topoTela('Galeria presidencial', 'Presidentes da República desde 1889')}
    <div class="linha entre"><div class="filtros mb0">${filtros}</div><span class="selo fato">${icone('livro', 'p')} Fatos históricos · retratos da Wikipédia</span></div>${blocos}
    <div class="linha-tempo-era"><h2>Governadores eleitos em 2022</h2></div>
    <section class="vidro painel"><div style="overflow-x:auto"><table class="tabela"><thead><tr><th>UF</th><th>Estado</th><th>Governador(a)</th><th>Partido na eleição</th></tr></thead><tbody>${govs}</tbody></table></div>
    <p class="mini fraco mt mb0">Mandato 2023–2026. Alguns trocaram de partido ou deixaram o cargo em 2026 para disputar outras eleições. Dados até meados de 2026; o resultado das eleições de outubro de 2026 não está incluído.</p></section>
    <p class="mini fraco mt">Retratos carregados de pt.wikipedia.org (Wikimedia Commons), sujeitos às licenças de cada imagem. Interinos de curta duração e juntas militares não estão listados.</p></div>`;
  Retratos.carregar($('#tela-galeria'));
};

/* ---------- RANKING ---------- */
RENDER.ranking = async () => {
  const el = $('#tela-ranking');
  el.innerHTML = `<div class="conteudo">${topoTela('Ranking', 'As melhores RUNS deste servidor')}<div id="rank"><div class="vidro esqueleto" style="height:220px"></div></div></div>`;
  const r = await api('/api/ranking');
  const l = Array.isArray(r) ? r : [];
  if (!l.length) { $('#rank').innerHTML = `<div class="vidro painel">${UIc.vazio('Nenhuma RUN concluída ainda. Seja o primeiro a entrar para a história.', 'trofeu')}</div>`; return; }
  const pod = (x, i) => x ? `<div class="vidro ${i === 0 ? 'p1' : ''} entra" style="--i:${i}"><div class="lugar">${i + 1}º</div>${icone('trofeu', 'g')}<h2 class="mt">${esc(x.nome)}</h2><div class="fraco peq">${esc(x.modo)} · ${esc(x.duracao)}</div><div class="titulo-display ouro" style="font-size:1.8rem">${nf(x.pontuacao, 0)}</div></div>` : '<div></div>';
  $('#rank').innerHTML = `<div class="podio">${pod(l[1], 1)}${pod(l[0], 0)}${pod(l[2], 2)}</div>
    <section class="vidro painel"><table class="tabela"><thead><tr><th>#</th><th>Governante</th><th>Modo</th><th>Resultado</th><th style="text-align:right">Pontos</th></tr></thead><tbody>
    ${l.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.nome)}</b></td><td>${esc(x.modo)} · ${esc(x.duracao)}</td><td>${esc(x.resultado)}</td><td class="num" style="text-align:right"><b>${nf(x.pontuacao, 0)}</b></td></tr>`).join('')}</tbody></table></section>`;
};

/* ---------- AJUSTES ---------- */
RENDER.ajustes = () => {
  const t = Tema.get(), anim = guardar.get('sim_anim') !== '0';
  $('#tela-ajustes').innerHTML = `<div class="conteudo">${topoTela('Configurações', 'Aparência, acessibilidade e dados')}
    <div class="grade g2"><section class="vidro painel"><div class="painel-cab"><span class="ico-caixa">${icone('sol')}</span><h2>Aparência</h2></div>
      <div class="grupo-btn">${[['light', 'sol', 'Claro'], ['dark', 'lua', 'Escuro'], ['auto', 'ajustes', 'Automático']].map(([k, ic, n]) => `<button type="button" class="btn ${t === k ? 'btn-ouro' : ''}" data-tema="${k}">${icone(ic, 'p')} ${n}</button>`).join('')}</div>
      <div class="sep"></div><div class="linha entre"><div><b>Animações</b><div class="fraco peq">Desligue para reduzir movimento na tela.</div></div><button type="button" class="btn ${anim ? 'btn-ouro' : ''}" data-anim="${anim ? 0 : 1}">${anim ? 'Ligadas' : 'Desligadas'}</button></div></section>
    <section class="vidro painel"><div class="painel-cab"><span class="ico-caixa">${icone('lixo')}</span><h2>Dados locais</h2></div>
      <p class="suave peq">${Tokens.codigos().length} partida(s) salva(s) neste navegador. Esquecê-las remove apenas o acesso local.</p><button type="button" class="btn btn-perigo" data-limpar="1">Esquecer todas as partidas</button></section>
    <section class="vidro painel" style="grid-column:1/-1"><div class="painel-cab"><span class="ico-caixa">${icone('info')}</span><h2>Sobre os dados</h2></div>
      <div class="grade g2 peq"><div><span class="selo fato">Fatos</span><p class="suave mt">Partidos, números eleitorais, bancadas eleitas em 2022 (TSE), presidentes desde 1889, governadores eleitos em 2022, fronteiras (Natural Earth) e malha estadual (IBGE).</p></div>
      <div><span class="selo sim">Simulação</span><p class="suave mt">Tudo o que acontece durante a partida: eleições, candidatos adversários, eventos, economia, investigações e relações diplomáticas.</p></div></div></section></div></div>`;
};

/* ---------- eventos ---------- */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button, [data-set], a[data-ir]');
  if (!el) return;
  const d = el.dataset;
  if (d.ir) { location.hash = d.ir === 'titulo' ? '' : d.ir; return; }
  if (d.tema) { Tema.set(d.tema); RENDER.ajustes(); return; }
  if (d.anim) { guardar.set('sim_anim', d.anim); Tema.aplicar(); RENDER.ajustes(); return; }
  if (d.limpar) { if (confirm('Esquecer todas as partidas salvas neste navegador?')) { Tokens.codigos().forEach((c) => Tokens.del(c)); RENDER.ajustes(); } return; }
  if (d.esquecer) { Tokens.del(d.esquecer); RENDER.continuar(); return; }
  if (d.era) { UIm.era = d.era; RENDER.galeria(); return; }
  if (!$('#tela-novo').contains(el)) return;
  lerInputs();
  if (d.passo !== undefined) return irPasso(Number(d.passo));
  if (d.nav === 'voltar') return irPasso(UIm.passo - 1);
  if (d.nav === 'proximo') return irPasso(UIm.passo + 1);
  if (d.nav === 'iniciar') return iniciar();
  if (d.set) {
    CFG[d.set] = d.v;
    if (d.set === 'modo') { CFG.idade = Math.max(CFG.idade, idadeMin()); renderNovo(); return; }
    if (d.set === 'genero') { $('#controles-c').innerHTML = CRIADOR.identidade(); return; }
    return atualizarParcial();
  }
  if (d.filtro) { UIm.filtro = d.filtro; return atualizarParcial(); }
  if (d.partido) { CFG.partido = d.partido; CFG.partido_novo = false; return atualizarParcial(); }
  if (d.partidoNovo) { if (!CFG.partido_novo) { CFG.partido_novo = true; CFG.partido = ''; } return atualizarParcial(); }
  if (d.pcor) { CFG.partido_cor = d.pcor; return atualizarParcial(); }
  if (d.proposta) {
    const i = CFG.propostas.indexOf(d.proposta);
    if (i >= 0) CFG.propostas.splice(i, 1); else if (CFG.propostas.length < 4) CFG.propostas.push(d.proposta); else return toast('Máximo de 4 promessas.', 'erro');
    return atualizarParcial();
  }
  if (d.abaC) { UIm.abaC = d.abaC; $$('.aba-c').forEach((b) => b.classList.toggle('ativa', b.dataset.abaC === d.abaC)); $('#controles-c').innerHTML = CRIADOR[d.abaC](); return; }
  if (d.ap) { CFG.aparencia[d.ap] = d.v; $('#controles-c').innerHTML = CRIADOR[UIm.abaC](); atualizarPreview(); return; }
  if (d.av === 'aleatorio') { CFG.aparencia = Avatar.aleatoria(String(Math.random()), { fundo: CFG.aparencia.fundo, faixa: CFG.aparencia.faixa }); $('#controles-c').innerHTML = CRIADOR[UIm.abaC](); atualizarPreview(); return; }
  if (d.av === 'restaurar') { CFG.aparencia = { ...Avatar.PADRAO }; $('#controles-c').innerHTML = CRIADOR[UIm.abaC](); atualizarPreview(); }
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'c-nome') { CFG.nome = t.value; $('#placa-nome').textContent = t.value || 'Seu nome'; $('#ficha').innerHTML = ficha(); }
  if (t.id === 'c-idade') { CFG.idade = Number(t.value); $('#c-idade-v').textContent = t.value; t.style.setProperty('--p', `${((CFG.idade - idadeMin()) / (80 - idadeMin())) * 100}%`); atualizarPreview(); }
  if (t.dataset.apcor) { CFG.aparencia[t.dataset.apcor] = t.value; atualizarPreview(); }
  if (t.id === 'p-cor') { CFG.partido_cor = t.value; $('#ficha').innerHTML = ficha(); }
  if (['p-sigla', 'p-nome', 'p-num'].includes(t.id)) { lerInputs(); $('#ficha').innerHTML = ficha(); }
});
document.addEventListener('change', (ev) => { if (ev.target.dataset.apcor) $('#controles-c').innerHTML = CRIADOR[UIm.abaC](); });

RENDER.novo = renderNovo;
(async function () {
  CAT = await api('/api/catalogo');
  window.addEventListener('hashchange', mostrar);
  mostrar();
  montarCena();
})();
