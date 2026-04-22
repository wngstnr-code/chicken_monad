import * as THREE from "https://esm.sh/three";

const minTileIndex = -8;
const maxTileIndex = 8;
const tilesPerRow = maxTileIndex - minTileIndex + 1;
const tileSize = 42;

// ============================================================
// BETTING SYSTEM (mock, in-memory + localStorage — no blockchain)
// ============================================================

const STEP_INCREMENT_BP = 250; // +0.025x per forward step
const CP_BONUS_NUM = 12; // × 1.2 at CP
const CP_BONUS_DEN = 10;
const CP_INTERVAL = 40; // checkpoint every 40 steps
const SEGMENT_TIME_MS = 60 * 1000; // 60s between CPs
const CP_MAX_STAY_MS = 60 * 1000; // auto-exit CP after 60s
const DECAY_BP_PER_SEC = 1000; // -0.1x per second = -1000 bp/s
const SPEED_MULT_PER_CP = 1.1; // vehicle speed × 1.1 per CP

const bet = {
  balance: 0,
  active: false,
  stake: 0,
  multiplierBp: 0, // starts at 0.00x (not 1.00x!)
  maxRow: 0,
  currentCp: 0, // number of CPs completed

  // CP window state
  cashoutWindow: false,
  cpEnterTime: 0,
  cpRowIndex: 0,

  // Segment (between CP) timer
  segmentActive: false,
  segmentStart: 0,

  // Decay tracking
  lastDecayTick: 0,

  timerInterval: null,
};

let gameOver = false;

function loadBalance() {
  const saved = localStorage.getItem("chickenBetBalance");
  bet.balance = saved ? parseFloat(saved) : 0;
  renderBalance();
}

function saveBalance() {
  localStorage.setItem("chickenBetBalance", bet.balance.toFixed(2));
}

function renderBalance() {
  const el = document.getElementById("balance");
  if (el) el.innerText = "$" + bet.balance.toFixed(2);
}

function deposit(amount) {
  if (!isFinite(amount) || amount <= 0) return;
  bet.balance += amount;
  saveBalance();
  renderBalance();
}

function startBet(stake) {
  if (!isFinite(stake) || stake <= 0) return false;
  if (stake > bet.balance) return false;

  bet.balance -= stake;
  saveBalance();
  renderBalance();

  bet.active = true;
  bet.stake = stake;
  bet.multiplierBp = 0;
  bet.maxRow = 0;
  bet.currentCp = 0;
  bet.cashoutWindow = false;
  bet.cpEnterTime = 0;
  bet.cpRowIndex = 0;
  bet.segmentActive = true; // first segment starts immediately from step 0
  bet.segmentStart = Date.now();
  bet.lastDecayTick = Date.now();

  startBetTicker();
  renderBetHud();
  showBetHud(true);
  showBetPanel(false);
  hideResult();

  initializeGame();
  return true;
}

function onPlayerAdvance(newRowIndex) {
  if (!bet.active) return;

  // +0.025x per forward step
  bet.multiplierBp = Math.max(0, bet.multiplierBp + STEP_INCREMENT_BP);

  // Check if this row is a checkpoint (every 40 steps, grass row)
  if (newRowIndex > 0 && newRowIndex % CP_INTERVAL === 0) {
    reachCheckpoint(newRowIndex);
  } else {
    // moved forward past the CP row — close cashout window
    if (bet.cashoutWindow && newRowIndex > bet.cpRowIndex) {
      closeCashoutWindow();
    }
  }

  renderBetHud();
}

function reachCheckpoint(rowIndex) {
  bet.currentCp += 1;
  bet.cpRowIndex = rowIndex;

  // × 1.2 compound bonus
  bet.multiplierBp = Math.floor((bet.multiplierBp * CP_BONUS_NUM) / CP_BONUS_DEN);

  // Open cashout window, freeze segment timer while at CP
  bet.cashoutWindow = true;
  bet.cpEnterTime = Date.now();
  bet.segmentActive = false;

  renderBetHud();
}

function closeCashoutWindow() {
  bet.cashoutWindow = false;
  // Start new segment timer (60s to reach next CP)
  bet.segmentActive = true;
  bet.segmentStart = Date.now();
  bet.lastDecayTick = Date.now();
}

function canCashOut() {
  return bet.active && bet.cashoutWindow;
}

function cashOut(reason) {
  if (!bet.active) return;
  if (!bet.cashoutWindow) return; // only at CP with window open

  bet.active = false;
  stopBetTicker();

  const mult = bet.multiplierBp / 10000;
  const payout = bet.stake * mult;
  const profit = payout - bet.stake;
  bet.balance += payout;
  saveBalance();
  renderBalance();

  showBetHud(false);
  showResult({
    type: "cashout",
    reason: reason || "manual",
    stake: bet.stake,
    multiplier: mult,
    payout,
    profit,
    rows: bet.maxRow,
    cp: bet.currentCp,
  });
}

function crashBet() {
  if (!bet.active) return;
  bet.active = false;
  stopBetTicker();

  const mult = bet.multiplierBp / 10000;
  showBetHud(false);
  showResult({
    type: "crash",
    stake: bet.stake,
    multiplier: mult,
    payout: 0,
    profit: -bet.stake,
    rows: bet.maxRow,
    cp: bet.currentCp,
  });
}

function startBetTicker() {
  stopBetTicker();
  bet.timerInterval = setInterval(tickBet, 100);
}

function stopBetTicker() {
  if (bet.timerInterval) {
    clearInterval(bet.timerInterval);
    bet.timerInterval = null;
  }
  renderTimer(SEGMENT_TIME_MS, false);
}

function tickBet() {
  if (!bet.active) return;
  const now = Date.now();

  // --- CP stay timeout check ---
  if (bet.cashoutWindow) {
    const stayElapsed = now - bet.cpEnterTime;
    const remaining = Math.max(0, CP_MAX_STAY_MS - stayElapsed);
    renderTimer(remaining, true); // "AT CP" mode
    if (remaining <= 0) {
      closeCashoutWindow();
    }
  } else if (bet.segmentActive) {
    // --- Segment timer ---
    const segElapsed = now - bet.segmentStart;
    const remaining = Math.max(0, SEGMENT_TIME_MS - segElapsed);
    renderTimer(remaining, false);

    // --- Decay logic: after segment time is up, -0.1x per second ---
    if (segElapsed > SEGMENT_TIME_MS) {
      const decayDeltaMs = now - bet.lastDecayTick;
      const decayBp = Math.floor((DECAY_BP_PER_SEC * decayDeltaMs) / 1000);
      if (decayBp > 0) {
        bet.multiplierBp = Math.max(0, bet.multiplierBp - decayBp);
        bet.lastDecayTick = now;
        renderBetHud();
      }
    } else {
      bet.lastDecayTick = now;
    }
  }
}

function renderTimer(ms, atCp) {
  const el = document.getElementById("timer");
  const card = document.getElementById("timer-card");
  const labelEl = document.getElementById("timer-label");
  if (!el) return;

  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  el.innerText = `${m}:${s.toString().padStart(2, "0")}`;

  if (labelEl) labelEl.innerText = atCp ? "AT CP" : "SEGMENT";

  if (card) {
    if (ms < 15000 && bet.active) card.classList.add("timer-warning");
    else card.classList.remove("timer-warning");
  }
}

function renderBetHud() {
  const mult = bet.multiplierBp / 10000;
  const payout = bet.stake * mult;
  const stakeEl = document.getElementById("bet-stake");
  const multEl = document.getElementById("bet-multiplier");
  const payEl = document.getElementById("bet-payout");
  const cpEl = document.getElementById("bet-cp");
  const cashoutBtn = document.getElementById("cash-out-btn");

  if (stakeEl) stakeEl.innerText = "$" + bet.stake.toFixed(2);
  if (multEl) multEl.innerText = mult.toFixed(2) + "x";
  if (payEl) payEl.innerText = "$" + payout.toFixed(2);
  if (cpEl) cpEl.innerText = "CP " + bet.currentCp;

  if (cashoutBtn) {
    if (canCashOut()) {
      cashoutBtn.disabled = false;
      cashoutBtn.classList.remove("disabled");
      cashoutBtn.innerText = "CASH OUT";
    } else {
      cashoutBtn.disabled = true;
      cashoutBtn.classList.add("disabled");
      cashoutBtn.innerText = "RUN TO NEXT CP";
    }
  }
}

function showBetPanel(show) {
  const el = document.getElementById("bet-panel");
  if (el) el.style.display = show ? "flex" : "none";
}

function showBetHud(show) {
  const el = document.getElementById("bet-hud");
  if (el) el.style.display = show ? "block" : "none";
}

function showResult(data) {
  gameOver = true;
  movesQueue.length = 0;

  const resultDOM = document.getElementById("result-container");
  const titleEl = document.getElementById("result-title");
  const bodyEl = document.getElementById("result-body");
  if (!resultDOM || !titleEl || !bodyEl) return;

  if (data.type === "cashout") {
    titleEl.innerText = "CASHED OUT";
    titleEl.style.color = "#27ae60";
    const profitClass = data.profit >= 0 ? "profit-positive" : "profit-negative";
    const profitSign = data.profit >= 0 ? "+" : "-";
    bodyEl.innerHTML = `
      <p>Checkpoint: <strong>${data.cp}</strong></p>
      <p>Rows survived: <strong>${data.rows}</strong></p>
      <p>Multiplier: <strong>${data.multiplier.toFixed(2)}x</strong></p>
      <p>Payout: <strong>$${data.payout.toFixed(2)}</strong></p>
      <p class="${profitClass}">Profit: ${profitSign}$${Math.abs(data.profit).toFixed(2)}</p>
    `;
  } else if (data.type === "crash") {
    titleEl.innerText = "CRASHED";
    titleEl.style.color = "#c0392b";
    bodyEl.innerHTML = `
      <p>Last checkpoint: <strong>${data.cp}</strong></p>
      <p>Rows survived: <strong>${data.rows}</strong></p>
      <p>Last multiplier: <strong>${data.multiplier.toFixed(2)}x</strong></p>
      <p class="profit-negative">Lost: -$${data.stake.toFixed(2)}</p>
    `;
  } else {
    titleEl.innerText = "GAME OVER";
    titleEl.style.color = "#c0392b";
    bodyEl.innerHTML = `<p>Score: <strong>${position.currentRow}</strong></p>`;
  }
  resultDOM.style.visibility = "visible";
}

function hideResult() {
  const el = document.getElementById("result-container");
  if (el) el.style.visibility = "hidden";
}

function Camera() {
  const size = 300;
  const viewRatio = window.innerWidth / window.innerHeight;
  const width = viewRatio < 1 ? size : size * viewRatio;
  const height = viewRatio < 1 ? size / viewRatio : size;

  const camera = new THREE.OrthographicCamera(
    width / -2, // left
    width / 2, // right
    height / 2, // top
    height / -2, // bottom
    100, // near
    900 // far
  );

  camera.up.set(0, 0, 1);
  camera.position.set(300, -300, 300);
  camera.lookAt(0, 0, 0);

  return camera;
}

function Texture(width, height, rects) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(0,0,0,0.6)";
  rects.forEach((rect) => {
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
  });
  return new THREE.CanvasTexture(canvas);
}

const carFrontTexture = new Texture(40, 80, [{ x: 0, y: 10, w: 30, h: 60 }]);
const carBackTexture = new Texture(40, 80, [{ x: 10, y: 10, w: 30, h: 60 }]);
const carRightSideTexture = new Texture(110, 40, [
  { x: 10, y: 0, w: 50, h: 30 },
  { x: 70, y: 0, w: 30, h: 30 },
]);
const carLeftSideTexture = new Texture(110, 40, [
  { x: 10, y: 10, w: 50, h: 30 },
  { x: 70, y: 10, w: 30, h: 30 },
]);

export const truckFrontTexture = Texture(30, 30, [
  { x: 5, y: 0, w: 10, h: 30 },
]);
export const truckRightSideTexture = Texture(25, 30, [
  { x: 15, y: 5, w: 10, h: 10 },
]);
export const truckLeftSideTexture = Texture(25, 30, [
  { x: 15, y: 15, w: 10, h: 10 },
]);


function Car(initialTileIndex, direction, color) {
  const car = new THREE.Group();
  car.position.x = initialTileIndex * tileSize;
  if (!direction) car.rotation.z = Math.PI;

  const main = new THREE.Mesh(
    new THREE.BoxGeometry(60, 30, 15),
    new THREE.MeshLambertMaterial({ color, flatShading: true })
  );
  main.position.z = 12;
  main.castShadow = true;
  main.receiveShadow = true;
  car.add(main);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(33, 24, 12), [
    new THREE.MeshPhongMaterial({
      color: 0xe8f4ff,
      flatShading: true,
      map: carBackTexture,
    }),
    new THREE.MeshPhongMaterial({
      color: 0xe8f4ff,
      flatShading: true,
      map: carFrontTexture,
    }),
    new THREE.MeshPhongMaterial({
      color: 0xe8f4ff,
      flatShading: true,
      map: carRightSideTexture,
    }),
    new THREE.MeshPhongMaterial({
      color: 0xe8f4ff,
      flatShading: true,
      map: carLeftSideTexture,
    }),
    new THREE.MeshPhongMaterial({ color: 0xd9ecff, flatShading: true }), // top
    new THREE.MeshPhongMaterial({ color: 0xcccccc, flatShading: true }), // bottom
  ]);
  cabin.position.x = -6;
  cabin.position.z = 25.5;
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  car.add(cabin);

  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff4b0 });
  const headlightL = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 3),
    headlightMat
  );
  headlightL.position.set(30.5, -10, 11);
  car.add(headlightL);

  const headlightR = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 3),
    headlightMat
  );
  headlightR.position.set(30.5, 10, 11);
  car.add(headlightR);

  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
  const taillightL = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 2.5),
    taillightMat
  );
  taillightL.position.set(-30.5, -10, 11);
  car.add(taillightL);

  const taillightR = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 2.5),
    taillightMat
  );
  taillightR.position.set(-30.5, 10, 11);
  car.add(taillightR);

  const bumperMat = new THREE.MeshLambertMaterial({
    color: 0x2c2c2c,
    flatShading: true,
  });
  const bumperFront = new THREE.Mesh(
    new THREE.BoxGeometry(1, 28, 4),
    bumperMat
  );
  bumperFront.position.set(30.5, 0, 8);
  car.add(bumperFront);

  const bumperBack = new THREE.Mesh(
    new THREE.BoxGeometry(1, 28, 4),
    bumperMat
  );
  bumperBack.position.set(-30.5, 0, 8);
  car.add(bumperBack);

  const frontWheel = Wheel(18);
  car.add(frontWheel);

  const backWheel = Wheel(-18);
  car.add(backWheel);

  return car;
}

function DirectionalLight() {
  const dirLight = new THREE.DirectionalLight();
  dirLight.position.set(-100, -100, 200);
  dirLight.up.set(0, 0, 1);
  dirLight.castShadow = true;

  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;

  dirLight.shadow.camera.up.set(0, 0, 1);
  dirLight.shadow.camera.left = -400;
  dirLight.shadow.camera.right = 400;
  dirLight.shadow.camera.top = 400;
  dirLight.shadow.camera.bottom = -400;
  dirLight.shadow.camera.near = 50;
  dirLight.shadow.camera.far = 400;

  return dirLight;
}

function createMonadCheckpointBannerTexture(cpNumber) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#1a1036";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#8f6dff";
  ctx.fillRect(0, 0, canvas.width, 10);
  ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(54, canvas.height / 2, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1036";
  ctx.beginPath();
  ctx.arc(54, canvas.height / 2, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`CHECKPOINT ${cpNumber}`, canvas.width / 2 + 16, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createGmonadGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = "bold 180px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "rgba(255,255,255,0.88)";
  ctx.lineWidth = 18;
  ctx.strokeText("GMonad", canvas.width / 2, canvas.height / 2 + 6);

  ctx.fillStyle = "rgba(30, 18, 64, 0.88)";
  ctx.fillText("GMonad", canvas.width / 2, canvas.height / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function Grass(rowIndex, isCheckpoint) {
  const grass = new THREE.Group();
  grass.position.y = rowIndex * tileSize;

  const createSection = (color) =>
    new THREE.Mesh(
      new THREE.BoxGeometry(tilesPerRow * tileSize, tileSize, 3),
      new THREE.MeshLambertMaterial({ color })
    );

  const middleColor = isCheckpoint ? 0xffe066 : 0xbaf455;
  const sideColor = isCheckpoint ? 0xf5c518 : 0x99c846;

  const middle = createSection(middleColor);
  middle.receiveShadow = true;
  grass.add(middle);

  const left = createSection(sideColor);
  left.position.x = -tilesPerRow * tileSize;
  grass.add(left);

  const right = createSection(sideColor);
  right.position.x = tilesPerRow * tileSize;
  grass.add(right);

  if (isCheckpoint) {
    const cpNumber = Math.floor(rowIndex / CP_INTERVAL);
    const postMat = new THREE.MeshLambertMaterial({
      color: 0x8b4513,
      flatShading: true,
    });
    const bannerMat = new THREE.MeshLambertMaterial({
      map: createMonadCheckpointBannerTexture(cpNumber),
    });

    const postL = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 40), postMat);
    postL.position.set(-tilesPerRow * tileSize * 0.35, -5, 20);
    postL.castShadow = true;
    grass.add(postL);

    const postR = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 40), postMat);
    postR.position.set(tilesPerRow * tileSize * 0.35, -5, 20);
    postR.castShadow = true;
    grass.add(postR);

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(tilesPerRow * tileSize * 0.75, 2, 12),
      bannerMat
    );
    banner.position.set(0, -5, 36);
    banner.castShadow = true;
    grass.add(banner);

    const gmonadGroundLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(tilesPerRow * tileSize * 0.62, tileSize * 0.7),
      new THREE.MeshBasicMaterial({
        map: createGmonadGroundTexture(),
        transparent: true,
        depthWrite: false,
      })
    );
    gmonadGroundLabel.position.set(0, 0, 1.7);
    grass.add(gmonadGroundLabel);

    // Monad-themed flags at edges
    [-1, 1].forEach((side) => {
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 18),
        new THREE.MeshLambertMaterial({ color: 0x7d5cff, flatShading: true })
      );
      flag.position.set(side * tilesPerRow * tileSize * 0.42, 15, 9);
      flag.castShadow = true;
      grass.add(flag);

      const flagTop = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1, 5),
        new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })
      );
      flagTop.position.set(
        side * tilesPerRow * tileSize * 0.42 + side * 4,
        15,
        16
      );
      grass.add(flagTop);
    });
  }

  const flowerColors = [0xff6b9d, 0xffd93d, 0xffffff, 0xc780ff, 0xff8a5c];
  const flowerCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < flowerCount; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const flowerGroup = new THREE.Group();

    const stem = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 3),
      new THREE.MeshLambertMaterial({ color: 0x4a7c1f, flatShading: true })
    );
    stem.position.z = 3;
    flowerGroup.add(stem);

    const petal = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.5, 2),
      new THREE.MeshLambertMaterial({
        color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
        flatShading: true,
      })
    );
    petal.position.z = 5.5;
    flowerGroup.add(petal);

    flowerGroup.position.x =
      side *
      ((tilesPerRow / 2) * tileSize + 30 + Math.random() * 260);
    flowerGroup.position.y = (Math.random() - 0.5) * tileSize * 0.8;
    grass.add(flowerGroup);
  }

  if (Math.random() < 0.4) {
    const bush = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x6fa832, flatShading: true })
    );
    const side = Math.random() < 0.5 ? -1 : 1;
    bush.position.x =
      side * ((tilesPerRow / 2) * tileSize + 50 + Math.random() * 200);
    bush.position.y = (Math.random() - 0.5) * tileSize * 0.6;
    bush.position.z = 4.5;
    bush.castShadow = true;
    grass.add(bush);
  }

  return grass;
}

const metadata = [];

const map = new THREE.Group();

function initializeMap() {
  // Remove all rows
  metadata.length = 0;
  map.remove(...map.children);

  // Add new rows
  for (let rowIndex = 0; rowIndex > -10; rowIndex--) {
    const grass = Grass(rowIndex);
    map.add(grass);
  }
  addRows();
}

function addRows() {
  const startIndex = metadata.length;
  const newMetadata = generateRows(20, startIndex);

  metadata.push(...newMetadata);

  newMetadata.forEach((rowData, index) => {
    const rowIndex = startIndex + index + 1;

    if (rowData.type === "forest") {
      const row = Grass(rowIndex, rowData.isCheckpoint);

      rowData.trees.forEach(({ tileIndex, height, variant }) => {
        const three = Tree(tileIndex, height, variant);
        row.add(three);
      });

      map.add(row);
    }

    if (rowData.type === "car") {
      const row = Road(rowIndex);

      rowData.vehicles.forEach((vehicle) => {
        const car = Car(
          vehicle.initialTileIndex,
          rowData.direction,
          vehicle.color
        );
        vehicle.ref = car;
        row.add(car);
      });

      map.add(row);
    }

    if (rowData.type === "truck") {
      const row = Road(rowIndex);

      rowData.vehicles.forEach((vehicle) => {
        const truck = Truck(
          vehicle.initialTileIndex,
          rowData.direction,
          vehicle.color
        );
        vehicle.ref = truck;
        row.add(truck);
      });

      map.add(row);
    }
  });
}

const player = Player();

function Player() {
  const player = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0xfafafa,
    flatShading: true,
  });
  const combMat = new THREE.MeshLambertMaterial({
    color: 0xe63946,
    flatShading: true,
  });
  const beakMat = new THREE.MeshLambertMaterial({
    color: 0xff9f1c,
    flatShading: true,
  });
  const eyeMat = new THREE.MeshLambertMaterial({
    color: 0x111111,
    flatShading: true,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 13, 12), bodyMat);
  body.position.z = 7;
  body.castShadow = true;
  body.receiveShadow = true;
  player.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 7), bodyMat);
  head.position.set(0, 4, 17);
  head.castShadow = true;
  head.receiveShadow = true;
  player.add(head);

  const beak = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2, 1.5), beakMat);
  beak.position.set(0, 9, 16.5);
  beak.castShadow = true;
  player.add(beak);

  const comb1 = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), combMat);
  comb1.position.set(-2, 2, 22);
  comb1.castShadow = true;
  player.add(comb1);

  const comb2 = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 3), combMat);
  comb2.position.set(0, 3, 22.5);
  comb2.castShadow = true;
  player.add(comb2);

  const comb3 = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), combMat);
  comb3.position.set(2, 4, 22);
  comb3.castShadow = true;
  player.add(comb3);

  const wattle = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2), combMat);
  wattle.position.set(0, 8.5, 14);
  player.add(wattle);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), eyeMat);
  eyeL.position.set(-2.5, 7.5, 18);
  player.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), eyeMat);
  eyeR.position.set(2.5, 7.5, 18);
  player.add(eyeR);

  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 7), bodyMat);
  wingL.position.set(-7, -1, 8);
  wingL.castShadow = true;
  player.add(wingL);

  const wingR = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 7), bodyMat);
  wingR.position.set(7, -1, 8);
  wingR.castShadow = true;
  player.add(wingR);

  const tail1 = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 6), bodyMat);
  tail1.position.set(0, -7, 13);
  tail1.castShadow = true;
  player.add(tail1);

  const tail2 = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 4), bodyMat);
  tail2.position.set(0, -8, 17);
  tail2.castShadow = true;
  player.add(tail2);

  const legMat = new THREE.MeshLambertMaterial({
    color: 0xff9f1c,
    flatShading: true,
  });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2), legMat);
  legL.position.set(-3, 0, 0.5);
  player.add(legL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 2), legMat);
  legR.position.set(3, 0, 0.5);
  player.add(legR);

  const playerContainer = new THREE.Group();
  playerContainer.add(player);

  return playerContainer;
}

const position = {
  currentRow: 0,
  currentTile: 0,
};

const movesQueue = [];

function initializePlayer() {
  // Initialize the Three.js player object
  player.position.x = 0;
  player.position.y = 0;
  player.children[0].position.z = 0;

  // Initialize metadata
  position.currentRow = 0;
  position.currentTile = 0;

  // Clear the moves queue
  movesQueue.length = 0;
}

function isInputBlocked() {
  if (gameOver) return true;
  const betPanel = document.getElementById("bet-panel");
  const depositModal = document.getElementById("deposit-modal");
  if (betPanel && betPanel.style.display !== "none") return true;
  if (depositModal && depositModal.style.display !== "none") return true;
  return false;
}

function queueMove(direction) {
  if (isInputBlocked()) return;

  const isValidMove = endsUpInValidPosition(
    {
      rowIndex: position.currentRow,
      tileIndex: position.currentTile,
    },
    [...movesQueue, direction]
  );

  if (!isValidMove) return;

  movesQueue.push(direction);
}

function stepCompleted() {
  const direction = movesQueue.shift();

  if (direction === "forward") position.currentRow += 1;
  if (direction === "backward") position.currentRow -= 1;
  if (direction === "left") position.currentTile -= 1;
  if (direction === "right") position.currentTile += 1;

  // Add new rows if the player is running out of them
  if (position.currentRow > metadata.length - 10) addRows();

  // Track multiplier for bet mode — only count NEW rows (anti-exploit)
  if (bet.active && position.currentRow > bet.maxRow) {
    bet.maxRow = position.currentRow;
    onPlayerAdvance(position.currentRow);
  }

  const scoreDOM = document.getElementById("score");
  if (scoreDOM) scoreDOM.innerText = position.currentRow.toString();
}

function Renderer() {
  const canvas = document.querySelector("canvas.game");
  if (!canvas) throw new Error("Canvas not found");

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas: canvas,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  return renderer;
}

function Road(rowIndex) {
  const road = new THREE.Group();
  road.position.y = rowIndex * tileSize;

  const createSection = (color) =>
    new THREE.Mesh(
      new THREE.PlaneGeometry(tilesPerRow * tileSize, tileSize),
      new THREE.MeshLambertMaterial({ color })
    );

  const middle = createSection(0x454a59);
  middle.receiveShadow = true;
  road.add(middle);

  const left = createSection(0x393d49);
  left.position.x = -tilesPerRow * tileSize;
  road.add(left);

  const right = createSection(0x393d49);
  right.position.x = tilesPerRow * tileSize;
  road.add(right);

  const curbMat = new THREE.MeshLambertMaterial({
    color: 0xd6d8dd,
    flatShading: true,
  });
  const curbFront = new THREE.Mesh(
    new THREE.BoxGeometry(tilesPerRow * tileSize, 1.5, 2),
    curbMat
  );
  curbFront.position.set(0, tileSize / 2 - 0.5, 1);
  road.add(curbFront);

  const curbBack = new THREE.Mesh(
    new THREE.BoxGeometry(tilesPerRow * tileSize, 1.5, 2),
    curbMat
  );
  curbBack.position.set(0, -tileSize / 2 + 0.5, 1);
  road.add(curbBack);

  return road;
}

function Tree(tileIndex, height, variant = "round") {
  const tree = new THREE.Group();
  tree.position.x = tileIndex * tileSize;

  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(12, 12, 20),
    new THREE.MeshLambertMaterial({
      color: 0x6b4226,
      flatShading: true,
    })
  );
  trunk.position.z = 10;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  if (variant === "pine") {
    const tiers = 3;
    const tierH = height / tiers;
    for (let i = 0; i < tiers; i++) {
      const size = 32 - i * 8;
      const shade = i === 0 ? 0x2f7a3a : i === 1 ? 0x3d8f47 : 0x4fa558;
      const tier = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, tierH),
        new THREE.MeshLambertMaterial({ color: shade, flatShading: true })
      );
      tier.position.z = 20 + i * tierH + tierH / 2;
      tier.castShadow = true;
      tier.receiveShadow = true;
      tree.add(tier);
    }
  } else {
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(30, 30, height),
      new THREE.MeshLambertMaterial({
        color: 0x7aa21d,
        flatShading: true,
      })
    );
    crown.position.z = height / 2 + 20;
    crown.castShadow = true;
    crown.receiveShadow = true;
    tree.add(crown);

    const crownTop = new THREE.Mesh(
      new THREE.BoxGeometry(22, 22, 8),
      new THREE.MeshLambertMaterial({
        color: 0x94c043,
        flatShading: true,
      })
    );
    crownTop.position.z = height + 20 + 4;
    crownTop.castShadow = true;
    tree.add(crownTop);

    const bump = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 6),
      new THREE.MeshLambertMaterial({
        color: 0x5c8510,
        flatShading: true,
      })
    );
    bump.position.set(6, 6, height / 2 + 20 + height / 4);
    tree.add(bump);
  }

  return tree;
}

function Truck(initialTileIndex, direction, color) {
  const truck = new THREE.Group();
  truck.position.x = initialTileIndex * tileSize;
  if (!direction) truck.rotation.z = Math.PI;

  const cargo = new THREE.Mesh(
    new THREE.BoxGeometry(70, 35, 35),
    new THREE.MeshLambertMaterial({
      color: 0xf2f2f2,
      flatShading: true,
    })
  );
  cargo.position.x = -15;
  cargo.position.z = 25;
  cargo.castShadow = true;
  cargo.receiveShadow = true;
  truck.add(cargo);

  const cargoStripe = new THREE.Mesh(
    new THREE.BoxGeometry(72, 37, 3),
    new THREE.MeshLambertMaterial({ color, flatShading: true })
  );
  cargoStripe.position.set(-15, 0, 22);
  truck.add(cargoStripe);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), [
    new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      map: truckFrontTexture,
    }), // front
    new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
    }), // back
    new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      map: truckLeftSideTexture,
    }),
    new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      map: truckRightSideTexture,
    }),
    new THREE.MeshPhongMaterial({ color, flatShading: true }), // top
    new THREE.MeshPhongMaterial({ color, flatShading: true }), // bottom
  ]);
  cabin.position.x = 35;
  cabin.position.z = 20;
  cabin.castShadow = true;
  cabin.receiveShadow = true;

  truck.add(cabin);

  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff4b0 });
  const headlightL = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 3),
    headlightMat
  );
  headlightL.position.set(50.5, -10, 12);
  truck.add(headlightL);

  const headlightR = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 3),
    headlightMat
  );
  headlightR.position.set(50.5, 10, 12);
  truck.add(headlightR);

  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
  const taillightL = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 3),
    taillightMat
  );
  taillightL.position.set(-50.5, -12, 15);
  truck.add(taillightL);

  const taillightR = new THREE.Mesh(
    new THREE.BoxGeometry(1, 4, 3),
    taillightMat
  );
  taillightR.position.set(-50.5, 12, 15);
  truck.add(taillightR);

  const exhaust = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0x555555, flatShading: true })
  );
  exhaust.position.set(25, -15, 43);
  truck.add(exhaust);

  const frontWheel = Wheel(37);
  truck.add(frontWheel);

  const middleWheel = Wheel(5);
  truck.add(middleWheel);

  const backWheel = Wheel(-35);
  truck.add(backWheel);

  return truck;
}

function Wheel(x) {
  const wheel = new THREE.Mesh(
    new THREE.BoxGeometry(12, 33, 12),
    new THREE.MeshLambertMaterial({
      color: 0x333333,
      flatShading: true,
    })
  );
  wheel.position.x = x;
  wheel.position.z = 6;
  return wheel;
}

function calculateFinalPosition(currentPosition, moves) {
  return moves.reduce((position, direction) => {
    if (direction === "forward")
      return {
        rowIndex: position.rowIndex + 1,
        tileIndex: position.tileIndex,
      };
    if (direction === "backward")
      return {
        rowIndex: position.rowIndex - 1,
        tileIndex: position.tileIndex,
      };
    if (direction === "left")
      return {
        rowIndex: position.rowIndex,
        tileIndex: position.tileIndex - 1,
      };
    if (direction === "right")
      return {
        rowIndex: position.rowIndex,
        tileIndex: position.tileIndex + 1,
      };
    return position;
  }, currentPosition);
}

function endsUpInValidPosition(currentPosition, moves) {
  // Calculate where the player would end up after the move
  const finalPosition = calculateFinalPosition(currentPosition, moves);

  // Detect if we hit the edge of the board
  if (
    finalPosition.rowIndex === -1 ||
    finalPosition.tileIndex === minTileIndex - 1 ||
    finalPosition.tileIndex === maxTileIndex + 1
  ) {
    // Invalid move, ignore move command
    return false;
  }

  // Detect if we hit a tree
  const finalRow = metadata[finalPosition.rowIndex - 1];
  if (
    finalRow &&
    finalRow.type === "forest" &&
    finalRow.trees.some((tree) => tree.tileIndex === finalPosition.tileIndex)
  ) {
    // Invalid move, ignore move command
    return false;
  }

  return true;
}

function generateRows(amount, startIndex) {
  const rows = [];
  for (let i = 0; i < amount; i++) {
    const rowIndex = startIndex + i + 1;
    rows.push(generateRow(rowIndex));
  }
  return rows;
}

function generateRow(rowIndex) {
  // Force grass row at every checkpoint position
  if (rowIndex > 0 && rowIndex % CP_INTERVAL === 0) {
    return generateCheckpointMetadata();
  }
  const type = randomElement(["car", "truck", "forest"]);
  if (type === "car") return generateCarLaneMetadata();
  if (type === "truck") return generateTruckLaneMetadata();
  return generateForesMetadata();
}

function generateCheckpointMetadata() {
  return { type: "forest", trees: [], isCheckpoint: true };
}

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateForesMetadata() {
  const occupiedTiles = new Set();
  const trees = Array.from({ length: 4 }, () => {
    let tileIndex;
    do {
      tileIndex = THREE.MathUtils.randInt(minTileIndex, maxTileIndex);
    } while (occupiedTiles.has(tileIndex));
    occupiedTiles.add(tileIndex);

    const height = randomElement([20, 45, 60]);
    const variant = randomElement(["round", "round", "pine"]);

    return { tileIndex, height, variant };
  });

  return { type: "forest", trees };
}

function generateCarLaneMetadata() {
  const direction = randomElement([true, false]);
  const speed = randomElement([125, 156, 188]);

  const occupiedTiles = new Set();

  const vehicles = Array.from({ length: 3 }, () => {
    let initialTileIndex;
    do {
      initialTileIndex = THREE.MathUtils.randInt(minTileIndex, maxTileIndex);
    } while (occupiedTiles.has(initialTileIndex));
    occupiedTiles.add(initialTileIndex - 1);
    occupiedTiles.add(initialTileIndex);
    occupiedTiles.add(initialTileIndex + 1);

    const color = randomElement([
      0xe63946, 0xf4a261, 0x2a9d8f, 0x457b9d, 0xe76f51,
      0xffb703, 0x9b5de5, 0x06d6a0,
    ]);

    return { initialTileIndex, color };
  });

  return { type: "car", direction, speed, vehicles };
}

function generateTruckLaneMetadata() {
  const direction = randomElement([true, false]);
  const speed = randomElement([125, 156, 188]);

  const occupiedTiles = new Set();

  const vehicles = Array.from({ length: 2 }, () => {
    let initialTileIndex;
    do {
      initialTileIndex = THREE.MathUtils.randInt(minTileIndex, maxTileIndex);
    } while (occupiedTiles.has(initialTileIndex));
    occupiedTiles.add(initialTileIndex - 2);
    occupiedTiles.add(initialTileIndex - 1);
    occupiedTiles.add(initialTileIndex);
    occupiedTiles.add(initialTileIndex + 1);
    occupiedTiles.add(initialTileIndex + 2);

    const color = randomElement([
      0x1d3557, 0xe63946, 0x2a9d8f, 0xe76f51, 0x6d597a, 0x8338ec,
    ]);

    return { initialTileIndex, color };
  });

  return { type: "truck", direction, speed, vehicles };
}

const moveClock = new THREE.Clock(false);

function animatePlayer() {
  if (!movesQueue.length) return;

  if (!moveClock.running) moveClock.start();

  const stepTime = 0.2; // Seconds it takes to take a step
  const progress = Math.min(1, moveClock.getElapsedTime() / stepTime);

  setPosition(progress);
  setRotation(progress);

  // Once a step has ended
  if (progress >= 1) {
    stepCompleted();
    moveClock.stop();
  }
}

function setPosition(progress) {
  const startX = position.currentTile * tileSize;
  const startY = position.currentRow * tileSize;
  let endX = startX;
  let endY = startY;

  if (movesQueue[0] === "left") endX -= tileSize;
  if (movesQueue[0] === "right") endX += tileSize;
  if (movesQueue[0] === "forward") endY += tileSize;
  if (movesQueue[0] === "backward") endY -= tileSize;

  player.position.x = THREE.MathUtils.lerp(startX, endX, progress);
  player.position.y = THREE.MathUtils.lerp(startY, endY, progress);
  player.children[0].position.z = Math.sin(progress * Math.PI) * 8;
}

function setRotation(progress) {
  let endRotation = 0;
  if (movesQueue[0] == "forward") endRotation = 0;
  if (movesQueue[0] == "left") endRotation = Math.PI / 2;
  if (movesQueue[0] == "right") endRotation = -Math.PI / 2;
  if (movesQueue[0] == "backward") endRotation = Math.PI;

  player.children[0].rotation.z = THREE.MathUtils.lerp(
    player.children[0].rotation.z,
    endRotation,
    progress
  );
}

const clock = new THREE.Clock();

function animateVehicles() {
  const delta = clock.getDelta();

  // Speed multiplier scales with CP count (bet mode only)
  const speedMultiplier = bet.active
    ? Math.pow(SPEED_MULT_PER_CP, bet.currentCp)
    : 1;

  // Animate cars and trucks
  metadata.forEach((rowData) => {
    if (rowData.type === "car" || rowData.type === "truck") {
      const beginningOfRow = (minTileIndex - 2) * tileSize;
      const endOfRow = (maxTileIndex + 2) * tileSize;
      const effectiveSpeed = rowData.speed * speedMultiplier;

      rowData.vehicles.forEach(({ ref }) => {
        if (!ref) throw Error("Vehicle reference is missing");

        if (rowData.direction) {
          ref.position.x =
            ref.position.x > endOfRow
              ? beginningOfRow
              : ref.position.x + effectiveSpeed * delta;
        } else {
          ref.position.x =
            ref.position.x < beginningOfRow
              ? endOfRow
              : ref.position.x - effectiveSpeed * delta;
        }
      });
    }
  });
}

document
  .getElementById("forward")
  ?.addEventListener("click", () => queueMove("forward"));

document
  .getElementById("backward")
  ?.addEventListener("click", () => queueMove("backward"));

document
  .getElementById("left")
  ?.addEventListener("click", () => queueMove("left"));

document
  .getElementById("right")
  ?.addEventListener("click", () => queueMove("right"));

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault(); // Avoid scrolling the page
    queueMove("forward");
  } else if (event.key === "ArrowDown") {
    event.preventDefault(); // Avoid scrolling the page
    queueMove("backward");
  } else if (event.key === "ArrowLeft") {
    event.preventDefault(); // Avoid scrolling the page
    queueMove("left");
  } else if (event.key === "ArrowRight") {
    event.preventDefault(); // Avoid scrolling the page
    queueMove("right");
  }
});

function hitTest() {
  if (gameOver) return;
  const row = metadata[position.currentRow - 1];
  if (!row) return;

  if (row.type === "car" || row.type === "truck") {
    const playerBoundingBox = new THREE.Box3();
    playerBoundingBox.setFromObject(player);

    row.vehicles.forEach(({ ref }) => {
      if (!ref) throw Error("Vehicle reference is missing");

      const vehicleBoundingBox = new THREE.Box3();
      vehicleBoundingBox.setFromObject(ref);

      if (playerBoundingBox.intersectsBox(vehicleBoundingBox)) {
        if (bet.active) {
          crashBet();
        } else {
          showResult({ type: "gameover" });
        }
      }
    });
  }
}

const scene = new THREE.Scene();
scene.add(player);
scene.add(map);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xb3d9ff, 0x88c070, 0.5);
hemiLight.position.set(0, 0, 200);
scene.add(hemiLight);

const dirLight = DirectionalLight();
dirLight.target = player;
player.add(dirLight);

const camera = Camera();
player.add(camera);

const scoreDOM = document.getElementById("score");
const resultDOM = document.getElementById("result-container");

initializeGame();
initBettingUI();

function initializeGame() {
  initializePlayer();
  initializeMap();
  gameOver = false;

  if (scoreDOM) scoreDOM.innerText = "0";
  if (resultDOM) resultDOM.style.visibility = "hidden";
}

function initBettingUI() {
  loadBalance();
  renderTimer(SEGMENT_TIME_MS, false);

  const depositBtn = document.getElementById("deposit-btn");
  const depositModal = document.getElementById("deposit-modal");
  const depositAmount = document.getElementById("deposit-amount");
  const depositConfirm = document.getElementById("deposit-confirm");
  const depositCancel = document.getElementById("deposit-cancel");

  depositBtn?.addEventListener("click", () => {
    if (depositModal) depositModal.style.display = "flex";
  });

  document.getElementById("bet-btn")?.addEventListener("click", () => {
    if (bet.active) return;
    hideResult();
    showBetPanel(true);
  });

  depositConfirm?.addEventListener("click", () => {
    const amt = parseFloat(depositAmount?.value || "0");
    if (amt > 0) deposit(amt);
    if (depositModal) depositModal.style.display = "none";
  });

  depositCancel?.addEventListener("click", () => {
    if (depositModal) depositModal.style.display = "none";
  });

  document.getElementById("deposit-close")?.addEventListener("click", () => {
    if (depositModal) depositModal.style.display = "none";
  });

  document.getElementById("bet-panel-close")?.addEventListener("click", () => {
    showBetPanel(false);
  });

  document.querySelectorAll("[data-deposit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (depositAmount) depositAmount.value = btn.dataset.deposit;
    });
  });

  const stakeInput = document.getElementById("stake-input");
  document.querySelectorAll("[data-amount]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (stakeInput) stakeInput.value = btn.dataset.amount;
    });
  });

  document.getElementById("start-bet-btn")?.addEventListener("click", () => {
    const stake = parseFloat(stakeInput?.value || "0");
    if (!isFinite(stake) || stake <= 0) {
      alert("Enter a valid stake amount");
      return;
    }
    if (stake > bet.balance) {
      alert(
        `Insufficient balance. You have $${bet.balance.toFixed(
          2
        )}. Deposit more first.`
      );
      return;
    }
    startBet(stake);
  });

  document.getElementById("free-play-btn")?.addEventListener("click", () => {
    hideResult();
    showBetPanel(false);
    stopBetTicker();
    bet.active = false;
    initializeGame();
  });

  document.getElementById("cash-out-btn")?.addEventListener("click", () => {
    cashOut("manual");
  });

  document.getElementById("retry")?.addEventListener("click", () => {
    hideResult();
    showBetPanel(true);
    stopBetTicker();
    bet.active = false;
    initializeGame();
  });

  showBetPanel(true);
}

const renderer = Renderer();
renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  const size = 300;
  const viewRatio = window.innerWidth / window.innerHeight;
  const width = viewRatio < 1 ? size : size * viewRatio;
  const height = viewRatio < 1 ? size / viewRatio : size;

  camera.left = width / -2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = height / -2;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
});

function animate() {
  animateVehicles();
  animatePlayer();
  hitTest();

  renderer.render(scene, camera);
}
