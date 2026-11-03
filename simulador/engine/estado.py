"""Criação de uma nova partida (RUN)."""
import random
from ..data.geo import ESTADOS_POR_UF
from ..data.historia import GOVERNADORES
from ..data.politica import IDEOLOGIAS, PROPOSTAS, PASTAS, CENARIOS, NOMES, SOBRENOMES, PARTIDOS
from . import congresso, diplomacia, eleicoes, economia
from .util import aplicar_efeitos, noticia, clamp, get_path

DURACOES = {"curta": 1, "media": 2, "longa": 2}  # nº de mandatos governados
TURNOS_MANDATO = 16  # trimestres


def pastas_do_escopo(escopo):
    return [p for p, d in PASTAS.items() if not (escopo == "estadual" and d.get("so_nacional"))]


def gerar_candidatos(estado, rng, pasta, n=3):
    siglas = list(estado["congresso"]["partidos"])
    out = []
    for _ in range(n):
        out.append({"nome": f"{rng.choice(NOMES)} {rng.choice(SOBRENOMES)}", "partido": rng.choice(siglas),
                    "competencia": rng.randint(30, 90), "integridade": rng.randint(20, 95),
                    "carisma": rng.randint(30, 90), "idade": rng.randint(38, 68)})
    return out


def nomear(estado, pasta, cand):
    estado["ministros"][pasta] = cand
    p = estado["congresso"]["partidos"].get(cand["partido"])
    if p:
        p["ministros"] += 1
        p["afin"] = round(clamp(p["afin"] + 12, 0, 100), 2)


def demitir(estado, pasta):
    m = estado["ministros"].get(pasta)
    if not m:
        return None
    p = estado["congresso"]["partidos"].get(m["partido"])
    if p:
        p["ministros"] = max(0, p["ministros"] - 1)
        p["afin"] = round(clamp(p["afin"] - 8, 0, 100), 2)
    estado["ministros"][pasta] = None
    return m


def novo_jogo(cfg):
    rng = random.Random()
    modo = cfg["modo"]
    escopo = "nacional" if modo == "presidente" else "estadual"
    ideo = IDEOLOGIAS[cfg["ideologia"]]
    cenario = cfg.get("cenario") or "aleatorio"
    if cenario not in CENARIOS:
        cenario = rng.choice(list(CENARIOS))

    partido = cfg["partido"]
    siglas = {p["sigla"]: p for p in PARTIDOS}
    jogador = {"nome": (cfg.get("nome") or "").strip() or f"{rng.choice(NOMES)} {rng.choice(SOBRENOMES)}",
               "idade": int(cfg.get("idade") or 35), "partido": partido, "partido_cor": cfg.get("partido_cor"), "partido_numero": cfg.get("partido_numero"),
               "genero": cfg.get("genero") or "neutro", "partido_nome": siglas[partido]["nome"] if partido in siglas else cfg.get("partido_nome", partido),
               "ideologia": cfg["ideologia"], "eco": ideo["eco"], "soc": ideo["soc"],
               "propostas": [p for p in cfg.get("propostas", []) if p in PROPOSTAS][:4],
               "aparencia": cfg.get("aparencia") or {}, "carisma": rng.randint(40, 70) + (8 if cfg["ideologia"] in ("nacionalista", "socialista") else 0)}

    uf = cfg.get("uf") if modo == "governador" else None
    if modo == "governador" and uf not in ESTADOS_POR_UF:
        raise ValueError("Estado inválido.")

    # Ponto de partida: janeiro de 2023, posse após a eleição de 2022 (indicadores próximos aos reais do fim de 2022).
    macro = {"crescimento": 2.0, "inflacao": 4.5, "selic": 10.5, "cambio": 5.2}
    if escopo == "nacional":
        pib, pop_m, tend, tb, ta = 10000.0, 203.0, 2.0, 513, 81  # PIB ~R$ 10 tri; Censo 2022: 203 mi
        divida_pib, desemp = 72.0, 8.1
        obrig, rotulo = 0.64, "Brasil"
        macro = {"crescimento": 2.9, "inflacao": 5.8, "selic": 13.75, "cambio": 5.25}
    else:
        est = ESTADOS_POR_UF[uf]
        pib, pop_m = float(est["pib"]), est["pop"]
        tend = 1.6 + min(1.0, pib / 1500 * 0.8) + rng.uniform(-0.2, 0.2)
        tb, ta = int(clamp(24 + pop_m * 1.5, 24, 94)), 0
        divida_pib, desemp = rng.uniform(15, 45), rng.uniform(7, 11)
        obrig, rotulo = 0.60, est["nome"]

    estado = {
        "meta": {"modo": modo, "escopo": escopo, "duracao": cfg["duracao"], "uf": uf, "rotulo": rotulo, "cenario": cenario,
                 "turno": 0, "ano": 2023, "trimestre": 1, "mandato": 0, "turno_mandato": 0, "fase": "campanha",
                 "max_mandatos": DURACOES[cfg["duracao"]], "encerrado": False, "resultado": None, "eventos_total": 0,
                 "populacao_m": pop_m, "antecessor": None if uf else "Jair Bolsonaro (PL)",
                 # quem venceu de fato em 2022 (o jogador ocupa esse lugar na simulação)
                 "substitui": ("{} ({})".format(*GOVERNADORES[uf]) if uf else "Luiz Inácio Lula da Silva (PT)")},
        "jogador": jogador, "popularidade": 45.0, "capital": 5,
        "economia": {"pib_bi": pib, "crescimento": macro["crescimento"], "inflacao": macro["inflacao"], "desemprego": round(desemp, 2), "selic": macro["selic"],
                     "divida_pib": round(divida_pib, 2), "divida_bi": pib * divida_pib / 100, "caixa": pib * 0.02, "cambio": macro["cambio"],
                     "confianca": 50.0, "tendencia": round(tend, 3), "choque": 0.0, "choque_inf": 0.0, "rev_ref": 1.0,
                     "receita": 0, "despesa": 0, "juros": 0, "resultado": 0, "obrigatorias": 0, "discricionarias": 0, "deficit_pib": 0},
        "impostos": {"renda": 15.0, "empresas": 25.0, "consumo": 18.0, "importacao": 12.0},
        "orcamento": {"obrig": obrig, "gasto_pct": 27.0, "aloc": economia.alocacao_inicial(escopo)},
        "setores": {s: round(rng.uniform(42, 58), 1) for s in ("saude", "educacao", "seguranca", "infraestrutura", "social", "meio_ambiente")},
        "ministros": {p: None for p in pastas_do_escopo(escopo)}, "candidatos_ministros": {},
        "congresso": congresso.montar(rng, escopo, jogador, tb, ta),
        "justica": {"independencia": 80.0, "confianca_stf": 65.0, "corrupcao": 45.0, "bc_indep": 80.0, "investigacoes": [],
                    "impeachment": {"risco": 10.0, "processo": None}, "vaga_stf": False},
        "sociedade": {"protestos": 20.0, "midia": 0.0, "polarizacao": 45.0, "desigualdade": 51.0,
                      "eleitorado": {"eco": round(rng.uniform(-0.3, 0.3), 2), "soc": round(rng.uniform(-0.2, 0.4), 2)}},
        "diplomacia": diplomacia.montar(rng, modo, uf),
        "campanha": {}, "evento": None, "historico": [], "noticias": [], "eleicoes": [], "promessas": {}, "snap": {},
    }
    if escopo == "estadual":
        estado["federal"] = {"crescimento": 2.0, "inflacao": 4.5, "selic": 10.5, "relacao": round(rng.uniform(40, 60), 1), "viés": 0}
        estado["popularidade"] = 40.0
        estado["economia"]["caixa"] = pib * 0.01
    estado["economia"]["rev_ref"] = economia.receita_trimestre(estado)

    aplicar_efeitos(estado, ideo["inicial"])
    aplicar_efeitos(estado, CENARIOS[cenario]["efeitos"])
    estado["economia"]["divida_bi"] = estado["economia"]["divida_pib"] / 100 * pib
    for pasta in estado["ministros"]:
        estado["candidatos_ministros"][pasta] = gerar_candidatos(estado, rng, pasta)

    # Eleito em 2022: a partida começa na posse (1º de janeiro de 2023). A próxima eleição é em outubro de 2026.
    from . import turno
    estado["eleicoes"].append(eleicoes.eleicao_2022(estado, rng))
    noticia(estado, f"Você venceu a eleição de 2022 para {eleicoes.NOME_CARGO[escopo]} de {rotulo}. Cenário: {CENARIOS[cenario]['nome']}.", "bom")
    turno._posse(estado, rng)
    noticia(estado, "Próxima eleição: outubro de 2026. A campanha de reeleição começa no 2º trimestre de 2026.", "info")
    return estado


def tirar_foto(estado):
    """Guarda indicadores de partida para avaliar promessas ao fim do mandato."""
    out = {}
    for pid in estado["jogador"]["propostas"]:
        meta = PROPOSTAS[pid].get("meta")
        if meta:
            out[meta[0]] = get_path(estado, meta[0])
    estado["snap"] = out


def registrar_historico(estado):
    e, s = estado["economia"], estado["setores"]
    estado["historico"].append({
        "turno": estado["meta"]["turno"], "ano": estado["meta"]["ano"], "tri": estado["meta"]["trimestre"],
        "popularidade": round(estado["popularidade"], 1), "crescimento": round(e["crescimento"], 2),
        "inflacao": round(e["inflacao"], 2), "desemprego": round(e["desemprego"], 2), "divida_pib": round(e["divida_pib"], 1),
        "confianca": round(e["confianca"], 1), "corrupcao": round(estado["justica"]["corrupcao"], 1),
        "saude": s["saude"], "educacao": s["educacao"], "seguranca": s["seguranca"], "infraestrutura": s["infraestrutura"],
        "protestos": round(estado["sociedade"]["protestos"], 1), "resultado": round(e["resultado"], 1)})
