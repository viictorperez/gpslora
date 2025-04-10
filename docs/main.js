// Inicializar el mapa
let map = L.map('map').setView([41.37, 2.19], 13); // Puerto de BCN

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const colores = ['red', 'blue', 'green', 'purple', 'orange'];
let colorIndex = 0;

// Guardar el último track cargado para reproducir
let ultimoTrack = [];
let ultimoColor = 'blue';

const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", (event) => {
  const files = event.target.files;
  const accion = document.querySelector('input[name="accion"]:checked').value;

  // 🧽 Limpiar puntos y líneas anteriores
  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
      map.removeLayer(layer);
    }
  });

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const contenido = e.target.result.trim();
      const lineas = contenido.split('\n').slice(1);
      const puntos = [];

      const color = colores[colorIndex++ % colores.length];

      lineas.forEach(linea => {
        const [id, lat, lon] = linea.split(',');
        const punto = [parseFloat(lat), parseFloat(lon)];

        if (!isNaN(punto[0]) && !isNaN(punto[1])) {
          puntos.push(punto);

          L.circleMarker(punto, {
            radius: 4,
            color: color,
            fillOpacity: 0.8
          })
          .bindPopup(`<strong>📍 Punto ID:</strong> ${id}<br><b>Lat:</b> ${lat}<br><b>Lon:</b> ${lon}`)
          .addTo(map);
        }
      });

      if (puntos.length > 0) {
        L.polyline(puntos, { color }).addTo(map);
        map.fitBounds(puntos);
      }

      // Guardar el track para reproducir
      ultimoTrack = puntos;
      ultimoColor = color;

      if (accion === 'subir') {
        subirCSVaZenodo(file);
      }
    };
    reader.readAsText(file);
  });

  fileInput.value = "";
});

function subirCSVaZenodo(file) {
  const autor = document.getElementById("autor").value.trim();
  const descripcion = document.getElementById("descripcion").value.trim();
  const cuenta = document.getElementById("zenodoCuenta")?.value || "A";

  const horaUTC = new Date().toISOString();

  if (!autor || !descripcion) {
    alert("Por favor, completa tu nombre y una descripción antes de subir.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("autor", autor);
  formData.append("descripcion", descripcion);
  formData.append("cuenta", cuenta);
  formData.append("hora_local", horaUTC);

  fetch("https://backend-gps-zenodo.onrender.com/subir-zenodo", {
    method: "POST",
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.zenodo_url) {
        alert("📦 Archivo subido a Zenodo: " + data.zenodo_url);
        cargarHistorialDesdeGoogle();
      } else {
        alert("❌ Error al subir a Zenodo");
        console.error(data);
      }
    })
    .catch(err => {
      console.error("❌ Error al conectar con el backend:", err);
    });
}

function cargarHistorialDesdeGoogle() {
  fetch("https://backend-gps-zenodo.onrender.com/historial")
    .then(res => res.json())
    .then(data => {
      const lista = document.getElementById("historial");
      lista.innerHTML = "";

      if (!Array.isArray(data)) {
        console.warn("📭 El historial recibido no es un array:", data);
        return;
      }

      const ordenado = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      ordenado.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="${item.enlace}" target="_blank">${item.nombre}</a> — ${item.fecha}`;
        lista.appendChild(li);
      });

    })
    .catch(err => {
      console.error("❌ No se pudo cargar el historial:", err);
    });
}

document.getElementById("borrarHistorial").addEventListener("click", () => {
  if (confirm("¿Estás seguro de que quieres borrar todo el historial?")) {
    fetch("https://backend-gps-zenodo.onrender.com/borrar-historial", {
      method: "POST"
    })
      .then(res => res.json())
      .then(data => {
        alert("✅ Historial borrado");
        cargarHistorialDesdeGoogle();
      })
      .catch(err => {
        alert("❌ Error al borrar historial");
        console.error(err);
      });
  }
});

window.addEventListener("DOMContentLoaded", cargarHistorialDesdeGoogle);

// Botón ▶ para reproducir puntos
const playBtn = L.control({ position: 'topright' });
playBtn.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  div.innerHTML = '▶️';
  div.style.backgroundColor = 'white';
  div.style.padding = '6px';
  div.style.cursor = 'pointer';
  div.title = 'Reproducir recorrido';
  div.onclick = () => {
    if (ultimoTrack.length > 0) {
      reproducirTrackAnimado(ultimoTrack, ultimoColor);
    } else {
      alert("Primero carga un track para reproducirlo.");
    }
  };
  return div;
};
playBtn.addTo(map);

function reproducirTrackAnimado(puntos, color) {
  let i = 0;
  const delay = 500; // ms entre puntos
  const linea = [];

  const interval = setInterval(() => {
    if (i >= puntos.length) {
      clearInterval(interval);
      return;
    }

    const punto = puntos[i];
    linea.push(punto);

    L.circleMarker(punto, {
      radius: 4,
      color: color,
      fillOpacity: 0.8
    })
    .bindPopup(`<strong>Punto:</strong> ${i + 1}<br>Lat: ${punto[0]}<br>Lon: ${punto[1]}`)
    .addTo(map)
    .openPopup();

    if (linea.length > 1) {
      L.polyline(linea.slice(linea.length - 2), { color }).addTo(map);
    }

    i++;
  }, delay);
}

