"""Multiplayer.

O anfitrião é o presidente. Quem entra como governador recebe a própria partida estadual (mesmas regras do
modo governador: orçamento, Assembleia, leis, eventos, eleição), ligada à do presidente: a economia federal
do estado é a do presidente e os dois negociam verbas, obras, convênios e apoio político.
Ministros, parlamentares e líderes estrangeiros enviam pedidos ao presidente.
O trimestre só avança quando todos os jogadores online clicam em "Pronto".
"""
from ..data.politica import SETORES, ROTULO_SETOR
from .util import aplicar_efeitos, noticia, gastar_ou_receber, clamp, distancia
from . import acoes, diplomacia, economia, eleicoes, eventos, estado as est

PAPEIS = {
    "presidente": "Presidente (anfitrião)",
    "governador": "Governador (governa um estado)",
    "ministro": "Ministro",
    "parlamentar": "Parlamentar",
    "lider": "Líder de outro país",
}
# pedidos que cada papel pode enviar
TIPOS_POR_PAPEL = {
    "governador": {"repasse", "obra", "forca_nacional", "apoio_politico"},
    "presidente": {"verba", "convenio", "pede_apoio"},
    "ministro": {"orcamento"}, "parlamentar": {"apoio"}, "lider": {"acordo", "reuniao"},
}
COM_VALOR = {"repasse", "apoio", "verba", "convenio"}
COM_SETOR = {"obra", "convenio"}
NOMES_PEDIDO = {"repasse": "Repasse de verba", "obra": "Obra/programa federal", "forca_nacional": "Força Nacional",
                "apoio_politico": "Oferta de apoio político", "verba": "Envio de verba", "convenio": "Convênio federal",
                "pede_apoio": "Pedido de apoio político", "orcamento": "Mais orçamento", "apoio": "Apoio por emendas",
                "acordo": "Ação diplomática", "reuniao": "Proposta de acordo"}


def validar(papel, tipo, payload):
    if tipo not in TIPOS_POR_PAPEL.get(papel, set()):
        return "Seu papel não pode enviar esse tipo de pedido."
    if tipo in COM_VALOR:
        try:
            v = float(payload.get("valor"))
        except (TypeError, ValueError):
            return "Valor inválido."
        if not 1 <= v <= 100:
            return "O valor deve ficar entre R$ 1 e 100 bi."
    if tipo in COM_SETOR and payload.get("setor") not in SETORES:
        return "Escolha uma área."
    if tipo == "reuniao":
        pauta = diplomacia.PAUTAS.get(payload.get("pauta"))
        if not pauta or payload.get("proposta") not in pauta["propostas"]:
            return "Escolha uma pauta e uma proposta de acordo."
    return None


# ---------------------------------------------------------------- governos estaduais
def vincular_macro(gov, pres):
    """A economia federal vista pelo estado é a do presidente."""
    e, f = pres["economia"], gov["federal"]
    f.update(crescimento=round(e["crescimento"], 3), inflacao=round(e["inflacao"], 3), selic=round(e["selic"], 3),
             presidente=pres["jogador"]["nome"], partido_pres=pres["jogador"]["partido"])


def criar_governo(pres, nome, uf, partido, ideologia, rng):
    """Partida estadual de um governador, com o calendário alinhado ao do presidente."""
    cfg = {"modo": "governador", "duracao": pres["meta"]["duracao"], "ideologia": ideologia, "partido": partido, "uf": uf,
           "nome": nome, "idade": rng.randint(40, 62), "cenario": pres["meta"]["cenario"], "propostas": []}
    g = est.novo_jogo(cfg)
    m, pm = g["meta"], pres["meta"]
    for k in ("turno", "ano", "trimestre", "turno_mandato"):
        m[k] = pm[k]
    for h in g["historico"]:
        h.update(turno=pm["turno"], ano=pm["ano"], tri=pm["trimestre"])
    m["multiplayer"] = True
    f = g["federal"]
    f["vinculado"] = True
    jp, jg = pres["jogador"], g["jogador"]
    afin = 62 if jp["partido"] == partido else 58 - 30 * distancia(jp["eco"], jp["soc"], jg["eco"], jg["soc"])
    f["relacao"] = round(clamp(afin + rng.uniform(-4, 4), 15, 85), 1)
    vincular_macro(g, pres)
    if pres["campanha"].get("ativa") and pm["fase"] == "governo":  # entrou durante a campanha: disputa também
        eleicoes.nova_campanha(g, rng, sucessor=m["mandato"] >= 2)
    noticia(g, f"Você governa {m['rotulo']} na sala do presidente {jp['nome']} ({jp['partido']}).", "info")
    return g


def resumo_governo(jid, g):
    m = g["meta"]
    return {"id": jid, "nome": g["jogador"]["nome"], "partido": g["jogador"]["partido"], "uf": m["uf"], "rotulo": m["rotulo"],
            "popularidade": round(g["popularidade"], 1), "relacao": round(g["federal"]["relacao"], 1),
            "caixa": round(g["economia"]["caixa"], 1), "resultado": round(g["economia"]["resultado"], 1),
            "setores": {k: round(v) for k, v in g["setores"].items()}, "encerrado": m["encerrado"],
            "fase": m["fase"], "aparencia": g["jogador"].get("aparencia", {}), "idade": g["jogador"]["idade"]}


def resumo_presidente(pres):
    e, j = pres["economia"], pres["jogador"]
    return {"nome": j["nome"], "partido": j["partido"], "popularidade": round(pres["popularidade"], 1),
            "crescimento": round(e["crescimento"], 2), "inflacao": round(e["inflacao"], 2), "selic": round(e["selic"], 2),
            "desemprego": round(e["desemprego"], 2), "caixa": round(e["caixa"], 1), "encerrado": pres["meta"]["encerrado"],
            "aparencia": j.get("aparencia", {}), "idade": j["idade"]}


def avancar_todos(pres, govs, rng):
    """Avança o trimestre do presidente e de todos os governos estaduais. Eventos sem resposta são decididos
    automaticamente (só acontece quando o anfitrião força o avanço)."""
    jogos = [pres] + list(govs)
    for g in jogos:
        if g["evento"] and not g["meta"]["encerrado"]:
            titulo = g["evento"]["titulo"]
            eventos.responder(g, 0, rng)
            noticia(g, f"Sem resposta a tempo, a assessoria decidiu sobre '{titulo}'.", "info")
    msg = "Trimestre concluído."
    if not pres["meta"]["encerrado"]:
        _, msg = acoes.executar(pres, "avancar_turno", {}, rng)
    for g in govs:
        if g["meta"]["encerrado"]:
            continue
        vincular_macro(g, pres)
        acoes.executar(g, "avancar_turno", {}, rng)
    return msg


# ---------------------------------------------------------------- pedidos
def _rel(gov, d):
    if gov:
        f = gov["federal"]
        f["relacao"] = round(clamp(f["relacao"] + d, 0, 100), 2)


def _gov_nome(gov, autor):
    return f"{autor} ({gov['meta']['rotulo']})" if gov else autor


def aplicar(estado, pedido, rng, aprovado, gov=None):
    """Aplica a decisão. `estado` é a partida do presidente; `gov`, a do governador envolvido (se houver).
    Retorna a mensagem."""
    pl, tipo, autor = pedido["payload"], pedido["tipo"], pedido["autor"]
    quem = _gov_nome(gov, autor)
    setor = pl.get("setor")
    rot = ROTULO_SETOR.get(setor, setor)
    if tipo == "repasse":
        v = float(pl["valor"])
        if aprovado:
            gastar_ou_receber(estado, -v)
            if gov:
                gastar_ou_receber(gov, v)
            _rel(gov, 3 + v / 5)
            aplicar_efeitos(estado, {"congresso.afinidade_geral": v / 20})
            msg = f"Repasse de R$ {v:.0f} bi aprovado para {quem}."
        else:
            _rel(gov, -3)
            aplicar_efeitos(estado, {"congresso.afinidade_geral": -1})
            msg = f"Repasse para {quem} negado."
    elif tipo == "obra":
        if aprovado:
            gastar_ou_receber(estado, -20)
            aplicar_efeitos(estado, {"popularidade": 0.5})
            if gov:
                aplicar_efeitos(gov, {f"setores.{setor}": 6, "popularidade": 1})
            _rel(gov, 4)
            msg = f"Programa federal de {rot} aprovado para {quem} (R$ 20 bi)."
        else:
            _rel(gov, -2)
            msg = f"Pedido de programa de {rot} de {quem} negado."
    elif tipo == "forca_nacional":
        if aprovado:
            gastar_ou_receber(estado, -8)
            if gov:
                aplicar_efeitos(gov, {"setores.seguranca": 5, "sociedade.protestos": -3})
            _rel(gov, 3)
            msg = f"Força Nacional enviada a {quem}."
        else:
            _rel(gov, -2)
            msg = f"Pedido de Força Nacional de {quem} negado."
    elif tipo == "apoio_politico":
        if aprovado:
            aplicar_efeitos(estado, {"congresso.afinidade_geral": 2, "popularidade": 0.5})
            if gov:
                aplicar_efeitos(gov, {"sociedade.polarizacao": 1})
            _rel(gov, 6)
            msg = f"{quem} declarou apoio ao governo federal: a bancada do estado se aproxima do Planalto."
        else:
            _rel(gov, -4)
            msg = f"O presidente recusou o apoio de {quem}."
    elif tipo == "verba":  # enviada pelo presidente, sem precisar de aceite
        v = float(pl["valor"])
        gastar_ou_receber(estado, -v)
        if gov:
            gastar_ou_receber(gov, v)
            aplicar_efeitos(gov, {"popularidade": 0.5})
        _rel(gov, 2 + v / 5)
        msg = f"O presidente enviou R$ {v:.0f} bi para {quem}."
    elif tipo == "convenio":
        v = float(pl["valor"])
        if aprovado:
            gastar_ou_receber(estado, -v)
            aplicar_efeitos(estado, {"popularidade": 0.5})
            if gov:
                aplicar_efeitos(gov, {f"setores.{setor}": min(10, 2 + v / 4), "popularidade": 1})
            _rel(gov, 5)
            msg = f"{quem} aceitou o convênio federal de {rot} (R$ {v:.0f} bi)."
        else:
            _rel(gov, -2)
            msg = f"{quem} recusou o convênio federal de {rot}."
    elif tipo == "pede_apoio":
        if aprovado:
            aplicar_efeitos(estado, {"congresso.afinidade_geral": 2})
            if gov:
                aplicar_efeitos(gov, {"popularidade": -0.5, "sociedade.polarizacao": 1})
            _rel(gov, 8)
            msg = f"{quem} apoiou a agenda do presidente no Congresso."
        else:
            _rel(gov, -5)
            msg = f"{quem} se recusou a apoiar a agenda do presidente."
    elif tipo == "apoio":
        v = float(pl["valor"])
        if aprovado:
            gastar_ou_receber(estado, -v)
            aplicar_efeitos(estado, {"congresso.afinidade_geral": v / 12})
            msg = f"Emendas de R$ {v:.0f} bi para a bancada de {autor}: apoio no Congresso aumentou."
        else:
            aplicar_efeitos(estado, {"congresso.afinidade_geral": -1.5})
            msg = f"Pedido de emendas de {autor} recusado."
    elif tipo == "orcamento":
        aloc = estado["orcamento"]["aloc"]
        if aprovado and setor in aloc:
            aloc[setor] = aloc[setor] + 4
            estado["orcamento"]["aloc"] = economia.normalizar_aloc(aloc)
            msg = f"Orçamento de {rot} ampliado a pedido de {autor}."
        else:
            msg = f"Pedido de orçamento de {autor} negado."
    elif tipo == "reuniao":
        cod = pl.get("pais")
        ent = estado["diplomacia"]["entidades"].get(cod)
        nome = diplomacia.PAUTAS[pl["pauta"]]["propostas"][pl["proposta"]]["nome"]
        if aprovado and ent:
            ok, msg = diplomacia.acordo_direto(estado, cod, pl["pauta"], pl["proposta"])
            msg = f"Reunião com {autor} ({ent['nome']}): {msg}" if ok else f"Proposta de {autor}: {msg}"
        else:
            if ent:
                ent["rel"] = round(clamp(ent["rel"] - 3, 0, 100), 2)
            msg = f"Proposta de {autor} ('{nome}') rejeitada."
    else:  # acordo
        cod = pl.get("pais")
        ent = estado["diplomacia"]["entidades"].get(cod)
        if aprovado and ent:
            ok, msg = diplomacia.acao(estado, pl.get("acao", "tratado"), cod, rng)
            msg = f"Pedido de {autor}: {msg}"
        else:
            if ent:
                ent["rel"] = round(clamp(ent["rel"] - 3, 0, 100), 2)
            msg = f"Proposta de {autor} recusada."
    bom = aprovado or tipo == "verba"
    noticia(estado, msg, "bom" if bom else "info")
    if gov:
        noticia(gov, msg, "bom" if bom else "ruim")
    return msg
