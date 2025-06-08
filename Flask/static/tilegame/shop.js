// static/tilegame/shop.js
window.addEventListener("load", () => {
  const btnShop  = document.getElementById("btn-shop");
  const modal    = document.getElementById("shop-modal");
  const listEl   = document.getElementById("shop-list");
  const closeBtn = document.getElementById("shop-close");

  btnShop.onclick = async () => {
    try {
      // fetch & render shop items
      const items = await fetch(`${API}/shop`).then(r => r.json());
      listEl.innerHTML = items.map(it => `
        <div class="card">
          <img src="${it.image}" alt="${it.item}" width="64" height="64"/>
          <h4>${it.item}</h4>
          <p>Price: ${it.price} gold</p>
          <button data-item="${it.item}" data-price="${it.price}">
            Buy ${it.item}
          </button>
        </div>
      `).join("");

      // wire “Buy” buttons
      listEl.querySelectorAll("button[data-item]").forEach(b => {
        b.onclick = async () => {
          const item  = b.dataset.item;
          const price = Number(b.dataset.price);
          try {
            await SDK.purchase(item, price);
            // let the HUD know what just happened:
            window.dispatchEvent(new CustomEvent("itemPurchased", {
              detail: { item, price }
            }));
            alert(`🎉 You bought a ${item}!`);
            await SDK.refreshButtons();
            // immediately update HUD gold
            const { human } = await SDK.fetchBalance("gold", SDK.user);
            document.getElementById("inv-gold").innerText = human;
          } catch (e) {
            alert(e.message);
          }
        };
      });

      modal.style.display = "block";
    } catch (e) {
      console.error("Shop load failed", e);
      alert("Could not load shop.");
    }
  };

  closeBtn.onclick = () => {
    modal.style.display = "none";
  };
});
