"""Fatos históricos (não simulados): presidentes da República e governadores eleitos em 2022.

Os retratos são carregados da Wikipédia em português (`wiki` = título do artigo).
Informações atualizadas até meados de 2026; o resultado das eleições de outubro de 2026 não consta aqui.
"""

ERAS = {
    "velha": "República Velha (1889–1930)",
    "vargas": "Era Vargas (1930–1945)",
    "populista": "República de 1946 (1946–1964)",
    "militar": "Regime militar (1964–1985)",
    "nova": "Nova República (1985–hoje)",
}

PRESIDENTES = [
    {"nome": "Deodoro da Fonseca", "inicio": 1889, "fim": 1891, "era": "velha", "wiki": "Deodoro da Fonseca", "nota": "Proclamou a República; renunciou em 1891."},
    {"nome": "Floriano Peixoto", "inicio": 1891, "fim": 1894, "era": "velha", "wiki": "Floriano Peixoto", "nota": "O \"Marechal de Ferro\"."},
    {"nome": "Prudente de Morais", "inicio": 1894, "fim": 1898, "era": "velha", "wiki": "Prudente de Morais", "nota": "Primeiro presidente civil eleito por voto direto."},
    {"nome": "Campos Sales", "inicio": 1898, "fim": 1902, "era": "velha", "wiki": "Campos Sales", "nota": "Criou a \"política dos governadores\"."},
    {"nome": "Rodrigues Alves", "inicio": 1902, "fim": 1906, "era": "velha", "wiki": "Rodrigues Alves", "nota": "Reforma urbana do Rio de Janeiro."},
    {"nome": "Afonso Pena", "inicio": 1906, "fim": 1909, "era": "velha", "wiki": "Afonso Pena", "nota": "Morreu no cargo."},
    {"nome": "Nilo Peçanha", "inicio": 1909, "fim": 1910, "era": "velha", "wiki": "Nilo Peçanha", "nota": "Assumiu como vice."},
    {"nome": "Hermes da Fonseca", "inicio": 1910, "fim": 1914, "era": "velha", "wiki": "Hermes da Fonseca", "nota": "Revolta da Chibata (1910)."},
    {"nome": "Venceslau Brás", "inicio": 1914, "fim": 1918, "era": "velha", "wiki": "Venceslau Brás", "nota": "Brasil entra na Primeira Guerra Mundial (1917)."},
    {"nome": "Delfim Moreira", "inicio": 1918, "fim": 1919, "era": "velha", "wiki": "Delfim Moreira", "nota": "Assumiu após a morte do eleito Rodrigues Alves."},
    {"nome": "Epitácio Pessoa", "inicio": 1919, "fim": 1922, "era": "velha", "wiki": "Epitácio Pessoa", "nota": "Centenário da Independência."},
    {"nome": "Artur Bernardes", "inicio": 1922, "fim": 1926, "era": "velha", "wiki": "Artur Bernardes", "nota": "Governou sob estado de sítio."},
    {"nome": "Washington Luís", "inicio": 1926, "fim": 1930, "era": "velha", "wiki": "Washington Luís", "nota": "Deposto pela Revolução de 1930."},
    {"nome": "Getúlio Vargas", "inicio": 1930, "fim": 1945, "era": "vargas", "wiki": "Getúlio Vargas", "nota": "Governo Provisório, Constitucional e Estado Novo."},
    {"nome": "José Linhares", "inicio": 1945, "fim": 1946, "era": "populista", "wiki": "José Linhares", "nota": "Presidente do STF, governo de transição."},
    {"nome": "Eurico Gaspar Dutra", "inicio": 1946, "fim": 1951, "era": "populista", "wiki": "Eurico Gaspar Dutra", "nota": "Constituição de 1946."},
    {"nome": "Getúlio Vargas", "inicio": 1951, "fim": 1954, "era": "populista", "wiki": "Getúlio Vargas", "nota": "Criação da Petrobras; morreu no cargo."},
    {"nome": "Café Filho", "inicio": 1954, "fim": 1955, "era": "populista", "wiki": "Café Filho", "nota": "Assumiu como vice."},
    {"nome": "Carlos Luz", "inicio": 1955, "fim": 1955, "era": "populista", "wiki": "Carlos Luz", "nota": "Interino; afastado em novembro de 1955."},
    {"nome": "Nereu Ramos", "inicio": 1955, "fim": 1956, "era": "populista", "wiki": "Nereu Ramos", "nota": "Interino até a posse de JK."},
    {"nome": "Juscelino Kubitschek", "inicio": 1956, "fim": 1961, "era": "populista", "wiki": "Juscelino Kubitschek", "nota": "Plano de Metas e construção de Brasília."},
    {"nome": "Jânio Quadros", "inicio": 1961, "fim": 1961, "era": "populista", "wiki": "Jânio Quadros", "nota": "Renunciou após sete meses."},
    {"nome": "João Goulart", "inicio": 1961, "fim": 1964, "era": "populista", "wiki": "João Goulart", "nota": "Deposto pelo golpe de 1964."},
    {"nome": "Ranieri Mazzilli", "inicio": 1964, "fim": 1964, "era": "militar", "wiki": "Ranieri Mazzilli", "nota": "Interino em abril de 1964."},
    {"nome": "Castelo Branco", "inicio": 1964, "fim": 1967, "era": "militar", "wiki": "Humberto de Alencar Castelo Branco", "nota": "Primeiro presidente do regime militar."},
    {"nome": "Costa e Silva", "inicio": 1967, "fim": 1969, "era": "militar", "wiki": "Artur da Costa e Silva", "nota": "Editou o AI-5 (1968)."},
    {"nome": "Emílio Médici", "inicio": 1969, "fim": 1974, "era": "militar", "wiki": "Emílio Garrastazu Médici", "nota": "\"Milagre econômico\" e repressão."},
    {"nome": "Ernesto Geisel", "inicio": 1974, "fim": 1979, "era": "militar", "wiki": "Ernesto Geisel", "nota": "Início da abertura \"lenta, gradual e segura\"."},
    {"nome": "João Figueiredo", "inicio": 1979, "fim": 1985, "era": "militar", "wiki": "João Figueiredo", "nota": "Lei da Anistia (1979)."},
    {"nome": "José Sarney", "inicio": 1985, "fim": 1990, "era": "nova", "partido": "PMDB", "wiki": "José Sarney", "nota": "Constituição de 1988."},
    {"nome": "Fernando Collor", "inicio": 1990, "fim": 1992, "era": "nova", "partido": "PRN", "wiki": "Fernando Collor de Mello", "nota": "Primeiro eleito por voto direto após 1960; renunciou durante o impeachment."},
    {"nome": "Itamar Franco", "inicio": 1992, "fim": 1995, "era": "nova", "wiki": "Itamar Franco", "nota": "Lançamento do Plano Real (1994)."},
    {"nome": "Fernando Henrique Cardoso", "inicio": 1995, "fim": 2003, "era": "nova", "partido": "PSDB", "wiki": "Fernando Henrique Cardoso", "nota": "Dois mandatos; estabilização e privatizações."},
    {"nome": "Luiz Inácio Lula da Silva", "inicio": 2003, "fim": 2010, "era": "nova", "partido": "PT", "wiki": "Luiz Inácio Lula da Silva", "nota": "Dois mandatos; Bolsa Família."},
    {"nome": "Dilma Rousseff", "inicio": 2011, "fim": 2016, "era": "nova", "partido": "PT", "wiki": "Dilma Rousseff", "nota": "Primeira mulher presidente; afastada por impeachment em 2016."},
    {"nome": "Michel Temer", "inicio": 2016, "fim": 2018, "era": "nova", "partido": "MDB", "wiki": "Michel Temer", "nota": "Teto de gastos e reforma trabalhista."},
    {"nome": "Jair Bolsonaro", "inicio": 2019, "fim": 2022, "era": "nova", "partido": "PSL / PL", "wiki": "Jair Bolsonaro", "nota": "Eleito pelo PSL; filiou-se ao PL em 2021."},
    {"nome": "Luiz Inácio Lula da Silva", "inicio": 2023, "fim": 2026, "era": "nova", "partido": "PT", "wiki": "Luiz Inácio Lula da Silva", "nota": "Terceiro mandato (2023–2026)."},
]

# Governadores eleitos em 2022 (mandato 2023–2026), com o partido pelo qual foram eleitos.
# Alguns trocaram de partido ou deixaram o cargo em 2026 para disputar outras eleições.
GOVERNADORES = {
    "AC": ("Gladson Cameli", "PP"), "AL": ("Paulo Dantas", "MDB"), "AP": ("Clécio Luís", "SOLIDARIEDADE"),
    "AM": ("Wilson Lima", "UNIÃO"), "BA": ("Jerônimo Rodrigues", "PT"), "CE": ("Elmano de Freitas", "PT"),
    "DF": ("Ibaneis Rocha", "MDB"), "ES": ("Renato Casagrande", "PSB"), "GO": ("Ronaldo Caiado", "UNIÃO"),
    "MA": ("Carlos Brandão", "PSB"), "MT": ("Mauro Mendes", "UNIÃO"), "MS": ("Eduardo Riedel", "PSDB"),
    "MG": ("Romeu Zema", "NOVO"), "PA": ("Helder Barbalho", "MDB"), "PB": ("João Azevêdo", "PSB"),
    "PR": ("Ratinho Júnior", "PSD"), "PE": ("Raquel Lyra", "PSDB"), "PI": ("Rafael Fonteles", "PT"),
    "RJ": ("Cláudio Castro", "PL"), "RN": ("Fátima Bezerra", "PT"), "RS": ("Eduardo Leite", "PSDB"),
    "RO": ("Marcos Rocha", "UNIÃO"), "RR": ("Antonio Denarium", "PP"), "SC": ("Jorginho Mello", "PL"),
    "SP": ("Tarcísio de Freitas", "REPUBLICANOS"), "SE": ("Fábio Mitidieri", "PSD"), "TO": ("Wanderlei Barbosa", "REPUBLICANOS"),
}
