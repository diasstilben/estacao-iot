import mysql.connector
from flask import Flask, request , jsonify

app = Flask(__name__)

@app.route('/api/clima', methods = ['POST'])
def receberdados():
    
    dados = request.get_json() #captura o pacote
    conexao = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="estacao_iot"
    )
    cursor = conexao.cursor()
    comando_sql = "INSERT INTO historico_clima (temperatura, umidade) VALUES (%s, %s)"
    valores = (dados['temperatura'], dados['umidade'])
    cursor.execute(comando_sql, valores)
    conexao.commit()
    cursor.close()
    conexao.close()
    return jsonify({"status": "sucesso"}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
