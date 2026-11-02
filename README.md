# Simulador de Presidente do Brasil

Flask + SQLite + HTML/CSS/JS puro (sem React/Node). Glassmorphism com tema claro/escuro.

## Rodar localmente

```bash
python -m venv .venv
.venv\Scripts\activate        # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
python app.py                 # http://localhost:5000
```

## Deploy no Render

1. Suba o projeto para o GitHub (`mixgsxd2-lab/simulador`).
2. No Render: **New → Blueprint** e escolha o repositório (o `render.yaml` configura tudo), ou **New → Web Service** com:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn app:app --workers 1 --threads 4 --timeout 60 --bind 0.0.0.0:$PORT`
   - Health check: `/saude`
3. Use **1 worker** (SQLite + estado serializado por transação).
4. Persistência: no plano free o disco é efêmero (o banco zera a cada deploy/reinício). Para manter os dados, use um plano pago, adicione um Disk em `/var/data` e defina `DATABASE_PATH=/var/data/simulador.db` (há um bloco comentado no `render.yaml`).

Variáveis: `SECRET_KEY` (gerada pelo Blueprint), `DATABASE_PATH` (opcional), `PORT` (o Render define).

## Estrutura

```
app.py                      ponto de entrada (gunicorn app:app)
simulador/
  __init__.py               create_app
  db.py                     SQLite (schema, transações)
  routes/pages.py, api.py   páginas e API JSON
  data/                     catálogos: geo (estados/países), politica (partidos, leis, cenários), eventos
  engine/                   regras do jogo
    estado.py               criação da RUN        turno.py      ciclo de trimestres, posse, fim de mandato
    economia.py             fiscal, setores       congresso.py  partidos, votação de leis
    justica.py              STF, investigações, impeachment, sociedade
    diplomacia.py           relações, ONU, guerras   eleicoes.py   campanha, debate, 1º/2º turno
    eventos.py              eventos aleatórios    acoes.py      ações do jogador (dispatcher)
    multiplayer.py          pedidos de jogadores  relatorio.py  relatório final/pontuação
  templates/ static/        interface
tests/simular.py            bot que joga RUNS completas (valida o motor)
```

## Como jogar

- **Presidente**: campanha de 4 trimestres (comícios, TV, alianças, debate) → 1º/2º turno → governo. Mapa-múndi em grade.
- **Hard (Governador)**: qualquer UF; mapa do Brasil, administração estadual, relações com a União e outros estados.
- Cada trimestre você tem **capital político**; leis, nomeações, negociações e diplomacia gastam capital.
- Mandato = 16 trimestres. Máximo de 2 consecutivos. RUN **curta** (1 mandato), **média** (2) ou **longa** (2 + eleição do sucessor).
- A RUN termina com relatório e pontuação (ranking na página inicial).
- **Multiplayer**: o anfitrião governa; os outros entram pelo código como governador, ministro, parlamentar ou líder de outro país e enviam *pedidos* (repasses, orçamento, emendas, acordos) que o anfitrião aprova ou nega, além do chat.

## Expandir

- Novas leis: `simulador/data/politica.py` (`LEIS`). Novos eventos: `simulador/data/eventos.py`. Novos cenários: `CENARIOS`.
- Novas ações: função em `engine/acoes.py` + entrada em `HANDLERS` + botão em `static/js/views.js`.
- Teste do motor: `python tests/simular.py`.
