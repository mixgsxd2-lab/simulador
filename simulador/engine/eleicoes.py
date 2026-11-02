"""Campanha, debates, pesquisa e eleições (1º e 2º turno)."""
import math
from ..data.politica import NOMES, SOBRENOMES
from .util import clamp, distancia, noticia, aplicar_efeitos

NOME_CARGO = {"nacional": "Presidente", "estadual": "Governador"}


def nova_campanha(estado, rng, inicial=False, sucessor=False):
    jog = estado["jogador"]
    proibidos = {jog["partido"]}
    cands = []
    siglas = [s for s in estado["congresso"]["partidos"] if s not in proibidos]
    escolhidos = []
    while siglas and len(escolhidos) < 4:
        s = rng.choices(siglas, [estado["congresso"]["partidos"][x]["baixa"] + 4 for x in siglas])[0]
        siglas.remove(s)
        escolhidos.append(s)
    for sigla in escolhidos:
        p = estado["congresso"]["partidos"][sigla]
        cands.append({"id": sigla, "nome": f"{rng.choice(NOMES)} {rng.choice(SOBRENOMES)}", "partido": sigla,
                      "eco": p["eco"], "soc": p["soc"], "forca": round(rng.uniform(34, 54), 1)})
    estado["campanha"] = {"ativa": True, "inicial": inicial, "sucessor": sucessor, "reconhecimento": 20 if inicial else 60,
                          "rejeicao": 20, "boost": 0.0, "turnos_restantes": 4 if inicial else 0, "fundo": 100.0, "coalizao": [], "debate_feito": False,
                          "candidatos": cands, "pesquisa": []}
    atualizar_pesquisa(estado, rng)


def forca_jogador(estado):
    c = estado["campanha"]
    jog = estado["jogador"]
    el = estado["sociedade"]["eleitorado"]
    prox = 12 * (1 - distancia(jog["eco"], jog["soc"], el["eco"], el["soc"]))
    if c["inicial"]:
        base = 18 + c["reconhecimento"] * 0.33
    else:
        peso = 0.55 if c["sucessor"] else 0.7
        base = 15 + estado["popularidade"] * peso
    coalizao = sum(estado["congresso"]["partidos"][s]["baixa"] for s in c["coalizao"] if s in estado["congresso"]["partidos"]) / estado["congresso"]["total_baixa"]
    return base + prox + c["boost"] - c["rejeicao"] * 0.2 + coalizao * 25 + estado["sociedade"]["midia"] * 0.06


def _forcas(estado):
    c = estado["campanha"]
    el = estado["sociedade"]["eleitorado"]
    lista = [{"id": "jogador", "nome": estado["jogador"]["nome"], "partido": estado["jogador"]["partido"], "forca": forca_jogador(estado)}]
    anti = 0 if c["inicial"] else (50 - estado["popularidade"]) * 0.15
    for cand in c["candidatos"]:
        prox = 12 * (1 - distancia(cand["eco"], cand["soc"], el["eco"], el["soc"]))
        lista.append({"id": cand["id"], "nome": cand["nome"], "partido": cand["partido"], "forca": cand["forca"] + prox + anti})
    return lista


def _participacao(forcas, rng=None, ruido=0.0):
    pesos = []
    for f in forcas:
        z = f["forca"] + (rng.uniform(-ruido, ruido) if rng else 0)
        pesos.append(math.exp(z / 10))
    total = sum(pesos)
    return [round(p / total * 100, 1) for p in pesos]


def atualizar_pesquisa(estado, rng):
    forcas = _forcas(estado)
    pct = _participacao(forcas, rng, 2.5)
    estado["campanha"]["pesquisa"] = sorted(
        [{"id": f["id"], "nome": f["nome"], "partido": f["partido"], "pct": p} for f, p in zip(forcas, pct)],
        key=lambda x: -x["pct"])


def rodar_eleicao(estado, rng):
    """Retorna dict com resultado do 1º (e 2º) turno. venceu = jogador (ou sucessor) vitorioso."""
    forcas = _forcas(estado)
    pct = _participacao(forcas, rng, 4.0)
    turno1 = sorted([{"id": f["id"], "nome": f["nome"], "partido": f["partido"], "pct": p} for f, p in zip(forcas, pct)], key=lambda x: -x["pct"])
    res = {"turno1": turno1, "turno2": None, "cargo": NOME_CARGO[estado["meta"]["escopo"]]}
    if turno1[0]["pct"] > 50:
        res["vencedor"] = turno1[0]["id"]
    else:
        a, b = turno1[0], turno1[1]
        fa = next(f["forca"] for f in forcas if f["id"] == a["id"])
        fb = next(f["forca"] for f in forcas if f["id"] == b["id"])
        pa = clamp(50 + (fa - fb) * 0.8 + rng.uniform(-3, 3), 35, 65)
        res["turno2"] = [{"id": a["id"], "nome": a["nome"], "partido": a["partido"], "pct": round(pa, 1)},
                         {"id": b["id"], "nome": b["nome"], "partido": b["partido"], "pct": round(100 - pa, 1)}]
        res["turno2"].sort(key=lambda x: -x["pct"])
        res["vencedor"] = res["turno2"][0]["id"]
    res["venceu"] = res["vencedor"] == "jogador"
    return res


def debate(estado, rng):
    c = estado["campanha"]
    desempenho = estado["jogador"]["carisma"] + rng.uniform(-25, 25) + (estado["popularidade"] - 50) * 0.1
    c["debate_feito"] = True
    if desempenho > 70:
        c["boost"] = round(c["boost"] + 5, 2)
        c["reconhecimento"] = min(100, c["reconhecimento"] + 8)
        return "Você brilhou no debate! Os eleitores indecisos migraram para você."
    if desempenho > 45:
        c["boost"] = round(c["boost"] + 1.5, 2)
        return "Debate morno: nem ganhou nem perdeu votos."
    c["boost"] = round(c["boost"] - 4, 2)
    c["rejeicao"] = min(100, c["rejeicao"] + 6)
    return "Desempenho fraco no debate. Os adversários exploraram seus tropeços."


def acao_campanha(estado, tipo, p, rng):
    """Ações de campanha. Retorna (ok, msg, custo_capital)."""
    c = estado["campanha"]
    if not c["ativa"]:
        return False, "A campanha não está ativa.", 0
    custos = {"comicio": (1, 15), "tv": (1, 30), "redes": (1, 10), "ataque": (1, 20), "alianca": (2, 0), "debate": (1, 0)}
    if tipo not in custos:
        return False, "Ação de campanha inválida.", 0
    cap, fundo = custos[tipo]
    if estado["capital"] < cap:
        return False, "Capital político insuficiente.", 0
    if c["fundo"] < fundo:
        return False, "Fundo de campanha insuficiente.", 0
    if tipo == "debate" and (c["debate_feito"] or (c["inicial"] and c["turnos_restantes"] > 2)):
        return False, "Debate indisponível agora (um por campanha, na reta final).", 0
    if tipo == "comicio":
        c["reconhecimento"] = min(100, c["reconhecimento"] + 6)
        c["boost"] = round(c["boost"] + 1.5, 2)
        msg = "Comício realizado: mais reconhecimento e entusiasmo da base."
    elif tipo == "tv":
        c["reconhecimento"] = min(100, c["reconhecimento"] + 8)
        c["rejeicao"] = min(100, c["rejeicao"] + 2)
        c["boost"] = round(c["boost"] + 1, 2)
        msg = "Propaganda na TV exibida em horário nobre."
    elif tipo == "redes":
        c["reconhecimento"] = min(100, c["reconhecimento"] + 4)
        c["rejeicao"] = min(100, c["rejeicao"] + 1)
        estado["sociedade"]["polarizacao"] = min(100, estado["sociedade"]["polarizacao"] + 1)
        msg = "Campanha digital turbinada."
    elif tipo == "ataque":
        alvo = max(c["candidatos"], key=lambda x: x["forca"])
        alvo["forca"] = round(alvo["forca"] - 3, 1)
        c["rejeicao"] = min(100, c["rejeicao"] + 4)
        msg = f"Propaganda negativa abalou {alvo['nome']}."
    elif tipo == "alianca":
        sigla = p.get("partido")
        part = estado["congresso"]["partidos"].get(sigla)
        if not part or sigla == estado["jogador"]["partido"] or sigla in c["coalizao"]:
            return False, "Partido inválido ou já aliado.", 0
        dist = distancia(estado["jogador"]["eco"], estado["jogador"]["soc"], part["eco"], part["soc"])
        if rng.random() > 0.9 - dist * 0.9:
            estado["capital"] -= cap
            return False, f"{part['nome']} recusou a aliança.", cap
        c["coalizao"].append(sigla)
        part["afin"] = round(clamp(part["afin"] + 20, 0, 100), 2)
        c["fundo"] += 20
        c["boost"] = round(c["boost"] + 2, 2)
        c["candidatos"] = [x for x in c["candidatos"] if x["partido"] != sigla]
        msg = f"Aliança fechada com {part['nome']}: mais tempo de TV e fundo de campanha."
    else:
        msg = debate(estado, rng)
    estado["capital"] -= cap
    c["fundo"] = round(c["fundo"] - fundo, 1)
    atualizar_pesquisa(estado, rng)
    return True, msg, cap
