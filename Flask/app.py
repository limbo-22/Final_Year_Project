import os
import json
import requests
from io import BytesIO
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

WEB3_STORAGE_TOKEN = os.getenv("WEB3_STORAGE_TOKEN")
HEADERS = {"Authorization": f"Bearer {WEB3_STORAGE_TOKEN}"}

# Base project directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 🔄 Load metadata template from item_templates folder inside Flask/
def load_item_template(item_type):
    try:
        template_path = os.path.join(BASE_DIR, "item_templates", f"{item_type}.json")
        with open(template_path, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"[ERROR] Template not found for: {item_type}")
        return None

# 🔍 Locate image files in assets
def find_image_path(item_type, extensions=[".png", ".jpg", ".jpeg"]):
    for ext in extensions:
        candidate = os.path.join(BASE_DIR, "assets", f"{item_type}{ext}")
        if os.path.exists(candidate):
            return candidate
    return None

# 📤 Upload binary file to Pinata
def upload_to_pinata(filepath):
    pinata_api_key = os.getenv("PINATA_API_KEY")
    pinata_secret_api_key = os.getenv("PINATA_SECRET_API_KEY")
    pinata_endpoint = os.getenv("PINATA_ENDPOINT")

    headers = {
        "pinata_api_key": pinata_api_key,
        "pinata_secret_api_key": pinata_secret_api_key
    }

    with open(filepath, "rb") as file:
        files = {'file': (os.path.basename(filepath), file)}
        resp = requests.post(pinata_endpoint, headers=headers, files=files)
    resp.raise_for_status()
    cid = resp.json()["IpfsHash"]
    return f"ipfs://{cid}"

# 📤 Upload JSON metadata directly (no disk), with filename matching item_type
def upload_json_to_pinata(data: dict, item_type: str):
    pinata_api_key = os.getenv("PINATA_API_KEY")
    pinata_secret = os.getenv("PINATA_SECRET_API_KEY")
    pinata_endpoint = os.getenv("PINATA_ENDPOINT")
    headers = {
        "pinata_api_key": pinata_api_key,
        "pinata_secret_api_key": pinata_secret
    }
    json_bytes = json.dumps(data).encode("utf-8")
    filename = f"{item_type}.json"
    files = {'file': (filename, BytesIO(json_bytes), "application/json")}
    resp = requests.post(pinata_endpoint, headers=headers, files=files)
    resp.raise_for_status()
    cid = resp.json()["IpfsHash"]
    return f"ipfs://{cid}"

@app.route("/")
def index():
    return "Game Metadata Backend Running"

@app.route("/item_templates")
def list_templates():
    templates_dir = os.path.join(BASE_DIR, "item_templates")
    if not os.path.exists(templates_dir):
        return jsonify({"error": "Template folder not found"}), 404
    files = [f for f in os.listdir(templates_dir) if f.endswith(".json")]
    return jsonify(files)

@app.route("/item_templates/<item_type>")
def view_template(item_type):
    path = os.path.join(BASE_DIR, "item_templates", f"{item_type}.json")
    if not os.path.exists(path):
        return jsonify({"error": "Template not found"}), 404
    with open(path) as f:
        return jsonify(json.load(f))

@app.route("/assets")
def list_assets():
    assets_dir = os.path.join(BASE_DIR, "assets")
    if not os.path.exists(assets_dir):
        return jsonify({"error": "Assets folder not found"}), 404
    images = [f for f in os.listdir(assets_dir) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    return jsonify(images)

@app.route("/assets/<filename>")
def get_asset_image(filename):
    assets_dir = os.path.join(BASE_DIR, "assets")
    if not os.path.exists(os.path.join(assets_dir, filename)):
        return jsonify({"error": f"File '{filename}' not found"}), 404
    return send_from_directory(assets_dir, filename)

@app.route("/mint/<item_type>", methods=["POST"])
def mint_item(item_type):
    data = request.get_json()
    user_address = data.get("user")

    # 📦 Load metadata from template
    item_data = load_item_template(item_type)
    if not item_data:
        return jsonify({"error": "Item type not supported"}), 400

    # 🖼️ Upload image to IPFS
    image_path = find_image_path(item_type)
    if not image_path:
        return jsonify({"error": "Image file not found"}), 404
    item_data["image"] = upload_to_pinata(image_path)

    # 📝 Upload metadata JSON directly
    metadata_uri = upload_json_to_pinata(item_data, item_type)

    return jsonify({
        "message": f"{item_type} will be minted to {user_address}",
        "metadata_uri": metadata_uri
    })

if __name__ == "__main__":
    app.run(debug=True)
