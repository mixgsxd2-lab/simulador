"""Sorteio e resolução de eventos aleatórios."""
from ..data.eventos import EVENTOS
from ..data.politica import CENARIOS
from .util import aplicar_efeitos, noticia, clamp
from . import justica


def _mitigar(estado, efeitos, setor):
    if not setor:
        return efeitos
    fator = 1 - estado["setores"][setor] / 250
    return {k: (v * fator if v < 0 else v) for k, v in efeitos.items()}


def _especial(estado, nome, rng):
    if nome == "demitir_suspeito":
        suspeitos = [(p, m) for p, m in estado["ministros"].items() if m and m["integridade"] < 60]
        if suspeitos:
            pasta, m = min(suspeitos, key=lambda x: x[1]["integridade"])
            estado["ministros"][pasta] = None
            sigla = m["partido"]
            if sigla in estado["congresso"]["partidos"]:
                estado["congresso"]["partidos"][sigla]["ministros"] = max(0, estado["congresso"]["partidos"][sigla]["ministros"] - 1)
            noticia(estado, f"{m['nome']} deixou o cargo.", "info")
    elif nome == "abrir_investigacao":
        justica.abrir_investigacao(estado, rng)
    elif nome == "abrir_investigacao_presidente":
        justica.abrir_investigacao(estado, rng, alvo="presidente", gravidade=rng.choice([1, 2, 2, 3]))


def sortear(estado, rng):
    escopo = estado["meta"]["escopo"]
    if rng.random() > 0.7:
        return
    tags = CENARIOS.get(estado["meta"]["cenario"], {}).get("tags", {})
    candidatos, pesos = [], []
    for eid, ev in EVENTOS.items():
        if escopo not in ev["escopo"]:
            continue
        try:
            if not ev["cond"](estado):
                continue
        except (KeyError, TypeError):
            continue
        mult = 1.0
        for t in ev["tags"]:
            mult *= tags.get(t, 1.0)
        candidatos.append(eid)
        pesos.append(ev["peso"] * mult)
    if not candidatos:
        return
    eid = rng.choices(candidatos, pesos)[0]
    ev = EVENTOS[eid]
    if "escolhas" in ev:
        estado["evento"] = {"id": eid, "titulo": ev["titulo"], "texto": ev["texto"],
                            "escolhas": [{"label": c["label"], "desc": c.get("desc", "")} for c in ev["escolhas"]]}
        noticia(estado, f"Evento: {ev['titulo']} — decisão necessária.", "evento")
    else:
        aplicar_efeitos(estado, _mitigar(estado, ev["efeitos"], ev.get("mitiga")))
        if ev.get("especial"):
            _especial(estado, ev["especial"], rng)
        positivo = "positivo" in ev["tags"]
        noticia(estado, f"{ev['titulo']}: {ev['texto']}", "bom" if positivo else "evento")
    estado["meta"]["eventos_total"] = estado["meta"].get("eventos_total", 0) + 1


def responder(estado, indice, rng):
    pend = estado["evento"]
    if not pend:
        return False, "Nenhum evento pendente."
    ev = EVENTOS[pend["id"]]
    if indice < 0 or indice >= len(ev["escolhas"]):
        return False, "Escolha inválida."
    esc = ev["escolhas"][indice]
    custo = -esc.get("capital", 0)
    if custo > estado["capital"]:
        return False, "Capital político insuficiente."
    estado["capital"] -= custo
    if "chance" in esc:
        ok = rng.random() < esc["chance"]
        efeitos = esc["sucesso"] if ok else esc["falha"]
        resultado = "deu certo" if ok else "deu errado"
    else:
        efeitos, resultado = esc["efeitos"], ""
    aplicar_efeitos(estado, _mitigar(estado, efeitos, ev.get("mitiga")))
    if esc.get("especial"):
        _especial(estado, esc["especial"], rng)
    estado["evento"] = None
    msg = f"{ev['titulo']} — {esc['label']}: {esc.get('texto', '')} {resultado}".strip()
    noticia(estado, msg, "evento")
    return True, msg
