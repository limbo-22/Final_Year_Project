// static/tilegame/hud.js

window.addEventListener("load", async function () {
  // 1) A placeholder “inventory” object for Phase 4.3:
  const inventory = {
    sword:  0,
    potion: 0,
    gem:    0,
    gold:   0
  };

  // 2) Render function to update the spans
  function renderHUD() {
    document.getElementById("inv-sword").innerText  = inventory.sword;
    document.getElementById("inv-potion").innerText = inventory.potion;
    document.getElementById("inv-gem").innerText    = inventory.gem;
    document.getElementById("inv-gold").innerText   = inventory.gold;
  }

  // 3) Utility: fetch on-chain gold balance
  async function fetchGoldBalance(user) {
    try {
      const { human } = await SDK.fetchBalance("gold", user);
      inventory.gold = human;
      renderHUD();
    } catch (e) {
      console.error("Error fetching gold:", e);
    }
  }

  // 4) “Connect Wallet” button
  document.getElementById("btn-connect-wallet").onclick = async () => {
    try {
      await SDK.connect();
      await SDK.refreshButtons();
      await fetchGoldBalance(SDK.user);
    } catch (e) {
      alert(e.message);
    }
  };

  // 5) Mint Gold (owner only, single-account shortcut)
  document.getElementById("btn-mint-gold").onclick = async () => {
    try {
      const human = Number(prompt("How many gold to mint?"));
      if (!human || human < 0) return;
      const amt = ethers.parseUnits(String(human), 18);
      const c   = SDK.contractInstance("gold");
      await (await c.mint(SDK.user, amt)).wait();
      const { human: newBal } = await SDK.fetchBalance("gold", SDK.user);
      document.getElementById("inv-gold").innerText = newBal;
    } catch (e) {
      alert(e.message);
    }
  };

  // 6) Burn Gold (owner only, single-account shortcut)
  document.getElementById("btn-burn-gold").onclick = async () => {
    try {
      const human = Number(prompt("How many gold to burn?"));
      if (!human || human < 0) return;
      const amt = ethers.parseUnits(String(human), 18);
      const c   = SDK.contractInstance("gold");
      await (await c.burn(SDK.user, amt)).wait();
      const { human: newBal } = await SDK.fetchBalance("gold", SDK.user);
      document.getElementById("inv-gold").innerText = newBal;
    } catch (e) {
      alert(e.message);
    }
  };

  // ────────────────────────────────────────────────
  // 7) Initialize SDK & then wire up the *full* Admin Panel
  await SDK.init();

  const adminPanel = document.getElementById("admin-panel");
  if (SDK.user === SHOP_OWNER) {
    // show it
    adminPanel.style.display = "block";

    // mint to arbitrary address
    document.getElementById("btn-admin-mint").onclick = async () => {
      try {
        const to     = document.getElementById("admin-target").value.trim();
        const amount= document.getElementById("admin-amount").value.trim();
        if (!to || !amount) {
          return alert("Please enter both target address and amount");
        }
        const dec = await SDK.getTokenDecimals("gold");
        const raw = ethers.parseUnits(amount, dec);
        await SDK.mintToken("gold", to, raw);
        alert(`Minted ${amount} gold to ${to}`);
      } catch (e) {
        alert(`Mint failed: ${e.message}`);
      }
    };

    // burn from arbitrary address
    document.getElementById("btn-admin-burn").onclick = async () => {
      try {
        const from   = document.getElementById("admin-target").value.trim();
        const amount= document.getElementById("admin-amount").value.trim();
        if (!from || !amount) {
          return alert("Please enter both target address and amount");
        }
        const dec = await SDK.getTokenDecimals("gold");
        const raw = ethers.parseUnits(amount, dec);
        await SDK.burnToken("gold", from, raw);
        alert(`Burned ${amount} gold from ${from}`);
      } catch (e) {
        alert(`Burn failed: ${e.message}`);
      }
    };

  } else {
    // hide it for non-owners
    adminPanel.style.display = "none";
  }
  // ────────────────────────────────────────────────

  // 8) Now resume normal HUD flow
  if (SDK.user) {
    await SDK.refreshButtons();
    await fetchGoldBalance(SDK.user);
  }
  setInterval(() => fetchGoldBalance(SDK.user), 10_000);
  renderHUD();
});


