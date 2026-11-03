"""Cúpulas internacionais obrigatórias (modo presidente).

Acontecem em datas fixas do calendário e entram como evento obrigatório: o presidente precisa participar
e escolher a posição do Brasil antes de avançar o trimestre (não existe opção de faltar).
Cada escolha tem `efeitos` (caminhos do estado), `rel` (variação da relação com os países de cada bloco;
"todos" = todos os países) e `texto` (resultado). Fatos: o Brasil é membro do Mercosul, do BRICS e da ONU;
por tradição, abre o debate geral da Assembleia Geral; sediou a cúpula do BRICS em 2025 (Rio de Janeiro)
e a COP30 em 2025 (Belém). As consequências de cada escolha são simuladas.
"""

SEDES_BRICS = {2023: "Joanesburgo (África do Sul)", 2024: "Kazan (Rússia)", 2025: "Rio de Janeiro (Brasil, anfitrião)", 2026: "Índia"}

CUPULAS = {
    "mercosul": {
        "nome": "Cúpula do Mercosul", "bloco": "Mercosul", "trimestres": [2, 4], "quando": "2 vezes por ano (2º e 4º trimestres)",
        "titulo": "Cúpula do Mercosul — {semestre}º semestre de {ano}",
        "texto": "Os presidentes de Brasil, Argentina, Paraguai e Uruguai se reúnem para a cúpula semestral do bloco. A presença do Brasil é obrigatória: qual será a posição do país?",
        "escolhas": [
            {"label": "Defender o acordo Mercosul–União Europeia", "desc": "Mercosul +3 · UE +6 · crescimento",
             "efeitos": {"economia.tendencia": 0.05, "economia.confianca": 2}, "rel": {"Mercosul": 3, "União Europeia": 6, "União Europeia / CPLP": 6},
             "texto": "O Brasil puxou as negociações com os europeus."},
            {"label": "Propor reduzir a Tarifa Externa Comum", "desc": "Mercado gosta · indústria reclama",
             "efeitos": {"economia.confianca": 3, "impostos.importacao": -1, "popularidade": -1}, "rel": {"Mercosul": 2},
             "texto": "A proposta de abrir o bloco dividiu a indústria brasileira."},
            {"label": "Defender mais integração regional", "desc": "Mercosul +6 · América Latina +3",
             "efeitos": {"economia.confianca": -1, "diplomacia.onu": 1}, "rel": {"Mercosul": 6, "América Latina": 3},
             "texto": "Os vizinhos elogiaram a liderança brasileira."},
            {"label": "Cobrar os vizinhos e priorizar o Brasil", "desc": "Popular em casa · Mercosul -6",
             "efeitos": {"popularidade": 1, "sociedade.polarizacao": 1}, "rel": {"Mercosul": -6},
             "texto": "O tom duro agradou parte do eleitorado e irritou os vizinhos."},
        ]},
    "brics": {
        "nome": "Cúpula do BRICS", "bloco": "BRICS", "trimestres": [3], "quando": "1 vez por ano (3º trimestre)",
        "titulo": "Cúpula do BRICS {ano}",
        "texto": "Líderes de Brasil, Rússia, Índia, China e África do Sul se reúnem em {sede}. O Brasil precisa participar e definir sua posição.",
        "escolhas": [
            {"label": "Defender o Novo Banco de Desenvolvimento", "desc": "+R$ 30 bi em financiamento · BRICS +5",
             "efeitos": {"economia.caixa": 30, "setores.infraestrutura": 2}, "rel": {"BRICS": 5, "Ocidente": -2},
             "texto": "O banco do BRICS aprovou novos financiamentos para obras no Brasil."},
            {"label": "Comércio em moedas locais", "desc": "BRICS +7 · Ocidente -6 · mercado desconfia",
             "efeitos": {"economia.confianca": -2, "economia.cambio": -0.05}, "rel": {"BRICS": 7, "Ocidente": -6},
             "texto": "A proposta de reduzir o uso do dólar repercutiu em Washington."},
            {"label": "Pragmatismo e equilíbrio entre os blocos", "desc": "Relações estáveis · ONU +1",
             "efeitos": {"diplomacia.onu": 1}, "rel": {"BRICS": 2, "Ocidente": 1},
             "texto": "O Brasil manteve pontes com todos os lados."},
            {"label": "Apoiar a expansão do bloco", "desc": "BRICS +3 · Oriente Médio +4 · África +3",
             "efeitos": {"diplomacia.onu": 1}, "rel": {"BRICS": 3, "Oriente Médio": 4, "África": 3, "Ocidente": -2},
             "texto": "O BRICS ganhou novos parceiros com apoio brasileiro."},
        ]},
    "onu": {
        "nome": "Assembleia Geral da ONU", "bloco": None, "trimestres": [3], "quando": "1 vez por ano (setembro, 3º trimestre)",
        "titulo": "Assembleia Geral da ONU {ano}",
        "texto": "Em Nova York, por tradição, o Brasil abre o debate geral das Nações Unidas. O mundo inteiro assiste: qual será o tom do discurso?",
        "escolhas": [
            {"label": "Paz e multilateralismo", "desc": "Prestígio na ONU +5 · todos +1",
             "efeitos": {"diplomacia.onu": 5, "popularidade": 1}, "rel": {"todos": 1},
             "texto": "O discurso foi aplaudido no plenário."},
            {"label": "Clima e proteção da Amazônia", "desc": "ONU +4 · UE e Ocidente gostam · agro reclama",
             "efeitos": {"diplomacia.onu": 4, "economia.confianca": -1}, "rel": {"União Europeia": 4, "União Europeia / CPLP": 4, "Ocidente": 2},
             "texto": "A agenda ambiental brasileira ganhou destaque."},
            {"label": "Reforma do Conselho de Segurança", "desc": "ONU +3 · BRICS +2 · popularidade +1",
             "efeitos": {"diplomacia.onu": 3, "popularidade": 1}, "rel": {"BRICS": 2, "Ocidente": -1},
             "texto": "O Brasil voltou a pedir uma vaga permanente no Conselho."},
            {"label": "Discurso duro e soberanista", "desc": "Popular em casa · ONU -5 · Ocidente -3",
             "efeitos": {"diplomacia.onu": -5, "popularidade": 2, "sociedade.polarizacao": 3}, "rel": {"Ocidente": -3, "União Europeia": -3},
             "texto": "O discurso agradou a base e causou desconforto entre os diplomatas."},
        ]},
    "cop30": {
        "nome": "COP30 em Belém", "bloco": None, "datas": [(2025, 4)], "quando": "novembro de 2025 (o Brasil é o anfitrião)",
        "titulo": "COP30 — o Brasil recebe o mundo em Belém",
        "texto": "A conferência do clima da ONU acontece na Amazônia, com o Brasil como anfitrião. Como presidente da conferência, você precisa definir a agenda.",
        "escolhas": [
            {"label": "Ambição máxima: desmatamento zero e fundo para florestas", "desc": "ONU +8 · meio ambiente +5 · -R$ 20 bi",
             "efeitos": {"diplomacia.onu": 8, "setores.meio_ambiente": 5, "economia.caixa": -20, "economia.confianca": -1},
             "rel": {"União Europeia": 5, "União Europeia / CPLP": 5, "Ocidente": 4}, "texto": "Belém terminou com um acordo histórico pelas florestas."},
            {"label": "Transição energética gradual", "desc": "ONU +3 · crescimento",
             "efeitos": {"diplomacia.onu": 3, "economia.tendencia": 0.05}, "rel": {"todos": 1},
             "texto": "O Brasil defendeu uma transição sem abrir mão do petróleo."},
            {"label": "Direito ao desenvolvimento e ao agronegócio", "desc": "Agro e mercado gostam · ONU -3 · UE -4",
             "efeitos": {"diplomacia.onu": -3, "economia.confianca": 2, "popularidade": 1}, "rel": {"União Europeia": -4, "Ocidente": -2, "BRICS": 2},
             "texto": "Os países ricos criticaram a posição brasileira."},
        ]},
}


def acontece(cupula, ano, trimestre):
    if "datas" in cupula:
        return (ano, trimestre) in cupula["datas"]
    return trimestre in cupula["trimestres"]
