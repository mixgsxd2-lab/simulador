"""Indicadores derivados enviados ao cliente (não persistidos)."""
from ..data.politica import LEIS
from . import congresso, diplomacia, economia
from .util import clamp


def grupos(estado):
    e, s, j = estado["economia"], estado["setores"], estado["justica"]
    pop = estado["popularidade"]
    jog = estado["jogador"]
    imp = estado["impostos"]
    g = {
        "Mais pobres": pop + (s["social"] - 50) * 0.35 - (e["desemprego"] - 9) * 1.2 - (e["inflacao"] - 5) * 1.2 - jog["eco"] * -4,
        "Classe média": pop - (e["inflacao"] - 5) * 0.8 - (imp["renda"] - 15) * 0.7 + (s["seguranca"] - 50) * 0.15,
        "Empresários": pop + (e["confianca"] - 50) * 0.5 - (imp["empresas"] - 25) * 0.8 + jog["eco"] * 6,
        "Servidores públicos": pop + (s["saude"] + s["educacao"] - 100) * 0.2 - (estado["orcamento"]["obrig"] - 0.64) * 60,
        "Jovens": pop + (s["educacao"] - 50) * 0.25 - (e["desemprego"] - 9) * 0.9 - jog["soc"] * 6,
        "Agronegócio": pop + (e["confianca"] - 50) * 0.2 - (s["meio_ambiente"] - 50) * 0.12 + jog["eco"] * 5,
        "Religiosos / conservadores": pop + jog["soc"] * 14 + (s["seguranca"] - 50) * 0.1,
        "Progressistas urbanos": pop - jog["soc"] * 12 + (s["meio_ambiente"] - 50) * 0.15 + (s["educacao"] - 50) * 0.1,
    }
    return {k: round(clamp(v, 3, 95), 1) for k, v in g.items()}


def derivados(estado):
    c = estado["congresso"]
    partidos = []
    for p in sorted(c["partidos"].values(), key=lambda p: -p["baixa"]):
        partidos.append({**p, "posicao": congresso.classificar(p["afin"])})
    e = estado["economia"]
    diplomacia._d(estado)  # partidas antigas: garante as listas de acordos/propostas
    return {
        "chance_leis": {k: congresso.chance_aprovacao(estado, v) for k, v in LEIS.items() if estado["meta"]["escopo"] in v["escopos"]},
        "apoio_baixa": congresso.apoio(estado, "baixa"), "apoio_alta": congresso.apoio(estado, "alta"),
        "partidos": partidos, "grupos": grupos(estado), "carga": round(economia.carga(estado) * 100, 1),
        "ano_idade": 35 + estado["meta"]["turno"] // 4,
        "orcamento": {"receita": e["receita"], "despesa": e["despesa"], "resultado": e["resultado"]},
    }
