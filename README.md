![](https://i.imgur.com/vaOZJTO.png)
## Envio de datos GPS por LoRa

Este repositorio trata de organizar toda la información necesaria para el proyecto así como de crear un acceso rápido a toda la documentación.

### El proyecto
#### Objetivos
Conseguir la comunicación de datos gps usando la tecnología de LoRa con un dispositivo Arduino.
#### Dispositivo
El dispositivo se trata de una placa Arduino a la que se la añadirá la correspondiente antena para poder hacer la comunicación con la antena del ICM, un GPS para recoger los datos y una batería. Todo esto encapsulado en una carcasa.
#### LoRa
LoRa (Long Range) es una tecnología gratuita que permite transimtir datos a larga distancia con muy poco gasto energético.
Esta es tecnología directa, trabaja punto a punto.
#### LoRaWan
LoRaWan (Long Range Wide Area Network) es un protocolo de red que se usa encima de LoRa para:
- Conectar muchos dispositivos (sensores, por ejemplo)
- Organizar la comunicación entre ellos
- Enviar datos a Internet, usando gateways

Mientras LoRa solo permite comunicación directa (punto a punto), LoRaWAN permite crear una red de largo alcance donde los dispositivos no tienen que estar conectados directamente unos con otros.
#### TTN
TTN (The Things Network) es una red pública basada en LoRaWan, es un servidor que permite conectar el dispositivo LoRaWan (arduino con datos GPS) a internet. Desde TTN se pueden redirigir estos datos a plataformas web como Grafana que permite visualizar los datos recogidos en tiempo real.
### Documentación
#### Material
- Placa: [Arduino MKR WAN 1310](https://store.arduino.cc/en-es/products/arduino-mkr-wan-1310?variant=35571180830871)
- Antena: [Dipole Pentaband Waterproof Antenna](https://store.arduino.cc/en-es/products/dipole-pentaband-waterproof-antenna?variant=35453906059415)
- Shield para GPS: [Arduino MKR GPS Shield](https://store.arduino.cc/en-es/products/arduino-mkr-gps-shield?variant=35572093649047)
- Proto shield básico: [MKR SD Proto Shield](https://store.arduino.cc/en-es/products/mkr-sd-proto-shield?variant=35572111081623)
- Shield con sensores: [Arduino MKR ENV Shield rev2](https://store.arduino.cc/en-es/products/arduino-mkr-env-shield-rev2?variant=40027689779351)

#### Información
[LoRa y LoRaWan](https://www.vencoel.com/que-es-lora-como-funciona-y-caracteristicas-principales/#:~:text=creada%20por%20Helium-,Conclusi%C3%B3n,ciudad%2C%20su%20comportamiento%20es%20excepcional.)
