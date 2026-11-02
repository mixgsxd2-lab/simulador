"""Páginas HTML."""
from flask import Blueprint, render_template, jsonify

bp = Blueprint("pages", __name__)


@bp.get("/")
def inicio():
    return render_template("index.html")


@bp.get("/jogo/<codigo>")
def jogo(codigo):
    return render_template("game.html", codigo=codigo.upper())


@bp.get("/saude")
def saude():
    return jsonify({"status": "ok"})
