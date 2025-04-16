// Inicializar el mapa
let map = L.map('map').setView([41.37, 2.19], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Capa de viento con Leaflet.Velocity
let velocityLayer = null;

function esValidoParaVelocity(data) {
  try {
    if (!data || !data.data) return false;
    if (!Array.isArray(data.data) || data.data.length !== 2) return false;

    const u = data.data[0];
    const v = data.data[1];

    if (!u.data || !Array.isArray(u.data)) return false;
    if (!v.data || !Array.isArray(v.data)) return false;

    return true;
  } catch (e) {
    console.warn("⚠️ Error validando datos de viento:", e);
    return false;
  }
}

function adaptarDatosViento(apiData) {
  // 1. Validación básica
  if (!apiData || !apiData.data || !Array.isArray(apiData.data)) {
    console.error("Datos inválidos recibidos", apiData);
    return null;
  }

  // 2. Extraer componentes U y V (corregir índices si es necesario)
  const componenteU = apiData.data.find(item => 
    item.header?.parameterNumberName?.includes("U-component")
  ) || { data: [] };
  
  const componenteV = apiData.data.find(item =>
    item.header?.parameterNumberName?.includes("V-component")
  ) || { data: [] };

  // 3. Asegurar que los datos son arrays
  const uData = Array.isArray(componenteU.data) ? componenteU.data : [];
  const vData = Array.isArray(componenteV.data) ? componenteV.data : [];

  // 4. Crear estructura compatible con Leaflet-Velocity
  return {
    header: {
      ...apiData.header,  // Conservamos metadatos originales
      parameterUnit: apiData.header?.parameterUnit || "m.s-1",
      lo1: apiData.header?.lo1 || 2.09,
      la1: apiData.header?.la1 || 41.47,
      dx: apiData.header?.dx || 0.1,
      dy: apiData.header?.dy || 0.1,
      nx: apiData.header?.nx || 3,
      ny: apiData.header?.ny || 3,
      refTime: apiData.header?.refTime || new Date().toISOString()
    },
    data: [
      {
        header: {
          parameterNumberName: "Eastward wind",
          parameterUnit: "m.s-1"
        },
        data: uData.length > 0 ? uData : new Array(9).fill(0) // Fallback
      },
      {
        header: {
          parameterNumberName: "Northward wind",
          parameterUnit: "m.s-1"
        },
        data: vData.length > 0 ? vData : new Array(9).fill(0) // Fallback
      }
    ]
  };
}

function cargarCapaDeViento() {
  fetch("https://backend-gps-zenodo.onrender.com/viento.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(apiData => {
      console.log("Datos API recibidos:", apiData);
      
      const datosAdaptados = adaptarDatosViento(apiData);
      if (!datosAdaptados) {
        throw new Error("No se pudieron adaptar los datos");
      }

      console.log("Datos adaptados:", datosAdaptados);

      if (velocityLayer) map.removeLayer(velocityLayer);

      velocityLayer = L.velocityLayer({
        displayValues: true,
        displayOptions: {
          velocityType: "Wind",
          position: "bottomleft",
          speedUnit: "m/s"
        },
        data: datosAdaptados,
        maxVelocity: 10,
        velocityScale: 0.03,
        particleAge: 50
      });

      map.addLayer(velocityLayer);
      console.log("Visualización de viento activa");

      // Ajustar vista
      const header = datosAdaptados.header;
      const bounds = L.latLngBounds(
        [header.la1 - header.dy * header.ny, header.lo1],
        [header.la1, header.lo1 + header.dx * header.nx]
      );
      map.fitBounds(bounds);
    })
    .catch(err => {
      console.error("Error:", err);
      // Cargar datos de ejemplo si falla
      cargarDatosDeEjemplo(); 
    });
}

// Función de respaldo con datos de ejemplo
function cargarDatosDeEjemplo() {
  const datosEjemplo = {
    header: {
      lo1: 2.09, la1: 41.47, dx: 0.1, dy: 0.1, nx: 3, ny: 3,
      parameterUnit: "m.s-1", refTime: new Date().toISOString()
    },
    data: [
      { header: { parameterNumberName: "U-component" }, data: [1,0,-1,2,0,-2,1,0,-1] },
      { header: { parameterNumberName: "V-component" }, data: [1,2,1,0,0,0,-1,-2,-1] }
    ]
  };
  
  velocityLayer = L.velocityLayer({
    data: datosEjemplo,
    velocityScale: 0.05
  }).addTo(map);
  
  console.warn("Usando datos de ejemplo");
}
// Cargar capa de viento al inicio y cada 30 minutos
cargarCapaDeViento();
setInterval(cargarCapaDeViento, 30 * 60 * 1000);

const colores = ['red', 'blue', 'green', 'purple', 'orange'];
let colorIndex = 0;

let ultimoTrack = [];
let ultimoColor = 'blue';
let animationInterval = null;
let animationIndex = 0;
let animationLine = [];
let animationSpeed = 500;

const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", (event) => {
  const files = event.target.files;
  const accion = document.querySelector('input[name="accion"]:checked').value;

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
        const punto = {
          id: id.trim(),
          lat: parseFloat(lat),
          lon: parseFloat(lon)
        };

        if (!isNaN(punto.lat) && !isNaN(punto.lon)) {
          puntos.push(punto);

          L.circleMarker([punto.lat, punto.lon], {
            radius: 4,
            color: color,
            fillOpacity: 0.8
          })
          .bindPopup(`<strong>📍 Punto ID:</strong> ${punto.id}<br><b>Lat:</b> ${punto.lat}<br><b>Lon:</b> ${punto.lon}`)
          .addTo(map);
        }
      });

      if (puntos.length > 0) {
        L.polyline(puntos.map(p => [p.lat, p.lon]), { color }).addTo(map);
        map.fitBounds(puntos.map(p => [p.lat, p.lon]));
      }

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
        console.warn("🛍️ El historial recibido no es un array:", data);
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

// Controles de animación
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");
const slowerBtn = document.getElementById("slower");
const fasterBtn = document.getElementById("faster");
const progresoBarra = document.getElementById("progreso-barra");

playBtn.addEventListener("click", startAnimation);
pauseBtn.addEventListener("click", () => clearInterval(animationInterval));
slowerBtn.addEventListener("click", () => animationSpeed += 200);
fasterBtn.addEventListener("click", () => animationSpeed = Math.max(100, animationSpeed - 200));

function startAnimation() {
  if (ultimoTrack.length === 0) {
    alert("Primero carga un track.");
    return;
  }

  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
      map.removeLayer(layer);
    }
  });

  animationIndex = 0;
  animationLine = [];
  progresoBarra.style.width = '0%';
  clearInterval(animationInterval);

  animationInterval = setInterval(() => {
    if (animationIndex >= ultimoTrack.length) {
      clearInterval(animationInterval);
      progresoBarra.style.width = '100%';
      return;
    }

    const punto = ultimoTrack[animationIndex];
    animationLine.push([punto.lat, punto.lon]);

    const marker = L.circleMarker([punto.lat, punto.lon], {
      radius: 4,
      color: ultimoColor,
      fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(`<strong>📍 Punto ID:</strong> ${punto.id}<br><b>Lat:</b> ${punto.lat}<br><b>Lon:</b> ${punto.lon}`);

    if (animationLine.length > 1) {
      L.polyline(animationLine.slice(animationLine.length - 2), { color: ultimoColor }).addTo(map);
    }

    animationIndex++;
    const porcentaje = (animationIndex / ultimoTrack.length) * 100;
    progresoBarra.style.width = `${porcentaje}%`;
  }, animationSpeed);
}
