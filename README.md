# Simulador de Presidente do Brasil

Flask + SQLite + HTML/CSS/JS puro (sem React/Node). Interface em glassmorphism, com temas claro e escuro, mapas reais e criador de personagem.

## Rodar localmente

```bash
python -m venv .venv
.venv\Scripts\activate        # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
python app.py                 # http://localhost:5000
```

## Deploy no Render

1. Suba o projeto para o GitHub (`mixgsxd2-lab/simulador`).
2. No Render, use **New → Blueprint** e escolha o repositório (o `render.yaml` configura tudo). Ou crie um **New → Web Service** com:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn app:app --workers 1 --threads 4 --timeout 60 --bind 0.0.0.0:$PORT`
   - Health check: `/saude`
3. Use **1 worker** (SQLite + estado serializado por transação).
4. Persistência: no plano free o disco é efêmero (o banco zera a cada deploy ou reinício). Para manter os dados, use um plano pago, adicione um Disk em `/var/data` e defina `DATABASE_PATH=/var/data/simulador.db` (há um bloco comentado no `render.yaml`).

## Dados reais × simulação

| Fato (fonte) | Simulado |
|---|---|
| Fronteiras dos países: Natural Earth via `world-atlas@2.0.2` | Eleições e candidatos adversários (fictícios, de partidos reais) |
| Malha dos 26 estados e DF: API de malhas do IBGE | Economia, eventos, investigações e crises |
| Partidos, números eleitorais e bancadas eleitas em 2022 (TSE), com fusões posteriores | Relações diplomáticas e guerras |
| Presidentes desde 1889 (retratos carregados da Wikipédia) | Afinidade de cada partido com o governo |
| Governadores eleitos em 2022 | |

Cores dos partidos e posições no eixo ideológico são estimativas da simulação. Os dados vão até meados de 2026 (o resultado das eleições de outubro de 2026 não está incluído).

## Estrutura

```
app.py                         ponto de entrada (gunicorn app:app)
simulador/
  __init__.py                  create_app
  db.py                        SQLite (schema, transações)
  routes/pages.py, api.py      páginas e API JSON
  data/
    geo.py                     estados e países parceiros
    politica.py                partidos reais, ideologias, leis, cenários
    historia.py                presidentes e governadores (fatos)
    eventos.py                 eventos aleatórios
  engine/                      regras do jogo (estado, turno, economia, congresso, justiça,
                               diplomacia, eleições, eventos, ações, multiplayer, relatório)
  templates/                   base, menu inicial (index), jogo
  static/
    css/base.css               design system: tokens, vidro, botões, campos
    css/componentes.css        mapa, anéis, gráficos, hemiciclo, retratos, cartões
    css/menu.css, jogo.css     telas
    js/core.js                 utilidades, API, tema, ícones, componentes, gráficos
    js/avatar.js               personagem em camadas SVG
    js/mapa.js                 mapas interativos (zoom, arrastar, toque, seleção)
    js/menu.js                 menu inicial, assistente e criador de personagem
    js/views.js, game.js       abas e núcleo da tela de jogo
    data/mundo.json, brasil.json   mapas pré-projetados (gerados por tools/gerar_mapas.py)
tools/gerar_mapas.py           gera os mapas a partir dos dados brutos
tests/simular.py               bot que joga RUNS completas (valida o motor)
```

## Regenerar os mapas

Só é necessário para trocar a resolução ou a fonte. Requer `pip install pycountry`.

```bash
curl -L -o world50.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
curl -L -o br.json "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=intermediaria&intrarregiao=UF"
python tools/gerar_mapas.py world50.json br.json
```

## Como jogar

- **Presidente**: campanha de 4 trimestres (comícios, TV, alianças, debate), depois 1º e 2º turno, e então o governo. Mapa-múndi real com 194 países.
- **Hard (Governador)**: qualquer UF no mapa do IBGE, com administração estadual e relações com a União e os outros estados.
- **Personagem**: rosto, pele, olhos, cabelo, barba, idade (mínimo constitucional de 35 anos para Presidente e 30 para Governador), trajes, gravata, óculos, acessórios e faixa presidencial.
- Cada trimestre dá **capital político**, gasto em leis, nomeações, negociações e diplomacia.
- Mandato de 16 trimestres, no máximo 2 consecutivos. RUN **curta** (1 mandato), **média** (2) ou **longa** (2 + eleição do sucessor).
- **Multiplayer**: o anfitrião governa; os outros entram pelo código e enviam pedidos que o anfitrião aprova ou nega.

## Expandir

- Novas leis: `simulador/data/politica.py` (`LEIS`). Novos eventos: `simulador/data/eventos.py`. Novos cenários: `CENARIOS`.
- Novas ações: função em `engine/acoes.py` + entrada em `HANDLERS` + botão em `static/js/views.js`.
- Novos componentes visuais: `UIc` em `static/js/core.js`.
- Teste do motor: `python tests/simular.py`.
