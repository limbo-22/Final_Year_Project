from flask import Flask, jsonify, request
import uuid

app = Flask(__name__)

# Simulated in-memory metadata storage
item_metadata = {
    "sword": {
        "name": "Sword of Valor",
        "description": "A shiny sword found in the dungeon.",
        "image": "ipfs://<CID-of-sword-image>",
        "attributes": [
            {"trait_type": "Power", "value": 10},
            {"trait_type": "Durability", "value": 100}
        ]
    }
}

@app.route("/")
def index():
    return "Game Metadata Backend Running"

@app.route("/metadata/<item_type>")
def get_metadata(item_type):
    item = item_metadata.get(item_type)
    if item:
        return jsonify(item)
    return jsonify({"error": "Item not found"}), 404

@app.route("/mint", methods=["POST"])
def mint_item():
    data = request.get_json()
    item_type = data.get("item")
    user_address = data.get("user")
    # In real case, trigger contract mint here with metadata URI
    return jsonify({
        "message": f"{item_type} will be minted to {user_address}",
        "metadata_uri": f"http://localhost:5000/metadata/{item_type}"
    })

if __name__ == "__main__":
    app.run(debug=True)