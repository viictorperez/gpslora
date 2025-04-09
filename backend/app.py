import requests
import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import json
import datetime

load_dotenv()

app = Flask(__name__)

ZENODO_TOKEN = os.getenv("ZENODO_TOKEN")
ZENODO_API_URL = "https://zenodo.org/api/deposit/depositions"
HEADERS = {
    "Authorization": f"Bearer {ZENODO_TOKEN}",
    "Content-Type": "application/json"
}

GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzF8l5UIJC0ED5y6bWrJs7GLaAYehR0lmroWP-Dc_z4ZI_f2Sz0CAkXFbbrBBMo0izsfQ/exec"  # URL de tu Google Apps Script

@app.route('/subir-zenodo', methods=['POST'])
def subir_csv_a_zenodo():
    try:
        print("📥 Recibiendo archivo...")
        if 'file' not in request.files:
            print("❌ Archivo no encontrado en la solicitud")
            return jsonify({"error": "No file provided"}), 400

        archivo = request.files['file']
        print("📄 Nombre del archivo recibido:", archivo.filename)

        if not archivo.filename.endswith('.csv'):
            print("❌ Archivo no es .csv")
            return jsonify({"error": "Only CSV files are allowed"}), 400

        # Crear depósito
        response = requests.post(ZENODO_API_URL, json={}, headers=HEADERS)
        print("📝 Respuesta al crear depósito:", response.status_code)

        if response.status_code != 201:
            print("❌ Error creando depósito:", response.text)
            return jsonify({"error": "Failed to create Zenodo deposition"}), 500

        deposito = response.json()
        deposito_id = deposito['id']

        # Subir archivo
        files_url = f"{ZENODO_API_URL}/{deposito_id}/files"
        upload_response = requests.post(files_url, headers=HEADERS, files={
            'file': (archivo.filename, archivo.stream, 'text/csv')
        })

        print("📤 Subida:", upload_response.status_code)
        if upload_response.status_code != 201:
            print("❌ Error al subir:", upload_response.text)
            return jsonify({"error": "Failed to upload the file to Zenodo"}), 500

        # Publicar
        publish_url = f"{ZENODO_API_URL}/{deposito_id}/actions/publish"
        publish_response = requests.post(publish_url, headers=HEADERS)
        print("🚀 Publicación:", publish_response.status_code)

        if publish_response.status_code != 202:
            print("❌ Error al publicar:", publish_response.text)
            return jsonify({"error": "Failed to publish the deposition"}), 500

        zenodo_url = f"https://zenodo.org/record/{deposito_id}"
        print("✅ URL pública:", zenodo_url)

        # Guardar en Sheets
        guardar_en_sheet(archivo.filename, zenodo_url)

        return jsonify({"zenodo_url": zenodo_url})

    except Exception as e:
        print("❗ EXCEPCIÓN:", e)
        return jsonify({"error": "Error interno del servidor", "detalle": str(e)}), 500


def guardar_en_sheet(nombre_archivo, url_zenodo):
    datos = {
        "nombre": nombre_archivo,
        "enlace": url_zenodo,
        "fecha": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    try:
        requests.post(GOOGLE_SHEETS_URL, data=json.dumps(datos))
    except Exception as e:
        print("⚠️ Error al guardar en Google Sheets:", e)
        
@app.route('/')
def home():
    return jsonify({"mensaje": "Backend funcionando correctamente 🚀"})
@app.route('/historial', methods=['GET'])
def obtener_historial():
    try:
        respuesta = requests.get(GOOGLE_SHEETS_URL)
        datos = respuesta.json()
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": "No se pudo obtener el historial", "detalle": str(e)}), 500   
        
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
