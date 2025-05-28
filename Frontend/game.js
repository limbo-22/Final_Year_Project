let currentRoom = "Entrance";
const API = "http://localhost:5000";
let provider, signer, currentUser;         // will hold the connected wallet
let mintedItems = [];    // array of itemType strings already minted

// dynamically loaded from Flask
let nftContracts = {};
let abi = [];

function displayRoom() {
  const hasSword = mintedItems.includes("sword");
  const desc = {
    Entrance:  "You are at the dungeon entrance. Go North.",
    NorthRoom: hasSword
      ? "You see an empty pedestal where the sword once was."
      : "A dark room. There's a shiny sword here."
  };
  document.getElementById("game-text").innerText = desc[currentRoom];
}

function goNorth() {
  if (currentRoom === "Entrance") {
    currentRoom = "NorthRoom";
    displayRoom();
  }
}

// 1) Connect wallet and preload state
async function connectWallet() {
  if (!window.ethereum) return alert("Install MetaMask");
  provider = new ethers.BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  signer      = await provider.getSigner();
  currentUser = (await signer.getAddress()).toLowerCase();

  document.getElementById("wallet-status").innerText = `Connected: ${currentUser}`;
  await refreshButtons();
}

// 2) Mint an item via backend and then on-chain
async function mintItem(itemType) {
  if (!currentUser) return alert("Connect first");

  // Trigger backend mint (uploads assets, pins to IPFS, records inventory)
  const resp = await fetch(`${API}/mint/${itemType}`, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: currentUser })
  });
  const result = await resp.json();
  if (!resp.ok) return alert(result.error || "Mint failed");

  // Fetch contract addresses & ABI
  const { contracts, abi } = await fetch(`${API}/contracts`).then(r => r.json());
  const contract = new ethers.Contract(contracts[itemType], abi, signer);

  // Send the on-chain transaction
  const tx = await contract.safeMint(currentUser, result.metadata_uri);
  console.log("Mint TX:", tx.hash);
  await tx.wait();

  alert(`🎉 You minted a ${itemType}!`);
  await refreshButtons();
}

// 3) Refresh button states from enriched inventory
async function refreshButtons() {
  document.querySelectorAll('button[id^="btn-"]').forEach(btn => {
    btn.disabled = false;
    btn.innerText = btn.dataset.defaultText;
  });

  const items = await fetch(`${API}/inventory/${currentUser}`).then(r => r.json());
  items.forEach(i => {
    const btn = document.getElementById(`btn-${i.item}`);
    if (btn) {
      btn.disabled = true;
      btn.innerText = `✅ ${i.item}`;
    }
  });
}

// 4) Show inventory modal with enriched data
async function showInventory() {
  if (!currentUser) return alert("Connect first");

  const items = await fetch(`${API}/inventory/${currentUser}`).then(r => r.json());
  const listEl = document.getElementById("inventory-list");
  listEl.innerHTML = items.map(i => `
    <div class="card">
      <img src="${i.image_url}" alt="${i.name}" />
      <h4>${i.name}</h4>
      <p>${i.description}</p>
      <a href="${i.metadata_url}" target="_blank">View Metadata</a>
    </div>
  `).join('');
  document.getElementById("inventory-modal").style.display = "block";
}

function hideInventory() {
  document.getElementById("inventory-modal").style.display = "none";
}


// Auto-reconnect if already authorized
window.onload = async () => {
  displayRoom();   // game logic UI

  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length) {
      signer      = await provider.getSigner();
      currentUser = accounts[0].address.toLowerCase();
      document.getElementById("wallet-status").innerText = `Connected: ${currentUser}`;
      await refreshButtons();
    }
  }
};
