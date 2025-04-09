let map = L.map('map').setView([41.37, 2.19], 13); // Puerto de BCN

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const colores = ['red', 'blue', 'green', 'purple', 'orange'];
let colorIndex = 0;

document.getElementById("fileInput").addEventListener("change", (event) => {
  const files = event.target.files;
  const accion = document.querySelector('input[name="accion"]:checked').value;

  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline || layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const contenido = e.target.result.trim();
      const lineas = contenido.split('\n').slice(1);
      const puntos = lineas.map(l => {
        const [timestamp, lat, lon] = l.split(',');
        return [parseFloat(lat), parseFloat(lon)];
      });

      const color = colores[colorIndex++ % colores.length];
      L.polyline(puntos, { color }).addTo(map);
      puntos.forEach(p => L.circleMarker(p, { radius: 3, color }).addTo(map));
      map.fitBounds(puntos);

      if (accion === 'subir') {
        subirCSVaZenodo(file);
      }
    };
    reader.readAsText(file);
  });
});

function subirCSVaZenodo(file) {
  const formData = new FormData();
  formData.append("file", file);

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
      data.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `<a href="${item.enlace}" target="_blank">${item.nombre}</a> — ${item.fecha}`;
        lista.appendChild(li);
      });
    })
    .catch(err => {
      console.error("❌ No se pudo cargar el historial:", err);
    });
}

// Cargar historial al entrar
cargarHistorialDesdeGoogle();
