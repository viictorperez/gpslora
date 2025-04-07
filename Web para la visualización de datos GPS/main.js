async function cargarCSV(url) {
  const res = await fetch(url);
  const texto = await res.text();
  const lineas = texto.trim().split('\n').slice(1); // Quitamos cabecera
  const puntos = [];

  for (const linea of lineas) {
    const [id, lat, lon] = linea.split(',');
    puntos.push({
      id,
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    });
  }

  return puntos;
}

async function dibujarMapa() {
  const puntos = await cargarCSV('datos.csv');

  const mapa = L.map('map').setView([puntos[0].lat, puntos[0].lon], 15);

  // Capa base (tipo Google Maps)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapa);

  // Dibujar puntos + línea
  const coordenadas = puntos.map(p => [p.lat, p.lon]);
  L.polyline(coordenadas, { color: 'blue' }).addTo(mapa);

  // Añadir marcadores
  puntos.forEach(p => {
    L.circleMarker([p.lat, p.lon], {
      radius: 5,
      color: 'red'
    })
    .bindPopup(`ID: ${p.id}<br>Lat: ${p.lat}<br>Lon: ${p.lon}`)
    .addTo(mapa);
  });
}

dibujarMapa();