let mapa;
let rutas = [];
let marcadores = [];
const colores = ['blue', 'green', 'red', 'orange', 'purple', 'brown', 'black'];

// 🔹 Inicializar el mapa cuando se carga el primer CSV
function inicializarMapa(lat, lon) {
  mapa = L.map('map').setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapa);
}

// 🔹 Borrar rutas y marcadores del mapa
function limpiarMapa() {
  rutas.forEach(r => mapa.removeLayer(r));
  rutas = [];

  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];
}

// 🔹 Pintar un CSV en el mapa
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

// 🔹 Subir archivo al backend (Render) para enviarlo a Zenodo
function subirCSVaZenodo(archivo) {
  const formData = new FormData();
  formData.append("file", archivo);

  fetch("https://backend-gps-zenodo.onrender.com/subir-zenodo", {
    method: "POST",
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.zenodo_url) {
      alert("Archivo subido a Zenodo:\n" + data.zenodo_url);
      console.log("✔️ Enlace Zenodo:", data.zenodo_url);
    } else {
      alert("Error al subir a Zenodo:\n" + JSON.stringify(data));
    }
  })
  .catch(err => {
    console.error("❌ Error al conectar con el backend:", err);
    alert("Hubo un error al conectar con el servidor.");
  });
}

// 🔹 Escucha el input para subir y procesar CSVs
document.getElementById('csvInput').addEventListener('change', function (e) {
  const archivos = Array.from(e.target.files);
  if (archivos.length === 0) return;

  limpiarMapa();

  archivos.forEach((archivo, i) => {
    const lector = new FileReader();
    lector.onload = function (event) {
      const contenido = event.target.result;
      const color = colores[(rutas.length + i) % colores.length];

      procesarCSV(contenido, color, archivo.name);
      subirCSVaZenodo(archivo); // 🔁 Subida a tu backend → Zenodo
    };
    lector.readAsText(archivo);
  });

  e.target.value = '';
});
