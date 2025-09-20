from flask import Flask, render_template
import os


def create_app() -> Flask:
    app = Flask(__name__)

    @app.route("/")
    def index():
        return render_template("index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    port_str = os.environ.get("PORT", "5050")
    try:
        port = int(port_str)
    except ValueError:
        port = 5000
    app.run(host="0.0.0.0", port=port, debug=True)


