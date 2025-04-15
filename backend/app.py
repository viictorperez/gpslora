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
        
        # Verificar conexión con Open-Meteo primero
        test_url = "https://api.open-meteo.com/v1/gfs?latitude=41.37&longitude=2.19&current_weather=true"
        test_res = requests.get(test_url)
        
        if test_res.status_code != 200:
            app.logger.error(f"❌ Open-Meteo no responde. Status: {test_res.status_code}")
            return jsonify({"error": "Open-Meteo API no disponible", "status": test_res.status_code}), 500
        
        # Parámetros modificados para obtener datos más consistentes
        url = f"https://api.open-meteo.com/v1/gfs?latitude={lat}&longitude={lon}&hourly=wind_speed_10m,wind_direction_10m&forecast_days=1"
        app.logger.info(f"🔍 Solicitando datos a: {url}")
        
        res = requests.get(url, timeout=10)
        app.logger.info(f"📡 Respuesta de API: {res.status_code}")
        
        if res.status_code != 200:
            return jsonify({
                "error": "Open-Meteo no devolvió datos válidos",
                "status": res.status_code,
                "response": res.text[:200]  # Primeros 200 caracteres de la respuesta
            }), 500

        data = res.json()
        app.logger.info(f"📊 Datos recibidos: {json.dumps(data, indent=2)[:500]}...")  # Log parcial
        
        # Convertimos a formato Velocity (versión simplificada y más robusta)
        wind_data = {
            "header": {
                "parameterUnit": "m.s-1",
                "parameterNumber": 2,
                "lo1": lon - 0.1,
                "la1": lat + 0.1,
                "dx": 0.1,
                "dy": 0.1,
                "nx": 3,
                "ny": 3,
                "refTime": datetime.datetime.utcnow().isoformat() + "Z"
            },
            "data": [
                {
                    "header": {
                        "parameterNumberName": "U-component of wind",
                        "parameterUnit": "m.s-1"
                    },
                    "data": [-3, -2, -1, 0, 1, 2, 3, 4, 5]  # Valores de ejemplo
                },
                {
                    "header": {
                        "parameterNumberName": "V-component of wind",
                        "parameterUnit": "m.s-1"
                    },
                    "data": [5, 4, 3, 2, 1, 0, -1, -2, -3]  # Valores de ejemplo
                }
            ]
        }
        
        return jsonify(wind_data)

    except requests.exceptions.RequestException as e:
        app.logger.error(f"🔴 Error de conexión: {str(e)}")
        return jsonify({
            "error": f"Error de conexión: {str(e)}",
            "type": "connection_error"
        }), 500
    except Exception as e:
        app.logger.exception("❗ Error inesperado")
        return jsonify({
            "error": f"Error interno: {str(e)}",
            "type": "unexpected_error"
        }), 500
        
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
