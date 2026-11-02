"""Justiça: STF independente, investigações, corrupção, impeachment; e sociedade (protestos, mídia)."""
from ..data.politica import PASTAS
from .util import clamp, sig, aplicar_efeitos, noticia
from . import congresso


# ---------- STF ----------
def revisar_lei(estado, lei, rng):
    """True se o STF derruba a lei (chance = risco × independência)."""
    j = estado["justica"]
    return rng.random() < lei["risco"] * (j["independencia"] / 100) * 0.9


# ---------- Investigações ----------
def abrir_investigacao(estado, rng, alvo=None, titulo=None, gravidade=None):
    j = estado["justica"]
    nome_alvo = alvo
    if alvo is None:
        suspeitos = [(p, m) for p, m in estado["ministros"].items() if m and m["integridade"] < 60]
        if suspeitos:
            pasta, m = min(suspeitos, key=lambda x: x[1]["integridade"])
            alvo = "ministro:" + pasta
            nome_alvo = m["nome"]
        else:
            alvo = "governo"
            nome_alvo = "o governo"
    elif alvo == "presidente":
        nome_alvo = estado["jogador"]["nome"]
    inv = {"id": estado["meta"]["turno"] * 100 + len(j["investigacoes"]), "alvo": alvo, "alvo_nome": nome_alvo,
           "titulo": titulo or f"Inquérito sobre {nome_alvo}", "gravidade": gravidade or rng.choice([1, 1, 2, 3]),
           "progresso": 0, "status": "aberta", "turno": estado["meta"]["turno"], "resposta": None}
    j["investigacoes"].append(inv)
    noticia(estado, f"Nova investigação: {inv['titulo']}.", "ruim")
    return inv


def passo_investigacoes(estado, rng):
    j = estado["justica"]
    for inv in j["investigacoes"]:
        if inv["status"] != "aberta":
            continue
        vel = rng.uniform(12, 22) * (0.5 + j["independencia"] / 100) * (1.4 if inv["resposta"] == "cooperar" else 1)
        inv["progresso"] = round(min(100, inv["progresso"] + vel), 1)
        if inv["progresso"] < 100:
            continue
        inv["status"] = "concluida"
        if inv["alvo"].startswith("ministro:"):
            pasta = inv["alvo"].split(":")[1]
            if estado["ministros"].get(pasta):
                estado["ministros"][pasta] = None
                noticia(estado, f"{inv['alvo_nome']} foi afastado após condenação em inquérito.", "ruim")
            aplicar_efeitos(estado, {"popularidade": -1.5 * inv["gravidade"], "justica.corrupcao": -2, "sociedade.midia": -2})
        elif inv["alvo"] == "presidente":
            noticia(estado, "O inquérito contra o chefe do governo foi concluído com denúncia.", "ruim")
            aplicar_efeitos(estado, {"popularidade": -3 * inv["gravidade"], "sociedade.midia": -6, "sociedade.protestos": 4 * inv["gravidade"]})
            inv["denuncia"] = True
        else:
            noticia(estado, f"Inquérito concluído: {inv['titulo']}.", "ruim")
            aplicar_efeitos(estado, {"popularidade": -1.5 * inv["gravidade"], "justica.corrupcao": 2})
    j["investigacoes"] = [i for i in j["investigacoes"]][-25:]


def risco_escandalo(estado, rng):
    """Ministros pouco íntegros geram escândalos."""
    for pasta, m in estado["ministros"].items():
        if m and m["integridade"] < 50 and rng.random() < (50 - m["integridade"]) / 220:
            if not any(i["status"] == "aberta" and i["alvo"] == "ministro:" + pasta for i in estado["justica"]["investigacoes"]):
                abrir_investigacao(estado, rng, alvo="ministro:" + pasta, titulo=f"Suspeitas contra {m['nome']} ({PASTAS[pasta].get(estado['meta']['escopo'], pasta)})")
                aplicar_efeitos(estado, {"justica.corrupcao": 3})
                return


# ---------- Impeachment ----------
def calcular_risco(estado):
    j = estado["justica"]
    abertas = [i for i in j["investigacoes"] if i["status"] == "aberta" and i["alvo"] == "presidente"]
    denunciado = sum(1 for i in j["investigacoes"] if i.get("denuncia"))
    ap = congresso.apoio(estado, "baixa")
    risco = ((50 - estado["popularidade"]) * 0.9 + (j["corrupcao"] - 40) * 0.3 + sum(i["gravidade"] for i in abertas) * 8
             + denunciado * 6 + (50 - ap) * 0.4 + estado["sociedade"]["protestos"] * 0.2 + (5 if estado["sociedade"]["midia"] < -30 else 0))
    j["impeachment"]["risco"] = round(clamp(risco, 0, 100), 1)


def _votos_contra(estado, casa):
    c = estado["congresso"]
    pop = estado["popularidade"]
    return sum(p[casa] * sig((50 - p["afin"]) / 12 + (50 - pop) / 40) for p in c["partidos"].values())


def passo_impeachment(estado, rng):
    """Retorna True se o chefe do governo foi afastado."""
    j = estado["justica"]
    imp = j["impeachment"]
    calcular_risco(estado)
    proc = imp["processo"]
    est = estado["meta"]["escopo"] == "estadual"
    termo = "governador" if est else "presidente"
    if proc is None:
        if imp["risco"] >= 65 and estado["popularidade"] < 35 and rng.random() < 0.35:
            imp["processo"] = {"etapa": "baixa", "turno": estado["meta"]["turno"], "protecao": 0}
            noticia(estado, f"Abertura de processo de impeachment contra o {termo}!", "ruim")
            aplicar_efeitos(estado, {"sociedade.protestos": 8, "economia.confianca": -6})
        return False
    casa = proc["etapa"] if estado["congresso"]["total_alta"] else "baixa"
    total = estado["congresso"]["total_" + casa]
    contra = _votos_contra(estado, casa) - proc["protecao"] * total / 100
    if contra >= total * 2 / 3:
        if casa == "baixa" and estado["congresso"]["total_alta"]:
            proc["etapa"] = "alta"
            proc["protecao"] = 0
            noticia(estado, "A Câmara autorizou o impeachment. O Senado julga em seguida.", "ruim")
            return False
        noticia(estado, f"O {termo} sofreu impeachment e foi afastado do cargo.", "ruim")
        imp["processo"] = None
        return True
    noticia(estado, f"O processo de impeachment foi barrado na votação ({casa}).", "bom")
    imp["processo"] = None
    aplicar_efeitos(estado, {"popularidade": 3})
    imp["risco"] = round(max(0, imp["risco"] - 20), 1)
    return False


# ---------- Sociedade ----------
def passo_sociedade(estado, rng):
    e = estado["economia"]
    soc = estado["sociedade"]
    j = estado["justica"]
    pop = estado["popularidade"]
    alvo_prot = 20 + (50 - pop) * 0.8 + (e["desemprego"] - 9) * 1.5 + (e["inflacao"] - 5) * 1.5 + (j["corrupcao"] - 40) * 0.2
    soc["protestos"] = round(clamp(soc["protestos"] * 0.75 + alvo_prot * 0.25 + rng.uniform(-2, 2), 0, 100), 2)
    soc["midia"] = round(clamp(soc["midia"] * 0.85 + ((pop - 50) * 1.2 - (j["corrupcao"] - 40) * 0.6) * 0.15, -100, 100), 2)
    soc["desigualdade"] = round(clamp(soc["desigualdade"] + (e["desemprego"] - 9) * 0.01 - (estado["setores"]["social"] - 50) * 0.012, 30, 70), 3)
    extremo = abs(estado["jogador"]["eco"]) * 5 + abs(estado["jogador"]["soc"]) * 5
    soc["polarizacao"] = round(clamp(soc["polarizacao"] + (45 + extremo - soc["polarizacao"]) * 0.04 + rng.uniform(-1, 1), 0, 100), 2)
    # corrupção percebida
    baixos = sum(1 for m in estado["ministros"].values() if m and m["integridade"] < 40)
    j["corrupcao"] = round(clamp(j["corrupcao"] - 0.4 + baixos * 0.6 + (100 - j["independencia"]) * 0.004, 0, 100), 2)
    j["confianca_stf"] = round(clamp(j["confianca_stf"] + (j["independencia"] - 70) * 0.02, 0, 100), 2)
    j["independencia"] = round(clamp(j["independencia"] + 0.3, 0, 100), 2)  # recuperação lenta
