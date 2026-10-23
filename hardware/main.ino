#include <DHT.h>

const int Sensor = 21;
DHT dht(Sensor, DHT22);

void setup() {
  pinMode(Sensor, INPUT); 
  dht.begin(); 
  Serial.begin(115200);
  Serial.println("Aqui estão os dados em tempo real: \n");
}

void loop() {
    
    delay(2000);

    float umidade = dht.readHumidity();
    float temperatura = dht.readTemperature();
    
    Serial.printf("Temperatura = %f \n" ,temperatura);
    Serial.printf("Umidade = %f \n", umidade); 

    
}
