let mapa;
let rutas = [];
let marcadores = [];
const colores = ['blue', 'green', 'red', 'orange', 'purple', 'brown', 'black'];

function inicializarMapa(lat, lon) {
  mapa = L.map('map').setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapa);
}

function limpiarMapa() {
  rutas.forEach(r => mapa.removeLayer(r));
  rutas = [];

  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];
}

function procesarCSV(texto, color, nombre) {
  const lineas = texto.trim().split('\n').slice(1);
  const puntos = [];

  for (const linea of lineas) {
    const [id, lat, lon] = linea.split(',');
    puntos.push({
      id,
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    });
  }

  if (!mapa) {
    inicializarMapa(puntos[0].lat, puntos[0].lon);
  }

  const coordenadas = puntos.map(p => [p.lat, p.lon]);

  const ruta = L.polyline(coordenadas, {
    color: color,
    weight: 4
  }).bindPopup(`Track: ${nombre}`);

  ruta.addTo(mapa);
  rutas.push(ruta);

  puntos.forEach(p => {
    const marcador = L.circleMarker([p.lat, p.lon], {
      radius: 4,
      color: color
    }).bindPopup(`ID: ${p.id}<br>Lat: ${p.lat}<br>Lon: ${p.lon}`);
    marcador.addTo(mapa);
    marcadores.push(marcador);
  });

  mapa.fitBounds(L.featureGroup(rutas).getBounds());
}

document.getElementById('csvInput').addEventListener('change', function (e) {
  limpiarMapa(); // Opcional: coméntalo si quieres mantener los anteriores
  const archivos = Array.from(e.target.files);

  archivos.forEach((archivo, i) => {
    const lector = new FileReader();
    lector.onload = function (event) {
      const color = colores[i % colores.length];
      procesarCSV(event.target.result, color, archivo.name);
    };
    lector.readAsText(archivo);
  });
});