"""Gera os mapas SVG (paths pré-projetados) usados pelo jogo.

Fontes (dados reais):
  - Mundo: Natural Earth via world-atlas@2.0.2 (countries-50m.json, TopoJSON)
      https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
  - Brasil: malha oficial do IBGE por UF (GeoJSON)
      https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=intermediaria&intrarregiao=UF

Uso (requer `pip install pycountry` só para gerar):
  python tools/gerar_mapas.py <countries-50m.json> <br.json>
Saída: simulador/static/data/mundo.json e brasil.json
"""
import json
import math
import sys
from pathlib import Path

import pycountry

SAIDA = Path(__file__).resolve().parent.parent / "simulador" / "static" / "data"

# código IBGE da UF -> sigla
IBGE_UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI",
           "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
           "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
# territórios sem código ISO no world-atlas
EXTRA = {"Kosovo": ("XK", "XKX"), "N. Cyprus": ("CY", "CYP"), "Somaliland": ("SO", "SOM")}


# ---------- projeção Equal Earth ----------
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2


def equal_earth(lon, lat):
    lam, phi = math.radians(lon), math.radians(lat)
    th = math.asin(M * math.sin(phi))
    t2 = th * th
    t6 = t2 * t2 * t2
    x = lam * math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return x, y


# ---------- simplificação Douglas-Peucker ----------
def _dist(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def simplificar(pts, tol):
    if len(pts) < 4:
        return pts
    manter = [False] * len(pts)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pts) - 1)]
    while pilha:
        i, j = pilha.pop()
        dmax, idx = 0, -1
        for k in range(i + 1, j):
            d = _dist(pts[k], pts[i], pts[j])
            if d > dmax:
                dmax, idx = d, k
        if dmax > tol and idx > 0:
            manter[idx] = True
            pilha += [(i, idx), (idx, j)]
    return [p for p, m in zip(pts, manter) if m]


def area(pts):
    return 0.5 * sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))


def centroide(pts):
    a = area(pts) or 1e-9
    cx = sum((pts[i - 1][0] + pts[i][0]) * (pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1]) for i in range(len(pts)))
    cy = sum((pts[i - 1][1] + pts[i][1]) * (pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1]) for i in range(len(pts)))
    return -cx / (6 * a), -cy / (6 * a)


def path(aneis):
    return "".join("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in anel) + "Z" for anel in aneis)


# ---------- TopoJSON ----------
def decodificar_arcos(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcos = []
    for arco in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arco:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcos.append(pts)
    return arcos


def anel_topo(indices, arcos):
    pts = []
    for i in indices:
        a = arcos[i] if i >= 0 else arcos[~i][::-1]
        pts.extend(a[1:] if pts else a)
    return pts


def _recortar(pts, manter_menor):
    """Sutherland–Hodgman contra a reta lon = 180 (lado <= 180 ou >= 180)."""
    dentro = (lambda p: p[0] <= 180) if manter_menor else (lambda p: p[0] >= 180)
    out = []
    for i, cur in enumerate(pts):
        prev = pts[i - 1]
        if dentro(cur) != dentro(prev):
            t = (180 - prev[0]) / (cur[0] - prev[0])
            out.append((180.0, prev[1] + t * (cur[1] - prev[1])))
        if dentro(cur):
            out.append(cur)
    return out


def antimeridiano(anel):
    """Divide anéis que cruzam ±180° (ex.: Rússia) em dois polígonos sem a faixa horizontal."""
    if not any(abs(anel[i][0] - anel[i - 1][0]) > 180 for i in range(1, len(anel))):
        return [anel]
    contin = [(lon + 360 if lon < 0 else lon, lat) for lon, lat in anel]
    oeste = _recortar(contin, True)
    leste = [(lon - 360, lat) for lon, lat in _recortar(contin, False)]
    return [p for p in (oeste, leste) if len(p) >= 3]


def gerar_mundo(arquivo):
    topo = json.load(open(arquivo, encoding="utf-8"))
    arcos = decodificar_arcos(topo)
    largura = 1000
    xmax, ymax = equal_earth(180, 0)[0], equal_earth(0, 90)[1]
    esc = largura / (2 * xmax)
    altura = 2 * ymax * esc

    def proj(lon, lat):
        x, y = equal_earth(lon, lat)
        return (x + xmax) * esc, (ymax - y) * esc

    paises = []
    for g in topo["objects"]["countries"]["geometries"]:
        nome = g["properties"]["name"]
        if nome == "Antarctica" or "arcs" not in g:
            continue
        polis = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        aneis, maior, maior_area = [], None, 0
        for poli in polis:
            for k, anel in enumerate(poli):
                for parte in antimeridiano(anel_topo(anel, arcos)):
                    pts = simplificar([proj(*p) for p in parte], 0.35)
                    if len(pts) < 3 or (k == 0 and abs(area(pts)) < 0.15):
                        continue
                    aneis.append(pts)
                    if k == 0 and abs(area(pts)) > maior_area:
                        maior, maior_area = pts, abs(area(pts))
        if not aneis:
            continue
        a2 = a3 = None
        pc = pycountry.countries.get(numeric=g.get("id", "")) if g.get("id") else None
        if pc:
            a2, a3 = pc.alpha_2, pc.alpha_3
        elif nome in EXTRA:
            a2, a3 = EXTRA[nome]
        cx, cy = centroide(maior)
        paises.append({"id": a3 or nome, "a2": a2, "nome_en": nome, "d": path(aneis), "c": [round(cx, 1), round(cy, 1)]})
    return {"largura": largura, "altura": round(altura, 1), "fonte": "Natural Earth / world-atlas 2.0.2 (50m)", "paises": paises}


def gerar_brasil(arquivo):
    gj = json.load(open(arquivo, encoding="utf-8"))
    lat0 = math.radians(-15)
    largura = 1000
    todos = []
    for f in gj["features"]:
        geo = f["geometry"]
        polis = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
        for poli in polis:
            for anel in poli:
                todos.extend(anel)
    xs = [lon * math.cos(lat0) for lon, _ in todos]
    ys = [-lat for _, lat in todos]
    x0, y0 = min(xs), min(ys)
    esc = largura / (max(xs) - x0)
    altura = (max(ys) - y0) * esc
    estados = []
    for f in gj["features"]:
        uf = IBGE_UF[f["properties"]["codarea"]]
        geo = f["geometry"]
        polis = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
        aneis, maior, maior_area = [], None, 0
        for poli in polis:
            for k, anel in enumerate(poli):
                pts = simplificar([((lon * math.cos(lat0) - x0) * esc, (-lat - y0) * esc) for lon, lat in anel], 0.45)
                if len(pts) < 3 or abs(area(pts)) < 0.5:
                    continue
                aneis.append(pts)
                if k == 0 and abs(area(pts)) > maior_area:
                    maior, maior_area = pts, abs(area(pts))
        cx, cy = centroide(maior)
        estados.append({"uf": uf, "ibge": f["properties"]["codarea"], "d": path(aneis), "c": [round(cx, 1), round(cy, 1)]})
    return {"largura": largura, "altura": round(altura, 1), "fonte": "IBGE — malha territorial por UF (API de malhas v3)", "estados": estados}


if __name__ == "__main__":
    SAIDA.mkdir(parents=True, exist_ok=True)
    mundo = gerar_mundo(sys.argv[1])
    brasil = gerar_brasil(sys.argv[2])
    (SAIDA / "mundo.json").write_text(json.dumps(mundo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (SAIDA / "brasil.json").write_text(json.dumps(brasil, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("países:", len(mundo["paises"]), "estados:", len(brasil["estados"]))
