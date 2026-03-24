/*
  Week 9 — Example 3: Adding Sound & Music

  Course: GBDA302 | Instructors: Dr. Karen Cochrane & David Han
  Date: Mar. 19, 2026

  Controls:
    A or D (Left / Right Arrow)   Horizontal movement
    W (Up Arrow)                  Jump
    Space Bar                     Attack

  Tile key:
    g = groundTile.png       (surface ground)
    d = groundTileDeep.png   (deep ground, below surface)
      = empty (no sprite)
*/

let player;
let playerImg, bgImg;
let jumpSfx, musicSfx;
let musicStarted = false;

let playerAnis = {
  idle: { row: 0, frames: 4, frameDelay: 10 },
  run: { row: 1, frames: 4, frameDelay: 3 },
  jump: { row: 2, frames: 3, frameDelay: Infinity, frame: 0 },
  attack: { row: 3, frames: 6, frameDelay: 2 },
};

let ground, groundDeep;
let groundImg, groundDeepImg;

let attacking = false;
let attackFrameCounter = 0;

// --- DEBUG STATE ---
let debug = {
  open: false,
  moonGravity: false,
  showHitboxes: false,
  showVelocity: false,
};

const NORMAL_GRAVITY = 10;
const MOON_GRAVITY = 5;

// --- TILE MAP ---
let level = [
  "              ",
  "              ",
  "              ",
  "              ",
  "              ",
  "       ggg    ",
  "gggggggggggggg",
  "dddddddddddddd",
];

// --- LEVEL CONSTANTS ---
const VIEWW = 320,
  VIEWH = 180;
const TILE_W = 24,
  TILE_H = 24;
const FRAME_W = 32,
  FRAME_H = 32;
const MAP_START_Y = VIEWH - TILE_H * 4;

function preload() {
  playerImg = loadImage("assets/foxSpriteSheet.png");
  bgImg = loadImage("assets/combinedBackground.png");
  groundImg = loadImage("assets/groundTile.png");
  groundDeepImg = loadImage("assets/groundTileDeep.png");

  if (typeof loadSound === "function") {
    jumpSfx = loadSound("assets/sfx/jump.wav");
    musicSfx = loadSound("assets/sfx/music.wav");
  }
}

function setup() {
  new Canvas(VIEWW, VIEWH, "pixelated");
  allSprites.pixelPerfect = true;
  world.gravity.y = NORMAL_GRAVITY;

  // Grab the canvas element directly instead of from the return value
  let cnvEl = document.querySelector("canvas");
  if (cnvEl) {
    let scale = Math.max(
      1,
      Math.min(
        Math.floor(windowWidth / VIEWW),
        Math.floor(windowHeight / VIEWH),
      ),
    );
    cnvEl.style.width = VIEWW * scale + "px";
    cnvEl.style.height = VIEWH * scale + "px";
  }

  setTimeout(createDebugDOM, 0);

  // Scale canvas up to nearest whole multiple that fits the window
  let scale = Math.max(
    1,
    Math.min(Math.floor(windowWidth / VIEWW), Math.floor(windowHeight / VIEWH)),
  );

  if (musicSfx) musicSfx.setLoop(true);
  startMusicIfNeeded();

  ground = new Group();
  ground.physics = "static";
  ground.img = groundImg;
  ground.tile = "g";

  groundDeep = new Group();
  groundDeep.physics = "static";
  groundDeep.img = groundDeepImg;
  groundDeep.tile = "d";

  new Tiles(level, 0, 0, TILE_W, TILE_H);

  player = new Sprite(FRAME_W, MAP_START_Y, FRAME_W, FRAME_H);
  player.spriteSheet = playerImg;
  player.rotationLock = true;
  player.anis.w = FRAME_W;
  player.anis.h = FRAME_H;
  player.anis.offset.y = -4;
  player.addAnis(playerAnis);
  player.ani = "idle";
  player.w = 18;
  player.h = 20;
  player.friction = 0;
  player.bounciness = 0;

  sensor = new Sprite();
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;
  sensor.w = player.w;
  sensor.h = 2;
  sensor.mass = 0.01;
  sensor.removeColliders();
  sensor.visible = false;
  let sensorJoint = new GlueJoint(player, sensor);
  sensorJoint.visible = false;
}

function windowResized() {
  let scale = Math.max(
    1,
    Math.min(Math.floor(windowWidth / VIEWW), Math.floor(windowHeight / VIEWH)),
  );
  let cnvEl = document.querySelector("canvas");
  if (cnvEl) {
    cnvEl.style.width = VIEWW * scale + "px";
    cnvEl.style.height = VIEWH * scale + "px";
  }
}

// ---------------------------------------------------------------------------
// DOM DEBUG PANEL
// Sits as a sibling to the <canvas> inside its parent, positioned absolutely.
// Because it is a plain HTML element it is rendered by the browser at full
// resolution and is completely unaffected by the canvas's pixelated mode.
// ---------------------------------------------------------------------------
function createDebugDOM() {
  let wrapper = document.querySelector("canvas").parentElement;
  wrapper.style.position = "relative";

  // Faint "~ debug" hint shown when panel is closed
  let hint = document.createElement("div");
  hint.id = "dbg-hint";
  Object.assign(hint.style, {
    position: "absolute",
    top: "6px",
    left: "8px",
    fontFamily: "monospace",
    fontSize: "11px",
    color: "rgba(255,255,255,0.35)",
    pointerEvents: "none",
    zIndex: "10",
  });
  hint.textContent = "` debug";
  wrapper.appendChild(hint);

  // Main panel
  let panel = document.createElement("div");
  panel.id = "dbg-panel";
  Object.assign(panel.style, {
    display: "none",
    position: "absolute",
    top: "8px",
    left: "8px",
    background: "rgba(8, 8, 8, 0.86)",
    color: "#ddd",
    fontFamily: "monospace",
    fontSize: "12px",
    lineHeight: "1.65",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.1)",
    pointerEvents: "none",
    minWidth: "170px",
    zIndex: "11",
    backdropFilter: "blur(2px)",
  });
  wrapper.appendChild(panel);
}

function updateDebugDOM(grounded) {
  let panel = document.getElementById("dbg-panel");
  let hint = document.getElementById("dbg-hint");
  if (!panel || !hint) return;

  if (!debug.open) {
    panel.style.display = "none";
    hint.style.display = "block";
    return;
  }

  hint.style.display = "none";
  panel.style.display = "block";

  const on = `style="color:#4ddd7a;font-weight:bold"`;
  const off = `style="color:#555"`;
  const val = `style="color:#6ab0f5"`;
  const dim = `style="color:#555"`;
  const lbl = `style="color:#aaa;padding-right:14px"`;

  let velRows = "";
  if (debug.showVelocity) {
    let px = player.pos.x.toFixed(1),
      py = player.pos.y.toFixed(1);
    let vx = player.vel.x.toFixed(2),
      vy = player.vel.y.toFixed(2);
    let gnd = grounded ? "yes" : "no";
    let ani = player.ani.name ?? "-";
    velRows = `
      <tr><td colspan="2" ${dim} style="padding-top:4px;border-top:1px solid #dcdcdc">──────────────</td></tr>
      <tr><td ${lbl}>pos</td><td ${val}>${px}, ${py}</td></tr>
      <tr><td ${lbl}>vel</td><td ${val}>${vx}, ${vy}</td></tr>
      <tr><td ${lbl}>gnd</td><td ${val}>${gnd}</td></tr>
      <tr><td ${lbl}>ani</td><td ${val}>${ani}</td></tr>
    `;
  }

  panel.innerHTML =
    `
    <table style="border-collapse:collapse;width:100%">
      <tr>
        <td colspan="2" style="color:#666;font-size:10px;letter-spacing:0.07em;padding-bottom:5px">
          DEBUG &nbsp;<span style="color:#dcdcdc">[` +
    "`" +
    ` to close]</span>
        </td>
      </tr>
      <tr>
        <td ${lbl}>moon grav <span style="color:#dcdcdc">[G]</span></td>
        <td ${debug.moonGravity ? on : off}>${debug.moonGravity ? "ON" : "off"}</td>
      </tr>
      <tr>
        <td ${lbl}>hitboxes <span style="color:#dcdcdc">[H]</span></td>
        <td ${debug.showHitboxes ? on : off}>${debug.showHitboxes ? "ON" : "off"}</td>
      </tr>
      <tr>
        <td ${lbl}>velocity <span style="color:#dcdcdc">[V]</span></td>
        <td ${debug.showVelocity ? on : off}>${debug.showVelocity ? "ON" : "off"}</td>
      </tr>
      ${velRows}
    </table>
  `;
}

// ---------------------------------------------------------------------------
// KEY HANDLING
// ---------------------------------------------------------------------------
function keyPressed() {
  startMusicIfNeeded();

  if (key === "`" || key === "~") {
    debug.open = !debug.open;
    return;
  }

  if (!debug.open) return;

  if (key === "g" || key === "G") {
    debug.moonGravity = !debug.moonGravity;
    world.gravity.y = debug.moonGravity ? MOON_GRAVITY : NORMAL_GRAVITY;
  }
  if (key === "h" || key === "H") {
    debug.showHitboxes = !debug.showHitboxes;
    allSprites.debug = debug.showHitboxes;
  }
  if (key === "v" || key === "V") {
    debug.showVelocity = !debug.showVelocity;
  }
}

function mousePressed() {
  startMusicIfNeeded();
}
function touchStarted() {
  startMusicIfNeeded();
  return false;
}

function startMusicIfNeeded() {
  if (musicStarted || !musicSfx) return;
  const startLoop = () => {
    if (!musicSfx.isPlaying()) musicSfx.play();
    musicStarted = musicSfx.isPlaying();
  };
  const maybePromise = userStartAudio();
  if (maybePromise && typeof maybePromise.then === "function") {
    maybePromise.then(startLoop).catch(() => {});
  } else {
    startLoop();
  }
}

// ---------------------------------------------------------------------------
// DRAW
// ---------------------------------------------------------------------------
function draw() {
  camera.off();
  imageMode(CORNER);
  image(bgImg, 0, 0, bgImg.width, bgImg.height);
  camera.on();

  let grounded = sensor.overlapping(ground);

  if (grounded && !attacking && kb.presses("space")) {
    attacking = true;
    attackFrameCounter = 0;
    player.vel.x = 0;
    player.ani.frame = 0;
    player.ani = "attack";
    player.ani.play();
  }

  if (grounded && kb.presses("up")) {
    player.vel.y = -4;
    if (jumpSfx) jumpSfx.play();
  }

  if (attacking) {
    attackFrameCounter++;
    if (attackFrameCounter > 12) {
      attacking = false;
      attackFrameCounter = 0;
    }
  } else if (!grounded) {
    player.ani = "jump";
    player.ani.frame = player.vel.y < 0 ? 0 : 1;
  } else {
    player.ani = kb.pressing("left") || kb.pressing("right") ? "run" : "idle";
  }

  if (!attacking) {
    player.vel.x = 0;
    if (kb.pressing("left")) {
      player.vel.x = -1.5;
      player.mirror.x = true;
    } else if (kb.pressing("right")) {
      player.vel.x = 1.5;
      player.mirror.x = false;
    }
  }

  player.pos.x = constrain(player.pos.x, FRAME_W / 2, VIEWW - FRAME_W / 2);

  // Update the DOM panel every frame (cheap — only touches innerHTML when open)
  updateDebugDOM(grounded);
}
