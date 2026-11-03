"""Ações do jogador: cada handler recebe (estado, params, rng) e devolve (ok, mensagem)."""
import random
from ..data.politica import LEIS, PASTAS, SETORES
from . import congresso, diplomacia, economia, eleicoes, eventos, justica, turno, estado as est
from .util import clamp, aplicar_efeitos, noticia, gastar_ou_receber

ACOES_CAMPANHA = {"comicio", "tv", "redes", "ataque", "alianca", "debate"}


def _cap(estado, custo):
    if estado["capital"] < custo:
        return f"Pontos de ação insuficientes (precisa de {custo})."
    estado["capital"] -= custo
    return None


def _num(v, lo, hi, padrao):
    try:
        return clamp(float(v), lo, hi)
    except (TypeError, ValueError):
        return padrao


# ---------- economia ----------
def ajustar_impostos(estado, p, rng):
    novos = {k: _num(p.get(k), 0, 45, estado["impostos"][k]) for k in estado["impostos"]}
    if all(abs(novos[k] - estado["impostos"][k]) < 1e-6 for k in novos):
        return False, "Nenhuma alteração."
    erro = _cap(estado, 1)
    if erro:
        return False, erro
    estado["impostos"] = {k: round(v, 1) for k, v in novos.items()}
    return True, "Alíquotas atualizadas."


def ajustar_orcamento(estado, p, rng):
    o = estado["orcamento"]
    aloc = {k: _num((p.get("aloc") or {}).get(k), 0, 100, o["aloc"][k]) for k in o["aloc"]}
    if estado["meta"]["escopo"] == "estadual":
        aloc["defesa"] = 0
    if sum(aloc.values()) <= 0:
        return False, "Orçamento inválido."
    o["aloc"] = economia.normalizar_aloc(aloc)
    o["gasto_pct"] = round(_num(p.get("gasto_pct"), 15, 45, o["gasto_pct"]), 1)
    return True, "Orçamento atualizado."


def pressionar_bc(estado, p, rng):
    if estado["meta"]["escopo"] != "nacional":
        return False, "Indisponível."
    erro = _cap(estado, 2)
    if erro:
        return False, erro
    e, j = estado["economia"], estado["justica"]
    e["selic"] = round(clamp(e["selic"] - 1.0, 2, 25), 2)
    j["bc_indep"] = round(clamp(j["bc_indep"] - 6, 0, 100), 2)
    aplicar_efeitos(estado, {"economia.confianca": -3, "economia.choque_inf": 0.3, "popularidade": 1})
    return True, "O Banco Central cedeu e reduziu os juros. O mercado desconfia."


# ---------- economia simplificada (um clique) ----------
NIVEIS_GASTO = {"austeridade": 22.0, "equilibrio": 27.0, "investimento": 32.0}


def politica_fiscal(estado, p, rng):
    """Baixa ou aumenta todos os impostos de uma vez."""
    d = {"baixar": -1, "aumentar": 1}.get(p.get("direcao"))
    if not d:
        return False, "Escolha baixar ou aumentar."
    erro = _cap(estado, 1)
    if erro:
        return False, erro
    for k in estado["impostos"]:
        passo = 1.0 if k == "importacao" else 2.0
        estado["impostos"][k] = round(clamp(estado["impostos"][k] + d * passo, 0, 45), 1)
    if d < 0:
        return True, "Impostos reduzidos: a economia e a popularidade sobem, mas entra menos dinheiro no caixa."
    return True, "Impostos aumentados: entra mais dinheiro no caixa, mas a economia e a popularidade sofrem."


def plano_orcamento(estado, p, rng):
    """Define o nível de gasto e uma área prioritária (recebe uma fatia maior do orçamento)."""
    o = estado["orcamento"]
    nivel = p.get("nivel") if p.get("nivel") in NIVEIS_GASTO else o.get("nivel", "equilibrio")
    prioridade = p.get("prioridade") if p.get("prioridade") in SETORES else o.get("prioridade")
    if p.get("prioridade") == "nenhuma":
        prioridade = None
    escopo = estado["meta"]["escopo"]
    aloc = dict(economia.alocacao_inicial(escopo))
    if prioridade:
        aloc[prioridade] = aloc[prioridade] + 12
    o["aloc"] = economia.normalizar_aloc(aloc)
    o["gasto_pct"] = NIVEIS_GASTO[nivel]
    o["nivel"], o["prioridade"] = nivel, prioridade
    nomes = {"austeridade": "austeridade (gasta menos, sobra caixa)", "equilibrio": "equilíbrio", "investimento": "investimento (serviços melhoram, caixa cai)"}
    from ..data.politica import ROTULO_SETOR
    return True, f"Orçamento: {nomes[nivel]}" + (f", prioridade em {ROTULO_SETOR[prioridade].lower()}." if prioridade else ".")


# ---------- gabinete ----------
def nomear_ministro(estado, p, rng):
    pasta, i = p.get("pasta"), p.get("indice")
    if pasta not in estado["ministros"]:
        return False, "Pasta inválida."
    cands = estado["candidatos_ministros"].get(pasta, [])
    if not isinstance(i, int) or not 0 <= i < len(cands):
        return False, "Candidato inválido."
    erro = _cap(estado, 1)
    if erro:
        return False, erro
    est.demitir(estado, pasta)
    cand = cands[i]
    est.nomear(estado, pasta, cand)
    estado["candidatos_ministros"][pasta] = est.gerar_candidatos(estado, rng, pasta)
    return True, f"{cand['nome']} ({cand['partido']}) nomeado(a)."


def demitir_ministro(estado, p, rng):
    m = est.demitir(estado, p.get("pasta"))
    if not m:
        return False, "Cargo vago."
    return True, f"{m['nome']} foi exonerado(a)."


# ---------- Congresso ----------
def propor_lei(estado, p, rng):
    lei_id = p.get("lei")
    lei = LEIS.get(lei_id)
    escopo = estado["meta"]["escopo"]
    if not lei or escopo not in lei["escopos"]:
        return False, "Lei indisponível."
    c = estado["congresso"]
    if any(l["id"] == lei_id for l in c["leis_aprovadas"]):
        return False, "Essa lei já está em vigor."
    if any(l["id"] == lei_id and estado["meta"]["turno"] - l["turno"] < 2 for l in c["leis_rejeitadas"] + c["leis_derrubadas"]):
        return False, "Aguarde antes de reenviar essa proposta."
    erro = _cap(estado, lei["custo"])
    if erro:
        return False, erro
    ok, msg = congresso.tramitar_lei(estado, lei_id, rng)
    return True, msg


def negociar(estado, p, rng):
    tipo = p.get("tipo")
    sigla = p.get("partido")
    if sigla not in estado["congresso"]["partidos"]:
        return False, "Partido inválido."
    if tipo == "emendas":
        valor = _num(p.get("valor"), 5, 50, 10)
        erro = _cap(estado, 1)
        if erro:
            return False, erro
        gastar_ou_receber(estado, -valor)
        congresso.liberar_emendas(estado, sigla, valor)
        return True, f"R$ {valor:.0f} bi em emendas liberadas para {sigla}."
    if tipo == "pressionar":
        erro = _cap(estado, 1)
        if erro:
            return False, erro
        part = estado["congresso"]["partidos"][sigla]
        if rng.random() < 0.5:
            part["afin"] = round(clamp(part["afin"] + 10, 0, 100), 2)
            return True, f"{sigla} cedeu à pressão."
        part["afin"] = round(clamp(part["afin"] - 8, 0, 100), 2)
        aplicar_efeitos(estado, {"sociedade.midia": -2})
        return True, f"{sigla} reagiu mal à pressão."
    return False, "Tipo de negociação inválido."


def negociar_base(estado, p, rng):
    """Um clique: libera emendas para todos os partidos indecisos (afinidade entre 40 e 60)."""
    indecisos = [s for s, x in estado["congresso"]["partidos"].items() if 40 <= x["afin"] < 60 and not x["jogador"]]
    if not indecisos:
        return False, "Não há partidos indecisos para negociar agora."
    erro = _cap(estado, 1)
    if erro:
        return False, erro
    gastar_ou_receber(estado, -20)
    for s in indecisos:
        congresso.liberar_emendas(estado, s, 20 / len(indecisos) * 2)
    return True, f"R$ 20 bi em emendas para {len(indecisos)} partido(s) indeciso(s): mais votos no Congresso."


# ---------- justiça / mídia ----------
def responder_investigacao(estado, p, rng):
    inv = next((i for i in estado["justica"]["investigacoes"] if i["id"] == p.get("id") and i["status"] == "aberta"), None)
    resp = p.get("resposta")
    if not inv:
        return False, "Investigação não encontrada."
    if resp == "cooperar":
        inv["resposta"] = "cooperar"
        aplicar_efeitos(estado, {"sociedade.midia": 2})
        return True, "O governo colaborará com as investigações."
    if resp == "demitir" and inv["alvo"].startswith("ministro:"):
        est.demitir(estado, inv["alvo"].split(":")[1])
        inv["status"] = "arquivada"
        aplicar_efeitos(estado, {"popularidade": -0.5, "justica.corrupcao": -2})
        return True, "O suspeito foi exonerado e o caso perdeu força."
    if resp == "obstruir":
        erro = _cap(estado, 2)
        if erro:
            return False, erro
        inv["resposta"] = "obstruir"
        if rng.random() < 1 - estado["justica"]["independencia"] / 130:
            inv["progresso"] = max(0, inv["progresso"] - 30)
            aplicar_efeitos(estado, {"justica.independencia": -3, "justica.corrupcao": 3, "sociedade.midia": -5})
            return True, "A investigação foi atrasada — a imprensa cobrou explicações."
        aplicar_efeitos(estado, {"justica.corrupcao": 4, "sociedade.midia": -8, "popularidade": -3})
        return True, "A tentativa de obstrução foi descoberta e piorou a situação."
    return False, "Resposta inválida."


def pressionar_stf(estado, p, rng):
    erro = _cap(estado, 2)
    if erro:
        return False, erro
    aplicar_efeitos(estado, {"justica.independencia": -6, "sociedade.midia": -4, "sociedade.polarizacao": 3})
    return True, "A pressão sobre o Judiciário gerou desgaste institucional."


def indicar_stf(estado, p, rng):
    j = estado["justica"]
    if not j["vaga_stf"]:
        return False, "Não há vaga no STF."
    erro = _cap(estado, 1)
    if erro:
        return False, erro
    perfil = p.get("perfil")
    j["vaga_stf"] = False
    if perfil == "tecnico":
        aplicar_efeitos(estado, {"justica.independencia": 4, "justica.confianca_stf": 4})
        return True, "Jurista técnico indicado e aprovado."
    aplicar_efeitos(estado, {"justica.independencia": -4, "congresso.afinidade_geral": 2})
    return True, "Aliado político indicado ao STF."


def publicidade(estado, p, rng):
    tipo = p.get("tipo")
    opcoes = {"tv": (1, 25, {"popularidade": 2, "sociedade.midia": 2}, "Campanha publicitária no ar."),
              "cadeia": (2, 0, {"popularidade": 3, "sociedade.midia": -4, "sociedade.polarizacao": 2}, "Pronunciamento em rede nacional."),
              "pressionar": (2, 0, {"sociedade.midia": 6, "sociedade.polarizacao": 4, "justica.corrupcao": 1}, "A pressão sobre veículos rendeu coberturas favoráveis, a custo de credibilidade.")}
    if tipo not in opcoes:
        return False, "Tipo inválido."
    cap, custo, efeitos, msg = opcoes[tipo]
    erro = _cap(estado, cap)
    if erro:
        return False, erro
    gastar_ou_receber(estado, -custo)
    aplicar_efeitos(estado, efeitos)
    return True, msg


def negociar_impeachment(estado, p, rng):
    proc = estado["justica"]["impeachment"]["processo"]
    if not proc:
        return False, "Não há processo de impeachment."
    erro = _cap(estado, 2)
    if erro:
        return False, erro
    gastar_ou_receber(estado, -20)
    proc["protecao"] = min(30, proc["protecao"] + 12)
    aplicar_efeitos(estado, {"congresso.afinidade_geral": 6})
    return True, "Negociação com os parlamentares para barrar o processo."


# ---------- diplomacia ----------
CUSTO_DIPLO = {"melhorar": 1, "tratado": 2, "alianca": 2, "sancionar": 1, "retirar_sancao": 0, "declarar_guerra": 3, "paz": 1,
               "onu_resolucao": 1, "onu_missao": 2, "onu_conselho": 3}


def acao_diplomatica(estado, p, rng):
    ac = p.get("acao")
    if ac not in CUSTO_DIPLO:
        return False, "Ação inválida."
    if estado["capital"] < CUSTO_DIPLO[ac]:
        return False, f"Pontos de ação insuficientes (precisa de {CUSTO_DIPLO[ac]})."
    ok, msg = diplomacia.acao(estado, ac, p.get("alvo"), rng)
    if ok:
        estado["capital"] -= CUSTO_DIPLO[ac]
        noticia(estado, msg, "info")
    return ok, msg


def reuniao_diplomatica(estado, p, rng):
    formato = p.get("formato")
    if formato not in diplomacia.FORMATOS:
        return False, "Formato de reunião inválido."
    custo = diplomacia.FORMATOS[formato]["capital"]
    if estado["capital"] < custo:
        return False, f"Pontos de ação insuficientes (precisa de {custo})."
    ok, msg, _ = diplomacia.reuniao(estado, p.get("alvo"), formato, p.get("pauta") or None, p.get("proposta") or None,
                                    p.get("concessao") or "nenhuma", rng)
    if ok:
        estado["capital"] -= custo
    return ok, msg


def cupula_multilateral(estado, p, rng):
    if estado["meta"]["escopo"] != "nacional":
        return False, "Cúpulas de blocos existem apenas no modo presidente."
    if estado["capital"] < 3:
        return False, "Pontos de ação insuficientes (precisa de 3)."
    ok, msg = diplomacia.cupula_bloco(estado, p.get("bloco"), p.get("pauta"), p.get("proposta"), rng)
    if ok:
        estado["capital"] -= 3
    return ok, msg


def responder_proposta(estado, p, rng):
    try:
        pid = int(p.get("id"))
    except (TypeError, ValueError):
        return False, "Proposta inválida."
    return diplomacia.responder_proposta(estado, pid, bool(p.get("aceitar")))


def denunciar_acordo(estado, p, rng):
    try:
        aid = int(p.get("id"))
    except (TypeError, ValueError):
        return False, "Acordo inválido."
    erro = _cap(estado, 1)
    if erro:
        return False, erro
    ok, msg = diplomacia.denunciar(estado, aid)
    if not ok:
        estado["capital"] += 1
    return ok, msg


def pedir_repasse(estado, p, rng):
    if estado["meta"]["escopo"] != "estadual":
        return False, "Indisponível."
    if estado["federal"].get("vinculado"):
        return False, "O presidente é um jogador: faça seus pedidos a ele na aba Sala."
    erro = _cap(estado, 2)
    if erro:
        return False, erro
    f = estado["federal"]
    if rng.random() < clamp(f["relacao"] / 100 + 0.1, 0.1, 0.9):
        gastar_ou_receber(estado, estado["economia"]["pib_bi"] * 0.012)
        f["relacao"] = round(clamp(f["relacao"] - 3, 0, 100), 2)
        return True, "Brasília liberou recursos extras ao estado."
    f["relacao"] = round(clamp(f["relacao"] - 2, 0, 100), 2)
    return True, "O governo federal negou o pedido."


def alinhar_federal(estado, p, rng):
    if estado["meta"]["escopo"] != "estadual":
        return False, "Indisponível."
    if estado["federal"].get("vinculado"):
        return False, "O presidente é um jogador: faça seus pedidos a ele na aba Sala."
    erro = _cap(estado, 1)
    if erro:
        return False, erro
    estado["federal"]["relacao"] = round(clamp(estado["federal"]["relacao"] + 8, 0, 100), 2)
    aplicar_efeitos(estado, {"sociedade.polarizacao": 1})
    return True, "Aproximação com Brasília: relação federativa melhorou."


# ---------- campanha / eventos / fim ----------
def campanha(estado, p, rng):
    ok, msg, _ = eleicoes.acao_campanha(estado, p.get("acao"), p, rng)
    return ok, msg


def responder_evento(estado, p, rng):
    try:
        i = int(p.get("escolha"))
    except (TypeError, ValueError):
        return False, "Escolha inválida."
    return eventos.responder(estado, i, rng)


def avancar_turno(estado, p, rng):
    return turno.avancar(estado, rng)


def encerrar_run(estado, p, rng):
    turno._encerrar(estado, "desistiu")
    return True, "Partida encerrada."


HANDLERS = {f.__name__: f for f in (
    ajustar_impostos, ajustar_orcamento, politica_fiscal, plano_orcamento, negociar_base, pressionar_bc, nomear_ministro, demitir_ministro, propor_lei, negociar,
    responder_investigacao, pressionar_stf, indicar_stf, publicidade, negociar_impeachment, acao_diplomatica,
    responder_proposta, denunciar_acordo,
    pedir_repasse, alinhar_federal, campanha, responder_evento, avancar_turno, encerrar_run)}

# ações permitidas durante a campanha inicial (antes da posse)
FASE_CAMPANHA = {"campanha", "avancar_turno", "encerrar_run"}
SEMPRE = {"responder_evento", "avancar_turno", "encerrar_run"}


def executar(estado, tipo, params, rng=None):
    rng = rng or random.Random()
    if estado["meta"]["encerrado"]:
        return False, "A partida já terminou."
    h = HANDLERS.get(tipo)
    if not h:
        return False, "Ação desconhecida."
    if estado["meta"]["fase"] == "campanha" and tipo not in FASE_CAMPANHA:
        return False, "Disponível apenas depois da posse."
    if estado["evento"] and tipo not in SEMPRE:
        return False, "Responda ao evento pendente primeiro."
    ok, msg = h(estado, params or {}, rng)
    # vaga no STF aparece ocasionalmente após ações de governo
    if tipo == "avancar_turno" and ok and not estado["meta"]["encerrado"] and estado["meta"]["escopo"] == "nacional":
        j = estado["justica"]
        if not j["vaga_stf"] and rng.random() < 0.04:
            j["vaga_stf"] = True
            noticia(estado, "Abriu uma vaga no STF: indique um novo ministro.", "evento")
    return ok, msg
