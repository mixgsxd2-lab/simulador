/* Tutorial interativo da tela de jogo: troca de aba, destaca a área explicada e mostra um cartão com o texto.
   Abre sozinho na primeira partida (guardar 'sim_tutorial') e pode ser revisto pelo botão "Tutorial". */
const Tutorial = {
  ativo: false,
  i: 0,
  passos() {
    const nac = NAC(), cargo = nac ? 'Presidente' : 'Governador(a)';
    const primeiro = Object.keys(S().diplomacia.entidades)[0];
    return [
      { titulo: 'Bem-vindo ao governo!', texto: `Você venceu a eleição de 2022 e toma posse como ${cargo} em 1º de janeiro de 2023. Seu objetivo: governar bem até a eleição de outubro de 2026, ser reeleito e entrar para a história. Este tutorial mostra cada parte do jogo em 2 minutos.` },
      { alvo: '.capital', titulo: 'Capital político', texto: 'Cada ação importante custa capital político: aprovar leis, nomear ministros, negociar com partidos e fazer diplomacia. Ele se recupera a cada trimestre, e mais rápido quando sua popularidade e sua base no Congresso estão altas.' },
      { alvo: '.btn-turno', titulo: 'Encerrar trimestre', texto: 'O tempo anda de três em três meses. Faça suas ações e clique aqui: a economia, o Congresso, a Justiça e o mundo reagem. Às vezes surge um evento que exige uma decisão sua antes de seguir.' },
      { alvo: '.faixa-kpi', titulo: 'Indicadores', texto: 'Popularidade, crescimento, inflação, desemprego, dívida, caixa e base no Congresso. As setas mostram a variação em relação ao trimestre anterior. Popularidade é o que decide a eleição.' },
      { aba: 'governo', alvo: '.gabinete', titulo: 'Governar: o gabinete', texto: 'Clique em um ministério para trocar o titular. Ministros competentes melhoram suas áreas; ministros pouco íntegros geram escândalos. Dar cargos a um partido aumenta o apoio dele no Congresso.' },
      { aba: 'economia', alvo: '#aba', titulo: 'Administrar o país: economia', texto: 'Ajuste impostos e o orçamento de cada área. Mais impostos enchem o caixa, mas freiam o crescimento e a popularidade. Áreas bem financiadas (saúde, educação, segurança…) melhoram a cada trimestre.' },
      { aba: 'congresso', alvo: '.lei-card', titulo: 'Criar leis', texto: 'Escolha um projeto e envie ao Congresso. Leis ordinárias precisam de maioria; emendas constitucionais, de 3/5. Partidos próximos da sua ideologia e com boa afinidade votam a favor. Use emendas e negociação na tabela de partidos para ampliar a base. Leis arriscadas podem ser derrubadas pelo STF.' },
      { aba: 'justica', alvo: '#aba', titulo: 'Justiça e impeachment', texto: 'Investigações da Polícia Federal, vagas no STF e risco de impeachment. Cooperar com a Justiça protege sua imagem; obstruir pode dar certo… ou virar escândalo.' },
      { aba: 'diplomacia', sel: primeiro, alvo: '#painel-ent', titulo: 'Diplomacia: reuniões e acordos', texto: `Clique em um ${nac ? 'país' : 'estado'} no mapa ou na lista. Escolha o formato (telefonema, chanceleres, cúpula presidencial ou visita de Estado), a pauta (economia, comércio, segurança ou meio ambiente) e a proposta. O medidor mostra a chance de aceitarem: relação, interesse do bloco e concessões aumentam essa chance.` },
      { aba: 'diplomacia', alvo: '.layout-diplo', titulo: 'Propostas e tratados', texto: 'Outros países também enviam propostas: aceite ou recuse antes que expirem. Os acordos em vigor geram efeitos a cada trimestre e podem ser abandonados (com custo diplomático). No modo presidente há ainda ONU, cúpulas de blocos (Mercosul, BRICS…), alianças, sanções e guerras.' },
      { aba: 'populacao', alvo: '#aba', titulo: 'População', texto: 'Veja a aprovação por grupo social, a qualidade dos serviços públicos e suas promessas de campanha. Cumprir promessas rende votos na eleição.' },
      { aba: 'governo', alvo: '.faixa-kpi', titulo: 'Eleição de 2026', texto: 'No 2º trimestre de 2026 começa a campanha de reeleição. Você enfrenta os candidatos reais registrados no TSE (como Lula, Flávio Bolsonaro, Ronaldo Caiado, Romeu Zema, Renan Santos e Augusto Cury, exceto o do seu próprio partido). Comícios, TV, alianças e debate ajudam; mas o que mais pesa é sua popularidade.' },
      { aba: 'sala', alvo: '.codigo-grande', titulo: 'Multiplayer', texto: 'Passe este código aos amigos. Eles entram pelo menu Multiplayer como governador, ministro, parlamentar ou líder de outro país e enviam pedidos que você aprova ou nega. Líderes estrangeiros podem propor e aceitar acordos com você. O chat fica aqui.' },
      { titulo: 'Pronto!', texto: 'Para rever este tutorial, use o botão Tutorial na barra lateral ou na aba Ajustes. Bom governo!' },
    ];
  },
  iniciar() {
    if (!G) return;
    this.lista = this.passos();
    this.i = 0;
    this.ativo = true;
    this.abaInicial = TAB;
    if (!$('#tutorial')) {
      const el = document.createElement('div');
      el.id = 'tutorial';
      el.innerHTML = '<div class="tut-foco"></div><div class="vidro tut-cartao" role="dialog" aria-live="polite"></div>';
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-tut]');
        if (b) this[b.dataset.tut]();
      });
      document.body.appendChild(el);
    }
    $('#tutorial').hidden = false;
    this.mostrar();
  },
  mostrar() {
    const p = this.lista[this.i];
    if (p.aba && TAB !== p.aba) {
      TAB = p.aba;
      if (p.sel) UI.sel = p.sel;
      render(false);
    } else if (p.sel && UI.sel !== p.sel) { UI.sel = p.sel; render(false); }
    const n = this.lista.length;
    $('#tutorial .tut-cartao').innerHTML = `<div class="linha entre nw"><span class="rotulo">Tutorial · ${this.i + 1} de ${n}</span><button type="button" class="btn btn-icone btn-mini btn-fantasma" data-tut="fechar" aria-label="Fechar tutorial">${icone('x', 'p')}</button></div>
      <h2 class="titulo-display" style="font-size:1.35rem;margin:6px 0">${esc(p.titulo)}</h2><p class="peq suave">${esc(p.texto)}</p>
      <div class="progresso-tut"><i style="width:${((this.i + 1) / n) * 100}%"></i></div>
      <div class="linha entre mt"><button type="button" class="btn btn-mini btn-fantasma" data-tut="fechar">Pular</button>
      <span class="linha nw">${this.i ? '<button type="button" class="btn btn-mini" data-tut="anterior">Voltar</button>' : ''}
      <button type="button" class="btn btn-mini btn-ouro" data-tut="proximo">${this.i === n - 1 ? 'Começar a governar' : 'Próximo'}</button></span></div>`;
    const alvo = p.alvo && $(p.alvo);
    if (alvo) alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    this.reposicionar();
    setTimeout(() => this.reposicionar(), 450);
  },
  reposicionar() {
    if (!this.ativo || !$('#tutorial')) return;
    const p = this.lista[this.i], foco = $('#tutorial .tut-foco'), cartao = $('#tutorial .tut-cartao');
    const alvo = p.alvo && $(p.alvo);
    const r = alvo && alvo.getBoundingClientRect();
    if (!r || !r.width) {
      foco.style.cssText = 'left:50%;top:50%;width:0;height:0';
      cartao.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)';
      return;
    }
    const m = 8, top = Math.max(r.top - m, 4), alt = Math.min(r.height + 2 * m, innerHeight - top - 4);
    foco.style.cssText = `left:${r.left - m}px;top:${top}px;width:${r.width + 2 * m}px;height:${alt}px`;
    if (innerWidth < 760) { cartao.style.cssText = ''; return; } // celular: cartão fixo embaixo (CSS)
    const w = Math.min(380, innerWidth - 32);
    let x = r.right + 18, y = r.top;
    if (x + w > innerWidth - 16) x = r.left - w - 18;
    if (x < 16) { x = Math.max(16, Math.min(r.left, innerWidth - w - 16)); y = r.bottom + 18 > innerHeight - 260 ? r.top - 280 : r.bottom + 18; }
    y = clampN(y, 16, innerHeight - 300);
    cartao.style.cssText = `left:${x}px;top:${y}px;width:${w}px`;
  },
  proximo() { if (this.i >= this.lista.length - 1) return this.fechar(); this.i++; this.mostrar(); },
  anterior() { if (this.i > 0) { this.i--; this.mostrar(); } },
  fechar() {
    this.ativo = false;
    guardar.set('sim_tutorial', '1');
    if ($('#tutorial')) $('#tutorial').hidden = true;
    if (TAB !== this.abaInicial && VIEWS[this.abaInicial]) { TAB = this.abaInicial; render(false); }
  },
};
addEventListener('resize', () => Tutorial.reposicionar());
addEventListener('scroll', () => Tutorial.reposicionar(), { passive: true });
document.addEventListener('keydown', (ev) => {
  if (!Tutorial.ativo) return;
  if (ev.key === 'Escape') Tutorial.fechar();
  if (ev.key === 'ArrowRight') Tutorial.proximo();
  if (ev.key === 'ArrowLeft') Tutorial.anterior();
});
