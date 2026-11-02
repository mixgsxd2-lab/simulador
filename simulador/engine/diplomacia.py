"""Diplomacia: relações, tratados, alianças, sanções, ONU e guerras (modo presidente);
relações federativas (modo governador)."""
from ..data.geo import PAISES, ESTADOS, PAISES_POR_COD
from .util import clamp, aplicar_efeitos, noticia, gastar_ou_receber


def montar(rng, estado_modo, uf=None):
    if estado_modo == "presidente":
        ent = {p["cod"]: {"cod": p["cod"], "nome": p["nome"], "rel": clamp(p["rel"] + rng.uniform(-6, 6), 15, 90), "tratado": False,
                          "alianca": False, "sancao": False, "guerra": False, "militar": p["militar"], "pib": p["pib"],
                          "regime": p["regime"], "bloco": p["bloco"], "jogador": None}
               for p in PAISES if p["cod"] != "BRA"}
    else:
        ent = {e["uf"]: {"cod": e["uf"], "nome": e["nome"], "rel": clamp(50 + rng.uniform(-12, 12), 20, 80), "tratado": False,
                         "alianca": False, "sancao": False, "guerra": False, "militar": 0, "pib": e["pib"], "regime": "", "bloco": e["regiao"], "jogador": None}
               for e in ESTADOS if e["uf"] != uf}
    return {"entidades": ent, "onu": 50.0, "militar": 55.0, "guerras": [], "assento_conselho": False}


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
