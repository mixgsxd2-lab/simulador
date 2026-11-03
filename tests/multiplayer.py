"""Testa o fluxo multiplayer pela API (python tests/multiplayer.py).

Anfitrião (presidente) cria a sala; um líder estrangeiro entra e negocia acordos; dois governadores entram,
cada um com a própria partida estadual, e interagem com o presidente e entre si; o trimestre só avança
quando todos os jogadores online estão prontos.
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
    governadores(c, cod, host, lider)
    print("OK: multiplayer funcionando")


def governadores(c, cod, host, lider):
    """Governadores jogam a própria partida estadual; o trimestre só avança com todos os online prontos."""
    g1 = c.post(f"/api/jogos/{cod}/entrar", json={"nome": "Carla", "papel": "governador", "uf": "SP", "partido": "PSD", "ideologia": "liberal"}).get_json()
    assert g1["ok"], g1
    assert not c.post(f"/api/jogos/{cod}/entrar", json={"nome": "Dupla", "papel": "governador", "uf": "SP"}).get_json()["ok"]
    g2 = c.post(f"/api/jogos/{cod}/entrar", json={"nome": "Davi", "papel": "governador", "uf": "BA", "partido": "PT", "ideologia": "social_democrata"}).get_json()
    t1, t2 = {"X-Token": g1["token"]}, {"X-Token": g2["token"]}

    p1 = c.get(f"/api/jogos/{cod}", headers=t1).get_json()
    assert p1["estado"]["meta"]["modo"] == "governador" and p1["estado"]["meta"]["uf"] == "SP", "o governador joga a partida do seu estado"
    assert p1["estado"]["federal"]["vinculado"] and p1["estado"]["diplomacia"]["entidades"]["BA"]["jogador"] == "Davi"
    assert len(c.get(f"/api/jogos/{cod}", headers=host).get_json()["mp"]["governadores"]) == 2

    # o governador governa o próprio estado
    r = c.post(f"/api/jogos/{cod}/acao", json={"tipo": "propor_lei", "params": {"lei": "saneamento"}}, headers=t1).get_json()
    assert r["ok"], r
    assert c.post(f"/api/jogos/{cod}/acao", json={"tipo": "avancar_turno"}, headers=t1).status_code == 400
    # ministros/líderes não governam
    assert c.post(f"/api/jogos/{cod}/acao", json={"tipo": "propor_lei", "params": {"lei": "saneamento"}}, headers=lider).status_code == 403

    # governador -> presidente: repasse (o dinheiro sai do caixa federal e entra no estadual)
    caixa_sp = c.get(f"/api/jogos/{cod}", headers=t1).get_json()["estado"]["economia"]["caixa"]
    c.post(f"/api/jogos/{cod}/pedidos", json={"tipo": "repasse", "payload": {"valor": 20}}, headers=t1)
    ped = next(p for p in c.get(f"/api/jogos/{cod}", headers=host).get_json()["pedidos"] if p["tipo"] == "repasse")
    assert c.post(f"/api/jogos/{cod}/pedidos/{ped['id']}/decidir", json={"aprovar": True}, headers=t2).status_code == 403
    assert c.post(f"/api/jogos/{cod}/pedidos/{ped['id']}/decidir", json={"aprovar": True}, headers=host).get_json()["ok"]
    assert c.get(f"/api/jogos/{cod}", headers=t1).get_json()["estado"]["economia"]["caixa"] > caixa_sp + 19

    # presidente -> governador: convênio que o governador aceita
    r = c.post(f"/api/jogos/{cod}/pedidos", json={"tipo": "convenio", "payload": {"governador": g2_id(c, cod, host), "setor": "saude", "valor": 15}}, headers=host).get_json()
    assert r["ok"], r
    ped = next(p for p in c.get(f"/api/jogos/{cod}", headers=t2).get_json()["pedidos"] if p["tipo"] == "convenio")
    assert c.post(f"/api/jogos/{cod}/pedidos/{ped['id']}/decidir", json={"aprovar": True}, headers=host).status_code == 403
    assert c.post(f"/api/jogos/{cod}/pedidos/{ped['id']}/decidir", json={"aprovar": True}, headers=t2).get_json()["ok"]

    # governador -> governador: consórcio decidido pelo outro jogador e válido nos dois estados
    r = c.post(f"/api/jogos/{cod}/acao", json={"tipo": "reuniao_diplomatica", "params": {"alvo": "BA", "formato": "telefonema",
                                                                                       "pauta": "seguranca", "proposta": "crime"}}, headers=t1).get_json()
    prop = c.get(f"/api/jogos/{cod}", headers=t2).get_json()["mp"]["propostas_para_mim"]
    assert len(prop) == 1, r["msg"]
    assert c.post(f"/api/jogos/{cod}/propostas/{prop[0]['id']}/responder", json={"aceitar": True, "origem": prop[0]["origem"]}, headers=t2).get_json()["ok"]
    assert any(a["proposta"] == "crime" for a in c.get(f"/api/jogos/{cod}", headers=t1).get_json()["estado"]["diplomacia"]["acordos"])
    assert any(a["proposta"] == "crime" for a in c.get(f"/api/jogos/{cod}", headers=t2).get_json()["estado"]["diplomacia"]["acordos"])

    # pronto: o trimestre só avança quando todos os online (presidente, 2 governadores e o líder) estão prontos
    turno = lambda t: c.get(f"/api/jogos/{cod}", headers=t).get_json()["estado"]["meta"]["turno"]
    t0 = turno(host)
    for t in (host, t1, t2):
        r = c.post(f"/api/jogos/{cod}/pronto", json={"pronto": True}, headers=t).get_json()
        if not r["ok"]:  # evento pendente: responde e tenta de novo
            c.post(f"/api/jogos/{cod}/acao", json={"tipo": "responder_evento", "params": {"escolha": 0}}, headers=t)
            r = c.post(f"/api/jogos/{cod}/pronto", json={"pronto": True}, headers=t).get_json()
        assert r["ok"], r
    assert turno(host) == t0, "falta o líder: não pode avançar"
    assert c.get(f"/api/jogos/{cod}", headers=host).get_json()["mp"]["pronto"]["faltam"] == ["Bob"]
    r = c.post(f"/api/jogos/{cod}/pronto", json={"pronto": True}, headers=lider).get_json()
    assert turno(host) == t0 + 1 and turno(t1) == t0 + 1 and turno(t2) == t0 + 1, r["msg"]
    assert not any(j["pronto"] for j in r["jogadores"])
    # forçar: só o anfitrião
    assert c.post(f"/api/jogos/{cod}/pronto", json={"forcar": True}, headers=t1).status_code == 403
    c.post(f"/api/jogos/{cod}/pronto", json={"forcar": True}, headers=host)
    assert turno(t2) == t0 + 2
    # a economia federal do estado é a do presidente
    pres = c.get(f"/api/jogos/{cod}", headers=host).get_json()["estado"]["economia"]
    assert abs(c.get(f"/api/jogos/{cod}", headers=t1).get_json()["estado"]["federal"]["selic"] - pres["selic"]) < 1e-6


def g2_id(c, cod, host):
    return next(g["id"] for g in c.get(f"/api/jogos/{cod}", headers=host).get_json()["mp"]["governadores"] if g["uf"] == "BA")


if __name__ == "__main__":
    main()
