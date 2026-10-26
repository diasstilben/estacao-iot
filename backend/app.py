import mysql.connector
from flask import Flask, request, jsonify, render_template  # render_template estava faltando

app = Flask(__name__, template_folder="../frontend/templates", static_folder="../frontend/static")


def get_conexao():
    """Abre uma conexão nova com o MySQL (usada pelas duas rotas da API)."""
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="estacao_iot"
    )


@app.route("/")
def home():
    # Entrega o dashboard já processado pelo Jinja2 (resolve os url_for)
    return render_template("index.html")


@app.route('/api/clima', methods=['POST'])
def receberdados():
    """Rota que o ESP32 usa para ENVIAR as leituras (sem alterações)."""
    dados = request.get_json()  # captura o pacote
    conexao = get_conexao()
    cursor = conexao.cursor()
    comando_sql = "INSERT INTO historico_clima (temperatura, umidade) VALUES (%s, %s)"
    valores = (dados['temperatura'], dados['umidade'])
    cursor.execute(comando_sql, valores)
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({"status": "sucesso"}), 200


@app.route('/api/clima/atual', methods=['GET'])
def clima_atual():
    """Rota que o DASHBOARD usa para LER a leitura mais recente."""
    conexao = get_conexao()
    cursor = conexao.cursor()
    # Assume que a tabela tem uma coluna "id" auto-incremento (a mais recente tem o maior id)
    cursor.execute("SELECT temperatura, umidade FROM historico_clima ORDER BY id DESC LIMIT 1")
    linha = cursor.fetchone()
    cursor.close()
    conexao.close()

    if linha is None:
        return jsonify({"erro": "Nenhuma leitura registrada ainda"}), 404

    # float(): se a coluna for DECIMAL, o MySQL devolve Decimal e o Flask o enviaria como texto,
    # o que o JS rejeitaria (ele espera números)
    return jsonify({"temperatura": float(linha[0]), "umidade": float(linha[1])}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)