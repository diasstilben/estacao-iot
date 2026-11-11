# 🛰️ [ESTAÇÃO IOT]

## 📖 Sobre o Projeto
Este é um projeto full-stack de Internet das Coisas (IoT) desenvolvido para coletar, armazenar e visualizar dados físicos do ambiente em tempo real e de forma histórica. O sistema lê informações de temperatura e umidade através de um microcontrolador, processa os dados em uma API estruturada e os disponibiliza em um painel interativo.

## 🛠️ Tecnologias Utilizadas

**Hardware & Embarcados**
* ESP32 (Microcontrolador C/C++)
* Sensor DHT22 (Temperatura e Umidade)
* Protocolo HTTP/Wi-Fi

**Backend & Dados**
* Python (Flask)
* Banco de Dados SQLite (arquivo local, criado automaticamente)
* Arquitetura RESTful

**Frontend**
* HTML5, CSS3 e JavaScript
* Dashboard com atualização automática, selos de estado e relatório de clima

## 📂 Arquitetura do Repositório

```
estacao-iot/
├── backend/
│   └── app.py            # API Flask + banco SQLite (estacao_iot.db é gerado na 1ª execução)
├── frontend/
│   ├── templates/        # index.html (dashboard)
│   └── static/           # script.js e style.css
└── hardware/
    ├── main.ino          # firmware do ESP32
    └── tinkercad/        # esquema do circuito
```

**Fluxo dos dados:** ESP32 → `POST /api/clima` → SQLite → `GET /api/clima/atual` → dashboard.

| Rota | Método | Função |
|------|--------|--------|
| `/` | GET | Entrega o dashboard |
| `/api/clima` | POST | Recebe `{"temperatura": X, "umidade": Y}` do ESP32 e grava no histórico |
| `/api/clima/atual` | GET | Devolve a leitura mais recente |

## ▶️ Como Executar

1. Instale a dependência: `pip install flask`
2. Inicie o servidor: `python backend/app.py` (porta 5000)
3. Abra `http://localhost:5000` no navegador.
4. No `hardware/main.ino`, ajuste `ssid`, `password` e o IP em `url_servidor` para o IP do computador que roda o Flask e grave no ESP32.
