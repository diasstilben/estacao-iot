from flask import Flask, request , jsonify

app = Flask(__name__)

@app.route('/api/clima', methods = ['POST'])
def receberdados():
    
    dados = request.get_json() #captura o pacote
    print(dados)

    return jsonify({"status": "sucesso"}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
