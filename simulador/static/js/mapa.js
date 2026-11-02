/* Mapas reais interativos em SVG.
   Mundo: Natural Earth (projeção Equal Earth pré-calculada). Brasil: malha oficial do IBGE por UF.
   Recursos: zoom (roda, botões, pinça), arrastar, dica ao passar o mouse, seleção, foco animado. */
const Mapas = (() => {
  const cache = {};
  const carregar = (tipo) => (cache[tipo] ||= fetch(`/static/data/${tipo}.json`).then((r) => r.json()));
  const nomesPt = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['pt-BR'], { type: 'region' }) : null;
  const nomePais = (p) => { try { return (p.a2 && nomesPt && nomesPt.of(p.a2)) || p.nome_en; } catch { return p.nome_en; } };

  /* contorno e graticulado da projeção Equal Earth (mesma escala do gerador Python) */
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  function ee(lon, lat) {
    const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180, t = Math.asin(M * Math.sin(p)), t2 = t * t, t6 = t2 * t2 * t2;
    return [(l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
  }
  function geometriaMundo(larg) {
    const xmax = ee(180, 0)[0], ymax = ee(0, 90)[1], k = larg / (2 * xmax);
    const P = (lon, lat) => { const [x, y] = ee(lon, lat); return `${((x + xmax) * k).toFixed(1)},${((ymax - y) * k).toFixed(1)}`; };
    let esfera = 'M' + P(-180, -90);
    for (let la = -90; la <= 90; la += 3) esfera += 'L' + P(-180, la);
    for (let la = 90; la >= -90; la -= 3) esfera += 'L' + P(180, la);
    esfera += 'Z';
    let grat = '';
    for (let lo = -150; lo <= 150; lo += 30) { grat += 'M' + P(lo, -90); for (let la = -88; la <= 90; la += 4) grat += 'L' + P(lo, la); }
    for (let la = -60; la <= 60; la += 30) { grat += 'M' + P(-180, la); for (let lo = -175; lo <= 180; lo += 5) grat += 'L' + P(lo, la); }
    return { esfera, grat };
  }

  class Mapa {
    constructor(el, opts) {
      this.el = el; this.o = Object.assign({ tipo: 'mundo', cor: () => null, dica: () => '', aoClicar: () => {}, rotulos: false, selecionado: null, classe: () => '' }, opts);
      this.z = 1; this.tx = 0; this.ty = 0; this.sel = this.o.selecionado;
    }
    async montar() {
      this.el.classList.add('mapa-caixa');
      this.el.innerHTML = '<div class="mapa-carregando esqueleto"></div>';
      const d = await carregar(this.o.tipo);
      this.dados = d;
      const W = d.largura, H = d.altura;
      this.W = W; this.H = H;
      const mundo = this.o.tipo === 'mundo';
      const itens = mundo ? d.paises : d.estados;
      let fundo = '';
      if (mundo) {
        const g = geometriaMundo(W);
        fundo = `<path d="${g.esfera}" class="mapa-oceano"/><path d="${g.grat}" class="mapa-grat"/>`;
      }
      const formas = itens.map((it) => {
        const id = mundo ? it.id : it.uf;
        return `<path d="${it.d}" data-id="${esc(id)}" class="mapa-forma" tabindex="-1"/>`;
      }).join('');
      const rotulos = this.o.rotulos && !mundo ? itens.map((it) => `<text x="${it.c[0]}" y="${it.c[1] + 4}" class="mapa-rotulo ${it.uf === 'DF' ? 'df' : ''}">${it.uf}</text>`).join('') : '';
      this.el.innerHTML = `<svg class="mapa-svg ${mundo ? 'mundo' : 'brasil'}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mundo ? 'Mapa-múndi interativo' : 'Mapa do Brasil por estado'}">
          <defs><radialGradient id="oceanoG" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="var(--oceano-1)"/><stop offset="1" stop-color="var(--oceano-2)"/></radialGradient>
          <filter id="relevo" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".35"/></filter></defs>
          <g class="mapa-zoom">${fundo}<g class="mapa-formas" ${mundo ? '' : 'filter="url(#relevo)"'}>${formas}</g><g class="mapa-rotulos">${rotulos}</g></g></svg>
        <div class="mapa-dica" hidden></div>
        <div class="mapa-ctrl"><button type="button" class="btn btn-icone btn-mini" data-z="in" aria-label="Aproximar">${icone('zoomMais', 'p')}</button>
          <button type="button" class="btn btn-icone btn-mini" data-z="out" aria-label="Afastar">${icone('zoomMenos', 'p')}</button>
          <button type="button" class="btn btn-icone btn-mini" data-z="reset" aria-label="Ver tudo">${icone('expandir', 'p')}</button></div>
        <div class="mapa-fonte">${esc(d.fonte)}</div>`;
      this.svg = $('svg', this.el); this.g = $('.mapa-zoom', this.el); this.dica = $('.mapa-dica', this.el);
      this.formas = new Map($$('.mapa-forma', this.el).map((p) => [p.dataset.id, p]));
      this.nomes = new Map(itens.map((it) => [mundo ? it.id : it.uf, mundo ? nomePais(it) : it.uf]));
      this._eventos();
      this.colorir();
      if (this.sel) this.selecionar(this.sel, false);
      return this;
    }
    nome(id) { return this.nomes.get(id) || id; }
    colorir() {
      for (const [id, p] of this.formas) {
        const c = this.o.cor(id);
        p.style.fill = c || '';
        p.setAttribute('class', `mapa-forma ${c ? 'ativo' : 'inativo'} ${this.o.classe(id) || ''} ${id === this.sel ? 'sel' : ''}`);
      }
    }
    selecionar(id, focar = true) {
      this.sel = id;
      for (const [k, p] of this.formas) p.classList.toggle('sel', k === id);
      const p = this.formas.get(id);
      if (p) { p.parentNode.appendChild(p); if (focar) this.focar(id); }
    }
    focar(id) {
      const p = this.formas.get(id);
      if (!p) return;
      const b = p.getBBox();
      const z = clampN(Math.min(this.W / (b.width * 3), this.H / (b.height * 3)), 1, this.o.tipo === 'mundo' ? 6 : 3.5);
      this._anim(z, this.W / 2 - (b.x + b.width / 2) * z, this.H / 2 - (b.y + b.height / 2) * z);
    }
    _aplicar() {
      const maxX = 0, minX = this.W - this.W * this.z, maxY = 0, minY = this.H - this.H * this.z;
      this.tx = clampN(this.tx, minX, maxX); this.ty = clampN(this.ty, minY, maxY);
      this.g.setAttribute('transform', `translate(${this.tx.toFixed(1)} ${this.ty.toFixed(1)}) scale(${this.z.toFixed(3)})`);
      this.svg.style.setProperty('--z', this.z);
    }
    _anim(z, tx, ty) {
      const z0 = this.z, x0 = this.tx, y0 = this.ty, t0 = performance.now(), dur = document.documentElement.classList.contains('sem-animacao') ? 1 : 650;
      const passo = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        this.z = z0 + (z - z0) * e; this.tx = x0 + (tx - x0) * e; this.ty = y0 + (ty - y0) * e; this._aplicar();
        if (k < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    }
    _zoomEm(f, cx, cy) {
      const z = clampN(this.z * f, 1, 8);
      this.tx = cx - ((cx - this.tx) * z) / this.z; this.ty = cy - ((cy - this.ty) * z) / this.z; this.z = z; this._aplicar();
    }
    _ponto(ev) { const r = this.svg.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * this.W, ((ev.clientY - r.top) / r.height) * this.H]; }
    _eventos() {
      const svg = this.svg;
      // a rolagem só dá zoom com Ctrl/⌘ ou depois de clicar no mapa — assim a página continua rolando normalmente
      svg.addEventListener('wheel', (ev) => {
        if (!ev.ctrlKey && !ev.metaKey && !this.ativo) { this._aviso(); return; }
        ev.preventDefault(); const [x, y] = this._ponto(ev); this._zoomEm(ev.deltaY < 0 ? 1.18 : 1 / 1.18, x, y);
      }, { passive: false });
      svg.addEventListener('pointerdown', () => { this.ativo = true; });
      this.el.addEventListener('pointerleave', () => { this.ativo = false; });
      const ptrs = new Map(); let arrastou = false, ini = null, distIni = 0, zIni = 1;
      svg.addEventListener('pointerdown', (ev) => { ptrs.set(ev.pointerId, ev); arrastou = false; ini = { x: ev.clientX, y: ev.clientY, tx: this.tx, ty: this.ty };
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; distIni = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); zIni = this.z; } });
      svg.addEventListener('pointermove', (ev) => {
        const alvo = ev.target.closest('.mapa-forma');
        if (ptrs.has(ev.pointerId)) {
          ptrs.set(ev.pointerId, ev);
          if (ptrs.size === 2) {
            const [a, b] = [...ptrs.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const [x, y] = this._ponto({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
            this._zoomEm((zIni * d) / distIni / this.z, x, y); arrastou = true; return;
          }
          const r = svg.getBoundingClientRect(), dx = ev.clientX - ini.x, dy = ev.clientY - ini.y;
          if (Math.hypot(dx, dy) > 4) { arrastou = true; svg.setPointerCapture?.(ev.pointerId); svg.classList.add('arrastando'); }
          if (arrastou) { this.tx = ini.tx + (dx / r.width) * this.W; this.ty = ini.ty + (dy / r.height) * this.H; this._aplicar(); }
        }
        if (alvo && !arrastou && ev.pointerType === 'mouse') this._mostrarDica(alvo.dataset.id, ev); else if (!alvo) this.dica.hidden = true;
      });
      const fim = (ev) => {
        const alvo = ev.target.closest && ev.target.closest('.mapa-forma');
        ptrs.delete(ev.pointerId); svg.classList.remove('arrastando');
        if (!arrastou && alvo && ev.type === 'pointerup') { this.o.aoClicar(alvo.dataset.id, this); if (ev.pointerType !== 'mouse') this._mostrarDica(alvo.dataset.id, ev); }
      };
      svg.addEventListener('pointerup', fim); svg.addEventListener('pointercancel', fim);
      svg.addEventListener('pointerleave', () => { this.dica.hidden = true; });
      this.el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-z]'); if (!b) return;
        if (b.dataset.z === 'reset') return this._anim(1, 0, 0);
        const f = b.dataset.z === 'in' ? 1.6 : 1 / 1.6, z = clampN(this.z * f, 1, 8);
        this._anim(z, this.W / 2 - ((this.W / 2 - this.tx) * z) / this.z, this.H / 2 - ((this.H / 2 - this.ty) * z) / this.z);
      });
    }
    _aviso() {
      let a = $('.mapa-aviso', this.el);
      if (!a) { a = document.createElement('div'); a.className = 'mapa-aviso'; a.textContent = 'Use Ctrl + rolagem (ou clique no mapa) para dar zoom'; this.el.appendChild(a); }
      a.classList.add('on'); clearTimeout(this._tAviso); this._tAviso = setTimeout(() => a.classList.remove('on'), 1400);
    }
    _mostrarDica(id, ev) {
      const html = this.o.dica(id, this.nome(id));
      if (!html) { this.dica.hidden = true; return; }
      const r = this.el.getBoundingClientRect();
      this.dica.innerHTML = html; this.dica.hidden = false;
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      this.dica.style.left = `${clampN(x + 16, 8, r.width - this.dica.offsetWidth - 8)}px`;
      this.dica.style.top = `${clampN(y + 16, 8, r.height - this.dica.offsetHeight - 8)}px`;
    }
  }
  return { Mapa, carregar, nomePais };
})();
