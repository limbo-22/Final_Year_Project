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


  // 1) wire up your “Connect Wallet” button just like text-game did…
  document.getElementById("btn-connect-wallet").onclick = async () => {
    try {
      await SDK.connect();
      await SDK.refreshButtons();
      // optional: immediately fetch the gold balance
      await SDK.fetchBalance("gold", SDK.user);
    } catch (e) {
      alert(e.message);
    }
  };

  // 4) Wait a moment for the global “currentUser” to be set by tilegame.js or game.js.
  //    We assume that tilegame.js calls SDK.connect() somewhere and sets window.currentUser.
  //    If not, you’ll need to wire in a login event or pass `currentUser` explicitly.

    // small delay so all UI is mounted before we paint the HUD
    await SDK.init();

    if (SDK.user) {
      await SDK.refreshButtons();
      await fetchGoldBalance(SDK.user);

    }
    // keep polling so HUD updates if user spends or earns gold
    setInterval(() => fetchGoldBalance(SDK.user), 10_000);
    // initial paint (0 until the first fetch arrives)
    renderHUD();

});
