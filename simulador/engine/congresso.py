"""Congresso: partidos, afinidade com o governo, votação de leis, negociação."""
from ..data.politica import PARTIDOS, IDEOLOGIAS, LEIS
from .util import clamp, sig, distancia, aplicar_efeitos, noticia


def _distribuir(pesos, total, rng):
    """Divide `total` cadeiras proporcionalmente aos pesos (maiores restos)."""
    jit = {k: v * rng.uniform(0.85, 1.15) for k, v in pesos.items()}
    soma = sum(jit.values())
    cota = {k: v / soma * total for k, v in jit.items()}
    base = {k: int(v) for k, v in cota.items()}
    resto = total - sum(base.values())
    for k in sorted(cota, key=lambda k: cota[k] - base[k], reverse=True)[:resto]:
        base[k] += 1
    return base


def montar(rng, escopo, jogador, total_baixa, total_alta):
    partidos = {p["sigla"]: dict(p) for p in PARTIDOS}
    pesos = {s: p["peso"] for s, p in partidos.items()}
    if jogador["partido"] not in partidos:  # partido criado pelo jogador
        ideo = IDEOLOGIAS[jogador["ideologia"]]
        partidos[jogador["partido"]] = {"sigla": jogador["partido"], "nome": jogador["partido_nome"], "eco": ideo["eco"], "soc": ideo["soc"], "peso": 22,
                                        "cor": jogador.get("partido_cor", "#7c5cff"), "numero": jogador.get("partido_numero")}
        pesos[jogador["partido"]] = 22
    reais = escopo == "nacional" and len(partidos) == len(PARTIDOS)
    if reais:  # bancadas reais (eleição de 2022, com fusões)
        baixa = {s: p["peso"] for s, p in partidos.items()}
        alta = {s: p.get("alta", 0) for s, p in partidos.items()}
    else:
        baixa = _distribuir(pesos, total_baixa, rng)
        alta = _distribuir({s: p.get("alta", 0) + 1 for s, p in partidos.items()}, total_alta, rng) if total_alta else {s: 0 for s in pesos}
    out = {}
    for s, p in partidos.items():
        d = distancia(jogador["eco"], jogador["soc"], p["eco"], p["soc"])
        afin = 66 - 54 * d + (14 if s == jogador["partido"] else 0) + rng.uniform(-4, 4)
        out[s] = {"sigla": s, "nome": p["nome"], "eco": p["eco"], "soc": p["soc"], "baixa": baixa[s], "alta": alta[s],
                  "cor": p.get("cor", "#7a8699"), "numero": p.get("numero"), "wiki": p.get("wiki"),
                  "afin": round(clamp(afin, 5, 95), 2), "favores": 0.0, "ministros": 0, "jogador": s == jogador["partido"]}
    return {"partidos": out, "total_baixa": total_baixa, "total_alta": total_alta, "leis_aprovadas": [], "leis_rejeitadas": [], "leis_derrubadas": []}


def apoio(estado, casa):
    c = estado["congresso"]
    total = c["total_" + casa]
    if not total:
        return 0.0
    return round(sum(p[casa] for p in c["partidos"].values() if p["afin"] >= 55) / total * 100, 1)


def classificar(afin):
    return "base" if afin >= 60 else "independente" if afin >= 40 else "oposição"


def passo(estado, rng):
    """Atualiza afinidade de cada partido com o governo."""
    c = estado["congresso"]
    jog = estado["jogador"]
    pop = estado["popularidade"]
    bonus_casa = (ministro_bonus(estado))
    for p in c["partidos"].values():
        d = distancia(jog["eco"], jog["soc"], p["eco"], p["soc"])
        alvo = 66 - 54 * d + (pop - 50) * 0.35 + 8 * min(p["ministros"], 2) + p["favores"] + bonus_casa + (10 if p["jogador"] else 0)
        p["afin"] = round(clamp(p["afin"] + 0.25 * (alvo - p["afin"]) + rng.uniform(-1, 1), 0, 100), 2)
        p["favores"] = round(p["favores"] * 0.85, 2)


def ministro_bonus(estado):
    m = estado["ministros"].get("casa_civil")
    return (m["competencia"] - 50) * 0.06 if m else -2


def votar(estado, lei, rng):
    c = estado["congresso"]
    pop = estado["popularidade"]
    precisa = 0.6 if lei["tipo"] == "emenda" else 0.5
    resultado = {}
    for casa in ("baixa", "alta"):
        total = c["total_" + casa]
        if not total:
            continue
        sim = 0.0
        for p in c["partidos"].values():
            if not p[casa]:
                continue
            alinh = 0.0
            if lei["eco"] or lei["soc"]:
                alinh = 0.7 - (abs(lei["eco"] - p["eco"]) * 0.8 + abs(lei["soc"] - p["soc"]) * 0.5)
            z = (p["afin"] - 50) / 12 + alinh * 1.3 + (pop - 50) / 60
            sim += p[casa] * sig(z)
        sim *= rng.uniform(0.96, 1.04)
        resultado[casa] = {"sim": int(round(min(sim, total))), "total": total, "aprovou": sim / total > precisa}
    return resultado


def tramitar_lei(estado, lei_id, rng):
    """Vota a lei nas casas e, se aprovada, sujeita à revisão do STF. Retorna (aprovada, mensagem)."""
    lei = LEIS[lei_id]
    c = estado["congresso"]
    res = votar(estado, lei, rng)
    c["ultima_votacao"] = {"lei": lei_id, "resultado": res, "turno": estado["meta"]["turno"]}
    if not all(r["aprovou"] for r in res.values()):
        c["leis_rejeitadas"].append({"id": lei_id, "turno": estado["meta"]["turno"]})
        aplicar_efeitos(estado, {"popularidade": -1, "congresso.afinidade_geral": -1})
        msg = f"'{lei['nome']}' foi rejeitada no Congresso."
        noticia(estado, msg, "ruim")
        return False, msg
    from . import justica
    if justica.revisar_lei(estado, lei, rng):
        c["leis_derrubadas"].append({"id": lei_id, "turno": estado["meta"]["turno"]})
        msg = f"O Congresso aprovou '{lei['nome']}', mas o STF a derrubou por inconstitucionalidade."
        aplicar_efeitos(estado, {"popularidade": -1, "justica.confianca_stf": 1})
        noticia(estado, msg, "ruim")
        return False, msg
    c["leis_aprovadas"].append({"id": lei_id, "turno": estado["meta"]["turno"]})
    aplicar_efeitos(estado, lei["efeitos"])
    msg = f"'{lei['nome']}' foi aprovada e sancionada."
    noticia(estado, msg, "bom")
    return True, msg


def liberar_emendas(estado, sigla, valor):
    """Entrega recursos a um partido (valor em R$ bi) para ganhar afinidade."""
    p = estado["congresso"]["partidos"].get(sigla)
    if not p:
        return False
    p["favores"] = round(min(25, p["favores"] + valor * 0.8), 2)
    p["afin"] = round(clamp(p["afin"] + valor * 0.6, 0, 100), 2)
    return True
