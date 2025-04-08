# -*- coding: utf-8 -*-
"""
Editor de Spyder

Este es un archivo temporal.
"""

from flask import Flask, request, jsonify
import requests
import os
from dotenv import load_dotenv
load_dotenv()
app = Flask(__name__)

# ⚠️ ¡Cambia esto por tu token de acceso personal de Zenodo!
ZENODO_TOKEN = "JbS1NFMAg7lyeHdGaY2QDl1JP3JdSxfLwJXaP1xOiFxuc2mE2pnKS9zfU84Q"
ZENODO_API_URL = "https://zenodo.org/api/deposit/depositions"

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

    # PASO 1: Crear un depósito (draft)
    r1 = requests.post(ZENODO_API_URL, json={}, headers={**HEADERS, "Content-Type": "application/json"})
    if r1.status_code != 201:
        return jsonify({"error": "No se pudo crear el depósito en Zenodo"}), 500

    deposito = r1.json()
    deposito_id = deposito['id']

    # PASO 2: Subir el archivo al depósito
    archivos_url = f"{ZENODO_API_URL}/{deposito_id}/files"
    r2 = requests.post(
        archivos_url,
        headers=HEADERS,
        files={'file': (archivo.filename, archivo.stream, 'text/csv')}
    )

    if r2.status_code != 201:
        return jsonify({"error": "Error al subir el archivo al depósito"}), 500

    # PASO 3: Publicar el depósito
    publicar_url = f"{ZENODO_API_URL}/{deposito_id}/actions/publish"
    r3 = requests.post(publicar_url, headers=HEADERS)

    if r3.status_code != 202:
        return jsonify({"error": "No se pudo publicar el depósito"}), 500

    url_publica = f"https://zenodo.org/record/{deposito_id}"
    return jsonify({
        "mensaje": "Archivo subido y publicado correctamente en Zenodo.",
        "zenodo_url": url_publica
    })

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)