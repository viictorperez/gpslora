import os
import json
import datetime
import requests
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import pytz
import math

load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)

# Variables de entorno
ZENODO_TOKEN = os.getenv("ZENODO_TOKEN")
ZENODO_API_URL = "https://zenodo.org/api/deposit/depositions"
GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbypqnAFQ_M2wmbKAbUmVtfY45-3tx3BPtdDHWgfrsBFYJg0Gk3n4Qkd4nDMsOqN0AERuA/exec"  # Sustituye por la tuya

@app.route('/')
def home():
    app.logger.info("🏠 Página raíz visitada")
    return jsonify({"mensaje": "Backend actualizado correctamente 🚀"})

@app.route('/subir-zenodo', methods=['POST'])
def subir_csv_a_zenodo():
    try:
        app.logger.info("📥 Recibiendo archivo...")

        if 'file' not in request.files:
            app.logger.warning("❌ Archivo no enviado")
            return jsonify({"error": "No file provided"}), 400

        archivo = request.files['file']
        autor_nombre = request.form.get("autor", "Usuario Web")
        descripcion = request.form.get("descripcion", "Track GPS subido desde la web")

        metadata = {
            "metadata": {
                "title": archivo.filename,
                "upload_type": "dataset",
                "description": descripcion,
                "creators": [{"name": autor_nombre}],
                "communities": [{"identifier": "remcientific"}]  # <-- cambia aquí
            }
        }

        response = requests.post(ZENODO_API_URL, json=metadata, headers={
            "Authorization": f"Bearer {ZENODO_TOKEN}",
            "Content-Type": "application/json"
        })
        app.logger.info(f"📝 Crear depósito: {response.status_code}")

        if response.status_code != 201:
            app.logger.error(f"❌ Error creando depósito: {response.text}")
            return jsonify({"error": "Error al crear depósito"}), 500

        deposito = response.json()
        deposito_id = deposito['id']

        # Paso 2: Subir archivo
        files_url = f"{ZENODO_API_URL}/{deposito_id}/files"
        upload_response = requests.post(
            files_url,
            headers={"Authorization": f"Bearer {ZENODO_TOKEN}"},
            files={"file": (archivo.filename, archivo.read())}
        )

        app.logger.info(f"📤 Subida: {upload_response.status_code}")
        if upload_response.status_code != 201:
            app.logger.error("❌ Error al subir archivo a Zenodo:")
            app.logger.error(f"➡️ Código de estado: {upload_response.status_code}")
            app.logger.error(f"➡️ Respuesta: {upload_response.text}")
            return jsonify({"error": "Error al subir archivo"}), 500

        # Paso 3: Publicar
        publish_url = f"{ZENODO_API_URL}/{deposito_id}/actions/publish"
        publish_response = requests.post(publish_url, headers={"Authorization": f"Bearer {ZENODO_TOKEN}"})
        app.logger.info(f"🚀 Publicar: {publish_response.status_code}")

        if publish_response.status_code != 202:
            app.logger.error(f"❌ Error al publicar: {publish_response.text}")
            return jsonify({"error": "Error al publicar depósito"}), 500

        zenodo_url = f"https://zenodo.org/record/{deposito_id}"
        app.logger.info(f"✅ Subido con éxito: {zenodo_url}")

        hora_local = request.form.get("hora_local")
        guardar_en_sheet(archivo.filename, zenodo_url, hora_local)

        return jsonify({"zenodo_url": zenodo_url})

    except Exception as e:
        app.logger.exception("❗ EXCEPCIÓN en subir_csv_a_zenodo")
        return jsonify({"error": "Error interno del servidor", "detalle": str(e)}), 500

def guardar_en_sheet(nombre_archivo, url_zenodo, hora_local=None):
    if hora_local:
        # Convertimos ISO string a formato bonito (sin milisegundos)
        fecha_formateada = hora_local.replace("T", " ").split(".")[0]
    else:
        zona = pytz.timezone("Europe/Madrid")
        ahora = datetime.datetime.now(zona)
        fecha_formateada = ahora.strftime('%Y-%m-%d %H:%M:%S')

    datos = {
        "nombre": nombre_archivo,
        "enlace": url_zenodo,
        "fecha": fecha_formateada
    }

    try:
        response = requests.post(GOOGLE_SHEETS_URL, data=json.dumps(datos))
        app.logger.info(f"🧾 Guardado en Sheets: {response.status_code}")
    except Exception as e:
        app.logger.exception("⚠️ Error al guardar en Sheets")


@app.route('/historial', methods=['GET'])
def obtener_historial():
    try:
        app.logger.info("📡 Solicitando historial desde Google Sheets...")
        respuesta = requests.get(GOOGLE_SHEETS_URL)
        datos = respuesta.json()
        return jsonify(datos)
    except Exception as e:
        app.logger.exception("❌ Error obteniendo historial desde Google Sheets")
        return jsonify({"error": "No se pudo obtener el historial", "detalle": str(e)}), 500
        
@app.route('/borrar-historial', methods=['POST'])
def borrar_historial():
    try:
        app.logger.info("🗑️ Solicitando borrado de historial en Google Sheets...")
        payload = { "borrar": True }
        response = requests.post(GOOGLE_SHEETS_URL, data=json.dumps(payload))
        return jsonify({"mensaje": "Historial borrado correctamente"})
    except Exception as e:
        app.logger.exception("❌ Error al borrar historial")
        return jsonify({"error": "No se pudo borrar el historial", "detalle": str(e)}), 500

@app.route('/viento.json')
def viento_json():
    try:
        lat = float(os.getenv("WIND_CENTER_LAT", "41.37"))
        lon = float(os.getenv("WIND_CENTER_LON", "2.19"))
        
        # 1. Obtener datos de la API
        url = f"https://api.open-meteo.com/v1/gfs?latitude={lat}&longitude={lon}&hourly=wind_speed_10m,wind_direction_10m&forecast_days=1"
        res = requests.get(url)
        
        if res.status_code != 200:
            return jsonify({"error": "No se pudo obtener viento"}), 500

        data = res.json()
        
        # 2. Convertir a formato de cuadrícula que Leaflet.Velocity entiende
        wind_speeds = data['hourly']['wind_speed_10m']  # en km/h
        wind_directions = data['hourly']['wind_direction_10m']  # en grados
        
        # Convertir velocidad a m/s (1 km/h = 0.277778 m/s)
        wind_speeds_ms = [speed * 0.277778 for speed in wind_speeds]
        
        # 3. Crear una pequeña cuadrícula alrededor del punto central
        grid_size = 0.2  # Tamaño en grados
        grid_points = 3   # Puntos en cada dirección
        
        # Componentes U (este-oeste) y V (norte-sur)
        u_data = []
        v_data = []
        
        for speed, direction in zip(wind_speeds_ms, wind_directions):
            # Convertir dirección y velocidad a componentes U/V
            rad = math.radians(direction)
            u = -speed * math.sin(rad)  # Componente este-oeste
            v = -speed * math.cos(rad)  # Componente norte-sur
            
            # Para crear una cuadrícula, repetimos los valores
            for _ in range(grid_points * grid_points):
                u_data.append(u)
                v_data.append(v)
        
        # 4. Estructurar los datos en formato Velocity
        wind_data = {
            "header": {
                "parameterUnit": "m.s-1",
                "parameterNumber": 2,
                "lo1": lon - grid_size/2,
                "la1": lat + grid_size/2,
                "dx": grid_size/grid_points,
                "dy": grid_size/grid_points,
                "nx": grid_points,
                "ny": grid_points,
                "refTime": data['hourly']['time'][0]  # Usa el primer timestamp
            },
            "data": [
                {
                    "header": {
                        "parameterNumberName": "U-component of wind",
                        "parameterUnit": "m.s-1"
                    },
                    "data": u_data
                },
                {
                    "header": {
                        "parameterNumberName": "V-component of wind",
                        "parameterUnit": "m.s-1"
                    },
                    "data": v_data
                }
            ]
        }
        
        return jsonify(wind_data)
        
    except Exception as e:
        logging.error(f"Error generando datos de viento: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
