let mapa;
let ruta;
let marcadores = [];

function inicializarMapa(lat, lon) {
  mapa = L.map('map').setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapa);
}

function limpiarMapa() {
  if (ruta) {
    mapa.removeLayer(ruta);
  }
  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];
}

function procesarCSV(texto) {
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

  limpiarMapa();

  const coordenadas = puntos.map(p => [p.lat, p.lon]);

  ruta = L.polyline(coordenadas, { color: 'blue' }).addTo(mapa);

  puntos.forEach(p => {
    const marcador = L.circleMarker([p.lat, p.lon], {
      radius: 5,
      color: 'red'
    }).bindPopup(`ID: ${p.id}<br>Lat: ${p.lat}<br>Lon: ${p.lon}`);
    marcador.addTo(mapa);
    marcadores.push(marcador);
  });

  mapa.fitBounds(ruta.getBounds());
}

document.getElementById('csvInput').addEventListener('change', function (e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function (event) {
    procesarCSV(event.target.result);
  };
  lector.readAsText(archivo);
});
