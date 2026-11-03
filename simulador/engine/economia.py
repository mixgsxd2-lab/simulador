"""Economia, orçamento e setores públicos."""
from ..data.politica import SETORES, ALOC_PADRAO, PASTAS
from .util import clamp, gastar_ou_receber

CARGA_BASE = 0.3426
FRACAO_PROPRIA = {"nacional": 0.64, "estadual": 0.30}
REPASSE_PIB = 0.055
GASTO_DISCR_PADRAO = 27.0


def carga(estado):
    t = estado["impostos"]
    return t["renda"] * 0.006 + t["empresas"] * 0.0036 + t["consumo"] * 0.0085 + t["importacao"] * 0.0008


def receita_trimestre(estado):
    e = estado["economia"]
    escopo = estado["meta"]["escopo"]
    rec = e["pib_bi"] * carga(estado) * FRACAO_PROPRIA[escopo] / 4
    if escopo == "estadual":
        rec += e["pib_bi"] * REPASSE_PIB / 4 * (0.6 + estado["federal"]["relacao"] / 100 * 0.8)
    return rec


def ministro_comp(estado, pasta):
    m = estado["ministros"].get(pasta)
    return m["competencia"] if m else 35


def normalizar_aloc(aloc):
    total = sum(aloc.values()) or 1
    return {k: round(v / total * 100, 2) for k, v in aloc.items()}


def alocacao_inicial(escopo):
    return dict(ALOC_PADRAO[escopo])


def _macro_federal(estado, rng):
    """Macroeconomia exógena para o modo governador."""
    f = estado["federal"]
    if f.get("vinculado"):  # multiplayer: a economia federal é a do presidente (jogador); só a relação oscila
        f["relacao"] = clamp(f["relacao"] + (50 - f["relacao"]) * 0.02 + rng.uniform(-1, 1), 0, 100)
        return
    f["crescimento"] = clamp(f["crescimento"] * 0.8 + 2.0 * 0.2 + rng.uniform(-0.5, 0.5) + f.get("viés", 0), -4, 6)
    f["inflacao"] = clamp(f["inflacao"] * 0.8 + 4.0 * 0.2 + rng.uniform(-0.3, 0.3), 2, 14)
    f["selic"] = clamp(f["selic"] + clamp((f["inflacao"] - 4.5) * 0.3, -0.75, 0.75), 3, 18)
    f["relacao"] = clamp(f["relacao"] + (50 - f["relacao"]) * 0.03 + rng.uniform(-1.5, 1.5), 0, 100)


def passo(estado, rng):
    e = estado["economia"]
    o = estado["orcamento"]
    s = estado["setores"]
    escopo = estado["meta"]["escopo"]
    dip = estado["diplomacia"]
    est = escopo == "estadual"

    if est:
        _macro_federal(estado, rng)
    f = estado.get("federal")

    # ---- fiscal ----
    receita = receita_trimestre(estado)
    obrig = o["obrig"] * e["rev_ref"]
    discr = o["gasto_pct"] / 100 * e["rev_ref"]
    selic_ef = f["selic"] if est else e["selic"]
    juros = e["divida_bi"] * selic_ef * 0.8 / 400
    resultado = receita - obrig - discr - juros
    e.update(receita=round(receita, 1), despesa=round(obrig + discr + juros, 1), juros=round(juros, 1),
             resultado=round(resultado, 1), obrigatorias=round(obrig, 1), discricionarias=round(discr, 1))
    gastar_ou_receber(estado, resultado)
    if e["caixa"] > e["rev_ref"] * 1.2:  # excedente amortiza dívida
        excesso = e["caixa"] - e["rev_ref"] * 1.2
        e["caixa"] -= excesso
        e["divida_bi"] = max(0, e["divida_bi"] - excesso)
    deficit_pct = -resultado * 4 / e["pib_bi"] * 100
    e["deficit_pib"] = round(deficit_pct, 2)

    # ---- setores ----
    razao_gasto = o["gasto_pct"] / GASTO_DISCR_PADRAO
    padrao = ALOC_PADRAO[escopo]
    aloc = o["aloc"]
    for setor in SETORES:
        ratio = (aloc.get(setor, 0) / max(padrao[setor], 1)) * razao_gasto
        pasta = next((p for p, d in PASTAS.items() if d["setor"] == setor), None)
        comp = ministro_comp(estado, pasta) if pasta in estado["ministros"] else 50
        delta = (ratio - 1) * 3 + (comp - 50) * 0.03 - 0.4 + rng.uniform(-0.6, 0.6)
        if pasta in estado["ministros"] and not estado["ministros"][pasta]:
            delta -= 0.6
        s[setor] = round(clamp(s[setor] + delta, 0, 100), 2)
    if not est:
        ratio_def = (aloc.get("defesa", 0) / max(padrao["defesa"], 1)) * razao_gasto
        dip["militar"] = round(clamp(dip["militar"] + (ratio_def - 1) * 1.5 + (ministro_comp(estado, "defesa") - 50) * 0.01 - 0.25, 10, 100), 2)

    # ---- crescimento ----
    tratados = sum(1 for x in dip["entidades"].values() if x.get("tratado"))
    guerras = len(dip["guerras"])
    local = (s["infraestrutura"] - 50) * 0.025 + (s["educacao"] - 50) * 0.012 + (e["confianca"] - 50) * 0.03
    local -= (carga(estado) - CARGA_BASE) * 30
    local += (o["gasto_pct"] - GASTO_DISCR_PADRAO) * 0.03 + tratados * 0.06 - guerras * 0.5 + e["choque"]
    if est:
        alvo = e["tendencia"] * 0.5 + f["crescimento"] * 0.5 + local - (f["selic"] - 9) * 0.05
    else:
        alvo = e["tendencia"] + local - (e["selic"] - 9) * 0.12
    alvo += rng.uniform(-0.5, 0.5)
    e["crescimento"] = round(clamp(e["crescimento"] * 0.6 + alvo * 0.4, -8, 10), 3)
    e["choque"] = round(e["choque"] * 0.6, 3)

    # ---- inflação, juros, câmbio ----
    if est:
        e["inflacao"] = round(clamp(f["inflacao"] * 0.7 + e["inflacao"] * 0.3 + e["choque_inf"] + rng.uniform(-0.2, 0.2), 0, 40), 3)
        e["selic"] = f["selic"]
        e["cambio"] = round(clamp(e["cambio"] + rng.uniform(-0.05, 0.05), 3.5, 10), 3)
    else:
        alvo_inf = (3.5 + (e["crescimento"] - 2) * 0.35 + (e["cambio"] - 5.2) * 0.6 + max(0, deficit_pct - 3) * 0.25
                    - (e["selic"] - 9) * 0.22 + e["choque_inf"] + rng.uniform(-0.4, 0.4))
        e["inflacao"] = round(clamp(e["inflacao"] * 0.65 + alvo_inf * 0.35, 0, 40), 3)
        e["selic"] = round(clamp(e["selic"] + clamp((e["inflacao"] - 4.5) * 0.4, -1, 1) * (estado["justica"]["bc_indep"] / 100), 2, 25), 3)
        e["cambio"] = round(clamp(e["cambio"] + (e["divida_pib"] - 75) * 0.004 + (e["inflacao"] - 4) * 0.03
                                  - (e["confianca"] - 50) * 0.012 + rng.uniform(-0.12, 0.12), 3.5, 10), 3)
    e["choque_inf"] = round(e["choque_inf"] * 0.5, 3)

    # ---- emprego e confiança ----
    e["desemprego"] = round(clamp(e["desemprego"] - (e["crescimento"] - 1.8) * 0.28 + (8.5 - e["desemprego"]) * 0.04 + rng.uniform(-0.15, 0.15), 3.5, 20), 3)
    risco = estado["justica"]["impeachment"]["risco"]
    e["confianca"] = round(clamp(e["confianca"] + (e["crescimento"] - 2) * 1.2 - (e["divida_pib"] - 80) * 0.05
                                 - max(0, deficit_pct - 3) * 0.8 - (risco - 30) * 0.04
                                 - (estado["justica"]["corrupcao"] - 40) * 0.03 + (50 - e["confianca"]) * 0.08
                                 + (ministro_comp(estado, "fazenda") - 50) * 0.03 + rng.uniform(-1, 1), 5, 95), 3)

    # ---- nominal ----
    nominal = (e["crescimento"] + e["inflacao"]) / 400
    e["pib_bi"] = round(e["pib_bi"] * (1 + nominal), 2)
    e["rev_ref"] = e["rev_ref"] * (1 + nominal)
    e["divida_pib"] = round(e["divida_bi"] / e["pib_bi"] * 100, 3)
