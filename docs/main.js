let map = L.map('map').setView([41.37, 2.19], 13); // Puerto de BCN

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const colores = ['red', 'blue', 'green', 'purple', 'orange'];
let colorIndex = 0;

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

  fileInput.value = "";
});

function subirCSVaZenodo(file) {
  const autor = document.getElementById("autor").value.trim();
  const descripcion = document.getElementById("descripcion").value.trim();
  const cuenta = document.getElementById("zenodoCuenta")?.value || "A"; // si usas selección de cuenta
  const offset = -new Date().getTimezoneOffset(); // minutos
  const sign = offset >= 0 ? "+" : "-";
  const horas = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutos = String(Math.abs(offset) % 60).padStart(2, "0");
  const zona = `${sign}${horas}:${minutos}`;

  const fecha = new Date();
  const horaLocal = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")} ${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}:${String(fecha.getSeconds()).padStart(2, "0")} ${zona}`;



  if (!autor || !descripcion) {
    alert("Por favor, completa tu nombre y una descripción antes de subir.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("autor", autor);
  formData.append("descripcion", descripcion);
  formData.append("cuenta", cuenta);
  formData.append("hora_local", horaLocal); // 🆕 hora desde el navegador

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

      // Ordenamos por fecha descendente (más nuevo arriba)
      const ordenado = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      ordenado.forEach(item => {
        const fecha = new Date(item.fecha);
        const fechaFormateada = fecha.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

  const li = document.createElement("li");
  li.innerHTML = `<a href="${item.enlace}" target="_blank">${item.nombre}</a> — ${fechaFormateada}`;
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
