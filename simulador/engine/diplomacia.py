"""Diplomacia: relações, tratados, alianças, sanções, ONU e guerras (modo presidente);
relações federativas (modo governador)."""
from ..data.geo import PAISES, ESTADOS, PAISES_POR_COD
from ..data.historia import GOVERNADORES
from .util import clamp, aplicar_efeitos, noticia, gastar_ou_receber


def montar(rng, estado_modo, uf=None):
    if estado_modo == "presidente":
        ent = {p["cod"]: {"cod": p["cod"], "nome": p["nome"], "rel": clamp(p["rel"] + rng.uniform(-6, 6), 15, 90), "tratado": False,
                          "alianca": False, "sancao": False, "guerra": False, "militar": p["militar"], "pib": p["pib"],
                          "regime": p["regime"], "bloco": p["bloco"], "jogador": None}
               for p in PAISES if p["cod"] != "BRA"}
    else:
        ent = {e["uf"]: {"cod": e["uf"], "nome": e["nome"], "rel": clamp(50 + rng.uniform(-12, 12), 20, 80), "tratado": False,
                         "alianca": False, "sancao": False, "guerra": False, "militar": 0, "pib": e["pib"], "regime": "", "bloco": e["regiao"], "jogador": None,
                         "lider": "{} ({})".format(*GOVERNADORES[e["uf"]])}
               for e in ESTADOS if e["uf"] != uf}
    return {"entidades": ent, "onu": 50.0, "militar": 55.0, "guerras": [], "assento_conselho": False,
            "acordos": [], "reunioes": [], "propostas": [], "aguardando": [], "seq": 0}


def passo(estado, rng):
    d = estado["diplomacia"]
    est = estado["meta"]["escopo"] == "estadual"
    for x in d["entidades"].values():
        alvo = 50
        if x["alianca"]:
            alvo = 85
        elif x["tratado"]:
            alvo = 68
        if x["sancao"]:
            alvo = 15
        if x["guerra"]:
            alvo = 5
        x["rel"] = round(clamp(x["rel"] + (alvo - x["rel"]) * 0.06 + rng.uniform(-1.5, 1.5), 0, 100), 2)
    passo_acordos(estado, rng)
    if est:
        return
    d["onu"] = round(clamp(d["onu"] + (50 - d["onu"]) * 0.04 + (4 if d["assento_conselho"] else 0) * 0.1 + rng.uniform(-1, 1), 0, 100), 2)
    for g in list(d["guerras"]):
        _passo_guerra(estado, g, rng)


def _passo_guerra(estado, g, rng):
    d = estado["diplomacia"]
    inimigo = d["entidades"][g["cod"]]
    aliados = sum(1 for x in d["entidades"].values() if x["alianca"] and not x["guerra"]) * 1.5
    g["progresso"] = round(clamp(g["progresso"] + (d["militar"] - inimigo["militar"]) * 0.25 + aliados + rng.uniform(-9, 9), -100, 100), 1)
    g["turnos"] += 1
    gastar_ou_receber(estado, -(12 + g["turnos"] * 1.5))
    aplicar_efeitos(estado, {"popularidade": -1.2, "economia.confianca": -1.5, "sociedade.protestos": 1.5})
    if g["progresso"] >= 100:
        noticia(estado, f"Vitória na guerra contra {inimigo['nome']}! O país comemora.", "bom")
        aplicar_efeitos(estado, {"popularidade": 10, "economia.caixa": 30})
        _encerrar(estado, g, 12)
    elif g["progresso"] <= -100:
        noticia(estado, f"Derrota na guerra contra {inimigo['nome']}. Crise nacional.", "ruim")
        aplicar_efeitos(estado, {"popularidade": -18, "economia.confianca": -15, "sociedade.protestos": 15})
        _encerrar(estado, g, 10)


def _encerrar(estado, g, rel_final):
    d = estado["diplomacia"]
    d["entidades"][g["cod"]]["guerra"] = False
    d["entidades"][g["cod"]]["rel"] = rel_final
    d["guerras"] = [w for w in d["guerras"] if w is not g and w["cod"] != g["cod"]]
    d.setdefault("historico_guerras", []).append({"cod": g["cod"], "progresso": g["progresso"], "turnos": g["turnos"]})


def acao(estado, ac, alvo, rng, extra=None):
    """Executa ação diplomática. Retorna (ok, mensagem). Custos de capital são tratados pelo chamador."""
    d = estado["diplomacia"]
    est = estado["meta"]["escopo"] == "estadual"
    x = d["entidades"].get(alvo) if alvo else None
    if ac in ("onu_resolucao", "onu_missao", "onu_conselho"):
        return _onu(estado, ac, rng)
    if x is None:
        return False, "Alvo inválido."
    nome = x["nome"]
    if ac == "melhorar":
        gastar_ou_receber(estado, -8)
        x["rel"] = round(clamp(x["rel"] + 8, 0, 100), 2)
        return True, f"Missão diplomática a {nome}: relação melhorou."
    if ac == "tratado":
        if x["rel"] < 55:
            return False, f"A relação com {nome} precisa ser de pelo menos 55."
        if x["tratado"]:
            return False, "Já existe tratado."
        x["tratado"] = True
        x["rel"] = round(clamp(x["rel"] + 6, 0, 100), 2)
        return True, ("Consórcio firmado com " if est else "Acordo comercial assinado com ") + nome + "."
    if est:
        return False, "Ação indisponível no modo governador."
    if ac == "alianca":
        if x["rel"] < 70:
            return False, f"A relação com {nome} precisa ser de pelo menos 70."
        x["alianca"] = True
        x["rel"] = round(clamp(x["rel"] + 8, 0, 100), 2)
        return True, f"Aliança formada com {nome}."
    if ac == "sancionar":
        x["sancao"] = True
        x["alianca"] = False
        x["rel"] = round(clamp(x["rel"] - 20, 0, 100), 2)
        aplicar_efeitos(estado, {"economia.choque": -0.1, "diplomacia.onu": 3 if x["regime"] == "autocracia" else -3})
        return True, f"Sanções impostas a {nome}."
    if ac == "retirar_sancao":
        x["sancao"] = False
        return True, f"Sanções contra {nome} retiradas."
    if ac == "declarar_guerra":
        if x["guerra"]:
            return False, "Já estamos em guerra."
        if d["militar"] < 30:
            return False, "Forças armadas despreparadas (poder militar < 30)."
        x["guerra"] = True
        x["alianca"] = False
        x["tratado"] = False
        x["rel"] = 5
        d["guerras"].append({"cod": alvo, "progresso": 0, "turnos": 0, "agressor": "nos"})
        aplicar_efeitos(estado, {"diplomacia.onu": -15, "popularidade": 5, "economia.confianca": -5})
        for o in d["entidades"].values():
            if o["alianca"] and o["bloco"] == x["bloco"] and o is not x:
                o["rel"] = round(clamp(o["rel"] - 15, 0, 100), 2)
        return True, f"GUERRA declarada contra {nome}!"
    if ac == "paz":
        g = next((w for w in d["guerras"] if w["cod"] == alvo), None)
        if not g:
            return False, "Não há guerra com esse país."
        if rng.random() < clamp(0.35 + g["progresso"] / 200 + d["onu"] / 400, 0.1, 0.9):
            noticia(estado, f"Cessar-fogo com {nome}. Fim da guerra.", "bom")
            aplicar_efeitos(estado, {"diplomacia.onu": 6, "popularidade": 1 if g["progresso"] > -30 else -4})
            _encerrar(estado, g, 30)
            return True, f"Paz negociada com {nome}."
        return False, f"{nome} recusou o cessar-fogo."
    return False, "Ação desconhecida."


def _onu(estado, ac, rng):
    d = estado["diplomacia"]
    if ac == "onu_resolucao":
        media = sum(x["rel"] for x in d["entidades"].values()) / len(d["entidades"])
        if rng.random() < clamp((d["onu"] + media) / 200 + 0.1, 0.1, 0.9):
            aplicar_efeitos(estado, {"diplomacia.onu": 3, "popularidade": 1})
            return True, "Resolução proposta pelo Brasil foi aprovada na ONU."
        aplicar_efeitos(estado, {"diplomacia.onu": -2})
        return True, "A resolução brasileira foi rejeitada na Assembleia Geral."
    if ac == "onu_missao":
        gastar_ou_receber(estado, -10)
        aplicar_efeitos(estado, {"diplomacia.onu": 6, "popularidade": 0.5})
        return True, "Missão de paz enviada. Prestígio internacional em alta."
    if d["assento_conselho"]:
        return False, "O Brasil já tem assento no Conselho de Segurança."
    if d["onu"] < 70:
        return False, "Prestígio na ONU precisa ser de pelo menos 70."
    if rng.random() < (d["onu"] - 50) / 60:
        d["assento_conselho"] = True
        aplicar_efeitos(estado, {"popularidade": 5, "diplomacia.onu": 8})
        return True, "O Brasil conquistou assento no Conselho de Segurança da ONU!"
    return True, "A candidatura ao Conselho de Segurança não avançou."


# =====================================================================================
# Reuniões diplomáticas, pautas, acordos e propostas (aceitas ou rejeitadas pelos países)
# =====================================================================================
# Formatos de reunião. "capital" e "custo" (R$ bi) são pagos por quem convoca; "bonus" soma à chance de acordo.
FORMATOS = {
    "telefonema": {"nome": "Telefonema", "desc": "Conversa rápida entre chefes de governo.", "capital": 1, "custo": 0, "bonus": -0.05, "rel": 2},
    "chanceleres": {"nome": "Reunião de chanceleres", "desc": "Seu ministro das Relações Exteriores negocia com o representante estrangeiro.", "capital": 1, "custo": 2, "bonus": 0.0, "rel": 3},
    "cupula": {"nome": "Cúpula presidencial", "desc": "Encontro entre os chefes de Estado.", "capital": 2, "custo": 5, "bonus": 0.08, "rel": 5},
    "visita": {"nome": "Visita de Estado", "desc": "Viagem oficial com comitiva e grande repercussão.", "capital": 3, "custo": 15, "bonus": 0.15, "rel": 8},
}

CONCESSOES = {
    "nenhuma": {"nome": "Sem concessões", "bonus": 0.0, "custo": 0, "efeitos": {}},
    "moderada": {"nome": "Concessões moderadas", "bonus": 0.10, "custo": 10, "efeitos": {}},
    "generosa": {"nome": "Concessões generosas", "bonus": 0.20, "custo": 30, "efeitos": {"popularidade": -1}},
}

# Pautas e propostas de acordo. "dif" reduz a chance de aceite; "imediato" aplica ao assinar; "tri" aplica a cada trimestre.
PAUTAS = {
    "economia": {"nome": "Economia e investimentos", "ico": "moedas", "propostas": {
        "investimentos": {"nome": "Acordo de proteção de investimentos", "dif": 0.0, "imediato": {"economia.confianca": 3}, "tri": {"economia.caixa": 3}},
        "financiamento": {"nome": "Linha de crédito para obras", "dif": 0.12, "min_pib": 1.0, "imediato": {"economia.caixa": 60, "setores.infraestrutura": 3}, "tri": {}},
        "moeda_local": {"nome": "Comércio em moeda local", "dif": 0.08, "escopos": ["nacional"], "imediato": {"economia.confianca": 1}, "tri": {"economia.cambio": -0.02}},
    }},
    "comercio": {"nome": "Comércio", "ico": "aperto", "propostas": {
        "livre_comercio": {"nome": "Acordo de livre comércio", "dif": 0.15, "tratado": True, "imediato": {"economia.tendencia": 0.1, "economia.confianca": 2}, "tri": {}},
        "tarifas": {"nome": "Redução recíproca de tarifas", "dif": 0.0, "imediato": {"economia.tendencia": 0.05}, "tri": {"economia.caixa": 2}},
        "agro": {"nome": "Abertura para o agronegócio brasileiro", "dif": 0.08, "imediato": {"economia.tendencia": 0.08, "popularidade": 0.5}, "tri": {}},
    }},
    "seguranca": {"nome": "Segurança e defesa", "ico": "escudo", "propostas": {
        "crime": {"nome": "Cooperação contra o crime organizado", "dif": 0.0, "imediato": {"setores.seguranca": 3}, "tri": {"setores.seguranca": 0.3}},
        "fronteiras": {"nome": "Controle conjunto de fronteiras", "dif": 0.05, "imediato": {"setores.seguranca": 2, "sociedade.protestos": -1}, "tri": {}},
        "defesa": {"nome": "Cooperação militar e exercícios conjuntos", "dif": 0.12, "escopos": ["nacional"], "imediato": {"diplomacia.militar": 4}, "tri": {}},
    }},
    "meio_ambiente": {"nome": "Meio ambiente", "ico": "folha", "propostas": {
        "clima": {"nome": "Compromisso climático conjunto", "dif": 0.0, "imediato": {"diplomacia.onu": 3, "setores.meio_ambiente": 2}, "tri": {}},
        "fundo_amazonia": {"nome": "Doação ao Fundo Amazônia", "dif": 0.15, "min_pib": 1.5, "escopos": ["nacional"], "imediato": {"economia.caixa": 30, "setores.meio_ambiente": 5}, "tri": {}},
        "energia_limpa": {"nome": "Parceria em energia limpa", "dif": 0.05, "imediato": {"setores.infraestrutura": 2, "setores.meio_ambiente": 2, "economia.tendencia": 0.05}, "tri": {}},
    }},
}

# Interesse de cada bloco por pauta (soma à chance de aceite).
INTERESSE = {
    "Mercosul": {"comercio": 0.15, "seguranca": 0.10, "economia": 0.05},
    "América Latina": {"comercio": 0.10, "seguranca": 0.10},
    "União Europeia": {"meio_ambiente": 0.15, "economia": 0.05, "comercio": -0.05},
    "União Europeia / CPLP": {"meio_ambiente": 0.10, "economia": 0.10, "comercio": 0.05},
    "Ocidente": {"meio_ambiente": 0.10, "economia": 0.10, "seguranca": 0.05},
    "BRICS": {"economia": 0.15, "comercio": 0.10, "meio_ambiente": -0.05},
    "Ásia": {"comercio": 0.10, "economia": 0.10},
    "Oriente Médio": {"economia": 0.10, "meio_ambiente": -0.10},
    "África": {"economia": 0.10, "seguranca": 0.05},
    "Eurásia": {"comercio": 0.05},
    "Leste Europeu": {"seguranca": 0.10},
}

CONTRAPARTIDAS = [
    None,
    {"txt": "pede uma contrapartida de R$ 10 bi", "efeitos": {"economia.caixa": -10}},
    {"txt": "pede redução de 1 ponto na tarifa de importação", "efeitos": {"impostos.importacao": -1}},
    {"txt": "pede apoio em votação na ONU (custo de imagem)", "efeitos": {"sociedade.midia": -2}},
]


def _d(estado):
    d = estado["diplomacia"]
    d.setdefault("acordos", [])
    d.setdefault("reunioes", [])
    d.setdefault("propostas", [])     # propostas recebidas de outros países (o jogador aceita ou rejeita)
    d.setdefault("aguardando", [])    # propostas do jogador aguardando um líder humano (multiplayer)
    d.setdefault("seq", 0)
    return d


def _novo_id(d):
    d["seq"] += 1
    return d["seq"]


def proposta_valida(estado, x, pauta, prop_id):
    """Retorna (proposta, erro)."""
    pa = PAUTAS.get(pauta)
    if not pa or prop_id not in pa["propostas"]:
        return None, "Pauta ou proposta inválida."
    prop = pa["propostas"][prop_id]
    if estado["meta"]["escopo"] not in prop.get("escopos", ["nacional", "estadual"]):
        return None, "Proposta indisponível neste modo."
    if prop.get("min_pib") and estado["meta"]["escopo"] == "nacional" and x["pib"] < prop["min_pib"]:
        return None, f"{x['nome']} não tem economia grande o bastante para essa proposta."
    if any(a["cod"] == x["cod"] and a["proposta"] == prop_id for a in _d(estado)["acordos"]):
        return None, "Esse acordo já está em vigor."
    return prop, None


def chance_base(estado, cod):
    """Parte da chance de aceite que depende só do país (o cliente soma pauta, formato, concessão e dificuldade)."""
    d = _d(estado)
    x = d["entidades"][cod]
    if x["guerra"]:
        return -1.0
    m = estado["ministros"].get("relacoes_exteriores")
    comp = m["competencia"] if m else 40
    turno = estado["meta"]["turno"]
    recusas = sum(1 for r in d["reunioes"] if r["cod"] == cod and r.get("aceito") is False and turno - r["turno"] < 3)
    b = 0.15 + (x["rel"] - 50) / 100 * 1.2 + (d["onu"] - 50) / 250 + (comp - 50) / 300 - recusas * 0.08
    if x["sancao"]:
        b -= 0.5
    return round(b, 3)


def chance(estado, cod, formato, pauta, prop_id, concessao="nenhuma"):
    x = _d(estado)["entidades"][cod]
    base = chance_base(estado, cod)
    if base <= -1:
        return 0.0
    prop = PAUTAS[pauta]["propostas"][prop_id]
    c = (base + INTERESSE.get(x["bloco"], {}).get(pauta, 0) + FORMATOS[formato]["bonus"]
         + CONCESSOES[concessao]["bonus"] - prop["dif"])
    return round(clamp(c, 0.03, 0.95), 3)


def _assinar(estado, x, pauta, prop_id, origem):
    d = _d(estado)
    prop = PAUTAS[pauta]["propostas"][prop_id]
    acordo = {"id": _novo_id(d), "cod": x["cod"], "pais": x["nome"], "pauta": pauta, "proposta": prop_id, "nome": prop["nome"],
              "turno": estado["meta"]["turno"], "ano": estado["meta"]["ano"], "origem": origem}
    d["acordos"].append(acordo)
    aplicar_efeitos(estado, prop["imediato"])
    if prop.get("tratado"):
        x["tratado"] = True
    x["rel"] = round(clamp(x["rel"] + 4, 0, 100), 2)
    return acordo


def reuniao(estado, cod, formato, pauta=None, prop_id=None, concessao="nenhuma", rng=None):
    """Reunião bilateral convocada pelo jogador. Retorna (ok, msg, resultado). Custos de capital: chamador."""
    d = _d(estado)
    x = d["entidades"].get(cod)
    if not x:
        return False, "País inválido.", None
    if formato not in FORMATOS:
        return False, "Formato de reunião inválido.", None
    if concessao not in CONCESSOES:
        concessao = "nenhuma"
    if x["guerra"]:
        return False, f"Estamos em guerra com {x['nome']}: negocie a paz primeiro.", None
    turno = estado["meta"]["turno"]
    if any(r["cod"] == cod and r["turno"] == turno for r in d["reunioes"]):
        return False, f"Já houve uma reunião com {x['nome']} neste trimestre.", None
    prop = None
    if pauta or prop_id:
        prop, erro = proposta_valida(estado, x, pauta, prop_id)
        if erro:
            return False, erro, None
    f = FORMATOS[formato]
    gastar_ou_receber(estado, -(f["custo"] + (CONCESSOES[concessao]["custo"] if prop else 0)))
    if formato == "visita":
        aplicar_efeitos(estado, {"popularidade": 1, "sociedade.midia": 1})
    x["rel"] = round(clamp(x["rel"] + f["rel"], 0, 100), 2)
    reg = {"cod": cod, "pais": x["nome"], "formato": formato, "pauta": pauta, "proposta": prop_id, "turno": turno,
           "ano": estado["meta"]["ano"], "tri": estado["meta"]["trimestre"], "aceito": None}
    d["reunioes"].insert(0, reg)
    del d["reunioes"][30:]
    if not prop:
        msg = f"{f['nome']} com {x['nome']}: as relações melhoraram."
        noticia(estado, msg, "info")
        return True, msg, reg
    if x.get("jogador"):  # país controlado por outro jogador: ele decide
        d["aguardando"].append({"id": _novo_id(d), "cod": cod, "pauta": pauta, "proposta": prop_id, "nome": prop["nome"],
                                "formato": formato, "concessao": concessao, "turno": turno})
        reg["aceito"] = None
        msg = f"Proposta '{prop['nome']}' enviada a {x['jogador']} ({x['nome']}). Aguardando resposta."
        noticia(estado, msg, "info")
        return True, msg, reg
    aplicar_efeitos(estado, CONCESSOES[concessao]["efeitos"])
    p = chance(estado, cod, formato, pauta, prop_id, concessao)
    reg["chance"] = p
    rng = rng or __import__("random").Random()
    if rng.random() < p:
        _assinar(estado, x, pauta, prop_id, "reuniao")
        reg["aceito"] = True
        msg = f"{x['nome']} aceitou: '{prop['nome']}' assinado durante {f['nome'].lower()}."
        noticia(estado, msg, "bom")
        return True, msg, reg
    reg["aceito"] = False
    x["rel"] = round(clamp(x["rel"] - 2, 0, 100), 2)
    msg = f"{x['nome']} rejeitou a proposta '{prop['nome']}'."
    noticia(estado, msg, "ruim")
    return True, msg, reg


def cupula_bloco(estado, bloco, pauta, prop_id, rng):
    """Cúpula multilateral: cada membro do bloco aceita ou rejeita a proposta. Retorna (ok, msg)."""
    d = _d(estado)
    membros = [x for x in d["entidades"].values() if x["bloco"] == bloco and not x["guerra"]]
    if len(membros) < 2:
        return False, "Bloco inválido."
    if prop_id not in PAUTAS.get(pauta, {}).get("propostas", {}):
        return False, "Pauta ou proposta inválida."
    gastar_ou_receber(estado, -10)
    aceitos, recusas = [], []
    for x in membros:
        if x.get("jogador"):
            continue
        prop, erro = proposta_valida(estado, x, pauta, prop_id)
        if erro:
            continue
        x["rel"] = round(clamp(x["rel"] + 2, 0, 100), 2)
        if rng.random() < chance(estado, x["cod"], "cupula", pauta, prop_id):
            _assinar(estado, x, pauta, prop_id, "cupula")
            aceitos.append(x["nome"])
        else:
            recusas.append(x["nome"])
    turno = estado["meta"]["turno"]
    d["reunioes"].insert(0, {"cod": None, "pais": f"Cúpula: {bloco}", "formato": "cupula", "pauta": pauta, "proposta": prop_id, "turno": turno,
                             "ano": estado["meta"]["ano"], "tri": estado["meta"]["trimestre"], "aceito": bool(aceitos),
                             "aceitos": aceitos, "recusas": recusas})
    del d["reunioes"][30:]
    if aceitos:
        aplicar_efeitos(estado, {"diplomacia.onu": 1})
    nome = PAUTAS[pauta]["propostas"][prop_id]["nome"]
    msg = f"Cúpula {bloco} — '{nome}': aderiram {', '.join(aceitos) or 'ninguém'}" + (f"; recusaram {', '.join(recusas)}." if recusas else ".")
    noticia(estado, msg, "bom" if aceitos else "ruim")
    return True, msg


def denunciar(estado, acordo_id):
    d = _d(estado)
    a = next((a for a in d["acordos"] if a["id"] == acordo_id), None)
    if not a:
        return False, "Acordo não encontrado."
    d["acordos"].remove(a)
    x = d["entidades"].get(a["cod"])
    if x:
        x["rel"] = round(clamp(x["rel"] - 10, 0, 100), 2)
        if PAUTAS[a["pauta"]]["propostas"][a["proposta"]].get("tratado"):
            x["tratado"] = False
    aplicar_efeitos(estado, {"diplomacia.onu": -2})
    msg = f"O Brasil se retirou do acordo '{a['nome']}' com {a['pais']}." if estado["meta"]["escopo"] == "nacional" else f"O estado deixou o acordo '{a['nome']}' com {a['pais']}."
    noticia(estado, msg, "ruim")
    return True, msg


def responder_proposta(estado, prop_id, aceitar):
    """O jogador responde a uma proposta recebida de outro país."""
    d = _d(estado)
    p = next((p for p in d["propostas"] if p["id"] == prop_id), None)
    if not p:
        return False, "Proposta não encontrada."
    d["propostas"].remove(p)
    x = d["entidades"].get(p["cod"])
    if not x:
        return False, "País inválido."
    if not aceitar:
        x["rel"] = round(clamp(x["rel"] - 4, 0, 100), 2)
        msg = f"Proposta de {x['nome']} recusada: '{p['nome']}'."
        noticia(estado, msg, "info")
        return True, msg
    if any(a["cod"] == x["cod"] and a["proposta"] == p["proposta"] for a in d["acordos"]):
        return False, "Esse acordo já está em vigor."
    if p.get("contrapartida"):
        aplicar_efeitos(estado, p["contrapartida"]["efeitos"])
    _assinar(estado, x, p["pauta"], p["proposta"], "proposta")
    msg = f"Acordo com {x['nome']} assinado: '{p['nome']}'."
    noticia(estado, msg, "bom")
    return True, msg


def resposta_lider(estado, aguardando_id, aceitar):
    """Um líder humano (multiplayer) responde a uma proposta do anfitrião."""
    d = _d(estado)
    a = next((a for a in d["aguardando"] if a["id"] == aguardando_id), None)
    if not a:
        return False, "Proposta não encontrada."
    d["aguardando"].remove(a)
    x = d["entidades"].get(a["cod"])
    for r in d["reunioes"]:
        if r["cod"] == a["cod"] and r["proposta"] == a["proposta"] and r["aceito"] is None:
            r["aceito"] = bool(aceitar)
            break
    if not aceitar:
        x["rel"] = round(clamp(x["rel"] - 2, 0, 100), 2)
        msg = f"{x['jogador'] or x['nome']} ({x['nome']}) rejeitou '{a['nome']}'."
        noticia(estado, msg, "ruim")
        return True, msg
    aplicar_efeitos(estado, CONCESSOES.get(a.get("concessao"), CONCESSOES["nenhuma"])["efeitos"])
    _assinar(estado, x, a["pauta"], a["proposta"], "reuniao")
    msg = f"{x['jogador'] or x['nome']} ({x['nome']}) aceitou '{a['nome']}'."
    noticia(estado, msg, "bom")
    return True, msg


def acordo_direto(estado, cod, pauta, prop_id, origem="lider"):
    """Assina sem sorteio (ex.: proposta de um líder humano aprovada pelo anfitrião)."""
    x = _d(estado)["entidades"].get(cod)
    if not x:
        return False, "País inválido."
    prop, erro = proposta_valida(estado, x, pauta, prop_id)
    if erro:
        return False, erro
    _assinar(estado, x, pauta, prop_id, origem)
    return True, f"Acordo '{prop['nome']}' assinado com {x['nome']}."


def passo_acordos(estado, rng):
    """Efeitos trimestrais dos acordos, propostas que vencem e novas propostas de outros países."""
    d = _d(estado)
    for a in d["acordos"]:
        prop = PAUTAS[a["pauta"]]["propostas"][a["proposta"]]
        if prop["tri"]:
            aplicar_efeitos(estado, prop["tri"])
        x = d["entidades"].get(a["cod"])
        if x:
            x["rel"] = round(clamp(x["rel"] + 0.4, 0, 100), 2)
    turno = estado["meta"]["turno"]
    for p in list(d["propostas"]):
        if turno >= p["expira"]:
            d["propostas"].remove(p)
            x = d["entidades"].get(p["cod"])
            if x:
                x["rel"] = round(clamp(x["rel"] - 2, 0, 100), 2)
                noticia(estado, f"A proposta de {x['nome']} expirou sem resposta.", "info")
    if len(d["propostas"]) >= 3 or rng.random() > 0.4:
        return
    cands = [x for x in d["entidades"].values() if x["rel"] >= 40 and not x["guerra"] and not x["sancao"] and not x.get("jogador")]
    if not cands:
        return
    x = rng.choices(cands, [x["rel"] for x in cands])[0]
    interesses = INTERESSE.get(x["bloco"], {})
    pautas = list(PAUTAS)
    pauta = rng.choices(pautas, [1 + 4 * max(0, interesses.get(p, 0)) for p in pautas])[0]
    opcoes = [k for k in PAUTAS[pauta]["propostas"] if proposta_valida(estado, x, pauta, k)[0]
              and not any(p["cod"] == x["cod"] and p["proposta"] == k for p in d["propostas"])]
    if not opcoes:
        return
    k = rng.choice(opcoes)
    contra = rng.choice(CONTRAPARTIDAS)
    nome = PAUTAS[pauta]["propostas"][k]["nome"]
    d["propostas"].append({"id": _novo_id(d), "cod": x["cod"], "pais": x["nome"], "pauta": pauta, "proposta": k, "nome": nome,
                           "contrapartida": contra, "turno": turno, "expira": turno + 2})
    noticia(estado, f"{x['nome']} propõe: '{nome}'. Responda na aba Diplomacia.", "evento")
