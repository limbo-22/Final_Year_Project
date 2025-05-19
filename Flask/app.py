import os
import json
import requests
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

WEB3_STORAGE_TOKEN = os.getenv("WEB3_STORAGE_TOKEN")
HEADERS = {
    "Authorization": f"Bearer {WEB3_STORAGE_TOKEN}"
}

# 🔄 Load metadata template from item_templates folder inside Flask/
def load_item_template(item_type):
    try:
        # Explicitly locate the file inside the Flask/item_templates/ directory
        base_dir = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(base_dir, "item_templates", f"{item_type}.json")

        with open(template_path, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"[ERROR] Template not found for: {item_type}")
        return None
    
def find_image_path(item_type, extensions=[".png", ".jpg", ".jpeg"]):
    assets_dir = os.path.join(BASE_DIR, "assets")
    for ext in extensions:
        candidate = os.path.join(assets_dir, f"{item_type}{ext}")
        if os.path.exists(candidate):
            return candidate
    return None


# 📤 Upload any file to Pinata
def upload_to_pinata(filepath):
    pinata_api_key = os.getenv("PINATA_API_KEY")
    pinata_secret_api_key = os.getenv("PINATA_SECRET_API_KEY")
    pinata_endpoint = os.getenv("PINATA_ENDPOINT")

    headers = {
        "pinata_api_key": pinata_api_key,
        "pinata_secret_api_key": pinata_secret_api_key
    }

    with open(filepath, "rb") as file:
        files = {
            'file': (os.path.basename(filepath), file)
        }
        response = requests.post(pinata_endpoint, headers=headers, files=files)

    if response.status_code != 200:
        print("[ERROR] Pinata upload failed:", response.status_code, response.text)
        response.raise_for_status()

    ipfs_hash = response.json()["IpfsHash"]
    return f"ipfs://{ipfs_hash}"



@app.route("/")
def index():
    return "Game Metadata Backend Running"


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route("/item_templates")
def list_templates():
    templates_dir = os.path.join(BASE_DIR, "item_templates")
    
    if not os.path.exists(templates_dir):
        return jsonify({"error": "Template not found"}), 404
    files = os.listdir(templates_dir)
    json_files = [f for f in files if f.endswith(".json")]
    return jsonify(json_files)


@app.route("/item_templates/<item_type>")
def view_template(item_type):
    path = os.path.join(BASE_DIR, "item_templates", f"{item_type}.json")
    print("Loading from:", path)

    if not os.path.exists(path):
        return jsonify({"error": "Template not found"}), 404

    with open(path) as f:
        return jsonify(json.load(f))



@app.route("/assets")
def list_assets():
    assets_dir = os.path.join(BASE_DIR, "assets")

    if not os.path.exists(assets_dir):
        return jsonify({"error": "Assets folder not found"}), 404

    files = os.listdir(assets_dir)
    image_files = [f for f in files if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    return jsonify(image_files)



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

    image_cid = upload_to_pinata(image_path)
    item_data["image"] = f"ipfs://{image_cid}"

    # 📝 Write updated metadata with IPFS image link
    os.makedirs("./temp", exist_ok=True)
    temp_metadata_path = f"./temp/{item_type}_metadata.json"
    with open(temp_metadata_path, "w") as f:
        json.dump(item_data, f)

    # 📤 Upload metadata JSON to IPFS
    metadata_cid = upload_to_pinata(temp_metadata_path)

    return jsonify({
        "message": f"{item_type} will be minted to {user_address}",
        "metadata_uri": f"ipfs://{metadata_cid}"
    })

if __name__ == "__main__":
    app.run(debug=True)
