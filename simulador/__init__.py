import os
from flask import Flask
from . import db


def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-troque-em-producao")
    app.config["DATABASE"] = os.environ.get("DATABASE_PATH") or os.path.join(app.instance_path, "simulador.db")
    os.makedirs(os.path.dirname(os.path.abspath(app.config["DATABASE"])), exist_ok=True)
    db.init_app(app)

    from .routes import pages, api
    app.register_blueprint(pages.bp)
    app.register_blueprint(api.bp, url_prefix="/api")
    return app
