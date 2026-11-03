/* Tutorial interativo da tela de jogo: troca de aba, destaca a área explicada e mostra um cartão com o texto.
   Abre sozinho na primeira partida (guardar 'sim_tutorial') e pode ser revisto pelo botão "Tutorial". */
const Tutorial = {
  ativo: false,
  i: 0,
  passos() {
    const nac = NAC(), cargo = nac ? 'Presidente' : 'Governador(a)';
    const primeiro = Object.keys(S().diplomacia.entidades)[0];
    return [
      { titulo: 'Bem-vindo ao governo!', texto: `Você venceu a eleição de 2022 e é ${cargo} desde janeiro de 2023. O jogo é simples: a cada trimestre você faz algumas ações e depois avança o tempo. Seu objetivo é chegar à eleição de outubro de 2026 com o povo do seu lado (popularidade de 50% ou mais).` },
      { aba: 'governo', alvo: '.objetivo', titulo: 'O que fazer agora', texto: 'Este painel mostra seu objetivo e as 3 ações mais importantes do momento. Toque numa dica para ir direto ao lugar certo. Na dúvida, siga as dicas!' },
      { alvo: '.capital', titulo: 'Pontos de ação', texto: 'Cada ação gasta pontos de ação (o raio ⚡): aprovar uma lei, nomear um ministro, negociar. Eles voltam a cada trimestre, e você ganha mais quando está popular.' },
      { alvo: '.btn-turno', titulo: 'Avançar o tempo', texto: 'Terminou suas ações? Toque aqui para passar 3 meses. A economia e o país reagem ao que você fez. Às vezes surge um evento e você escolhe o que fazer. No multiplayer, o botão vira "Estou pronto" e o tempo só anda quando todos estão prontos.' },
      { alvo: '.faixa-kpi', titulo: 'Seus números', texto: 'Verde é bom, amarelo pede atenção e vermelho é problema. O mais importante é a popularidade: é ela que decide a eleição.' },
      { aba: 'economia', alvo: '#aba', titulo: 'Economia em dois toques', texto: 'Baixe ou aumente os impostos e escolha como gastar: austeridade, equilíbrio ou investimento, e a área prioritária (saúde, educação…). Se a inflação ou o caixa ficarem vermelhos, escolha austeridade.' },
      { aba: 'congresso', alvo: '.lei-card', titulo: 'Leis', texto: 'Cada lei mostra a chance de ser aprovada e se agrada ou não o eleitor. Comece pelas recomendadas. Se a chance estiver baixa, use "Negociar apoio" para conquistar partidos indecisos.' },
      { aba: 'diplomacia', sel: primeiro, alvo: '#painel-ent', titulo: nac ? 'Mundo' : 'Outros estados', texto: nac ? 'Toque num país para melhorar a relação, fazer acordos comerciais ou alianças. Mercosul, BRICS e ONU têm cúpulas obrigatórias: quando chegam, você só escolhe a posição do Brasil.' : 'Toque em outro estado para cooperar ou firmar consórcios, que ajudam a economia.' },
      { aba: 'pais', alvo: '#aba', titulo: 'País', texto: 'Aqui você vê o que cada grupo da população acha do governo, a Justiça (investigações e STF) e os gráficos da sua gestão.' },
      { aba: 'governo', alvo: '.faixa-kpi', titulo: 'A eleição', texto: nac ? 'No 2º trimestre de 2026 começa a campanha. Você enfrenta os candidatos reais de 2026 (Lula, Flávio Bolsonaro, Caiado, Zema, Renan Santos e Augusto Cury, exceto o do seu partido). Comícios e TV ajudam, mas o que mais pesa é a popularidade.' : 'No 2º trimestre de 2026 começa a campanha para governador. Comícios e TV ajudam, mas o que mais pesa é a popularidade.' },
      { aba: 'sala', alvo: '.codigo-grande', titulo: 'Jogar com amigos', texto: nac ? 'Passe este código: seus amigos entram como governadores, cada um com seu estado, e negociam verbas e apoio com você.' : 'Aqui você fala com o presidente e os outros governadores: peça verbas e obras, ofereça apoio e use o chat.' },
      { titulo: 'Pronto!', texto: 'É só isso. Siga as dicas do painel "O que fazer agora" e avance o tempo. Para rever este tutorial, use o botão Tutorial (barra lateral ou aba Ajustes). Bom governo!' },
    ].filter(Boolean);
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
