import os
import json
import requests
from io import BytesIO
from flask import Flask, jsonify, request, send_from_directory, url_for, render_template
from dotenv import load_dotenv
from flask_cors import CORS

# Load environment variables
load_dotenv()

# Tell Flask where to find static files and Jinja templates:
app = Flask(
    __name__,
    static_folder="static",     # ← your index.html, game.js, style.css go here
    template_folder="templates" # ← your sdk.js.j2 sits here
)
CORS(app, resources={r"/*": {"origins": "*"}})

# Base directory of the project
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ERC-721 ABI + pinata creds
with open(os.path.join(BASE_DIR, 'erc721_abi.json')) as f:
    CONTRACT_ABI = json.load(f)
PINATA_KEY    = os.getenv('PINATA_API_KEY')
PINATA_SECRET = os.getenv('PINATA_SECRET_API_KEY')
PINATA_URL    = os.getenv('PINATA_ENDPOINT')


# Read these from your .env
NFT_CONTRACTS = {
    "sword":  os.getenv("CURRENT_CONTRACT_ADDRESS"),
    "potion": os.getenv("CURRENT_CONTRACT_ADDRESS"),
    "gem":    os.getenv("CURRENT_CONTRACT_ADDRESS"),
}
# ------------------------
# In-memory inventory store
# ------------------------
# Maps lowercase wallet addresses to a list of minted item types
user_items = {
    #     { "item": "sword",  "metadata_uri": "ipfs://..." }
}

# ------------------------
# Helper Functions
# ------------------------

def load_metadata(item_type):
    """Load the JSON metadata for an item."""
    try:
        path = os.path.join(BASE_DIR, "metadata", f"{item_type}.json")
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[ERROR] Metadata not found for: {item_type}")
        return None
    
def pin_file(filepath):
    headers = { 'pinata_api_key': PINATA_KEY, 'pinata_secret_api_key': PINATA_SECRET }
    with open(filepath, 'rb') as f:
        res = requests.post(PINATA_URL, headers=headers, files={ 'file': (os.path.basename(filepath), f) })
    res.raise_for_status()
    return f"ipfs://{res.json()['IpfsHash']}"

def pin_json(data, name):
    headers = { 'pinata_api_key': PINATA_KEY, 'pinata_secret_api_key': PINATA_SECRET }
    payload = BytesIO(json.dumps(data).encode())
    res = requests.post(PINATA_URL, headers=headers, files={ 'file': (f'{name}.json', payload) })
    res.raise_for_status()
    return f"ipfs://{res.json()['IpfsHash']}"

@app.route("/")
def serve_index():
    # This will send /static/index.html when someone visits http://localhost:5000/
    return app.send_static_file("index.html")

# ── Serve the SDK template as JavaScript ─────────────────────────────────────
@app.route("/sdk.js")
def serve_sdk():
    return (
        render_template(
            "sdk.js.j2",
            NFT_CONTRACTS=NFT_CONTRACTS,
            CONTRACT_ABI=CONTRACT_ABI
        ),
        200,
        {"Content-Type": "application/javascript"}
    )

# Endpoint: contract config
@app.route('/contracts')
def get_contracts():
    return jsonify({ 'contracts': NFT_CONTRACTS, 'abi': CONTRACT_ABI })

# ------------------------
# Routes: Assets & Metadata
# ------------------------


@app.route('/metadata')
def list_metadata():
    """Return a list of available item metadata filenames."""
    folder = os.path.join(BASE_DIR, "metadata")
    if not os.path.exists(folder):
        return jsonify({"error": "Metadata folder not found"}), 404
    files = [f for f in os.listdir(folder) if f.endswith(".json")]
    return jsonify(files)

@app.route('/metadata/<item_type>')
def view_metadata(item_type):
    """Return the JSON for a specific item metadata."""
    path = os.path.join(BASE_DIR, "metadata", f"{item_type}.json")
    if not os.path.exists(path):
        return jsonify({"error": "Metadata not found"}), 404
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


# Endpoint: mint – uploads image + metadata, records inventory
@app.route('/mint/<item_type>', methods=['POST'])
def mint(item_type):
    data = request.get_json() or {}
    user = data.get('user')
    if not user:
        return jsonify({ 'error': 'Missing user address' }), 400
    addr = user.lower()
    user_items.setdefault(addr, [])
    if any(e['item']==item_type for e in user_items[addr]):
        return jsonify({ 'error': f'{item_type} already minted' }), 400

    meta = load_metadata(item_type)
    if not meta:
        return jsonify({ 'error': 'Unknown item type' }), 400

    # Pin image & metadata
    img_path = os.path.join(BASE_DIR, 'assets', f'{item_type}.png')
    if not os.path.exists(img_path):
        return jsonify({'error': 'Image not found'}), 404
    img_uri  = pin_file(img_path)
    meta['image'] = img_uri
    meta_uri = pin_json(meta, item_type)


    # record both URIs in inventory
    user_items[addr].append({
        'item':         item_type,
        'metadata_uri': meta_uri,
        'image_uri':    img_uri
    })

    return jsonify({
        'metadata_uri': meta_uri,
        'image_uri':    img_uri
    })

# Enriched inventory
@app.route('/inventory/<user_address>')
def inventory(user_address):
    addr = user_address.lower()
    user_items.setdefault(addr, [])

    enriched = []
    for entry in user_items[addr]:
        item = entry['item']
        meta = load_metadata(item)
        if not meta:
            continue

        # Build a link to your Flask‐served JSON
        meta_url = url_for('view_metadata', item_type=item, _external=True)

        enriched.append({
            'item':         item,
            'name':         meta.get('name'),
            'description':  meta.get('description'),
            'image_url':    entry['image_uri'].replace('ipfs://', 'https://ipfs.io/ipfs/'),
            'metadata_url': meta_url
        })
    return jsonify(enriched)

if __name__ == '__main__':
    app.run(debug=True)