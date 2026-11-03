"""Ciclo de turnos (trimestres), posse, eleições, fim de mandato e encerramento da RUN."""
from ..data.politica import PROPOSTAS
from . import economia, congresso, justica, diplomacia, eleicoes, eventos, estado as est, relatorio
from .util import clamp, noticia, aplicar_efeitos, get_path

CAMPANHA_INICIO = 13  # turno do mandato em que começa a campanha de reeleição


def _tempo(m):
    m["turno"] += 1
    m["trimestre"] += 1
    if m["trimestre"] > 4:
        m["trimestre"] = 1
        m["ano"] += 1


def avancar(estado, rng):
    m = estado["meta"]
    if m["encerrado"]:
        return False, "A partida já terminou."
    if estado["evento"]:
        return False, "Responda ao evento pendente antes de avançar."
    if m["fase"] == "campanha":
        return _turno_campanha(estado, rng)
    return _turno_governo(estado, rng)


# ---------- campanha inicial ----------
def _turno_campanha(estado, rng):
    c = estado["campanha"]
    _tempo(estado["meta"])
    c["turnos_restantes"] -= 1
    c["reconhecimento"] = round(min(100, c["reconhecimento"] + 1), 2)
    c["fundo"] = round(c["fundo"] + 30 + c["reconhecimento"] * 0.2, 1)
    estado["capital"] = 5
    for cand in c["candidatos"]:
        cand["forca"] = round(clamp(cand["forca"] + rng.uniform(-2, 2.5), 15, 70), 1)
    eleicoes.atualizar_pesquisa(estado, rng)
    lider = c["pesquisa"][0]
    noticia(estado, f"Pesquisa: {lider['nome']} ({lider['partido']}) lidera com {lider['pct']}%.", "info")
    if c["turnos_restantes"] > 0:
        est.registrar_historico(estado)
        return True, "Campanha avança."
    return _resolver_eleicao(estado, rng, "inicial")


# ---------- governo ----------
def _atualizar_popularidade(estado):
    e, s, soc, j = estado["economia"], estado["setores"], estado["sociedade"], estado["justica"]
    alvo = (50 + (e["crescimento"] - 2) * 3 - (e["inflacao"] - 4) * 2.5 - (e["desemprego"] - 8) * 2
            + (s["saude"] - 50) * 0.15 + (s["educacao"] - 50) * 0.08 + (s["seguranca"] - 50) * 0.15 + (s["social"] - 50) * 0.15
            + soc["midia"] * 0.08 - (j["corrupcao"] - 40) * 0.25 - (soc["protestos"] - 20) * 0.15
            - (economia.carga(estado) - economia.CARGA_BASE) * 40)
    if estado["meta"]["escopo"] == "estadual":
        alvo += (estado["federal"]["relacao"] - 50) * 0.05
    estado["popularidade"] = round(clamp(estado["popularidade"] + 0.3 * (alvo - estado["popularidade"]), 4, 90), 2)


def _turno_governo(estado, rng):
    m = estado["meta"]
    economia.passo(estado, rng)
    congresso.passo(estado, rng)
    justica.risco_escandalo(estado, rng)
    justica.passo_investigacoes(estado, rng)
    justica.passo_sociedade(estado, rng)
    diplomacia.passo(estado, rng)
    _atualizar_popularidade(estado)

    if justica.passo_impeachment(estado, rng):
        return _encerrar(estado, "impeachment")
    if estado["popularidade"] < 8 and estado["sociedade"]["protestos"] > 85:
        noticia(estado, "Sem apoio e cercado pelos protestos, o governante renuncia.", "ruim")
        return _encerrar(estado, "renuncia")

    eventos.sortear(estado, rng)
    _tempo(m)
    m["turno_mandato"] += 1
    ap = congresso.apoio(estado, "baixa")
    estado["capital"] = int(min(8, estado["capital"] + 3 + int(estado["popularidade"] // 30) + (1 if ap > 50 else 0)))
    estado["justica"]["impeachment"]["risco"] = estado["justica"]["impeachment"]["risco"]
    est.registrar_historico(estado)

    c = estado["campanha"]
    if c.get("ativa"):
        c["fundo"] = round(c["fundo"] + 20, 1)
        for cand in c["candidatos"]:
            cand["forca"] = round(clamp(cand["forca"] + rng.uniform(-1.5, 2), 15, 70), 1)
        eleicoes.atualizar_pesquisa(estado, rng)
    elif m["turno_mandato"] == CAMPANHA_INICIO and _disputa_eleicao(estado):
        eleicoes.nova_campanha(estado, rng, sucessor=m["mandato"] >= 2)
        noticia(estado, "Começa a campanha eleitoral. Use as ações de campanha na aba Governo.", "evento")
    if m["turno_mandato"] >= est.TURNOS_MANDATO:
        return _fim_de_mandato(estado, rng)
    return True, "Trimestre concluído."


def _disputa_eleicao(estado):
    m = estado["meta"]
    if m["mandato"] < 2:
        return True
    return m["duracao"] == "longa"  # sucessor


# ---------- promessas, eleição e fim de mandato ----------
def avaliar_promessas(estado):
    cumpridas, itens = 0, []
    leis = {l["id"] for l in estado["congresso"]["leis_aprovadas"]}
    for pid in estado["jogador"]["propostas"]:
        p = PROPOSTAS[pid]
        if "lei" in p:
            ok = p["lei"] in leis
        else:
            caminho, direcao = p["meta"][0], p["meta"][1]
            atual = get_path(estado, caminho)
            if len(p["meta"]) == 4:
                ok = atual <= p["meta"][3]
            else:
                ok = atual <= estado["snap"].get(caminho, atual) - p["meta"][2]
        cumpridas += ok
        itens.append({"id": pid, "nome": p["nome"], "cumprida": bool(ok)})
    return cumpridas, itens


def _resolver_eleicao(estado, rng, tipo):
    m = estado["meta"]
    c = estado["campanha"]
    if tipo != "inicial":
        cumpridas, itens = avaliar_promessas(estado)
        c["boost"] = round(c["boost"] + 2 * cumpridas - 2 * (len(itens) - cumpridas), 2)
    res = eleicoes.rodar_eleicao(estado, rng)
    res["tipo"] = tipo
    # a votação acontece no trimestre que acabou de terminar (outubro); a posse é no ano seguinte
    res["ano"] = m["ano"] - 1 if m["trimestre"] == 1 else m["ano"]
    estado["eleicoes"].append(res)
    c["ativa"] = False
    quem = "Você" if tipo != "sucessor" else "Seu sucessor"
    if res["venceu"]:
        noticia(estado, f"{quem} venceu a eleição ({'2º turno' if res['turno2'] else '1º turno'})!", "bom")
    else:
        noticia(estado, f"{quem} perdeu a eleição.", "ruim")

    if tipo == "inicial":
        if not res["venceu"]:
            return _encerrar(estado, "derrota_inicial")
        _posse(estado, rng)
        return True, "Eleito! Começa o mandato."
    if tipo == "sucessor":
        return _encerrar(estado, "sucessor_eleito" if res["venceu"] else "sucessor_derrotado")
    # reeleição
    if not res["venceu"]:
        return _encerrar(estado, "derrota")
    if m["mandato"] >= m["max_mandatos"]:
        return _encerrar(estado, "reeleito")
    estado["popularidade"] = round(clamp((estado["popularidade"] + 55) / 2, 40, 70), 2)
    _posse(estado, rng)
    return True, "Reeleito! Começa o segundo mandato."


def _fim_de_mandato(estado, rng):
    m = estado["meta"]
    if m["mandato"] < 2 and m["mandato"] <= m["max_mandatos"]:
        return _resolver_eleicao(estado, rng, "reeleicao")
    if m["duracao"] == "longa":
        return _resolver_eleicao(estado, rng, "sucessor")
    return _encerrar(estado, "mandato_completo")


def _posse(estado, rng):
    m = estado["meta"]
    m["fase"] = "governo"
    m["mandato"] += 1
    m["turno_mandato"] = 0
    estado["campanha"] = {"ativa": False}
    if m["mandato"] == 1:
        estado["popularidade"] = 55.0
        for pasta, cands in estado["candidatos_ministros"].items():
            if not estado["ministros"][pasta]:
                est.nomear(estado, pasta, max(cands, key=lambda x: x["competencia"] * 0.6 + x["integridade"] * 0.4 + rng.uniform(0, 25)))
                estado["candidatos_ministros"][pasta] = est.gerar_candidatos(estado, rng, pasta)
    est.tirar_foto(estado)
    estado["capital"] = 6
    noticia(estado, f"Posse do {m['mandato']}º mandato. Boa sorte!", "bom")
    est.registrar_historico(estado)


def _encerrar(estado, resultado):
    m = estado["meta"]
    m["encerrado"] = True
    m["resultado"] = resultado
    m["fase"] = "fim"
    estado["campanha"] = {"ativa": False}
    estado["relatorio"] = relatorio.gerar(estado)
    return True, "A partida terminou."
