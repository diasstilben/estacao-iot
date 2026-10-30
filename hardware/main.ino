#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "Estação_IOT";
const char* password = "dias1234";
const char* url_servidor = "http://192.168.13.115:5000/api/clima";
const int Sensor = 21;

DHT dht(Sensor, DHT22);

void setup() {
  Serial.begin(115200); // 1. Liga a tela
  WiFi.begin(ssid, password); // 2. Dá a ordem de conexão
  
  // 3. Espera a conexão confirmar
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("."); 
  }
  
  Serial.println("\nWi-Fi Conectado!");
  pinMode(Sensor, INPUT); 
  dht.begin(); 
  Serial.println("Aqui estão os dados em tempo real: \n");
}

void loop() {
  delay(2000); // Dá um respiro de 2 segundos para o sensor trabalhar

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(url_servidor); 
    
    // 1. Lê os dados
    float umidade = dht.readHumidity();
    float temperatura = dht.readTemperature();
    
    // 2. Imprime no terminal local do ESP32
    Serial.printf("Temperatura = %.2f \n", temperatura);
    Serial.printf("Umidade = %.2f \n", umidade); 
    
    // 3. Monta o pacote JSON com as variáveis lidas
    String pacote_json = "{\"temperatura\": " + String(temperatura) + ", \"umidade\": " + String(umidade) + "}";
    
    // 4. Dispara pela rede para o Flask
    http.addHeader("Content-Type", "application/json");
    int codigo_resposta = http.POST(pacote_json);
    
    Serial.print("Código HTTP do Servidor: ");
    Serial.println(codigo_resposta);
    
    http.end(); // Fecha a conexão limpa
  } else {
    Serial.println("Erro: Wi-Fi desligado.");
  }
}