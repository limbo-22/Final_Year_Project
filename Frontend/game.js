let currentRoom = "Entrance";
let hasMintedSword = false;
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

function pickUpItem(itemType) {
  if (itemType === "sword" && currentRoom === "NorthRoom" && !hasMintedSword) {
    mintItem("sword");
  } else if (itemType === "sword" && hasMintedSword) {
    alert("You already picked up the sword!");
  } else {
    mintItem(itemType); // for other items like "potion", "gem"
  }
}



async function mintItem(itemType) {
  try {

    console.log(`Attempting to mint item: ${itemType}`);

    if (!signer) {
      alert("Please connect your wallet first.");
      return;
    }

    const address = await signer.getAddress();
    console.log("Connected wallet address:", address);


    // 🔄 Fetch metadata from Flask
    console.log("Sending POST to backend...");
    const response = await fetch(`http://localhost:5000/mint/${itemType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: address })
    });

    
  if (!response.ok) {
    const errorText = await response.text(); // to inspect backend response
    console.error("Flask error response:", errorText);
    alert(`Backend error (${response.status}): ${errorText}`);
    return;
  }


    const result = await response.json();
    const metadataURI = result.metadata_uri;
    console.log(`${itemType} metadata URI:`, metadataURI);

    // 🧾 Use the correct contract
    const contractAddress = nftContracts[itemType];
    const contract = new ethers.Contract(contractAddress, abi, signer);

    console.log("Calling safeMint on contract...");
    const tx = await contract.safeMint(address, metadataURI);
    console.log("Transaction sent. Hash:", tx.hash);


    await tx.wait();
     console.log("Transaction confirmed!");

    alert(`${itemType} NFT minted to your wallet!`);
    if (itemType === "sword") hasMintedSword = true;
    displayRoom();

  } catch (err) {
    console.error("Mint failed:", err);
    alert("Minting failed. See console.");
  }
}


async function connectWallet() {
  if (window.ethereum) {
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      document.getElementById("wallet-status").innerText = `Connected: ${userAddress}`;
    } catch (err) {
      console.error("User rejected connection", err);
      alert("Wallet connection rejected.");
    }
  } else {
    alert("MetaMask is not installed!");
  }
}

window.onload = () => {
  displayRoom();
};