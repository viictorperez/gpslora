let mapa;
let rutas = [];
let marcadores = [];
const colores = ['blue', 'green', 'red', 'orange', 'purple', 'brown', 'black'];

// ✅ URL del Google Sheets API (cámbiala por la tuya)
const GOOGLE_SHEET_API = "https://script.google.com/macros/s/AKfycbzF8l5UIJC0ED5y6bWrJs7GLaAYehR0lmroWP-Dc_z4ZI_f2Sz0CAkXFbbrBBMo0izsfQ/exec"; // 🚨 Cambia esta URL

// 🔹 Inicializa el mapa
function inicializarMapa(lat, lon) {
  mapa = L.map('map').setView([lat, lon], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapa);
}

// 🔹 Limpia el mapa
function limpiarMapa() {
  rutas.forEach(r => mapa.removeLayer(r));
  rutas = [];
  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];
}

// 🔹 Dibuja el contenido del CSV en el mapa
function procesarCSV(texto, color, nombre) {
  const lineas = texto.trim().split('\n').slice(1);
  const puntos = lineas.map(linea => {
    const [id, lat, lon] = linea.split(',');
    return { id, lat: parseFloat(lat), lon: parseFloat(lon) };
  });

  if (!mapa) {
    inicializarMapa(puntos[0].lat, puntos[0].lon);
  }

  const coordenadas = puntos.map(p => [p.lat, p.lon]);
  const ruta = L.polyline(coordenadas, { color: color, weight: 4 }).bindPopup(`Track: ${nombre}`);
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

// 🔹 Subir CSV a backend → Zenodo
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
      mostrarEnlaceZenodo(archivo.name, data.zenodo_url, new Date().toLocaleString());
      alert("Archivo subido a Zenodo:\n" + data.zenodo_url);
    } else {
      alert("Error al subir a Zenodo:\n" + JSON.stringify(data));
    }
  })
  .catch(err => {
    console.error("❌ Error al conectar con el backend:", err);
    alert("Hubo un error al conectar con el servidor.");
  });
}

// 🔹 Mostrar enlace en lista
function mostrarEnlaceZenodo(nombre, url, fecha) {
  const lista = document.getElementById('zenodoLinks');
  const li = document.createElement('li');
  li.innerHTML = `<a href="${url}" target="_blank">${nombre}</a> - ${fecha}`;
  lista.appendChild(li);
}

// 🔹 Cargar historial desde backend
function cargarHistorialDesdeBackend() {
  fetch("https://backend-gps-zenodo.onrender.com/historial")
    .then(res => res.json())
    .then(data => {
      const lista = document.getElementById('zenodoLinks');
      lista.innerHTML = '';
      data.forEach(item => {
        mostrarEnlaceZenodo(item.nombre, item.enlace, item.fecha);
      });
    })
    .catch(err => {
      console.error("❌ No se pudo cargar el historial:", err);
    });
}

// 🔹 Evento al subir archivos CSV
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
      subirCSVaZenodo(archivo);
    };
    lector.readAsText(archivo);
  });

  e.target.value = '';
});

// 🔹 Cargar historial al iniciar
cargarHistorialDesdeBackend();


