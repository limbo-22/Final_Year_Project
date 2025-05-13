let currentRoom = "Entrance";
let hasMintedSword = false;
let provider;
let signer;

const swordNFTAddress = "0x9f64932be34d5d897c4253d17707b50921f372b6";
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

function pickUpSword() {
  if (currentRoom === "NorthRoom" && !hasMintedSword) {
    mintSwordNFT();
  } else if (hasMintedSword) {
    alert("You already picked up the sword!");
  }
}



async function mintSwordNFT() {
  try {
    if (!signer) {
      alert("Please connect your wallet first.");
      return;
    }

    const contract = new ethers.Contract(swordNFTAddress, abi, signer);
    const address = await signer.getAddress();

    const metadataURI = "ipfs://bafkreidbhnkh6o5t6emazn3iilpewwrcgg5onqt77pj3dcwi6jpqrbbjmm";
    const tx = await contract.safeMint(address, metadataURI);
    await tx.wait();

    hasMintedSword = true;
    alert("Sword minted to your wallet!");
    displayRoom();
  } catch (err) {
    console.error("Mint failed", err);
    alert("Minting failed. Check console.");
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