"""Testa o fluxo multiplayer pela API (python tests/multiplayer.py).

Anfitrião cria a sala, um líder estrangeiro entra, a assinatura de sincronização muda, o líder propõe
um acordo que o anfitrião aprova, e o anfitrião propõe um acordo que o líder aceita.
"""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "teste.db")
from simulador import create_app  # noqa: E402


def main():
    c = create_app().test_client()
    r = c.post("/api/jogos", json={"modo": "presidente", "duracao": "curta", "ideologia": "centrista", "partido": "MISSÃO", "nome": "Ana", "idade": 40}).get_json()
    assert r["ok"], r
    cod, host = r["codigo"], {"X-Token": r["token"]}

    sinal = lambda: c.get(f"/api/jogos/{cod}/sinal", headers=host).get_json()["assinatura"]
    antes = sinal()
    g = c.post(f"/api/jogos/{cod}/entrar", json={"nome": "Bob", "papel": "lider", "pais": "ARG"}).get_json()
    assert g["ok"], g
    lider = {"X-Token": g["token"]}
    assert sinal() != antes, "a entrada de um jogador deve mudar a assinatura"

    pk = c.get(f"/api/jogos/{cod}", headers=host).get_json()
    assert pk["estado"]["meta"]["ano"] == 2023 and pk["estado"]["meta"]["fase"] == "governo"
    assert [j["online"] for j in pk["jogadores"]] == [True, True]

    # líder -> anfitrião
    assert c.post(f"/api/jogos/{cod}/pedidos", json={"tipo": "reuniao", "payload": {"pauta": "comercio", "proposta": "tarifas"}}, headers=lider).get_json()["ok"]
    pid = c.get(f"/api/jogos/{cod}", headers=host).get_json()["pedidos"][0]["id"]
    assert c.post(f"/api/jogos/{cod}/pedidos/{pid}/decidir", json={"aprovar": True}, headers=lider).status_code == 403
    assert c.post(f"/api/jogos/{cod}/pedidos/{pid}/decidir", json={"aprovar": True}, headers=host).get_json()["ok"]

    # anfitrião -> líder
    r = c.post(f"/api/jogos/{cod}/acao", json={"tipo": "reuniao_diplomatica", "params": {"alvo": "ARG", "formato": "telefonema",
                                                                                       "pauta": "meio_ambiente", "proposta": "clima"}}, headers=host).get_json()
    ag = r["estado"]["diplomacia"]["aguardando"]
    assert len(ag) == 1, r["msg"]
    assert c.post(f"/api/jogos/{cod}/propostas/{ag[0]['id']}/responder", json={"aceitar": True}, headers=host).status_code == 403
    assert c.post(f"/api/jogos/{cod}/propostas/{ag[0]['id']}/responder", json={"aceitar": True}, headers=lider).get_json()["ok"]

    acordos = [a["proposta"] for a in c.get(f"/api/jogos/{cod}", headers=lider).get_json()["estado"]["diplomacia"]["acordos"]]
    assert acordos == ["tarifas", "clima"], acordos

    c.post(f"/api/jogos/{cod}/mensagem", json={"texto": "Olá"}, headers=lider)
    assert c.get(f"/api/jogos/{cod}", headers=host).get_json()["mensagens"][-1]["texto"] == "Olá"
    print("OK: multiplayer funcionando")


if __name__ == "__main__":
    main()
