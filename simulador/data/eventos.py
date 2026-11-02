"""Catálogo de eventos aleatórios.

Evento automático: tem `efeitos`. Evento com decisão: tem `escolhas`, cada uma com `efeitos`
(ou `chance` + `sucesso`/`falha`), `capital` (custo em capital político) e `texto` (resultado).
`mitiga`: setor cujo índice reduz o impacto negativo. `escopo`: nacional, estadual ou ambos.
"""

N, E = "nacional", "estadual"


def _s(s, path):
    a, b = path.split(".")
    return s[a][b]


EVENTOS = {
    "greve_caminhoneiros": {
        "titulo": "Greve dos caminhoneiros", "tags": ["social", "economia"], "peso": 1.0, "escopo": [N],
        "texto": "Caminhoneiros bloqueiam rodovias contra o preço do diesel. Prateleiras começam a esvaziar.",
        "cond": lambda s: _s(s, "economia.inflacao") > 4.5,
        "escolhas": [
            {"label": "Subsidiar o diesel", "desc": "-R$ 30 bi", "efeitos": {"economia.caixa": -30, "popularidade": 2, "economia.choque_inf": -0.2}, "texto": "O subsídio encerrou a greve."},
            {"label": "Negociar com os líderes", "desc": "-1 capital", "capital": -1, "efeitos": {"popularidade": 1, "sociedade.protestos": -3}, "texto": "Acordo costurado após dias de impasse."},
            {"label": "Mandar a polícia desbloquear", "desc": "Risco de confronto", "chance": 0.55,
             "sucesso": {"sociedade.protestos": -4, "popularidade": 1}, "falha": {"popularidade": -5, "sociedade.protestos": 8, "economia.crescimento": -0.3}, "texto": "A operação terminou."},
        ]},
    "enchentes": {
        "titulo": "Enchentes devastadoras", "tags": ["clima"], "peso": 1.0, "escopo": [N, E], "mitiga": "infraestrutura",
        "texto": "Chuvas históricas deixam milhares de desabrigados e destroem estradas.",
        "cond": lambda s: True,
        "escolhas": [
            {"label": "Decretar calamidade e liberar verba", "desc": "-R$ 40 bi", "efeitos": {"economia.caixa": -40, "popularidade": 3, "setores.infraestrutura": 3}, "texto": "Resposta rápida melhorou a imagem do governo."},
            {"label": "Acionar só a Defesa Civil", "desc": "Custo baixo", "efeitos": {"popularidade": -4, "sociedade.protestos": 5, "economia.crescimento": -0.2}, "texto": "A população criticou a lentidão."},
        ]},
    "seca_severa": {
        "titulo": "Seca severa no campo", "tags": ["clima"], "peso": 0.7, "escopo": [N, E], "mitiga": "meio_ambiente",
        "texto": "A estiagem derruba a safra e encarece os alimentos.",
        "cond": lambda s: True,
        "efeitos": {"economia.crescimento": -0.4, "economia.choque_inf": 0.4, "popularidade": -2}},
    "incendios": {
        "titulo": "Queimadas fora de controle", "tags": ["clima"], "peso": 0.7, "escopo": [N, E], "mitiga": "meio_ambiente",
        "texto": "Focos de incêndio se espalham e a fumaça cobre cidades.",
        "cond": lambda s: _s(s, "setores.meio_ambiente") < 60,
        "escolhas": [
            {"label": "Mobilizar brigadas", "desc": "-R$ 15 bi", "efeitos": {"economia.caixa": -15, "setores.meio_ambiente": 3, "popularidade": 1}, "texto": "Brigadas contiveram o fogo."},
            {"label": "Minimizar o problema", "desc": "Grátis, mas arriscado", "efeitos": {"setores.meio_ambiente": -6, "diplomacia.onu": -5, "sociedade.midia": -4, "popularidade": -2}, "texto": "A imprensa e a ONU reagiram mal."},
        ]},
    "greve_professores": {
        "titulo": "Greve dos professores", "tags": ["social"], "peso": 0.9, "escopo": [N, E],
        "texto": "A rede pública para por reajuste salarial.",
        "cond": lambda s: _s(s, "setores.educacao") < 65,
        "escolhas": [
            {"label": "Conceder reajuste", "desc": "-R$ 20 bi", "efeitos": {"economia.caixa": -20, "setores.educacao": 3, "popularidade": 1}, "texto": "Aulas retomadas."},
            {"label": "Recusar", "desc": "Mantém o caixa", "efeitos": {"setores.educacao": -4, "popularidade": -3, "sociedade.protestos": 4}, "texto": "A greve se arrastou por semanas."},
        ]},
    "surto_doenca": {
        "titulo": "Surto de doença", "tags": ["saude"], "peso": 0.8, "escopo": [N, E], "mitiga": "saude",
        "texto": "Hospitais lotados com um surto de doença infecciosa.",
        "cond": lambda s: _s(s, "setores.saude") < 60,
        "escolhas": [
            {"label": "Campanha emergencial de saúde", "desc": "-R$ 25 bi", "efeitos": {"economia.caixa": -25, "setores.saude": 5, "popularidade": 2}, "texto": "O surto foi controlado."},
            {"label": "Aguardar", "desc": "Sem custo", "efeitos": {"setores.saude": -6, "popularidade": -5, "sociedade.protestos": 4}, "texto": "A crise sanitária se agravou."},
        ]},
    "escandalo_ministro": {
        "titulo": "Escândalo no gabinete", "tags": ["escandalo"], "peso": 1.0, "escopo": [N, E],
        "texto": "Reportagem expõe suspeitas contra um membro do primeiro escalão.",
        "cond": lambda s: any(m and m["integridade"] < 55 for m in s["ministros"].values()),
        "escolhas": [
            {"label": "Demitir o ministro envolvido", "desc": "Perde o aliado, limpa a imagem", "especial": "demitir_suspeito", "efeitos": {"popularidade": 1, "justica.corrupcao": -2}, "texto": "A demissão estancou o desgaste."},
            {"label": "Defender o ministro", "desc": "Risco político", "efeitos": {"popularidade": -4, "sociedade.midia": -6, "justica.corrupcao": 4}, "especial": "abrir_investigacao", "texto": "A defesa foi mal recebida."},
        ]},
    "operacao_pf": {
        "titulo": "Operação da Polícia Federal", "tags": ["escandalo"], "peso": 0.8, "escopo": [N, E],
        "texto": "Mandados de busca em empresas ligadas ao poder. Um inquérito é aberto.",
        "cond": lambda s: _s(s, "justica.corrupcao") > 45,
        "efeitos": {"popularidade": -2, "sociedade.midia": -3}, "especial": "abrir_investigacao"},
    "audios_vazados": {
        "titulo": "Áudios vazados", "tags": ["escandalo"], "peso": 0.6, "escopo": [N, E],
        "texto": "Gravações comprometedoras são divulgadas na imprensa.",
        "cond": lambda s: _s(s, "justica.corrupcao") > 55,
        "escolhas": [
            {"label": "Pedir investigação independente", "desc": "-1 capital", "capital": -1, "efeitos": {"popularidade": -1, "sociedade.midia": 3}, "texto": "A transparência segurou parte do dano."},
            {"label": "Negar tudo", "desc": "Aposta alta", "chance": 0.4, "sucesso": {"popularidade": 1}, "falha": {"popularidade": -8, "sociedade.midia": -10, "justica.corrupcao": 5}, "especial": "abrir_investigacao_presidente", "texto": "O caso gerou repercussão."},
        ]},
    "protestos_massivos": {
        "titulo": "Protestos massivos", "tags": ["social"], "peso": 1.0, "escopo": [N, E],
        "texto": "Multidões tomam as ruas das capitais pedindo mudanças.",
        "cond": lambda s: s["popularidade"] < 42,
        "escolhas": [
            {"label": "Anunciar pacote de medidas", "desc": "-R$ 30 bi", "efeitos": {"economia.caixa": -30, "sociedade.protestos": -8, "popularidade": 2}, "texto": "O pacote acalmou parte dos manifestantes."},
            {"label": "Reprimir os atos", "desc": "Risco de escalada", "chance": 0.4, "sucesso": {"sociedade.protestos": -6}, "falha": {"sociedade.protestos": 10, "popularidade": -5, "sociedade.midia": -8}, "texto": "A resposta definiu o clima nas ruas."},
            {"label": "Ignorar", "desc": "Sem custo", "efeitos": {"sociedade.protestos": 5, "popularidade": -3}, "texto": "Os atos cresceram."},
        ]},
    "crise_cambial": {
        "titulo": "Fuga de capitais", "tags": ["fiscal", "economia"], "peso": 1.2, "escopo": [N],
        "texto": "Investidores retiram recursos e o dólar dispara.",
        "cond": lambda s: _s(s, "economia.confianca") < 38 or _s(s, "economia.divida_pib") > 90,
        "escolhas": [
            {"label": "Vender reservas", "desc": "-R$ 50 bi", "efeitos": {"economia.caixa": -50, "economia.cambio": -0.4, "economia.confianca": 3}, "texto": "O câmbio se acalmou."},
            {"label": "Apertar o ajuste fiscal", "desc": "Austeridade", "efeitos": {"economia.confianca": 6, "popularidade": -3, "setores.social": -2}, "texto": "O mercado gostou do sinal."},
            {"label": "Não fazer nada", "desc": "Deixar o mercado agir", "efeitos": {"economia.cambio": 0.6, "economia.choque_inf": 0.5, "economia.confianca": -5}, "texto": "O dólar subiu e pressionou a inflação."},
        ]},
    "boom_commodities": {
        "titulo": "Alta das commodities", "tags": ["positivo"], "peso": 0.7, "escopo": [N, E],
        "texto": "Preços internacionais disparam e a arrecadação cresce.",
        "cond": lambda s: True,
        "efeitos": {"economia.caixa": 60, "economia.crescimento": 0.4, "popularidade": 2, "economia.confianca": 3}},
    "crise_global": {
        "titulo": "Crise financeira global", "tags": ["externo", "economia"], "peso": 0.5, "escopo": [N, E],
        "texto": "Bolsas despencam no mundo todo.",
        "cond": lambda s: True,
        "efeitos": {"economia.crescimento": -0.8, "economia.confianca": -8, "economia.cambio": 0.3, "popularidade": -2}},
    "onda_crime": {
        "titulo": "Onda de violência", "tags": ["seguranca"], "peso": 0.9, "escopo": [N, E], "mitiga": "seguranca",
        "texto": "Uma sequência de crimes brutais choca o país.",
        "cond": lambda s: _s(s, "setores.seguranca") < 55,
        "escolhas": [
            {"label": "Operação de segurança", "desc": "-R$ 20 bi", "efeitos": {"economia.caixa": -20, "setores.seguranca": 5, "popularidade": 2}, "texto": "A ofensiva reduziu os índices."},
            {"label": "Pedir calma e investigar", "desc": "Sem custo", "efeitos": {"popularidade": -4, "sociedade.protestos": 3}, "texto": "A população cobrou mais ação."},
        ]},
    "greve_policia": {
        "titulo": "Greve da polícia", "tags": ["seguranca", "social"], "peso": 0.6, "escopo": [E, N],
        "texto": "Policiais cruzam os braços e a criminalidade sobe.",
        "cond": lambda s: _s(s, "setores.seguranca") < 50,
        "escolhas": [
            {"label": "Atender as reivindicações", "desc": "-R$ 15 bi", "efeitos": {"economia.caixa": -15, "setores.seguranca": 4}, "texto": "Policiais voltaram ao trabalho."},
            {"label": "Chamar reforços federais", "desc": "-1 capital", "capital": -1, "efeitos": {"setores.seguranca": 1, "popularidade": -2}, "texto": "A situação foi contida."},
        ]},
    "apagao": {
        "titulo": "Apagão elétrico", "tags": ["clima"], "peso": 0.7, "escopo": [N, E], "mitiga": "infraestrutura",
        "texto": "Falha na rede deixa milhões sem energia.",
        "cond": lambda s: _s(s, "setores.infraestrutura") < 50,
        "efeitos": {"economia.crescimento": -0.3, "popularidade": -4, "setores.infraestrutura": -3}},
    "petroleo": {
        "titulo": "Descoberta de petróleo", "tags": ["positivo"], "peso": 0.3, "escopo": [N, E],
        "texto": "Novas reservas elevam a expectativa de receitas futuras.",
        "cond": lambda s: True,
        "efeitos": {"economia.tendencia": 0.15, "economia.confianca": 5, "popularidade": 2, "economia.caixa": 30}},
    "startup": {
        "titulo": "Boom de startups", "tags": ["positivo"], "peso": 0.5, "escopo": [N, E],
        "texto": "Empresas de tecnologia atraem investimento e empregos qualificados.",
        "cond": lambda s: _s(s, "setores.educacao") > 45,
        "efeitos": {"economia.tendencia": 0.1, "economia.desemprego": -0.3, "popularidade": 1}},
    "evento_esportivo": {
        "titulo": "Grande evento esportivo", "tags": ["positivo"], "peso": 0.4, "escopo": [N, E],
        "texto": "O país é convidado a sediar um evento internacional.",
        "cond": lambda s: True,
        "escolhas": [
            {"label": "Sediar o evento", "desc": "-R$ 45 bi", "efeitos": {"economia.caixa": -45, "popularidade": 4, "diplomacia.onu": 3, "setores.infraestrutura": 4}, "texto": "A festa empolgou o povo, mas as contas apertaram."},
            {"label": "Recusar", "desc": "Sem custo", "efeitos": {"popularidade": -1}, "texto": "Oportunidade perdida."},
        ]},
    "critica_midia": {
        "titulo": "Editorial duro da imprensa", "tags": ["escandalo"], "peso": 0.7, "escopo": [N, E],
        "texto": "Grandes veículos publicam críticas ferozes ao governo.",
        "cond": lambda s: s["sociedade"]["midia"] < 0,
        "efeitos": {"popularidade": -2, "sociedade.midia": -4}},
    "acordo_comercial": {
        "titulo": "Proposta de acordo comercial", "tags": ["externo", "positivo"], "peso": 0.6, "escopo": [N],
        "texto": "Um bloco econômico propõe abrir mercados em troca de concessões.",
        "cond": lambda s: True,
        "escolhas": [
            {"label": "Aceitar", "desc": "Mais comércio, indústria local reclama", "efeitos": {"economia.tendencia": 0.15, "economia.confianca": 3, "sociedade.protestos": 2, "diplomacia.onu": 2}, "texto": "Acordo fechado."},
            {"label": "Recusar", "desc": "Protege a indústria", "efeitos": {"popularidade": 1, "economia.confianca": -1}, "texto": "Proposta recusada."},
        ]},
    "tensao_fronteira": {
        "titulo": "Tensão na fronteira", "tags": ["externo"], "peso": 0.5, "escopo": [N],
        "texto": "Incidente com tropas vizinhas eleva a temperatura diplomática.",
        "cond": lambda s: s["diplomacia"]["militar"] > 0,
        "escolhas": [
            {"label": "Reforçar a fronteira", "desc": "-R$ 15 bi", "efeitos": {"economia.caixa": -15, "popularidade": 2, "diplomacia.militar": 2}, "texto": "Demonstração de força sem disparos."},
            {"label": "Buscar mediação da ONU", "desc": "+ONU", "efeitos": {"diplomacia.onu": 4, "popularidade": -1}, "texto": "A diplomacia prevaleceu."},
        ]},
    "corte_repasse": {
        "titulo": "Governo federal corta repasses", "tags": ["fiscal"], "peso": 0.9, "escopo": [E],
        "texto": "Brasília anuncia contingenciamento e atrasa transferências ao estado.",
        "cond": lambda s: s["federal"]["relacao"] < 60,
        "escolhas": [
            {"label": "Negociar em Brasília", "desc": "-1 capital", "capital": -1, "efeitos": {"federal.relacao": 6}, "texto": "Parte dos recursos foi liberada."},
            {"label": "Confrontar publicamente", "desc": "Aposta de popularidade", "efeitos": {"popularidade": 3, "federal.relacao": -8, "economia.caixa": -20}, "texto": "O embate rendeu votos, mas custou caro."},
        ]},
    "greve_saude": {
        "titulo": "Greve dos servidores da saúde", "tags": ["social", "saude"], "peso": 0.6, "escopo": [N, E],
        "texto": "Médicos e enfermeiros paralisam atendimentos eletivos.",
        "cond": lambda s: _s(s, "setores.saude") < 55,
        "escolhas": [
            {"label": "Abrir negociação", "desc": "-R$ 15 bi", "efeitos": {"economia.caixa": -15, "setores.saude": 3}, "texto": "Greve encerrada."},
            {"label": "Manter a posição", "desc": "Sem custo", "efeitos": {"setores.saude": -5, "popularidade": -3}, "texto": "Filas aumentaram."},
        ]},
}
