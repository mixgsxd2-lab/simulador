"""Relatório final do governo (fim da RUN) e pontuação."""
from ..data.politica import LEIS, CENARIOS

RESULTADOS = {
    "reeleito": ("Reeleito", "Você foi reeleito e conclui sua trajetória com vitória.", 150),
    "derrota": ("Derrota na reeleição", "O eleitorado optou pela mudança.", 0),
    "derrota_inicial": ("Derrota na eleição", "Você não conseguiu chegar ao poder.", 0),
    "mandato_completo": ("Mandatos concluídos", "Você cumpriu o limite de dois mandatos consecutivos.", 120),
    "sucessor_eleito": ("Sucessor eleito", "Seu legado se perpetua com o sucessor no poder.", 180),
    "sucessor_derrotado": ("Sucessor derrotado", "A oposição retomou o poder.", 60),
    "impeachment": ("Impeachment", "Afastado pelo Congresso.", -150),
    "renuncia": ("Renúncia", "Sem apoio, você deixou o cargo.", -100),
    "desistiu": ("Encerrada pelo jogador", "Você encerrou a partida antecipadamente.", 0),
}


def _media(h, k):
    return round(sum(x[k] for x in h) / len(h), 2) if h else 0


def gerar(estado):
    from .turno import avaliar_promessas
    m = estado["meta"]
    h = [x for x in estado["historico"] if x["turno"] > 0] or estado["historico"]
    cumpridas, promessas = avaliar_promessas(estado)
    leis = [{"nome": LEIS[l["id"]]["nome"], "turno": l["turno"]} for l in estado["congresso"]["leis_aprovadas"]]
    titulo, descricao, bonus = RESULTADOS.get(m["resultado"], ("Fim", "", 0))
    escandalos = sum(1 for i in estado["justica"]["investigacoes"])
    guerras = estado["diplomacia"].get("historico_guerras", [])
    pontos = (_media(h, "popularidade") * 2 + _media(h, "crescimento") * 10 - _media(h, "inflacao") * 4 - _media(h, "desemprego") * 3
              + len(leis) * 5 + cumpridas * 15 - escandalos * 4 + bonus + m["mandato"] * 40)
    pontos = round(max(0, pontos), 1)
    return {
        "resultado": m["resultado"], "titulo": titulo, "descricao": descricao, "pontuacao": pontos,
        "cenario": CENARIOS.get(m["cenario"], {}).get("nome", ""), "anos": m["turno"] / 4, "mandatos": m["mandato"],
        "medias": {k: _media(h, k) for k in ("popularidade", "crescimento", "inflacao", "desemprego", "divida_pib", "corrupcao")},
        "final": {"popularidade": estado["popularidade"], "divida_pib": estado["economia"]["divida_pib"],
                  "pib_bi": round(estado["economia"]["pib_bi"], 1), "desemprego": estado["economia"]["desemprego"]},
        "leis": leis, "leis_rejeitadas": len(estado["congresso"]["leis_rejeitadas"]), "leis_derrubadas": len(estado["congresso"]["leis_derrubadas"]),
        "promessas": promessas, "investigacoes": escandalos, "guerras": guerras,
        "eleicoes": [{"tipo": e["tipo"], "ano": e["ano"], "venceu": e["venceu"],
                      "turno1": e["turno1"][:3], "turno2": e["turno2"]} for e in estado["eleicoes"]],
        "historico": h,
    }
