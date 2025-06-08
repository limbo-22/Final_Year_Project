// static/tilegame/hud.js

window.addEventListener("load", async function () {
  // 1) In‐memory counts
  const inventory = {
    sword:  0,
    potion: 0,
    gem:    0,
    gold:   0
  };

  // 2) Render function
  function renderHUD() {
    document.getElementById("inv-sword").innerText  = inventory.sword;
    document.getElementById("inv-potion").innerText = inventory.potion;
    document.getElementById("inv-gem").innerText    = inventory.gem;
    document.getElementById("inv-gold").innerText   = inventory.gold;
  }

  // 3) Fetch on‐chain gold balance
  async function fetchGoldBalance(user) {
    try {
      const { human } = await SDK.fetchBalance("gold", user);
      inventory.gold = human;
      renderHUD();
    } catch (e) {
      console.error("Error fetching gold:", e);
    }
  }

  // 4) Fetch on‐backend inventory counts
  async function fetchInventoryCounts(user) {
    try {
      // your Flask /inventory/<user> returns [{ item: "sword", … }, …]
      const invList = await fetch(`${API}/inventory/${user}`).then(r => r.json());
      // zero all
      inventory.sword  = 0;
      inventory.potion = 0;
      inventory.gem    = 0;
      // tally
      invList.forEach(i => {
        if (i.item === "sword") inventory.sword++;
        if (i.item === "potion") inventory.potion++;
        if (i.item === "gem")    inventory.gem++;
      });
      renderHUD();
    } catch (e) {
      console.error("Error fetching inventory:", e);
    }
  }

  // 5) Hook up “Connect Wallet” button
  document.getElementById("btn-connect-wallet").onclick = async () => {
    try {
      await SDK.connect();
      await SDK.refreshButtons();
      // once connected, fetch both
      await fetchGoldBalance(SDK.user);
      await fetchInventoryCounts(SDK.user);
    } catch (e) {
      alert(e.message);
    }
  };

  // 6) Admin mint/burn buttons (owner only) should also refresh on success
  document.getElementById("btn-mint-gold").onclick = async () => {
    try {
      const human = Number(prompt("How many gold to mint?"));
      if (!human || human < 0) return;
      const amt = ethers.parseUnits(String(human), 18);
      const c   = SDK.contractInstance("gold");
      const tx  = await c.mint(SDK.user, amt);
      await tx.wait();
      // refresh both
      await fetchGoldBalance(SDK.user);
      await fetchInventoryCounts(SDK.user);
    } catch (e) {
      alert(e.message);
    }
  };

  document.getElementById("btn-burn-gold").onclick = async () => {
    try {
      const human = Number(prompt("How many gold to burn?"));
      if (!human || human < 0) return;
      const amt = ethers.parseUnits(String(human), 18);
      const c   = SDK.contractInstance("gold");
      const tx  = await c.burn(SDK.user, amt);
      await tx.wait();
      // refresh both
      await fetchGoldBalance(SDK.user);
      await fetchInventoryCounts(SDK.user);
    } catch (e) {
      alert(e.message);
    }
  };

  // 7) Once SDK has initialized (& possibly reconnected silently),
  //    fetch balances if already logged in:
  await SDK.init();
  if (SDK.user) {
    await fetchGoldBalance(SDK.user);
    await fetchInventoryCounts(SDK.user);
  }

  // 8) Poll gold balance every 10s
  setInterval(() => {
    if (SDK.user) fetchGoldBalance(SDK.user);
  }, 10_000);

  // 9) Initial paint (zero until first fetch)
  renderHUD();
});
