"""Multiplayer: pedidos de jogadores (governadores, ministros, parlamentares, líderes) aprovados pelo anfitrião."""
from .util import aplicar_efeitos, noticia, gastar_ou_receber, clamp
from . import diplomacia, economia

PAPEIS = {
    "presidente": "Presidente / Governador (anfitrião)",
    "governador": "Governador",
    "ministro": "Ministro",
    "parlamentar": "Parlamentar",
    "lider": "Líder de outro país",
}
TIPOS_POR_PAPEL = {"governador": {"repasse"}, "ministro": {"orcamento"}, "parlamentar": {"apoio"}, "lider": {"acordo", "reuniao"}}


def validar(papel, tipo, payload):
    if tipo not in TIPOS_POR_PAPEL.get(papel, set()):
        return "Seu papel não pode enviar esse tipo de pedido."
    if tipo == "reuniao":
        pauta = diplomacia.PAUTAS.get(payload.get("pauta"))
        if not pauta or payload.get("proposta") not in pauta["propostas"]:
            return "Escolha uma pauta e uma proposta de acordo."
    if tipo in ("repasse", "apoio"):
        try:
            v = float(payload.get("valor"))
        except (TypeError, ValueError):
            return "Valor inválido."
        if not 1 <= v <= 100:
            return "O valor deve ficar entre R$ 1 e 100 bi."
    return None


def aplicar(estado, pedido, rng, aprovado):
    """Aplica a decisão do anfitrião. Retorna mensagem."""
    pl, tipo, autor = pedido["payload"], pedido["tipo"], pedido["autor"]
    if tipo == "repasse":
        v = float(pl["valor"])
        if aprovado:
            gastar_ou_receber(estado, -v)
            aplicar_efeitos(estado, {"congresso.afinidade_geral": v / 20})
            msg = f"Repasse de R$ {v:.0f} bi aprovado ao governador {autor}."
        else:
            aplicar_efeitos(estado, {"congresso.afinidade_geral": -2})
            msg = f"Repasse a {autor} negado."
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
        setor = pl.get("setor")
        aloc = estado["orcamento"]["aloc"]
        if aprovado and setor in aloc:
            aloc[setor] = aloc[setor] + 4
            estado["orcamento"]["aloc"] = economia.normalizar_aloc(aloc)
            msg = f"Orçamento de {setor} ampliado a pedido de {autor}."
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
    noticia(estado, msg, "info")
    return msg
