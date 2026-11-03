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
| Fronteiras dos países: Natural Earth via `world-atlas@2.0.2` | Votação das eleições durante a partida (inclusive a de 2026) |
| Malha dos 26 estados e DF: API de malhas do IBGE | Economia, eventos, investigações e crises |
| Partidos, números eleitorais e bancadas eleitas em 2022 (TSE), com fusões posteriores; Partido Missão (14), registrado em 2025 | Relações diplomáticas, aceite de acordos e guerras |
| Resultado da eleição presidencial de 2022 (TSE), com o jogador no lugar do vencedor | Candidatos fictícios (governador e eleições após 2026) |
| Principais candidaturas à Presidência registradas no TSE para 2026 | Afinidade de cada partido com o governo |
| Presidentes desde 1889, governadores eleitos em 2022, logotipos dos partidos e fotos dos candidatos (carregados da Wikipédia) | Efeitos das leis e dos acordos |

Cores dos partidos e posições no eixo ideológico são estimativas da simulação. O resultado real das eleições de outubro de 2026 não está incluído: na partida, a eleição de 2026 é simulada.

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
    js/views.js, game.js       abas e núcleo da tela de jogo (sincronização multiplayer)
    js/tutorial.js             tutorial interativo da tela de jogo
    data/mundo.json, brasil.json   mapas pré-projetados (gerados por tools/gerar_mapas.py)
tools/gerar_mapas.py           gera os mapas a partir dos dados brutos
tests/simular.py               bot que joga RUNS completas (valida o motor)
tests/multiplayer.py           fluxo multiplayer pela API (governadores, pronto, pedidos, acordos, chat)
```

## Regenerar os mapas

Só é necessário para trocar a resolução ou a fonte. Requer `pip install pycountry`.

```bash
curl -L -o world50.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
curl -L -o br.json "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=intermediaria&intrarregiao=UF"
python tools/gerar_mapas.py world50.json br.json
```

## Como jogar

- **Objetivo**: você venceu a eleição de 2022 e governa desde janeiro de 2023. Chegue à eleição de outubro de 2026 com popularidade de 50% ou mais. Você enfrenta os candidatos reais de 2026 (Lula, Flávio Bolsonaro, Caiado, Zema, Renan Santos e Augusto Cury, exceto o do seu partido).
- **Rodadas**: cada rodada é um trimestre. Você faz algumas ações, que gastam **pontos de ação** (⚡) e voltam a cada rodada, e toca em **Encerrar trimestre**.
- **O que fazer agora**: na aba Início, um painel mostra o objetivo e as 3 ações mais importantes do momento, com atalho para o lugar certo.
- **Abas (5)**: Início (objetivo, dicas, ministérios, comunicação, manchetes), Economia, Leis, Mundo e Mais (povo, Justiça, gráficos, sala multiplayer e ajustes).
- **Economia**: controles de impostos e do orçamento (nível de gasto e divisão entre as áreas), com indicadores e o resultado fiscal do trimestre.
- **Leis**: 44 projetos agrupados por tema. Cada um mostra a **chance de aprovar** (Congresso e STF já incluídos) e se agrada ou não o eleitor. "Negociar apoio" libera emendas para os partidos indecisos; a negociação partido a partido fica em "avançado".
- **Mundo**: missões, acordos comerciais, alianças, sanções, guerras e ONU. **Cúpulas obrigatórias** (presidente): Mercosul (2º e 4º trimestres), BRICS e Assembleia Geral da ONU (3º trimestre) e COP30 em Belém (2025); em cada uma você escolhe a posição do Brasil (catálogo em `data/cupulas.py`).
- **Criação da partida**: 5 etapas (cargo, partido, ideologia, personagem e revisão). Promessas, duração e cenário são opcionais, em "Opções avançadas".
- **Tutorial**: abre na primeira partida e pode ser revisto pelo botão Tutorial; o menu tem a tela **Como jogar**.
- **Multiplayer**: quem cria a sala é o **presidente**. Quem entra como **governador** escolhe um estado e joga a própria partida estadual, ligada à economia do presidente; os dois negociam verbas, convênios, programas federais, Força Nacional e apoio político, e governadores fecham consórcios entre si. Também dá para entrar como ministro, parlamentar ou líder de outro país.
- **Pronto**: o trimestre só avança quando **todos os jogadores online** tocam em "Estou pronto" (sozinho, avança na hora). Quem fica offline não bloqueia; o presidente pode forçar o avanço.
- Mandato de 16 trimestres, no máximo 2 consecutivos. Partida **curta** (até 2026), **média** (até 2030) ou **longa** (2 mandatos + eleição do sucessor).

## Expandir

- Novas leis: `simulador/data/politica.py` (`LEIS`). Novos eventos: `simulador/data/eventos.py`. Novos cenários: `CENARIOS`.
- Novas ações: função em `engine/acoes.py` + entrada em `HANDLERS` + botão em `static/js/views.js`.
- Novos componentes visuais: `UIc` em `static/js/core.js`.
- Novas cúpulas obrigatórias: `CUPULAS` em `data/cupulas.py`.
- Testes: `python tests/simular.py` (motor) e `python tests/multiplayer.py` (API multiplayer).
