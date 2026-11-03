"""API JSON do simulador."""
import json
import random
import re
import secrets
import time
from flask import Blueprint, jsonify, request
from ..data.geo import ESTADOS, PAISES, ESTADOS_POR_UF
from ..data.historia import PRESIDENTES, ERAS, GOVERNADORES
from ..data.politica import PARTIDOS, IDEOLOGIAS, PROPOSTAS, PASTAS, LEIS, CENARIOS, SETORES, ROTULO_SETOR
from ..db import get_db, transacao, carregar_jogo, salvar_estado, salvar_relatorio
from ..engine import acoes, diplomacia, estado as est, multiplayer, visao

bp = Blueprint("api", __name__)
ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def erro(msg, status=400, **extra):
    return jsonify({"ok": False, "erro": msg, **extra}), status


def _texto(v, limite):
    return re.sub(r"\s+", " ", str(v or "")).strip()[:limite]


CHAVES_APARENCIA = {"rosto", "pele", "olhos", "cor_olhos", "sobrancelha", "boca", "cabelo", "cor_cabelo", "barba", "traje", "cor_traje",
                    "gravata", "oculos", "acessorio", "faixa", "fundo", "rugas"}


def _aparencia(ap):
    """Só aceita chaves conhecidas e valores simples (ids ou cores #rrggbb)."""
    out = {}
    for k, v in (ap or {}).items() if isinstance(ap, dict) else []:
        v = str(v)
        if k in CHAVES_APARENCIA and re.fullmatch(r"#[0-9a-fA-F]{6}|[a-z0-9_]{1,20}", v):
            out[k] = v
    return out


def _jogador(db, codigo):
    token = request.headers.get("X-Token", "")
    if not token:
        return None
    return db.execute("SELECT * FROM jogadores WHERE token=? AND jogo=?", (token, codigo)).fetchone()


def _codigo_novo(db):
    while True:
        cod = "".join(random.choice(ALFABETO) for _ in range(5))
        if not db.execute("SELECT 1 FROM jogos WHERE codigo=?", (cod,)).fetchone():
            return cod


ROTULO_EFEITO = {"economia.confianca": "confiança", "economia.caixa": "caixa (R$ bi)", "economia.tendencia": "crescimento potencial",
                 "economia.cambio": "câmbio", "setores.infraestrutura": "infraestrutura", "setores.seguranca": "segurança",
                 "setores.meio_ambiente": "meio ambiente", "sociedade.protestos": "protestos", "diplomacia.militar": "poder militar",
                 "diplomacia.onu": "prestígio na ONU", "popularidade": "popularidade"}


def _efeitos_txt(prop):
    """Resumo legível dos efeitos de uma proposta de acordo."""
    def fmt(ef, sufixo=""):
        return [f"{ROTULO_EFEITO.get(k, k)} {'+' if v > 0 else ''}{v:g}{sufixo}" for k, v in ef.items()]
    return fmt(prop["imediato"]) + fmt(prop["tri"], "/trim.")


@bp.get("/catalogo")
def catalogo():
    return jsonify({
        "partidos": PARTIDOS, "ideologias": IDEOLOGIAS, "propostas": PROPOSTAS, "estados": ESTADOS, "paises": PAISES,
        "leis": {k: {kk: vv for kk, vv in v.items() if kk != "efeitos"} for k, v in LEIS.items()},
        "pastas": PASTAS, "cenarios": {k: {"nome": v["nome"], "desc": v["desc"]} for k, v in CENARIOS.items()},
        "setores": SETORES, "rotulo_setor": ROTULO_SETOR, "papeis": multiplayer.PAPEIS,
        "diplomacia": {"formatos": diplomacia.FORMATOS, "concessoes": diplomacia.CONCESSOES, "interesse": diplomacia.INTERESSE,
                       "pautas": {k: {"nome": v["nome"], "ico": v["ico"], "propostas": {pk: {kk: vv for kk, vv in pv.items() if kk not in ("imediato", "tri")}
                                                                                          | {"efeitos": _efeitos_txt(pv)} for pk, pv in v["propostas"].items()}}
                                  for k, v in diplomacia.PAUTAS.items()}},
        "presidentes": PRESIDENTES, "eras": ERAS, "governadores": {uf: {"nome": n, "partido": p} for uf, (n, p) in GOVERNADORES.items()},
    })


@bp.post("/jogos/resumos")
def resumos():
    """Resumo das partidas salvas neste navegador (botão Continuar)."""
    cods = [str(c).upper()[:5] for c in ((request.get_json(silent=True) or {}).get("codigos") or [])][:20]
    db = get_db()
    out = []
    for cod in cods:
        row, estado = carregar_jogo(db, cod)
        if not row:
            continue
        m = estado["meta"]
        out.append({"codigo": cod, "nome": estado["jogador"]["nome"], "partido": estado["jogador"]["partido"], "modo": m["modo"],
                    "rotulo": m["rotulo"], "ano": m["ano"], "tri": m["trimestre"], "fase": m["fase"], "encerrado": m["encerrado"],
                    "popularidade": round(estado["popularidade"]), "aparencia": estado["jogador"].get("aparencia", {}), "atualizado": row["atualizado"]})
    out.sort(key=lambda x: -x["atualizado"])
    return jsonify(out)


@bp.get("/ranking")
def ranking():
    rows = get_db().execute("SELECT nome,modo,duracao,resultado,pontuacao,ts FROM relatorios ORDER BY pontuacao DESC LIMIT 10").fetchall()
    return jsonify([dict(r) for r in rows])


@bp.post("/jogos")
def criar_jogo():
    d = request.get_json(silent=True) or {}
    if d.get("modo") not in ("presidente", "governador"):
        return erro("Modo inválido.")
    if d.get("duracao") not in ("curta", "media", "longa"):
        return erro("Duração inválida.")
    if d.get("ideologia") not in IDEOLOGIAS:
        return erro("Escolha uma ideologia.")
    sigla = _texto(d.get("partido"), 6).upper()
    siglas = {p["sigla"] for p in PARTIDOS}
    cfg = {"modo": d["modo"], "duracao": d["duracao"], "ideologia": d["ideologia"], "cenario": d.get("cenario"),
           "nome": _texto(d.get("nome"), 40), "propostas": [p for p in (d.get("propostas") or []) if p in PROPOSTAS],
           "uf": d.get("uf"), "aparencia": _aparencia(d.get("aparencia")), "genero": d.get("genero") if d.get("genero") in ("m", "f", "neutro") else "neutro"}
    try:
        idade = int(d.get("idade") or 35)
    except (TypeError, ValueError):
        idade = 35
    minimo = 35 if d["modo"] == "presidente" else 30  # idade mínima constitucional (art. 14, §3º)
    if not minimo <= idade <= 80:
        return erro(f"A idade deve ficar entre {minimo} e 80 anos para esse cargo.")
    cfg["idade"] = idade
    if sigla in siglas:
        cfg["partido"] = sigla
    elif d.get("partido_novo"):
        if not re.fullmatch(r"[A-Z0-9]{2,6}", sigla):
            return erro("A sigla do novo partido deve ter de 2 a 6 letras/números.")
        cfg["partido"], cfg["partido_nome"] = sigla, _texto(d.get("partido_nome"), 50) or sigla
        cor = str(d.get("partido_cor") or "")
        cfg["partido_cor"] = cor if re.fullmatch(r"#[0-9a-fA-F]{6}", cor) else "#7c5cff"
        try:
            num = int(d.get("partido_numero"))
            cfg["partido_numero"] = num if 10 <= num <= 99 and num not in {p["numero"] for p in PARTIDOS} else None
        except (TypeError, ValueError):
            cfg["partido_numero"] = None
    else:
        return erro("Escolha um partido.")
    if d["modo"] == "governador" and d.get("uf") not in ESTADOS_POR_UF:
        return erro("Escolha um estado para governar.")
    try:
        estado = est.novo_jogo(cfg)
    except ValueError as ex:
        return erro(str(ex))
    db = get_db()
    token = secrets.token_urlsafe(24)
    with transacao() as tx:
        cod = _codigo_novo(tx)
        agora = time.time()
        tx.execute("INSERT INTO jogos(codigo,modo,duracao,estado,criado,atualizado) VALUES (?,?,?,?,?,?)",
                   (cod, cfg["modo"], cfg["duracao"], json.dumps(estado, ensure_ascii=False), agora, agora))
        tx.execute("INSERT INTO jogadores(jogo,nome,papel,token,anfitriao,entrou,visto) VALUES (?,?,?,?,1,?,?)",
                   (cod, estado["jogador"]["nome"], "presidente", token, agora, agora))
    return jsonify({"ok": True, "codigo": cod, "token": token})


@bp.get("/jogos/<codigo>/resumo")
def resumo(codigo):
    row, estado = carregar_jogo(get_db(), codigo.upper())
    if not row:
        return erro("Partida não encontrada.", 404)
    m = estado["meta"]
    return jsonify({"ok": True, "modo": m["modo"], "rotulo": m["rotulo"], "encerrado": m["encerrado"],
                    "entidades": [{"cod": k, "nome": v["nome"]} for k, v in estado["diplomacia"]["entidades"].items()]})


@bp.post("/jogos/<codigo>/entrar")
def entrar(codigo):
    codigo = codigo.upper()
    d = request.get_json(silent=True) or {}
    nome, papel = _texto(d.get("nome"), 30), d.get("papel")
    if not nome:
        return erro("Informe seu nome.")
    if papel not in multiplayer.PAPEIS or papel == "presidente":
        return erro("Papel inválido.")
    with transacao() as db:
        row, estado = carregar_jogo(db, codigo)
        if not row:
            return erro("Partida não encontrada.", 404)
        if estado["meta"]["encerrado"]:
            return erro("Essa partida já terminou.")
        if papel == "governador" and estado["meta"]["modo"] == "governador":
            return erro("Em partidas Hard, entre como secretário, deputado ou governador de outro estado (líder).")
        extra = {}
        if papel == "lider":
            cod = d.get("pais")
            ent = estado["diplomacia"]["entidades"].get(cod)
            if not ent:
                return erro("Escolha um país (ou estado) válido.")
            if ent["jogador"]:
                return erro("Essa posição já foi escolhida por outro jogador.")
            ent["jogador"] = nome
            extra["pais"] = cod
            salvar_estado(db, codigo, estado)
        token = secrets.token_urlsafe(24)
        db.execute("INSERT INTO jogadores(jogo,nome,papel,extra,token,anfitriao,entrou,visto) VALUES (?,?,?,?,?,0,?,?)",
                   (codigo, nome, papel, json.dumps(extra), token, time.time(), time.time()))
    return jsonify({"ok": True, "token": token})


def _pacote(db, row, estado, jog):
    codigo = row["codigo"]
    agora = time.time()
    jogadores = [{"nome": r["nome"], "papel": r["papel"], "anfitriao": bool(r["anfitriao"]), "extra": json.loads(r["extra"]),
                  "online": agora - (r["visto"] or 0) < ONLINE_SEG}
                 for r in db.execute("SELECT * FROM jogadores WHERE jogo=? ORDER BY id", (codigo,))]
    mensagens = [dict(r) for r in db.execute("SELECT autor,papel,texto,ts FROM mensagens WHERE jogo=? ORDER BY id DESC LIMIT 40", (codigo,))][::-1]
    pedidos = []
    for r in db.execute("SELECT * FROM pedidos WHERE jogo=? ORDER BY id DESC LIMIT 25", (codigo,)):
        pedidos.append({"id": r["id"], "autor": r["autor"], "papel": r["papel"], "tipo": r["tipo"], "payload": json.loads(r["payload"]), "status": r["status"]})
    resp = {"ok": True, "codigo": codigo, "versao": row["versao"], "estado": estado, "derivados": visao.derivados(estado),
            "eu": {"nome": jog["nome"], "papel": jog["papel"], "anfitriao": bool(jog["anfitriao"]), "extra": json.loads(jog["extra"])},
            "jogadores": jogadores, "mensagens": mensagens, "pedidos": pedidos}
    return resp


ONLINE_SEG = 20  # sem sinal há mais que isso = offline


def _marcar_visto(db, jog):
    db.execute("UPDATE jogadores SET visto=? WHERE id=?", (time.time(), jog["id"]))


@bp.get("/jogos/<codigo>")
def obter(codigo):
    codigo = codigo.upper()
    db = get_db()
    jog = _jogador(db, codigo)
    row, estado = carregar_jogo(db, codigo)
    if not row:
        return erro("Partida não encontrada.", 404)
    if not jog:
        return erro("Entre na partida para jogar.", 401, precisa_entrar=True)
    _marcar_visto(db, jog)
    return jsonify(_pacote(db, row, estado, jog))


@bp.get("/jogos/<codigo>/sinal")
def sinal(codigo):
    """Sincronização leve do multiplayer: o cliente só baixa a partida inteira quando algo muda."""
    codigo = codigo.upper()
    db = get_db()
    jog = _jogador(db, codigo)
    if not jog:
        return erro("Não autorizado.", 401)
    _marcar_visto(db, jog)
    row = db.execute("SELECT versao FROM jogos WHERE codigo=?", (codigo,)).fetchone()
    if not row:
        return erro("Partida não encontrada.", 404)
    agora = time.time()
    j = db.execute("SELECT COUNT(*) n, SUM(CASE WHEN ? - visto < ? THEN 1 ELSE 0 END) on_ FROM jogadores WHERE jogo=?",
                   (agora, ONLINE_SEG, codigo)).fetchone()
    m = db.execute("SELECT COALESCE(MAX(id),0) FROM mensagens WHERE jogo=?", (codigo,)).fetchone()[0]
    p = db.execute("SELECT COALESCE(MAX(id),0), SUM(CASE WHEN status='pendente' THEN 1 ELSE 0 END) FROM pedidos WHERE jogo=?", (codigo,)).fetchone()
    return jsonify({"ok": True, "assinatura": f"{row['versao']}-{j['n']}-{j['on_'] or 0}-{m}-{p[0]}-{p[1] or 0}"})


@bp.post("/jogos/<codigo>/propostas/<int:pid>/responder")
def responder_proposta_lider(codigo, pid):
    """Líder estrangeiro (jogador) aceita ou rejeita uma proposta enviada pelo anfitrião."""
    codigo = codigo.upper()
    aceitar = bool((request.get_json(silent=True) or {}).get("aceitar"))
    with transacao() as db:
        jog = _jogador(db, codigo)
        row, estado = carregar_jogo(db, codigo)
        if not row or not jog:
            return erro("Não autorizado.", 401)
        pais = json.loads(jog["extra"]).get("pais")
        alvo = next((a for a in estado["diplomacia"].get("aguardando", []) if a["id"] == pid), None)
        if jog["papel"] != "lider" or not alvo or alvo["cod"] != pais:
            return erro("Essa proposta não é para você.", 403)
        ok, msg = diplomacia.resposta_lider(estado, pid, aceitar)
        salvar_estado(db, codigo, estado)
        row, _ = carregar_jogo(db, codigo)
        pacote = _pacote(db, row, estado, jog)
    pacote.update(ok=ok, msg=msg)
    return jsonify(pacote)


@bp.post("/jogos/<codigo>/acao")
def acao(codigo):
    codigo = codigo.upper()
    d = request.get_json(silent=True) or {}
    with transacao() as db:
        jog = _jogador(db, codigo)
        row, estado = carregar_jogo(db, codigo)
        if not row:
            return erro("Partida não encontrada.", 404)
        if not jog:
            return erro("Não autorizado.", 401)
        if not jog["anfitriao"]:
            return erro("Apenas o anfitrião (chefe do governo) executa ações de governo. Envie um pedido a ele.", 403)
        ok, msg = acoes.executar(estado, d.get("tipo"), d.get("params") or {})
        salvar_estado(db, codigo, estado)
        if estado["meta"]["encerrado"] and "relatorio" in estado:
            salvar_relatorio(db, codigo, estado["jogador"]["nome"], estado["meta"]["modo"], estado["meta"]["duracao"], estado["relatorio"])
        row, _ = carregar_jogo(db, codigo)
        pacote = _pacote(db, row, estado, jog)
    pacote.update(ok=ok, msg=msg)
    return jsonify(pacote)


@bp.post("/jogos/<codigo>/mensagem")
def mensagem(codigo):
    codigo = codigo.upper()
    texto = _texto((request.get_json(silent=True) or {}).get("texto"), 300)
    db = get_db()
    jog = _jogador(db, codigo)
    if not jog:
        return erro("Não autorizado.", 401)
    if not texto:
        return erro("Mensagem vazia.")
    db.execute("INSERT INTO mensagens(jogo,autor,papel,texto,ts) VALUES (?,?,?,?,?)", (codigo, jog["nome"], jog["papel"], texto, time.time()))
    return jsonify({"ok": True})


@bp.post("/jogos/<codigo>/pedidos")
def criar_pedido(codigo):
    codigo = codigo.upper()
    d = request.get_json(silent=True) or {}
    db = get_db()
    jog = _jogador(db, codigo)
    if not jog:
        return erro("Não autorizado.", 401)
    payload = d.get("payload") or {}
    tipo = d.get("tipo")
    msg = multiplayer.validar(jog["papel"], tipo, payload)
    if msg:
        return erro(msg)
    if tipo == "acordo":
        extra = json.loads(jog["extra"])
        payload = {"pais": extra.get("pais"), "acao": payload.get("acao") if payload.get("acao") in ("tratado", "alianca", "sancionar", "melhorar") else "tratado"}
    elif tipo == "reuniao":
        extra = json.loads(jog["extra"])
        payload = {"pais": extra.get("pais"), "pauta": payload["pauta"], "proposta": payload["proposta"]}
    elif tipo == "orcamento":
        payload = {"setor": payload.get("setor") if payload.get("setor") in SETORES else "saude"}
    else:
        payload = {"valor": float(payload["valor"])}
    db.execute("INSERT INTO pedidos(jogo,autor,papel,tipo,payload,ts) VALUES (?,?,?,?,?,?)",
               (codigo, jog["nome"], jog["papel"], tipo, json.dumps(payload), time.time()))
    return jsonify({"ok": True})


@bp.post("/jogos/<codigo>/pedidos/<int:pid>/decidir")
def decidir_pedido(codigo, pid):
    codigo = codigo.upper()
    aprovar = bool((request.get_json(silent=True) or {}).get("aprovar"))
    with transacao() as db:
        jog = _jogador(db, codigo)
        row, estado = carregar_jogo(db, codigo)
        if not row or not jog:
            return erro("Não autorizado.", 401)
        if not jog["anfitriao"]:
            return erro("Apenas o anfitrião decide pedidos.", 403)
        ped = db.execute("SELECT * FROM pedidos WHERE id=? AND jogo=? AND status='pendente'", (pid, codigo)).fetchone()
        if not ped:
            return erro("Pedido não encontrado.", 404)
        pedido = {"tipo": ped["tipo"], "autor": ped["autor"], "payload": json.loads(ped["payload"])}
        msg = multiplayer.aplicar(estado, pedido, random.Random(), aprovar)
        db.execute("UPDATE pedidos SET status=? WHERE id=?", ("aprovado" if aprovar else "negado", pid))
        salvar_estado(db, codigo, estado)
        row, _ = carregar_jogo(db, codigo)
        pacote = _pacote(db, row, estado, jog)
    pacote.update(ok=True, msg=msg)
    return jsonify(pacote)
