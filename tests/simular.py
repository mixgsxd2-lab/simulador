"""Simula runs completas com um bot aleatório para validar o motor (python tests/simular.py)."""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from simulador.data.politica import LEIS, PROPOSTAS  # noqa: E402
from simulador.engine import acoes, estado as est  # noqa: E402


def bot(estado, rng):
    m = estado["meta"]
    ex = acoes.executar
    if m["fase"] == "campanha":
        for t in ("comicio", "tv", "redes"):
            ex(estado, "campanha", {"acao": t}, rng)
        ex(estado, "campanha", {"acao": "debate"}, rng)
        return
    if estado["evento"]:
        ex(estado, "responder_evento", {"escolha": rng.randrange(len(estado["evento"]["escolhas"]))}, rng)
    escopo = m["escopo"]
    leis = [k for k, v in LEIS.items() if escopo in v["escopos"]]
    ex(estado, "propor_lei", {"lei": rng.choice(leis)}, rng)
    ex(estado, "negociar", {"tipo": "emendas", "partido": rng.choice(list(estado["congresso"]["partidos"])), "valor": 10}, rng)
    if estado["campanha"].get("ativa"):
        ex(estado, "campanha", {"acao": rng.choice(["comicio", "tv", "redes"])}, rng)
        ex(estado, "campanha", {"acao": "debate"}, rng)
    for inv in estado["justica"]["investigacoes"]:
        if inv["status"] == "aberta" and inv["resposta"] is None:
            ex(estado, "responder_investigacao", {"id": inv["id"], "resposta": "cooperar"}, rng)
    if estado["justica"]["vaga_stf"]:
        ex(estado, "indicar_stf", {"perfil": "tecnico"}, rng)
    if estado["justica"]["impeachment"]["processo"]:
        ex(estado, "negociar_impeachment", {}, rng)
    if escopo == "nacional" and rng.random() < 0.1:
        ex(estado, "acao_diplomatica", {"acao": "melhorar", "alvo": rng.choice(list(estado["diplomacia"]["entidades"]))}, rng)


def rodar(modo, duracao, rng):
    cfg = {"modo": modo, "duracao": duracao, "partido": "MDCI", "ideologia": rng.choice(["liberal", "social_democrata", "centrista", "conservador"]),
           "propostas": ["emprego", "saude"], "uf": rng.choice(["SP", "PI", "DF"]) if modo == "governador" else None}
    s = est.novo_jogo(cfg)
    for _ in range(400):
        if s["meta"]["encerrado"]:
            break
        bot(s, rng)
        ok, msg = acoes.executar(s, "avancar_turno", {}, rng)
        if not ok and s["evento"]:
            acoes.executar(s, "responder_evento", {"escolha": 0}, rng)
    assert s["meta"]["encerrado"], "run não terminou"
    return s


if __name__ == "__main__":
    rng = random.Random(7)
    resumo = {}
    for modo in ("presidente", "governador"):
        for dur in ("curta", "media", "longa"):
            for _ in range(12):
                s = rodar(modo, dur, rng)
                r = s["relatorio"]
                resumo.setdefault((modo, dur), []).append((r["resultado"], round(r["pontuacao"]), s["meta"]["turno"]))
    for k, v in resumo.items():
        print(k, v)
