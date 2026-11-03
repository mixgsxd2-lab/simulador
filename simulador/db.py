"""Persistência SQLite."""
import json
import sqlite3
import time
from contextlib import contextmanager
from flask import g, current_app

SCHEMA = """
CREATE TABLE IF NOT EXISTS jogos (
    codigo TEXT PRIMARY KEY, modo TEXT NOT NULL, duracao TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ativo',
    estado TEXT NOT NULL, criado REAL NOT NULL, atualizado REAL NOT NULL, versao INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS jogadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, jogo TEXT NOT NULL, nome TEXT NOT NULL, papel TEXT NOT NULL,
    extra TEXT NOT NULL DEFAULT '{}', token TEXT NOT NULL UNIQUE, anfitriao INTEGER NOT NULL DEFAULT 0, entrou REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jogadores_jogo ON jogadores(jogo);
CREATE TABLE IF NOT EXISTS mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT, jogo TEXT NOT NULL, autor TEXT NOT NULL, papel TEXT NOT NULL, texto TEXT NOT NULL, ts REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mensagens_jogo ON mensagens(jogo);
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, jogo TEXT NOT NULL, autor TEXT NOT NULL, papel TEXT NOT NULL, tipo TEXT NOT NULL,
    payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', ts REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pedidos_jogo ON pedidos(jogo);
CREATE TABLE IF NOT EXISTS governos (
    jogador INTEGER PRIMARY KEY, jogo TEXT NOT NULL, uf TEXT NOT NULL, estado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_governos_jogo ON governos(jogo);
CREATE TABLE IF NOT EXISTS relatorios (
    id INTEGER PRIMARY KEY AUTOINCREMENT, jogo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, modo TEXT NOT NULL, duracao TEXT NOT NULL,
    resultado TEXT NOT NULL, pontuacao REAL NOT NULL, dados TEXT NOT NULL, ts REAL NOT NULL
);
"""


def conectar():
    conn = sqlite3.connect(current_app.config["DATABASE"], timeout=20, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    except sqlite3.DatabaseError:
        pass
    return conn


def get_db():
    if "db" not in g:
        g.db = conectar()
    return g.db


def fechar_db(_=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


MIGRACOES = [
    "ALTER TABLE jogadores ADD COLUMN visto REAL NOT NULL DEFAULT 0",  # presença (online) no multiplayer
    "ALTER TABLE jogadores ADD COLUMN pronto INTEGER NOT NULL DEFAULT 0",  # pronto para avançar o trimestre
    "ALTER TABLE pedidos ADD COLUMN destino INTEGER",  # NULL = anfitrião; senão, id do jogador que decide
    "ALTER TABLE pedidos ADD COLUMN autor_id INTEGER",
]


def init_db():
    conn = conectar()
    conn.executescript(SCHEMA)
    for sql in MIGRACOES:  # bancos criados antes da coluna existir
        try:
            conn.execute(sql)
        except sqlite3.OperationalError:
            pass
    conn.close()


def init_app(app):
    app.teardown_appcontext(fechar_db)
    with app.app_context():
        init_db()


@contextmanager
def transacao():
    db = get_db()
    db.execute("BEGIN IMMEDIATE")
    try:
        yield db
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise


# ---------- jogos ----------
def carregar_jogo(db, codigo):
    row = db.execute("SELECT * FROM jogos WHERE codigo=?", (codigo,)).fetchone()
    if not row:
        return None, None
    return row, json.loads(row["estado"])


def salvar_estado(db, codigo, estado):
    status = "encerrado" if estado["meta"]["encerrado"] else "ativo"
    db.execute("UPDATE jogos SET estado=?, status=?, atualizado=?, versao=versao+1 WHERE codigo=?",
               (json.dumps(estado, ensure_ascii=False), status, time.time(), codigo))


def salvar_relatorio(db, codigo, nome, modo, duracao, rel):
    db.execute("INSERT OR REPLACE INTO relatorios(jogo,nome,modo,duracao,resultado,pontuacao,dados,ts) VALUES (?,?,?,?,?,?,?,?)",
               (codigo, nome, modo, duracao, rel["resultado"], rel["pontuacao"], json.dumps(rel, ensure_ascii=False), time.time()))


# ---------- governos estaduais (multiplayer: cada governador joga a própria partida) ----------
def carregar_governos(db, codigo):
    """{id do jogador: estado da partida do governador}"""
    return {r["jogador"]: json.loads(r["estado"]) for r in db.execute("SELECT * FROM governos WHERE jogo=?", (codigo,))}


def salvar_governo(db, codigo, jogador_id, estado):
    db.execute("INSERT OR REPLACE INTO governos(jogador,jogo,uf,estado) VALUES (?,?,?,?)",
               (jogador_id, codigo, estado["meta"]["uf"], json.dumps(estado, ensure_ascii=False)))


def tocar(db, codigo):
    """Marca a sala como alterada (a sincronização dos clientes usa a versão)."""
    db.execute("UPDATE jogos SET versao=versao+1, atualizado=? WHERE codigo=?", (time.time(), codigo))
