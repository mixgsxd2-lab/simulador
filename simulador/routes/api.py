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
from ..db import get_db, transacao, carregar_jogo, salvar_estado, salvar_relatorio, carregar_governos, salvar_governo, tocar
from ..engine.util import noticia
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
    db = get_db()
    row, estado = carregar_jogo(db, codigo.upper())
    if not row:
        return erro("Partida não encontrada.", 404)
    m = estado["meta"]
    ocupadas = [r["uf"] for r in db.execute("SELECT uf FROM governos WHERE jogo=?", (codigo.upper(),))]
    return jsonify({"ok": True, "modo": m["modo"], "rotulo": m["rotulo"], "encerrado": m["encerrado"],
                    "presidente": estado["jogador"]["nome"], "ufs_ocupadas": ocupadas,
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
        govs = carregar_governos(db, codigo)
        if papel == "governador":
            uf = d.get("uf")
            if uf not in ESTADOS_POR_UF:
                return erro("Escolha o estado que você vai governar.")
            if any(g["meta"]["uf"] == uf for g in govs.values()):
                return erro("Esse estado já tem um governador nesta sala.")
            sigla = d.get("partido") if d.get("partido") in {p["sigla"] for p in PARTIDOS} else GOVERNADORES[uf][1]
            ideologia = d.get("ideologia") if d.get("ideologia") in IDEOLOGIAS else "centrista"
            extra = {"uf": uf}
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
        cur = db.execute("INSERT INTO jogadores(jogo,nome,papel,extra,token,anfitriao,entrou,visto) VALUES (?,?,?,?,?,0,?,?)",
                         (codigo, nome, papel, json.dumps(extra), token, time.time(), time.time()))
        if papel == "governador":
            g = multiplayer.criar_governo(estado, nome, uf, sigla, ideologia, random.Random())
            for jid, outro in govs.items():  # os outros estados com jogador passam a ser decididos por ele
                ufo = outro["meta"]["uf"]
                if uf in outro["diplomacia"]["entidades"]:
                    outro["diplomacia"]["entidades"][uf]["jogador"] = nome
                    salvar_governo(db, codigo, jid, outro)
                if ufo in g["diplomacia"]["entidades"]:
                    g["diplomacia"]["entidades"][ufo]["jogador"] = outro["jogador"]["nome"]
            salvar_governo(db, codigo, cur.lastrowid, g)
            noticia(estado, f"{nome} ({sigla}) assumiu o governo de {g['meta']['rotulo']} e entrou na sala.", "info")
            salvar_estado(db, codigo, estado)
        tocar(db, codigo)
    return jsonify({"ok": True, "token": token})


ONLINE_SEG = 20  # sem sinal há mais que isso = offline


def _online(r, agora=None):
    return (agora or time.time()) - (r["visto"] or 0) < ONLINE_SEG


def _jogo_encerrado(r, pres, govs):
    if r["anfitriao"]:
        return pres["meta"]["encerrado"]
    g = govs.get(r["id"])
    return g["meta"]["encerrado"] if g else False


def _prontidao(db, codigo, pres, govs):
    """Quem precisa clicar em Pronto: todos os jogadores online cuja partida não terminou."""
    agora = time.time()
    rows = db.execute("SELECT * FROM jogadores WHERE jogo=? ORDER BY id", (codigo,)).fetchall()
    obrig = [r for r in rows if _online(r, agora) and not _jogo_encerrado(r, pres, govs)]
    return rows, obrig


def _talvez_avancar(db, codigo, forcar=False):
    """Avança o trimestre de todos quando todos os jogadores online estão prontos (ou o anfitrião força)."""
    row, pres = carregar_jogo(db, codigo)
    govs = carregar_governos(db, codigo)
    rows, obrig = _prontidao(db, codigo, pres, govs)
    if not forcar and (not obrig or any(not r["pronto"] for r in obrig)):
        return None
    if pres["meta"]["encerrado"] and all(g["meta"]["encerrado"] for g in govs.values()):
        return None
    ja_encerrado = pres["meta"]["encerrado"]
    msg = multiplayer.avancar_todos(pres, list(govs.values()), random.Random())
    salvar_estado(db, codigo, pres)
    for jid, g in govs.items():
        salvar_governo(db, codigo, jid, g)
    if pres["meta"]["encerrado"] and not ja_encerrado and "relatorio" in pres:
        salvar_relatorio(db, codigo, pres["jogador"]["nome"], pres["meta"]["modo"], pres["meta"]["duracao"], pres["relatorio"])
    db.execute("UPDATE jogadores SET pronto=0 WHERE jogo=?", (codigo,))
    m = pres["meta"]
    return msg if len(rows) == 1 else f"Todos prontos: começa o {m['trimestre']}º trimestre de {m['ano']}."


def _propostas_para(jog, pres, govs):
    """Propostas de acordo aguardando a resposta deste jogador (líder estrangeiro ou governador)."""
    out = []
    if jog["papel"] == "lider":
        pais = json.loads(jog["extra"]).get("pais")
        out += [{**a, "origem": None, "de": pres["jogador"]["nome"]} for a in pres["diplomacia"].get("aguardando", []) if a["cod"] == pais]
    meu = govs.get(jog["id"])
    if meu:
        uf = meu["meta"]["uf"]
        for jid, g in govs.items():
            if jid != jog["id"]:
                out += [{**a, "origem": jid, "de": f"{g['jogador']['nome']} ({g['meta']['rotulo']})"}
                        for a in g["diplomacia"].get("aguardando", []) if a["cod"] == uf]
    return out


def _pacote(db, row, estado, jog):
    codigo = row["codigo"]
    govs = carregar_governos(db, codigo)
    rows, obrig = _prontidao(db, codigo, estado, govs)
    agora = time.time()
    jogadores = [{"id": r["id"], "nome": r["nome"], "papel": r["papel"], "anfitriao": bool(r["anfitriao"]), "extra": json.loads(r["extra"]),
                  "online": _online(r, agora), "pronto": bool(r["pronto"]), "governo": r["id"] in govs}
                 for r in rows]
    mensagens = [dict(r) for r in db.execute("SELECT autor,papel,texto,ts FROM mensagens WHERE jogo=? ORDER BY id DESC LIMIT 40", (codigo,))][::-1]
    pedidos = []
    for r in db.execute("SELECT * FROM pedidos WHERE jogo=? ORDER BY id DESC LIMIT 30", (codigo,)):
        pedidos.append({"id": r["id"], "autor": r["autor"], "autor_id": r["autor_id"], "destino": r["destino"], "papel": r["papel"],
                        "tipo": r["tipo"], "nome": multiplayer.NOMES_PEDIDO.get(r["tipo"], r["tipo"]),
                        "payload": json.loads(r["payload"]), "status": r["status"]})
    meu = govs.get(jog["id"])
    visivel = meu or estado  # o governador joga a própria partida estadual
    mp = {"presidente": multiplayer.resumo_presidente(estado),
          "governadores": [multiplayer.resumo_governo(jid, g) for jid, g in govs.items()],
          "pronto": {"total": len(obrig), "prontos": sum(1 for r in obrig if r["pronto"]),
                     "faltam": [r["nome"] for r in obrig if not r["pronto"]]},
          "propostas_para_mim": _propostas_para(jog, estado, govs)}
    return {"ok": True, "codigo": codigo, "versao": row["versao"], "estado": visivel, "derivados": visao.derivados(visivel),
            "eu": {"id": jog["id"], "nome": jog["nome"], "papel": jog["papel"], "anfitriao": bool(jog["anfitriao"]),
                   "extra": json.loads(jog["extra"]), "pronto": bool(jog["pronto"]), "governa": bool(jog["anfitriao"] or meu)},
            "jogadores": jogadores, "mensagens": mensagens, "pedidos": pedidos, "mp": mp}


def _marcar_visto(db, jog):
    db.execute("UPDATE jogadores SET visto=? WHERE id=?", (time.time(), jog["id"]))


def _resposta(db, codigo, jog, **extra):
    row, estado = carregar_jogo(db, codigo)
    jog = db.execute("SELECT * FROM jogadores WHERE id=?", (jog["id"],)).fetchone()
    pacote = _pacote(db, row, estado, jog)
    pacote.update(extra)
    return jsonify(pacote)


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
    """Sincronização leve do multiplayer: o cliente só baixa a partida inteira quando algo muda.
    Também avança o trimestre se os que ainda faltavam ficaram offline."""
    codigo = codigo.upper()
    db = get_db()
    jog = _jogador(db, codigo)
    if not jog:
        return erro("Não autorizado.", 401)
    _marcar_visto(db, jog)
    if db.execute("SELECT 1 FROM jogadores WHERE jogo=? AND pronto=1", (codigo,)).fetchone():
        with transacao() as tx:
            _talvez_avancar(tx, codigo)
    row = db.execute("SELECT versao FROM jogos WHERE codigo=?", (codigo,)).fetchone()
    if not row:
        return erro("Partida não encontrada.", 404)
    agora = time.time()
    j = db.execute("SELECT COUNT(*) n, SUM(CASE WHEN ? - visto < ? THEN 1 ELSE 0 END) on_, SUM(pronto) pr FROM jogadores WHERE jogo=?",
                   (agora, ONLINE_SEG, codigo)).fetchone()
    m = db.execute("SELECT COALESCE(MAX(id),0) FROM mensagens WHERE jogo=?", (codigo,)).fetchone()[0]
    p = db.execute("SELECT COALESCE(MAX(id),0), SUM(CASE WHEN status='pendente' THEN 1 ELSE 0 END) FROM pedidos WHERE jogo=?", (codigo,)).fetchone()
    return jsonify({"ok": True, "assinatura": f"{row['versao']}-{j['n']}-{j['on_'] or 0}-{j['pr'] or 0}-{m}-{p[0]}-{p[1] or 0}"})


@bp.post("/jogos/<codigo>/pronto")
def pronto(codigo):
    """Marca (ou desmarca) o jogador como pronto. Quando todos os online estão prontos, o trimestre avança.
    O anfitrião pode forçar o avanço com {"forcar": true}."""
    codigo = codigo.upper()
    d = request.get_json(silent=True) or {}
    with transacao() as db:
        jog = _jogador(db, codigo)
        row, estado = carregar_jogo(db, codigo)
        if not row or not jog:
            return erro("Não autorizado.", 401)
        _marcar_visto(db, jog)
        if d.get("forcar"):
            if not jog["anfitriao"]:
                return erro("Só o presidente (anfitrião) pode forçar o avanço.", 403)
            msg = _talvez_avancar(db, codigo, forcar=True) or "Nada para avançar."
            return _resposta(db, codigo, jog, ok=True, msg=msg)
        quer = bool(d.get("pronto", True))
        meu = carregar_governos(db, codigo).get(jog["id"]) or (estado if jog["anfitriao"] else None)
        if quer and meu is not None:
            if meu["meta"]["encerrado"]:
                return erro("Sua partida já terminou.")
            if meu["evento"]:
                return erro("Responda ao evento pendente antes de ficar pronto.")
        db.execute("UPDATE jogadores SET pronto=? WHERE id=?", (int(quer), jog["id"]))
        msg = _talvez_avancar(db, codigo) if quer else None
        if not msg:
            msg = "Você está pronto. Aguardando os outros jogadores…" if quer else "Você não está mais pronto."
            tocar(db, codigo)
        return _resposta(db, codigo, jog, ok=True, msg=msg)


@bp.post("/jogos/<codigo>/propostas/<int:pid>/responder")
def responder_proposta(codigo, pid):
    """Um jogador (líder estrangeiro ou governador) aceita ou rejeita uma proposta de acordo feita a ele."""
    codigo = codigo.upper()
    d = request.get_json(silent=True) or {}
    aceitar = bool(d.get("aceitar"))
    with transacao() as db:
        jog = _jogador(db, codigo)
        row, estado = carregar_jogo(db, codigo)
        if not row or not jog:
            return erro("Não autorizado.", 401)
        govs = carregar_governos(db, codigo)
        origem = d.get("origem")
        if origem is None:  # proposta do presidente a um líder estrangeiro
            pais = json.loads(jog["extra"]).get("pais")
            alvo = next((a for a in estado["diplomacia"].get("aguardando", []) if a["id"] == pid), None)
            if jog["papel"] != "lider" or not alvo or alvo["cod"] != pais:
                return erro("Essa proposta não é para você.", 403)
            ok, msg = diplomacia.resposta_lider(estado, pid, aceitar)
            salvar_estado(db, codigo, estado)
        else:  # proposta de outro governador (consórcio entre estados)
            try:
                origem = int(origem)
            except (TypeError, ValueError):
                return erro("Origem inválida.")
            meu, g = govs.get(jog["id"]), govs.get(origem)
            alvo = g and next((a for a in g["diplomacia"].get("aguardando", []) if a["id"] == pid), None)
            if not meu or not alvo or alvo["cod"] != meu["meta"]["uf"]:
                return erro("Essa proposta não é para você.", 403)
            ok, msg = diplomacia.resposta_lider(g, pid, aceitar)
            if ok and aceitar:  # o acordo vale para os dois estados
                x = meu["diplomacia"]["entidades"].get(g["meta"]["uf"])
                if x and not diplomacia.proposta_valida(meu, x, alvo["pauta"], alvo["proposta"])[1]:
                    diplomacia._assinar(meu, x, alvo["pauta"], alvo["proposta"], "consorcio")
                noticia(meu, msg, "bom")
            salvar_governo(db, codigo, origem, g)
            salvar_governo(db, codigo, jog["id"], meu)
        tocar(db, codigo)
        return _resposta(db, codigo, jog, ok=ok, msg=msg)


@bp.post("/jogos/<codigo>/acao")
def acao(codigo):
    codigo = codigo.upper()
    d = request.get_json(silent=True) or {}
    tipo = d.get("tipo")
    with transacao() as db:
        jog = _jogador(db, codigo)
        row, estado = carregar_jogo(db, codigo)
        if not row:
            return erro("Partida não encontrada.", 404)
        if not jog:
            return erro("Não autorizado.", 401)
        meu = carregar_governos(db, codigo).get(jog["id"])
        if not jog["anfitriao"] and not meu:
            return erro("Apenas o presidente e os governadores governam. Envie um pedido ao presidente.", 403)
        if tipo == "avancar_turno":
            return erro("Use o botão Pronto: o trimestre avança quando todos os jogadores online estiverem prontos.")
        alvo = meu if meu else estado
        ok, msg = acoes.executar(alvo, tipo, d.get("params") or {})
        if meu:
            salvar_governo(db, codigo, jog["id"], meu)
            tocar(db, codigo)
        else:
            salvar_estado(db, codigo, estado)
            if estado["meta"]["encerrado"] and "relatorio" in estado:
                salvar_relatorio(db, codigo, estado["jogador"]["nome"], estado["meta"]["modo"], estado["meta"]["duracao"], estado["relatorio"])
        if alvo["meta"]["encerrado"]:  # quem terminou deixa de bloquear o avanço dos outros
            _talvez_avancar(db, codigo)
        return _resposta(db, codigo, jog, ok=ok, msg=msg)


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
    with transacao() as db:
        jog = _jogador(db, codigo)
        if not jog:
            return erro("Não autorizado.", 401)
        row, estado = carregar_jogo(db, codigo)
        payload = d.get("payload") or {}
        tipo = d.get("tipo")
        papel = "presidente" if jog["anfitriao"] else jog["papel"]
        msg = multiplayer.validar(papel, tipo, payload)
        if msg:
            return erro(msg)
        govs = carregar_governos(db, codigo)
        destino = None
        if papel == "presidente":  # o presidente se dirige a um governador
            try:
                destino = int(payload.get("governador"))
            except (TypeError, ValueError):
                destino = None
            if destino not in govs:
                return erro("Escolha um governador.")
            if govs[destino]["meta"]["encerrado"]:
                return erro("A partida desse governador já terminou.")
        elif estado["meta"]["encerrado"]:
            return erro("A partida do presidente já terminou.")
        extra = json.loads(jog["extra"])
        if tipo == "acordo":
            payload = {"pais": extra.get("pais"), "acao": payload.get("acao") if payload.get("acao") in ("tratado", "alianca", "sancionar", "melhorar") else "tratado"}
        elif tipo == "reuniao":
            payload = {"pais": extra.get("pais"), "pauta": payload["pauta"], "proposta": payload["proposta"]}
        elif tipo in ("orcamento", "obra"):
            payload = {"setor": payload["setor"] if payload.get("setor") in SETORES else "saude"}
        elif tipo == "convenio":
            payload = {"setor": payload["setor"], "valor": float(payload["valor"])}
        elif tipo in ("forca_nacional", "apoio_politico", "pede_apoio"):
            payload = {}
        else:
            payload = {"valor": float(payload["valor"])}
        if govs.get(jog["id"]):
            payload["uf"] = govs[jog["id"]]["meta"]["uf"]
        if destino:
            payload["uf"] = govs[destino]["meta"]["uf"]
        if tipo == "verba":  # verba do presidente: vale na hora, sem precisar de aceite
            gov = govs[destino]
            msg = multiplayer.aplicar(estado, {"tipo": tipo, "autor": gov["jogador"]["nome"], "payload": payload}, random.Random(), True, gov)
            salvar_estado(db, codigo, estado)
            salvar_governo(db, codigo, destino, gov)
            status = "aprovado"
        else:
            msg, status = "Pedido enviado.", "pendente"
        db.execute("INSERT INTO pedidos(jogo,autor,autor_id,destino,papel,tipo,payload,status,ts) VALUES (?,?,?,?,?,?,?,?,?)",
                   (codigo, jog["nome"], jog["id"], destino, papel, tipo, json.dumps(payload), status, time.time()))
        tocar(db, codigo)
        return _resposta(db, codigo, jog, ok=True, msg=msg)


@bp.post("/jogos/<codigo>/pedidos/<int:pid>/decidir")
def decidir_pedido(codigo, pid):
    codigo = codigo.upper()
    aprovar = bool((request.get_json(silent=True) or {}).get("aprovar"))
    with transacao() as db:
        jog = _jogador(db, codigo)
        row, estado = carregar_jogo(db, codigo)
        if not row or not jog:
            return erro("Não autorizado.", 401)
        ped = db.execute("SELECT * FROM pedidos WHERE id=? AND jogo=? AND status='pendente'", (pid, codigo)).fetchone()
        if not ped:
            return erro("Pedido não encontrado.", 404)
        decide = jog["id"] == ped["destino"] if ped["destino"] else bool(jog["anfitriao"])
        if not decide:
            return erro("Esse pedido não é para você.", 403)
        govs = carregar_governos(db, codigo)
        gid = ped["destino"] or ped["autor_id"]
        gov = govs.get(gid)
        nome = gov["jogador"]["nome"] if gov and ped["destino"] else ped["autor"]
        pedido = {"tipo": ped["tipo"], "autor": nome, "payload": json.loads(ped["payload"])}
        msg = multiplayer.aplicar(estado, pedido, random.Random(), aprovar, gov)
        db.execute("UPDATE pedidos SET status=? WHERE id=?", ("aprovado" if aprovar else "negado", pid))
        salvar_estado(db, codigo, estado)
        if gov:
            salvar_governo(db, codigo, gid, gov)
        return _resposta(db, codigo, jog, ok=True, msg=msg)
