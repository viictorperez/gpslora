from flask import Flask, request, jsonify
import requests
import os
import json
import datetime
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

ZENODO_TOKEN = os.getenv("ZENODO_TOKEN")
ZENODO_API_URL = "https://zenodo.org/api/deposit/depositions"
GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxZYsI3_m7VY7NY01Ah_HVTEv6evT9doEBkb9MCWGYiBhFUiy2f8KXDzoqtwG8SEGGKXQ/exec"  # Reemplaza con tu URL real

HEADERS = {
    "Authorization": f"Bearer {ZENODO_TOKEN}"
}


@app.route('/')
def home():
    return jsonify({"mensaje": "Backend para subir CSV a Zenodo funcionando correctamente 🚀"})


@app.route('/subir-zenodo', methods=['POST'])
def subir_csv_a_zenodo():
    if 'file' not in request.files:
        return jsonify({"error": "No se envió ningún archivo."}), 400

    archivo = request.files['file']

    if not archivo.filename.endswith('.csv'):
        return jsonify({"error": "Solo se aceptan archivos .csv"}), 400

    # Paso 1: Crear depósito
    r1 = requests.post(ZENODO_API_URL, json={}, headers={**HEADERS, "Content-Type": "application/json"})
    if r1.status_code != 201:
        return jsonify({"error": "No se pudo crear el depósito en Zenodo"}), 500

    deposito = r1.json()
    deposito_id = deposito['id']

    # Paso 2: Subir archivo
    files_url = f"{ZENODO_API_URL}/{deposito_id}/files"
    r2 = requests.post(
        files_url,
        headers=HEADERS,
        files={'file': (archivo.filename, archivo.stream, 'text/csv')}
    )

    if r2.status_code != 201:
        return jsonify({"error": "Error al subir el archivo"}), 500

    # Paso 3: Publicar
    publicar_url = f"{ZENODO_API_URL}/{deposito_id}/actions/publish"
    r3 = requests.post(publish_url, headers=HEADERS)

    if r3.status_code != 202:
        return jsonify({"error": "No se pudo publicar el depósito"}), 500

    # URL pública del archivo en Zenodo
    url_publica = f"https://zenodo.org/record/{deposito_id}"

    # Guardar en Google Sheets
    guardar_en_sheet(archivo.filename, url_publica)

    return jsonify({
        "mensaje": "Archivo subido y publicado correctamente en Zenodo.",
        "zenodo_url": url_publica
    })


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
    app.run(host="0.0.0.0", port=5000)
