// game.js — pure UI bindings using SDK.*

let currentRoom = "Entrance";
let currentUser;
const itemTypes = ["sword","potion","gem"];

// display the room text
function displayRoom() {
  const hasSword = document.getElementById("btn-sword").disabled;
  const txt = (currentRoom === "Entrance")
    ? "You are at the dungeon entrance. Go North."
    : hasSword
      ? "You see an empty pedestal where the sword once was."
      : "A dark room. There's a shiny sword here.";
  document.getElementById("game-text").innerText = txt;
}

// wallet connect
document.getElementById("btn-connect").onclick = async () => {
  try {
    currentUser = await SDK.connect();
    document.getElementById("wallet-status").innerText = `Connected: ${currentUser}`;
    await SDK.refreshButtons();
    displayRoom();
  } catch (e) {
    alert(e.message);
  }
};

// movement
document.getElementById("btn-north").onclick = () => {
  if (currentRoom === "Entrance") {
    currentRoom = "NorthRoom";
    displayRoom();
  }
};

// mint buttons
itemTypes.forEach(item => {
  const btn = document.getElementById(`btn-${item}`);
  btn.onclick = async () => {
    try {
      await SDK.mint(item);
      alert(`You minted a ${item}!`);
      await SDK.refreshButtons();
      displayRoom();
    } catch (e) {
      alert(e.message);
    }
  };
});

// inventory modal
document.getElementById("btn-inventory").onclick = () => SDK.showInventory();
document.getElementById("inventory-close").onclick = () => SDK.hideInventory();

// On page load: render room + auto-reconnect
window.addEventListener("DOMContentLoaded", async () => {
  // 6.1) Tell SDK what to do when account changes:
  SDK.onAccountChange = (newAddress) => {
    currentUser = newAddress;
    const statusEl = document.getElementById("wallet-status");
    if (newAddress) {
      statusEl.innerText = `Connected: ${newAddress}`;
    } else {
      statusEl.innerText = "Not connected";
    }
    // Update the mint buttons and room text
    SDK.refreshButtons();
    displayRoom();
  };

  // 6.2) Fire SDK.init() to pick up any existing connection
  await SDK.init();

  // 6.3) If SDK found a user already connected, the onAccountChange
  //      block above will have run.  If not, we must at least show “Not connected”
  if (!currentUser) {
    document.getElementById("wallet-status").innerText = "Not connected";
    displayRoom();
  }
});
