"""Utilitários compartilhados pelo motor do jogo."""
import math

LIMITES = {
    "economia.crescimento": (-8, 10), "economia.inflacao": (0, 40), "economia.desemprego": (3, 25),
    "economia.selic": (2, 25), "economia.divida_pib": (3, 250), "economia.cambio": (3, 12),
    "economia.tendencia": (0, 4.5), "economia.caixa": (-1e9, 1e9), "economia.choque": (-5, 5),
    "economia.choque_inf": (-5, 5), "orcamento.obrig": (0.4, 0.8), "orcamento.gasto_pct": (10, 60),
    "sociedade.desigualdade": (30, 70), "sociedade.midia": (-100, 100), "federal.relacao": (0, 100),
}


def limites(caminho):
    if caminho in LIMITES:
        return LIMITES[caminho]
    if caminho.startswith("impostos."):
        return (0, 45)
    return (0, 100)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def sig(x):
    return 1 / (1 + math.exp(-x))


def get_path(estado, caminho):
    atual = estado
    for k in caminho.split("."):
        atual = atual[k]
    return atual


def set_path(estado, caminho, valor):
    *pais, ultimo = caminho.split(".")
    atual = estado
    for k in pais:
        atual = atual[k]
    atual[ultimo] = valor


def aplicar_efeitos(estado, efeitos, escala=1.0):
    """Aplica deltas em caminhos pontuados, respeitando limites. Caminhos inexistentes são ignorados."""
    for caminho, delta in efeitos.items():
        if caminho == "congresso.afinidade_geral":
            for p in estado["congresso"]["partidos"].values():
                p["afin"] = round(clamp(p["afin"] + delta * escala, 0, 100), 2)
            continue
        if caminho == "economia.caixa":
            gastar_ou_receber(estado, delta * escala)
            continue
        try:
            atual = get_path(estado, caminho)
        except (KeyError, TypeError):
            continue
        lo, hi = limites(caminho)
        set_path(estado, caminho, round(clamp(atual + delta * escala, lo, hi), 4))


def gastar_ou_receber(estado, valor):
    """Valor em R$ bi: positivo entra no caixa, negativo sai (e vira dívida se faltar caixa)."""
    e = estado["economia"]
    e["caixa"] += valor
    if e["caixa"] < 0:
        e["divida_bi"] += -e["caixa"]
        e["caixa"] = 0
        e["divida_pib"] = e["divida_bi"] / e["pib_bi"] * 100


def noticia(estado, texto, tipo="info"):
    m = estado["meta"]
    estado["noticias"].insert(0, {"turno": m["turno"], "ano": m["ano"], "tri": m["trimestre"], "texto": texto, "tipo": tipo})
    del estado["noticias"][60:]


def distancia(eco_a, soc_a, eco_b, soc_b):
    return math.hypot(eco_a - eco_b, soc_a - soc_b) / 2.83
