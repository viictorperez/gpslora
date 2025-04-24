// Inicializar el mapa
let map = L.map('map').setView([41.37, 2.19], 13);

map.createPane('puntos');
map.getPane('puntos').style.zIndex = 650; // más alto que polyline (default ~600)

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
}).addTo(map);

// Capa de viento con Leaflet.Velocity
let velocityLayer = null;

function cargarCapaDeViento() {
  console.log("⏳ Cargando capa de viento...");
  
  fetch("https://backend-gps-zenodo.onrender.com/viento.json")
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      console.log("✅ Respuesta de viento recibida:", data);

      if (!data || !data.data || !Array.isArray(data.data)) {
        console.warn("❌ Datos inválidos de viento:", data);
        return;
      }

      if (velocityLayer) map.removeLayer(velocityLayer);

      velocityLayer = L.velocityLayer({
        displayValues: true,
        displayOptions: {
          velocityType: "Viento",
          position: "bottomleft",
          emptyString: "No hay datos de viento",
          speedUnit: "m/s"
        },
        data: data.data,
        maxVelocity: 15,
        velocityScale: 0.01,
        particleAge: 40,
        lineWidth: 1,
        colorScale: ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#d7191c"],
        opacity: 0.2
      });

      map.addLayer(velocityLayer);
      const refTime = data.header?.refTime || new Date().toISOString();
      document.getElementById("info-viento").innerText = `💨 Viento actualizado: ${refTime} UTC`;
    })
    .catch(err => {
      console.warn("⚠️ No se pudo cargar la capa de viento:", err);
    });
}

cargarCapaDeViento();
setInterval(cargarCapaDeViento, 30 * 60 * 1000);

// Perfiles CTD por punto ID
let perfilesCTD = {};

const colores = ['blue', 'green', 'purple', 'orange'];
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

  ultimoTrack = [];
  perfilesCTD = {};

  const archivosArray = Array.from(files);

  // 1. Leer primero todos los perfiles y guardar las promesas
  const promesasPerfiles = archivosArray
    .filter(file => /punto[_-]?(\d+)/i.test(file.name))
    .map(file => {
      const puntoId = file.name.match(/punto[_-]?(\d+)/i)[1];
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
          const contenido = e.target.result.trim();
          const lineas = contenido.split('\n');
          const columnas = lineas[0].split(',');
          const datos = lineas.slice(1).map(linea => {
            const partes = linea.split(',');
            const fila = {};
            columnas.forEach((col, i) => {
              fila[col.trim()] = partes[i]?.trim();
            });
            return fila;
          });
          perfilesCTD[puntoId] = { columnas, datos };
          resolve(); // marcar que este archivo terminó de cargarse
        };
        reader.readAsText(file);
      });
    });

  // 2. Esperar a que todos los perfiles estén cargados
  Promise.all(promesasPerfiles).then(() => {
    // 3. Luego procesamos los archivos que son tracks GPS
    archivosArray
      .filter(file => !/punto[_-]?(\d+)/i.test(file.name))
      .forEach(file => {
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

              const perfil = perfilesCTD[punto.id];
              let popup = `<strong>📍 Punto ID:</strong> ${punto.id}<br><b>Lat:</b> ${punto.lat}<br><b>Lon:</b> ${punto.lon}`;
              if (perfil) {
                popup += `<br><button onclick="mostrarPerfilCTD('${punto.id}')">📊 Ver perfil CTD</button>`;
              }

              L.circleMarker([punto.lat, punto.lon], {
                radius: 4,
                color: perfil ? 'red' : color,  // 🔁 usa negro si tiene perfil
                fillOpacity: 0.8,
                pane: 'puntos'  // 👈 esto los pone por encima
              })

              .bindPopup(popup)
              .addTo(map);
            }
          });

          if (puntos.length > 0) {
            L.polyline(puntos.map(p => [p.lat, p.lon]), { color }).addTo(map);
            map.fitBounds(puntos.map(p => [p.lat, p.lon]));
          }

          ultimoTrack = puntos;
          ultimoColor = color;

        };
        reader.readAsText(file);
      });

    fileInput.value = "";
    if (accion === 'subir') {
      archivosArray.forEach(file => {
        if (file.name.toLowerCase().endsWith(".csv")) {
          subirCSVaZenodo(file);
        }
      });
    }

  });
});



function mostrarPerfilCTD(id) {
  const perfil = perfilesCTD[id];
  if (!perfil) return;
  const tabla = `
    <html>
    <head><title>Perfil CTD - Punto ${id}</title><style>
      table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: center; }
      th { background: #f0f0f0; }
    </style></head>
    <body><h2>Perfil CTD - Punto ${id}</h2>
    <table><thead><tr>${perfil.columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${perfil.datos.map(fila => `<tr>${perfil.columnas.map(c => `<td>${fila[c]}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></body></html>
  `;
  const nuevaVentana = window.open();
  nuevaVentana.document.write(tabla);
  nuevaVentana.document.close();
}

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
