let currentRoom = "Entrance";
let hasMintedSword = false;
let currentUser;         // will hold the connected wallet
let mintedItems = [];    // array of item types already minted
let provider;
let signer;

const nftContracts = {
  sword: "0x9f64932be34d5d897c4253d17707b50921f372b6",
  potion: "0x9f64932be34d5d897c4253d17707b50921f372b6",
  gem: "0x9f64932be34d5d897c4253d17707b50921f372b6"
};

const abi = [
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "string", "name": "uri", "type": "string" }
    ],
    "name": "safeMint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

function displayRoom() {
  const desc = {
    Entrance: "You are at the dungeon entrance. Go North.",
    NorthRoom: hasMintedSword
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
    document.getElementById("wallet-status").innerText = `Connected: ${currentUser}`;

    // Fetch and initialize inventory
    const invRes = await fetch(`http://localhost:5000/inventory/${currentUser}`);
    if (invRes.ok) {
      mintedItems = await invRes.json();
      mintedItems.forEach(item => {
        const btn = document.getElementById(`btn-${item}`);
        if (btn) {
          btn.innerText = `✅ ${item} minted`;
          btn.disabled = true;
        }
      });
    }
  } catch (err) {
    console.error("Wallet connect failed:", err);
    alert("Wallet connection failed.");
  }
}

function pickUpItem(itemType) {
  // Ensure wallet is connected
  if (!currentUser) {
    alert("Please connect your wallet first.");
    return;
  }
  // Prevent duplicate mints client-side
  if (mintedItems.includes(itemType)) {
    alert(`You already minted ${itemType}!`);
    return;
  }
  // Proceed to mint
  mintItem(itemType);
}

async function mintItem(itemType) {
  console.log(`Attempting to mint item: ${itemType}`);
  try {
    console.log("Sending POST to backend...");
    const response = await fetch(`http://localhost:5000/mint/${itemType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: currentUser })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Flask error response:", errorText);
      alert(`Backend error (${response.status}): ${errorText}`);
      return;
    }

    const result = await response.json();
    const metadataURI = result.metadata_uri;
    console.log(`${itemType} metadata URI:`, metadataURI);

    // Use ethers to mint on-chain
    const contractAddress = nftContracts[itemType] || /* fallback address */ "";
    const contract = new ethers.Contract(contractAddress, abi, signer);

    console.log("Calling safeMint on contract...");
    const tx = await contract.safeMint(currentUser, metadataURI);
    console.log("Transaction sent. Hash:", tx.hash);

    await tx.wait();
    console.log("Transaction confirmed!");

    // Update state
    mintedItems.push(itemType);
    const btn = document.getElementById(`btn-${itemType}`);
    if (btn) {
      btn.innerText = `✅ ${itemType} minted`;
      btn.disabled = true;
    }

    alert(`You got ${itemType}!`);
    displayRoom();
  } catch (err) {
    console.error("Mint failed:", err);
    alert("Minting failed. See console.");
  }
}


window.onload = () => {
  displayRoom();
};