let currentRoom = "Entrance";

let currentUser;         // will hold the connected wallet
let mintedItems = [];    // array of itemType strings already minted

let provider;
let signer;

const nftContracts = {
  sword:  "0x9f64932be34d5d897c4253d17707b50921f372b6",
  potion: "0x9f64932be34d5d897c4253d17707b50921f372b6",
  gem:    "0x9f64932be34d5d897c4253d17707b50921f372b6"
};

const abi = [{
  "inputs": [
    { "internalType": "address", "name": "to",  "type": "address" },
    { "internalType": "string",  "name": "uri", "type": "string"  }
  ],
  "name": "safeMint",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}];

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

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask is not installed!");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    signer = await provider.getSigner();
    currentUser = (await signer.getAddress()).toLowerCase();
    document.getElementById("wallet-status")
            .innerText = `Connected: ${currentUser}`;

    // load & lock buttons
    await loadInventory();
  } catch (err) {
    console.error("Wallet connect failed:", err);
    alert("Wallet connection failed.");
  }
}

function pickUpItem(itemType) {
  if (!currentUser) {
    alert("Please connect your wallet first.");
    return;
  }

  mintItem(itemType);
}

async function mintItem(itemType) {
  console.log(`Attempting to mint item: ${itemType}`);
  try {
    const response = await fetch(
      `http://localhost:5000/mint/${itemType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: currentUser })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.error("Flask error response:", err);
      alert(`Backend error (${response.status}): ${
        err?.error || await response.text()
      }`);
      return;
    }

    const { metadata_uri } = await response.json();
    console.log(`${itemType} metadata URI:`, metadata_uri);

    // on‐chain mint
    const contract = new ethers.Contract(
      nftContracts[itemType], abi, signer
    );
    const tx = await contract.safeMint(currentUser, metadata_uri);
    console.log("Tx sent:", tx.hash);
    await tx.wait();
    console.log("Transaction confirmed!");

    // record & lock
    mintedItems.push(itemType);
    const btn = document.getElementById(`btn-${itemType}`);
    if (btn) {
      btn.innerText  = `✅ ${itemType} minted`;
      btn.disabled   = true;
    }

    alert(`You got ${itemType}!`);
    displayRoom();

  } catch (err) {
    console.error("Mint failed:", err);
    alert("Minting failed. See console.");
  }
}

async function showInventory() {
  if (!currentUser) {
    alert("Connect your wallet first!");
    return;
  }

  const res = await fetch(
    `http://localhost:5000/inventory/${currentUser}`
  );
  if (!res.ok) {
    alert("Failed to load inventory");
    return;
  }
  const entries = await res.json();
  // entries = [ { item, metadata_uri }, ... ]

  const listEl = document.getElementById("inventory-list");
  listEl.innerHTML = "";

  for (const { item, metadata_uri } of entries) {
    // normalize gateway URL
    let metaUrl = metadata_uri;
    if (metaUrl.startsWith("ipfs://")) {
      metaUrl = metaUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) continue;
    const metadata = await metaRes.json();

    const card = document.createElement("div");
    card.style.cssText = `
      border:1px solid #444;
      padding:10px;
      width:120px;
      text-align:center;
      background:#333;
    `;

    // image
    const img = document.createElement("img");
    let imgUrl = metadata.image;
    if (imgUrl.startsWith("ipfs://")) {
      imgUrl = imgUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    img.src   = imgUrl;
    img.alt   = item;
    img.style.width = "100%";
    card.appendChild(img);

    // label + link
    const label = document.createElement("p");
    label.innerHTML = `
      <strong>${item}</strong><br/>
      <a href="${metaUrl}" target="_blank">View Metadata</a>
    `;
    card.appendChild(label);

    listEl.appendChild(card);
  }

  document.getElementById("inventory-modal").style.display = "block";
}

function hideInventory() {
  document.getElementById("inventory-modal").style.display = "none";
}

async function loadInventory() {
  if (!currentUser) return;

  //  Reset all buttons back to their default state
  //    (we assume your HTML buttons have data-default-text attributes)
  document.querySelectorAll('button[id^="btn-"]').forEach(btn => {
    const def = btn.dataset.defaultText;
    if (!def) return;                // skip buttons that don’t have it
    btn.disabled  = false;
    btn.innerText = def;
  });

  const res = await fetch(
    `http://localhost:5000/inventory/${currentUser}`
  );
  if (!res.ok) return;

  const entries = await res.json();
  // convert to simple string list
  mintedItems = entries.map(e => e.item);

  mintedItems.forEach(itemType => {
    const btn = document.getElementById(`btn-${itemType}`);
    if (btn) {
      btn.innerText = `✅ ${itemType} minted`;
      btn.disabled  = true;
    }
  });
}

// Auto‐reconnect & lock buttons if MetaMask is already unlocked
window.onload = async () => {
  displayRoom();

  if (window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.listAccounts();
    if (accounts.length) {
      signer      = await provider.getSigner();
      currentUser = accounts[0].address.toLowerCase();
      document.getElementById("wallet-status")
              .innerText = `Connected: ${currentUser}`;
      await loadInventory();
    }
  }
};
