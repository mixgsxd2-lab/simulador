/* Personagem em camadas SVG (viewBox 200×240). Usado no criador, no topo do jogo, no gabinete e nos candidatos. */
const Avatar = (() => {
  const OPC = {
    rosto: [['oval', 'Oval'], ['redondo', 'Redondo'], ['quadrado', 'Quadrado'], ['longo', 'Alongado'], ['fino', 'Fino']],
    pele: ['#f6d7c3', '#efc4a2', '#e2ae88', '#cf9468', '#b07650', '#8d5b3c', '#6c4329', '#4b2e1c'],
    olhos: [['normal', 'Atento'], ['amendoado', 'Amendoado'], ['sorridente', 'Sorridente'], ['serio', 'Sério']],
    cor_olhos: ['#3b2618', '#5a3b22', '#2f5d3a', '#3a6ea5', '#6b6f73'],
    sobrancelha: [['grossa', 'Grossa'], ['fina', 'Fina'], ['arqueada', 'Arqueada'], ['reta', 'Reta']],
    boca: [['sorriso', 'Sorriso'], ['neutro', 'Neutra'], ['confiante', 'Confiante'], ['aberto', 'Sorriso aberto']],
    cabelo: [['careca', 'Careca'], ['raspado', 'Raspado'], ['curto', 'Curto social'], ['lateral', 'Repartido'], ['topete', 'Topete'], ['ondulado', 'Ondulado'],
      ['cacheado', 'Cacheado'], ['afro', 'Black power'], ['longo', 'Longo liso'], ['chanel', 'Chanel'], ['coque', 'Coque'], ['grisalho_classico', 'Clássico recuado']],
    cor_cabelo: ['#15110f', '#2f2119', '#5a3a22', '#8a6440', '#cfae76', '#a24d27', '#8d8d8d', '#dedede'],
    barba: [['nenhuma', 'Sem barba'], ['por_fazer', 'Por fazer'], ['bigode', 'Bigode'], ['cavanhaque', 'Cavanhaque'], ['curta', 'Barba curta'], ['cheia', 'Barba cheia']],
    traje: [['terno', 'Terno'], ['risca', 'Terno risca de giz'], ['colete', 'Terno com colete'], ['tailleur', 'Tailleur'], ['camisa', 'Camisa social'], ['gola_alta', 'Blazer e gola alta']],
    cor_traje: ['#1c2640', '#24272d', '#0f1013', '#566070', '#2b4f8a', '#5a1f2b', '#b39b77', '#45563a', '#e8e4dc'],
    gravata: [['nenhuma', 'Sem gravata'], ['#9e1b2a', 'Vermelha'], ['#1d3f8f', 'Azul'], ['#0f7a43', 'Verde'], ['#d9a91a', 'Amarela'], ['#5b2a6e', 'Roxa'], ['listrada', 'Listrada']],
    oculos: [['nenhum', 'Nenhum'], ['fino', 'Aro fino'], ['grosso', 'Aro grosso'], ['redondo', 'Redondo'], ['meio', 'Meia armação']],
    acessorio: [['nenhum', 'Nenhum'], ['broche', 'Broche da bandeira'], ['broche_partido', 'Broche do partido'], ['lenco', 'Lenço de bolso'], ['brincos', 'Brincos'], ['colar', 'Colar de pérolas']],
    faixa: [['nao', 'Sem faixa'], ['sim', 'Faixa presidencial']],
    fundo: [['palacio', 'Palácio'], ['bandeira', 'Bandeira'], ['estudio', 'Estúdio'], ['plenario', 'Plenário'], ['transparente', 'Sem fundo']],
  };
  const PADRAO = { rosto: 'oval', pele: '#cf9468', olhos: 'normal', cor_olhos: '#3b2618', sobrancelha: 'grossa', boca: 'confiante', cabelo: 'lateral',
    cor_cabelo: '#2f2119', barba: 'nenhuma', traje: 'terno', cor_traje: '#1c2640', gravata: '#1d3f8f', oculos: 'nenhum', acessorio: 'broche', faixa: 'nao', fundo: 'palacio' };

  const ROSTO = {
    oval: 'M62 88C62 58 80 46 100 46S138 58 138 88C138 118 124 142 100 144C76 142 62 118 62 88Z',
    redondo: 'M59 92C59 60 79 47 100 47S141 60 141 92C141 122 124 140 100 141C76 140 59 122 59 92Z',
    quadrado: 'M61 86C61 57 80 46 100 46S139 57 139 86V112C139 129 123 143 100 144C77 143 61 129 61 112Z',
    longo: 'M64 86C64 54 82 43 100 43S136 54 136 86C136 121 122 149 100 151C78 149 64 121 64 86Z',
    fino: 'M61 86C61 56 80 46 100 46S139 56 139 86C139 112 121 140 100 146C79 140 61 112 61 86Z',
  };
  const QUEIXO = { oval: 144, redondo: 141, quadrado: 144, longo: 151, fino: 146 };

  const sombra = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((x) => Math.round(clampN(x * f, 0, 255))); return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''); };

  function cabeloTras(t, c, s) {
    switch (t) {
      case 'longo': return `<path d="M58 88C54 50 78 34 100 34S146 50 142 88L148 174C132 182 120 174 118 162H82C80 174 68 182 52 174Z" fill="${c}"/><path d="M74 120L70 172M128 120L132 172" stroke="${s}" stroke-width="2" opacity=".35"/>`;
      case 'chanel': return `<path d="M55 88C51 50 78 35 100 35S149 50 145 88L147 134C141 141 130 139 127 130H73C70 139 59 141 53 134Z" fill="${c}"/>`;
      case 'coque': return `<circle cx="100" cy="32" r="15" fill="${c}"/><circle cx="100" cy="32" r="15" fill="url(#luzCab)" opacity=".5"/>`;
      case 'afro': return `<path d="M42 92C32 52 64 18 100 18S168 52 158 92C164 116 150 126 140 118L60 118C50 126 36 116 42 92Z" fill="${c}"/>`;
      case 'cacheado': return `<path d="M54 92C46 58 70 32 100 32S154 58 146 92C150 108 140 114 134 108L66 108C60 114 50 108 54 92Z" fill="${c}"/>`;
      default: return '';
    }
  }
  function cabeloFrente(t, c, s) {
    switch (t) {
      case 'careca': return '<ellipse cx="88" cy="58" rx="14" ry="6" fill="#fff" opacity=".12"/>';
      case 'raspado': return `<path d="M62 88C61 56 80 44 100 44S139 56 138 88C134 70 120 60 100 60S66 70 62 88Z" fill="${c}" opacity=".6"/>`;
      case 'curto': return `<path d="M60 90C57 57 78 39 100 39S143 56 140 90C137 76 132 68 124 63C112 70 90 70 76 63C68 69 63 78 60 90Z" fill="${c}"/>`;
      case 'lateral': return `<path d="M60 92C56 56 80 38 104 38S144 58 140 92C138 78 134 66 126 60C108 66 84 60 74 54C66 62 62 76 60 92Z" fill="${c}"/><path d="M84 41C80 48 77 54 74 56" stroke="${s}" stroke-width="1.6" fill="none"/>`;
      case 'topete': return `<path d="M60 90C58 60 72 34 104 30C132 28 147 52 140 90C136 74 130 64 120 60C104 66 84 64 72 62C66 70 62 80 60 90Z" fill="${c}"/><path d="M88 36C100 30 118 32 128 42" stroke="${s}" stroke-width="2" fill="none" opacity=".5"/>`;
      case 'ondulado': return `<path d="M58 94C52 58 78 36 102 36S148 56 142 94C138 84 136 74 130 68C126 74 118 70 114 64C108 70 98 70 92 64C86 70 78 70 74 66C68 72 62 82 58 94Z" fill="${c}"/>`;
      case 'cacheado': return `<g fill="${c}">${[[64, 70], [72, 58], [84, 50], [98, 47], [112, 50], [124, 57], [134, 68], [60, 84], [140, 84], [78, 62], [118, 62]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10"/>`).join('')}</g><g fill="${s}" opacity=".35">${[[70, 64], [92, 52], [116, 56], [132, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</g>`;
      case 'afro': return `<path d="M60 86C60 60 78 50 100 50S140 60 140 86C134 72 120 64 100 64S66 72 60 86Z" fill="${c}"/>`;
      case 'longo': return `<path d="M60 96C57 56 80 40 100 40S143 56 140 96C136 72 124 60 106 58C96 66 78 72 66 74C62 80 60 88 60 96Z" fill="${c}"/>`;
      case 'chanel': return `<path d="M59 88C59 56 80 41 100 41S141 56 141 88L134 74C118 66 82 66 66 74Z" fill="${c}"/>`;
      case 'coque': return `<path d="M60 90C58 56 80 42 100 42S142 56 140 90C136 72 124 60 100 58S64 72 60 90Z" fill="${c}"/><path d="M76 52C88 46 112 46 124 52" stroke="${s}" stroke-width="1.6" fill="none" opacity=".5"/>`;
      case 'grisalho_classico': return `<path d="M60 92C58 64 68 52 78 50C74 60 72 72 70 80C66 82 62 86 60 92ZM140 92C142 64 132 52 122 50C126 60 128 72 130 80C134 82 138 86 140 92Z" fill="${c}"/><path d="M80 50C92 46 108 46 120 50C112 52 88 52 80 50Z" fill="${c}" opacity=".7"/>`;
      default: return '';
    }
  }
  function barba(t, c, q) {
    const bigode = `<path d="M87 118C92 113 98 115 100 117C102 115 108 113 113 118C108 121 104 120 100 119C96 120 92 121 87 118Z" fill="${c}"/>`;
    switch (t) {
      case 'por_fazer': return `<path d="M64 104C66 128 82 ${q} 100 ${q + 1}S134 128 136 104C130 122 118 132 100 133S70 122 64 104ZM86 117C92 114 108 114 114 117L112 121H88Z" fill="${c}" opacity=".28"/>`;
      case 'bigode': return bigode;
      case 'cavanhaque': return `${bigode}<path d="M91 129C93 ${q - 4} 107 ${q - 4} 109 129C104 132 96 132 91 129Z" fill="${c}"/>`;
      case 'curta': return `<path d="M63 100C64 126 80 ${q} 100 ${q + 1}S136 126 137 100C133 116 126 124 116 127C110 130 90 130 84 127C74 124 67 116 63 100Z" fill="${c}" opacity=".88"/>${bigode}`;
      case 'cheia': return `<path d="M61 96C60 132 80 ${q + 10} 100 ${q + 12}S140 132 139 96C135 114 127 123 117 126C110 121 90 121 83 126C73 123 65 114 61 96Z" fill="${c}"/>${bigode}`;
      default: return '';
    }
  }
  function olhos(t, cor) {
    const um = (x) => {
      if (t === 'sorridente') return `<path d="M${x - 6} 97Q${x} 91 ${x + 6} 97" stroke="#2a1d17" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      const base = `<ellipse cx="${x}" cy="96" rx="${t === 'amendoado' ? 6.2 : 5.4}" ry="${t === 'amendoado' ? 2.9 : 3.5}" fill="#fbf8f4"/><circle cx="${x}" cy="96" r="2.6" fill="${cor}"/><circle cx="${x}" cy="96" r="1.2" fill="#120c0a"/><circle cx="${x + .9}" cy="95" r=".7" fill="#fff"/>`;
      const palp = t === 'serio' ? `<path d="M${x - 6} 94.5H${x + 6}" stroke="#2a1d17" stroke-width="2.2" stroke-linecap="round"/>` : `<path d="M${x - 6} 95Q${x} 91.5 ${x + 6} 95" stroke="#2a1d17" stroke-width="1.3" fill="none"/>`;
      return base + palp;
    };
    return um(85) + um(115);
  }
  function sobrancelhas(t, c) {
    const w = t === 'grossa' ? 3.4 : t === 'fina' ? 1.6 : 2.4;
    const d = { grossa: ['M77 86Q85 81 93 84', 'M107 84Q115 81 123 86'], fina: ['M78 85Q85 82 92 84', 'M108 84Q115 82 122 85'],
      arqueada: ['M77 87Q84 79 93 84', 'M107 84Q116 79 123 87'], reta: ['M77 84.5L93 84', 'M107 84L123 84.5'] }[t] || [];
    return d.map((p) => `<path d="${p}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`).join('');
  }
  function boca(t) {
    const cor = '#8a3f3a';
    switch (t) {
      case 'sorriso': return `<path d="M90 124Q100 131 110 124" stroke="${cor}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      case 'neutro': return `<path d="M91 126H109" stroke="${cor}" stroke-width="2.4" stroke-linecap="round"/>`;
      case 'aberto': return `<path d="M88 122Q100 136 112 122Q100 126 88 122Z" fill="#5b1f1f"/><path d="M91 123.2Q100 126.5 109 123.2L108 126Q100 128 92 126Z" fill="#fff"/>`;
      default: return `<path d="M90 126Q101 130 110 123" stroke="${cor}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
  }
  function oculos(t) {
    const cor = '#1c1c1f';
    switch (t) {
      case 'fino': return `<g stroke="${cor}" stroke-width="1.3" fill="rgba(200,220,255,.12)"><rect x="75" y="88" width="20" height="15" rx="5"/><rect x="105" y="88" width="20" height="15" rx="5"/><path d="M95 94H105M75 93L63 90M125 93L137 90" fill="none"/></g>`;
      case 'grosso': return `<g stroke="${cor}" stroke-width="3.2" fill="rgba(200,220,255,.1)"><rect x="74" y="87" width="22" height="16" rx="3"/><rect x="104" y="87" width="22" height="16" rx="3"/><path d="M96 93H104M74 92L62 89M126 92L138 89" fill="none"/></g>`;
      case 'redondo': return `<g stroke="#8a6a2a" stroke-width="1.6" fill="rgba(200,220,255,.12)"><circle cx="85" cy="96" r="9"/><circle cx="115" cy="96" r="9"/><path d="M94 95Q100 92 106 95M76 94L63 91M124 94L137 91" fill="none"/></g>`;
      case 'meio': return `<g stroke="${cor}" fill="none"><path d="M74 89H96M104 89H126" stroke-width="3.4" stroke-linecap="round"/><path d="M75 89Q75 103 85 103Q95 103 96 89M104 89Q105 103 115 103Q125 103 126 89" stroke-width=".9"/><path d="M96 91H104" stroke-width="1.5"/></g>`;
      default: return '';
    }
  }
  function traje(ap, partidoCor) {
    const c = ap.cor_traje, s = sombra(c, .72), cl = sombra(c, 1.25);
    const corpo = `<path d="M16 240C20 193 50 169 100 167S180 193 184 240Z" fill="${c}"/>`;
    const camisa = '#f4f2ee';
    const gravataCor = ap.gravata;
    const gravata = gravataCor && gravataCor !== 'nenhuma'
      ? `<path d="M96 172H104L103 180H97Z" fill="${gravataCor === 'listrada' ? '#7a1a26' : sombra(gravataCor, .85)}"/><path d="M97 179H103L106 208L100 216L94 208Z" fill="${gravataCor === 'listrada' ? '#7a1a26' : gravataCor}"/>${gravataCor === 'listrada' ? '<path d="M96 186L104 190M95 195L105 200M95 204L104 208" stroke="#d9b45a" stroke-width="2"/>' : ''}` : '';
    let out = '';
    switch (ap.traje) {
      case 'camisa':
        out = `<path d="M16 240C20 193 50 169 100 167S180 193 184 240Z" fill="${c === '#0f1013' || c === '#24272d' ? camisa : c}"/><path d="M84 166L100 182L116 166L120 176L100 186L80 176Z" fill="${sombra(c === '#0f1013' || c === '#24272d' ? camisa : c, .9)}"/><path d="M100 186V240" stroke="#0002" stroke-width="1.2"/>${[196, 210, 224].map((y) => `<circle cx="100" cy="${y}" r="1.4" fill="#0003"/>`).join('')}${gravata}`;
        break;
      case 'gola_alta':
        out = `${corpo}<path d="M74 168C82 186 92 196 100 196S118 186 126 168L118 240H82Z" fill="${sombra(c, .55)}"/><path d="M80 148H120L123 172Q100 182 77 172Z" fill="${sombra(c, .55)}"/><path d="M80 158H120M79 165H121" stroke="#0003" stroke-width="1"/>`;
        break;
      case 'tailleur':
        out = `${corpo}<path d="M84 167Q100 192 116 167Z" fill="${camisa}"/><path d="M82 168L100 204L90 210L72 180Z" fill="${s}"/><path d="M118 168L100 204L110 210L128 180Z" fill="${s}"/><circle cx="100" cy="222" r="2.2" fill="${cl}"/>`;
        break;
      default:
        out = `${corpo}<path d="M84 167L100 206L116 167Z" fill="${camisa}"/><path d="M84 167L95 180L100 170Z M116 167L105 180L100 170Z" fill="#fff"/>${gravata}
          <path d="M82 168L100 208L88 214L70 181Z" fill="${s}"/><path d="M118 168L100 208L112 214L130 181Z" fill="${s}"/>`;
        if (ap.traje === 'colete') out += `<path d="M86 196L100 212L114 196L116 240H84Z" fill="${sombra(c, .85)}"/>${[218, 228].map((y) => `<circle cx="100" cy="${y}" r="1.5" fill="${cl}"/>`).join('')}`;
        if (ap.traje === 'risca') out += `<g stroke="${cl}" stroke-width=".7" opacity=".55">${[34, 46, 58, 142, 154, 166].map((x) => `<path d="M${x} ${x < 100 ? 196 + (70 - x) / 4 : 196 + (x - 130) / 4}V240"/>`).join('')}</g>`;
    }
    // acessórios do peito
    if (ap.acessorio === 'broche') out += '<circle cx="72" cy="192" r="4.4" fill="#0f7a43"/><path d="M72 188.6L75.6 192L72 195.4L68.4 192Z" fill="#f2c200"/><circle cx="72" cy="192" r="1.4" fill="#1d3f8f"/>';
    if (ap.acessorio === 'broche_partido') out += `<circle cx="72" cy="192" r="4.4" fill="${partidoCor || '#d9b45a'}" stroke="#fff8" stroke-width="1"/>`;
    if (ap.acessorio === 'lenco') out += '<path d="M128 194L140 191L138 198Z" fill="#f4f2ee"/><path d="M131 193L137 188L139 195Z" fill="#d9b45a"/>';
    if (ap.acessorio === 'colar') out += `<path d="M84 168Q100 184 116 168" fill="none" stroke="#f4efe6" stroke-width="3" stroke-dasharray=".1 4.4" stroke-linecap="round"/>`;
    if (ap.faixa === 'sim') out += `<path d="M56 177L74 170L156 240H128Z" fill="#0f7a43"/><path d="M62 175L69 172L148 240H138Z" fill="#f2c200"/><circle cx="116" cy="214" r="9" fill="#1d3f8f" stroke="#f2c200" stroke-width="2"/><path d="M111 214H121M116 209V219" stroke="#fff" stroke-width="1.4"/>`;
    return out;
  }
  function fundo(t, uid) {
    switch (t) {
      case 'transparente': return '';
      case 'bandeira': return `<rect width="200" height="240" fill="#0d6b3d"/><path d="M100 40L188 120L100 200L12 120Z" fill="#e8b80d" opacity=".9"/><circle cx="100" cy="120" r="46" fill="#1d3f8f"/><rect width="200" height="240" fill="url(#vin${uid})"/>`;
      case 'estudio': return `<rect width="200" height="240" fill="url(#est${uid})"/>`;
      case 'plenario': return `<rect width="200" height="240" fill="#2a1416"/>${[60, 90, 120, 150].map((r) => `<path d="M${100 - r} 240A${r} ${r} 0 0 1 ${100 + r} 240" stroke="#6e3036" stroke-width="7" fill="none" opacity=".55"/>`).join('')}<rect width="200" height="240" fill="url(#vin${uid})"/>`;
      default: return `<rect width="200" height="240" fill="url(#pal${uid})"/>${[24, 56, 144, 176].map((x) => `<rect x="${x - 6}" y="60" width="12" height="180" fill="#ffffff" opacity=".06"/>`).join('')}<path d="M0 60H200" stroke="#fff" opacity=".08"/><rect width="200" height="240" fill="url(#vin${uid})"/>`;
    }
  }

  let seq = 0;
  function svg(ap = {}, opts = {}) {
    ap = { ...PADRAO, ...ap };
    const uid = (++seq).toString(36);
    const idade = opts.idade || 40;
    const pele = ap.pele, ps = sombra(pele, .86), cab = ap.cor_cabelo, cs = sombra(cab, .7);
    const q = QUEIXO[ap.rosto] || 144;
    const rugas = idade >= 50 ? `<g stroke="${sombra(pele, .7)}" stroke-width="1" fill="none" opacity="${idade >= 62 ? .55 : .35}"><path d="M86 70Q100 67 114 70M88 75Q100 73 112 75"/>${idade >= 58 ? '<path d="M75 99L71 101M125 99L129 101M90 111Q87 119 90 125M110 111Q113 119 110 125"/>' : ''}</g>` : '';
    return `<svg class="avatar ${opts.cls || ''}" viewBox="0 0 200 240" role="img" aria-label="${esc(opts.rotulo || 'Personagem')}">
      <defs>
        <radialGradient id="pal${uid}" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#2d3a55"/><stop offset="1" stop-color="#0c1018"/></radialGradient>
        <radialGradient id="est${uid}" cx=".5" cy=".35" r=".85"><stop offset="0" stop-color="#8a909b"/><stop offset="1" stop-color="#2b2f36"/></radialGradient>
        <radialGradient id="vin${uid}" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
        <radialGradient id="pel${uid}" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient>
        <linearGradient id="luzCab" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      ${opts.semFundo ? '' : fundo(ap.fundo, uid)}
      <g class="av-corpo">
        ${cabeloTras(ap.cabelo, cab, cs)}
        <path d="M84 128H116V170Q100 178 84 170Z" fill="${ps}"/>
        ${traje(ap, opts.partidoCor)}
        <ellipse cx="61" cy="97" rx="6.5" ry="11" fill="${ps}"/><ellipse cx="139" cy="97" rx="6.5" ry="11" fill="${ps}"/>
        <path d="${ROSTO[ap.rosto] || ROSTO.oval}" fill="${pele}"/><path d="${ROSTO[ap.rosto] || ROSTO.oval}" fill="url(#pel${uid})"/>
        <ellipse cx="80" cy="113" rx="7" ry="4" fill="#d9605a" opacity=".1"/><ellipse cx="120" cy="113" rx="7" ry="4" fill="#d9605a" opacity=".1"/>
        ${rugas}
        ${barba(ap.barba, cab, q)}
        <path d="M100 99Q97 109 95 112Q100 115 105 112" stroke="${sombra(pele, .7)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        ${boca(ap.boca)}
        ${olhos(ap.olhos, ap.cor_olhos)}
        ${sobrancelhas(ap.sobrancelha, ap.cabelo === 'careca' || ap.cabelo === 'raspado' ? sombra(cab, 1) : cab)}
        ${ap.acessorio === 'brincos' ? '<circle cx="60" cy="110" r="2.6" fill="#e3c164"/><circle cx="140" cy="110" r="2.6" fill="#e3c164"/>' : ''}
        ${oculos(ap.oculos)}
        ${cabeloFrente(ap.cabelo, cab, cs)}
      </g></svg>`;
  }

  /* aparência aleatória determinística (NPCs, candidatos, ministros) */
  function aleatoria(semente, extra = {}) {
    const r = rngSeed(hashStr(semente));
    const pick = (arr) => { const v = arr[Math.floor(r() * arr.length)]; return Array.isArray(v) ? v[0] : v; };
    const ap = {};
    for (const k of Object.keys(PADRAO)) ap[k] = pick(OPC[k]);
    ap.fundo = 'estudio'; ap.faixa = 'nao';
    if (['terno', 'risca', 'colete'].includes(ap.traje) && ap.gravata === 'nenhuma') ap.gravata = '#1d3f8f';
    ap.cor_traje = pick(OPC.cor_traje.slice(0, 6));
    return { ...ap, ...extra };
  }
  return { OPC, PADRAO, svg, aleatoria };
})();
