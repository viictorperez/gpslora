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
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    archivo = request.files['file']
    if not archivo.filename.endswith('.csv'):
        return jsonify({"error": "Only CSV files are allowed"}), 400

    # Paso 1: Crear depósito en Zenodo
    response = requests.post(ZENODO_API_URL, json={}, headers=HEADERS)
    if response.status_code != 201:
        return jsonify({"error": "Failed to create Zenodo deposition"}), 500

    deposito = response.json()
    deposito_id = deposito['id']

    # Paso 2: Subir el archivo a Zenodo
    files_url = f"{ZENODO_API_URL}/{deposito_id}/files"
    upload_response = requests.post(files_url, headers=HEADERS, files={'file': (archivo.filename, archivo.stream, 'text/csv')})

    if upload_response.status_code != 201:
        return jsonify({"error": "Failed to upload the file to Zenodo"}), 500

    # Paso 3: Publicar el depósito
    publish_url = f"{ZENODO_API_URL}/{deposito_id}/actions/publish"
    publish_response = requests.post(publish_url, headers=HEADERS)

    if publish_response.status_code != 202:
        return jsonify({"error": "Failed to publish the deposition"}), 500

    # Obtener la URL pública del depósito
    zenodo_url = f"https://zenodo.org/record/{deposito_id}"

    # Guardar el historial en Google Sheets
    guardar_en_sheet(archivo.filename, zenodo_url)

    return jsonify({"zenodo_url": zenodo_url}), 200

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

if __name__ == '__main__':
    app.run(debug=True)
