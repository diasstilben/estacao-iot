import os
import sqlite3
from flask import Flask, request, jsonify, render_template

app = Flask(__name__, template_folder="../frontend/templates", static_folder="../frontend/static")

# Arquivo do banco fica na pasta backend/ (criado automaticamente na primeira execução)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "estacao_iot.db")


def get_conexao():
    """Abre uma conexão nova com o SQLite (usada pelas duas rotas da API)."""
    return sqlite3.connect(DB_PATH)


def criar_tabela():
    """Cria a tabela de histórico se ainda não existir."""
    conexao = get_conexao()
    conexao.execute(
        """
        CREATE TABLE IF NOT EXISTS historico_clima (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            temperatura REAL NOT NULL,
            umidade REAL NOT NULL,
            data_hora TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        """
    )
    conexao.commit()
    conexao.close()


criar_tabela()


@app.route("/")
def home():
    # Entrega o dashboard já processado pelo Jinja2 (resolve os url_for)
    return render_template("index.html")


@app.route('/api/clima', methods=['POST'])
def receberdados():
    """Rota que o ESP32 usa para ENVIAR as leituras."""
    dados = request.get_json()  # captura o pacote
    conexao = get_conexao()
    conexao.execute(
        "INSERT INTO historico_clima (temperatura, umidade) VALUES (?, ?)",
        (dados['temperatura'], dados['umidade']),
    )
    conexao.commit()
    conexao.close()
    return jsonify({"status": "sucesso"}), 200


@app.route('/api/clima/atual', methods=['GET'])
def clima_atual():
    """Rota que o DASHBOARD usa para LER a leitura mais recente."""
    conexao = get_conexao()
    linha = conexao.execute(
        "SELECT temperatura, umidade FROM historico_clima ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conexao.close()

    if linha is None:
        return jsonify({"erro": "Nenhuma leitura registrada ainda"}), 404

    return jsonify({"temperatura": float(linha[0]), "umidade": float(linha[1])}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
