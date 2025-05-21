import os
import json
import requests
from io import BytesIO
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv
from flask_cors import CORS

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Base directory of the project
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ------------------------
# In-memory inventory store
# ------------------------
# Maps lowercase wallet addresses to a list of minted item types
user_items = {}

# ------------------------
# Helper Functions
# ------------------------

def load_item_template(item_type):
    """Load the JSON template for an item."""
    try:
        path = os.path.join(BASE_DIR, "item_templates", f"{item_type}.json")
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[ERROR] Template not found for: {item_type}")
        return None


def find_image_path(item_type, extensions=(".png", ".jpg", ".jpeg")):
    """Locate the asset image for the given item."""
    for ext in extensions:
        candidate = os.path.join(BASE_DIR, "assets", f"{item_type}{ext}")
        if os.path.exists(candidate):
            return candidate
    return None


def upload_to_pinata(filepath):
    """Upload a binary file (image) to Pinata and return its IPFS URI."""
    api_key = os.getenv("PINATA_API_KEY")
    secret  = os.getenv("PINATA_SECRET_API_KEY")
    endpoint = os.getenv("PINATA_ENDPOINT")
    headers = {"pinata_api_key": api_key, "pinata_secret_api_key": secret}
    with open(filepath, "rb") as f:
        files = {"file": (os.path.basename(filepath), f)}
        resp = requests.post(endpoint, headers=headers, files=files)
    resp.raise_for_status()
    cid = resp.json()["IpfsHash"]
    return f"ipfs://{cid}"


def upload_json_to_pinata(data: dict, item_type: str):
    """Upload JSON metadata directly to Pinata (no temp file), named <item_type>.json."""
    api_key = os.getenv("PINATA_API_KEY")
    secret  = os.getenv("PINATA_SECRET_API_KEY")
    endpoint = os.getenv("PINATA_ENDPOINT")
    headers = {"pinata_api_key": api_key, "pinata_secret_api_key": secret}
    json_bytes = json.dumps(data).encode("utf-8")
    files = {"file": (f"{item_type}.json", BytesIO(json_bytes), "application/json")}    
    resp = requests.post(endpoint, headers=headers, files=files)
    resp.raise_for_status()
    cid = resp.json()["IpfsHash"]
    return f"ipfs://{cid}"

# ------------------------
# Routes: Assets & Templates
# ------------------------

@app.route('/')
def index():
    return "Game Metadata Backend Running"

@app.route('/item_templates')
def list_templates():
    """Return a list of available item template filenames."""
    folder = os.path.join(BASE_DIR, "item_templates")
    if not os.path.exists(folder):
        return jsonify({"error": "Templates folder not found"}), 404
    files = [f for f in os.listdir(folder) if f.endswith(".json")]
    return jsonify(files)

@app.route('/item_templates/<item_type>')
def view_template(item_type):
    """Return the JSON for a specific item template."""
    path = os.path.join(BASE_DIR, "item_templates", f"{item_type}.json")
    if not os.path.exists(path):
        return jsonify({"error": "Template not found"}), 404
    with open(path) as f:
        return jsonify(json.load(f))

@app.route('/assets')
def list_assets():
    """Return a list of image filenames in assets folder."""
    folder = os.path.join(BASE_DIR, "assets")
    if not os.path.exists(folder):
        return jsonify({"error": "Assets folder not found"}), 404
    imgs = [f for f in os.listdir(folder) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    return jsonify(imgs)

@app.route('/assets/<filename>')
def get_asset_image(filename):
    """Serve an asset image by filename."""
    folder = os.path.join(BASE_DIR, "assets")
    if not os.path.exists(os.path.join(folder, filename)):
        return jsonify({"error": f"File '{filename}' not found"}), 404
    return send_from_directory(folder, filename)

# ------------------------
# Routes: Inventory Tracking
# ------------------------

@app.route('/inventory/<user_address>')
def get_inventory(user_address):
    addr = user_address.lower()
    # if this is the first time we’ve seen this wallet, create its list
    if addr not in user_items:
        user_items[addr] = []
    return jsonify(user_items[addr])

# ------------------------
# Routes: Minting
# ------------------------

@app.route('/mint/<item_type>', methods=['POST'])
def mint_item(item_type):
    data = request.get_json() or {}
    user_address = data.get('user')
    if not user_address:
        return jsonify({"error": "Missing user address"}), 400
    addr = user_address.lower()

    # Initialize inventory list if first time
    if addr not in user_items:
        user_items[addr] = []

    # Prevent duplicates
    if item_type in user_items[addr]:
        return jsonify({"error": f"{item_type} already minted"}), 400

    # Load template
    item_data = load_item_template(item_type)
    if not item_data:
        return jsonify({"error": "Item type not supported"}), 400

    # Upload image
    img_path = find_image_path(item_type)
    if not img_path:
        return jsonify({"error": "Image not found"}), 404
    item_data['image'] = upload_to_pinata(img_path)

    # Upload metadata JSON
    metadata_uri = upload_json_to_pinata(item_data, item_type)

    # Record the mint in inventory
    user_items[addr].append(item_type)

    return jsonify({
        "message": f"{item_type} minted to {user_address}",
        "metadata_uri": metadata_uri
    })

if __name__ == '__main__':
    app.run(debug=True)