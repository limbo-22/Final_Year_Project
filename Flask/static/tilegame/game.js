// static/tilegame/tilegame.js

window.addEventListener("load", async () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx    = canvas.getContext("2d");
  if (!ctx) return alert("Canvas not supported.");

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

  // 3) Draw loop: for each row/col, pick the right tile
  const tileSize = 32; // px
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const tileId = tiles[row][col];
      const img = images[tileId];
      if (img) {
        ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
      }
    }
  }
});
