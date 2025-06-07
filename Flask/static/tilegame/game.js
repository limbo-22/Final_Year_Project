// static/tilegame/tilegame.js

window.addEventListener("load", async () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx    = canvas.getContext("2d");
  if (!ctx) return alert("Canvas not supported.");

  await SDK.init();


  // 1) Fetch the JSON map
  const resp = await fetch("/static/tilegame/tilemap.json");
  const mapData = await resp.json();
  const { width, height, tiles, tileDefs } = mapData;

  // 2) Preload images
  const images = {};
  await Promise.all(tileDefs.map(def => {
    return new Promise(res => {
      const img = new Image();
      img.src = def.image;
      img.onload = () => {
        images[def.id] = img;
        res();
      };
    });
  }));

  function drawGoldOnHUD(amount) {
    document.getElementById("inv-gold").innerText = amount;
  }

  // 2) show HUD/gold in the tile game UI
  if (SDK.user) {
    const { human: gold } = await SDK.fetchBalance("gold", SDK.user);
    drawGoldOnHUD(gold);

    // optional polling
    setInterval(async () => {
      const { human } = await SDK.fetchBalance("gold", SDK.user);
      drawGoldOnHUD(human);
    }, 10_000);
  }

  // 3) Preload hero sprite
  const heroImg = new Image();
  heroImg.src = "/static/tilegame/map_assets/hero.png";
  await new Promise(res => (heroImg.onload = res));

  // 4) Set initial hero position (tile coordinates)
  let heroX = 1, heroY = 1; // tile indices (col, row)

  const tileSize = 64;

  // 5) Draw function (tiles + hero)
  function drawAll() {
    // draw tiles
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tileId = tiles[row][col];
        const img = images[tileId];
        if (img) {
          ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
        }
      }
    }
    // draw hero on top
    ctx.drawImage(heroImg, heroX * tileSize, heroY * tileSize, tileSize, tileSize);
  }

  // 6) Initial render
  drawAll();

  // 7) Listen for arrow keys to move hero
  window.addEventListener("keydown", e => {
    // prevent scrolling
    if (![ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight" ].includes(e.key)) return;

    e.preventDefault();
    switch (e.key) {
      case "ArrowUp":
        if (heroY > 0 && tiles[heroY - 1][heroX] !== 0 /*block?*/ ) {
          heroY--;
        }
        break;
      case "ArrowDown":
        if (heroY < height - 1 && tiles[heroY + 1][heroX] !== 0) {
          heroY++;
        }
        break;
      case "ArrowLeft":
        if (heroX > 0 && tiles[heroY][heroX - 1] !== 0) {
          heroX--;
        }
        break;
      case "ArrowRight":
        if (heroX < width - 1 && tiles[heroY][heroX + 1] !== 0) {
          heroX++;
        }
        break;
    }
    drawAll();
  });
});
