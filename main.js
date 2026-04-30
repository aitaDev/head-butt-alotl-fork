import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const app = document.getElementById('app');
const saveKey = 'axolotl-alien-fighter-save';
const gameVersion = 'v0.4.0';
const patchNotes = [
  'v0.4.0  Depth gauge — real-time dive indicator with zone name and visual fill. Deep waters darken the world.',
  'v0.3.5  Anglerfish lurking in the deep — glowing lures, aggressive hunting in dark waters, pulsing bioluminescence.',
  'v0.3.4  Seabed creatures now live: urchins spike on contact, crabs scuttle and deal damage, starfish are collectible with respawn.',
  'v0.3.3  HP bar flashes red while sprinting, screen shake on critical headbutts.',
  'v0.3.2  Halved whale size, added whale swimming movement, and restored menu button sound triggers.',
  'v0.3.0  Upgrades visibly change axolotl, new creatures: jellyfish/seahorses/orbs/anemones, bubble particles, animated kelp, bioluminescent glow, lore tablets, light rays, treasure chests.',
  'v0.2.0  Added menu patch notes, version tag, flashier XP UI, and bigger coral pass.',
  'v0.1.9  Added user audio loops and ambient sound hooks.',
  'v0.1.8  Removed hard world wrap bounce, world now recycles around player.',
  'v0.1.7  Added sharks, whale chat, narwhals, octopus, fish, and coral biome detail.',
  'v0.1.6  Added larger alien variety, progression tuning, and deeper ocean feel.'
];

const defaults = {
  options: {
    sound: 70,
    music: 50,
    graphics: 'high',
    keybinds: {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
      sprint: 'ShiftLeft',
      upgrades: 'KeyU',
      pause: 'Escape'
    }
  },
  save: {
    hasSave: false,
    xp: 0,
    level: 1,
    currency: 0,
    health: 100,
    upgrades: { fins: 0, head: 0, lungs: 0, bite: 0 },
    stats: { aliensBonked: 0, wormsEaten: 0, steakEaten: 0 }
  }
};

let data = loadData();
data.save.currency = 0;
let gameStarted = false;
let paused = true;
let pointerLocked = false;
let rebinding = null;
let lastDamageCause = 'your own bad decisions';
let upgradeHintShown = false;
let roundStartedAt = performance.now();

const state = {
  xp: data.save.xp,
  level: data.save.level,
  currency: 0,
  health: data.save.health,
  upgrades: { ...data.save.upgrades },
  stats: { ...data.save.stats }
};

const config = {
  moveSpeed: () => 7 + state.upgrades.fins * 1.4,
  ramPower: () => 10 + state.level * 1.75 + state.upgrades.head * 7,
  maxHealth: () => 100 + state.upgrades.lungs * 20,
  pickupRadius: () => 1.4 + state.upgrades.bite * 0.25,
  accel: () => 5.8 + state.upgrades.fins * 0.6,
  verticalAccel: () => 10,
  jumpStrength: () => 7.5 + state.upgrades.fins * 0.4,
  sprintDrain: () => 4.5,
  maxBoostMultiplier: () => 5,
  xpToNext: () => 50 + (state.level - 1) * 35
};

const hostileSpeedMultiplier = 10;

const upgradesMeta = [
  { key: 'fins', name: 'Better Fins', desc: 'Swim faster through the pond.', cost: lvl => [20, 100, 300, 900, 2500][lvl] },
  { key: 'head', name: 'Bigger Stronger Head', desc: 'Bonk aliens harder for faster takedowns.', cost: lvl => [60, 100, 300, 900, 2500][lvl] },
  { key: 'lungs', name: 'Pond Lungs', desc: 'More health and better survival.', cost: lvl => [45, 100, 300, 900, 2500][lvl] },
  { key: 'bite', name: 'Power Chomp', desc: 'Grab worms and steak from farther away.', cost: lvl => [45, 100, 300, 900, 2500][lvl] }
];

app.innerHTML = `
<div id="ui">
  <div id="gameOverMenu" class="overlay hidden">
    <div class="panel">
      <h1 style="font-size:44px;color:#ff4d6d;text-shadow:0 0 18px rgba(255,0,64,0.6)">GAME OVER</h1>
      <p class="subtitle" id="gameOverCaption" style="color:#ffb3c1">you found out huh?</p>
      <div class="menu-buttons">
        <button id="retryBtn">Rise Again</button>
        <button id="gameOverTitleBtn" class="secondary">Quit to Title</button>
      </div>
    </div>
  </div>

  <div id="whaleChatMenu" class="overlay hidden">
    <div class="panel">
      <h2>Whale Wisdom</h2>
      <p class="subtitle" id="whaleDialogText">Please help protect the ocean. Trash, oil, plastic, and poison spread everywhere. Clean water means life for all of us.</p>
      <div class="small space-continue">Hit space to continue</div>
    </div>
  </div>

  <div id="tutorialMenu" class="overlay hidden">
    <div class="panel">
      <h2>How To Swim</h2>
      <p class="subtitle">W move forward, S back, A left, D right, move mouse to aim, Shift sprint, C upgrades, Esc pause.</p>
      <div class="small space-continue">Hit space to continue</div>
    </div>
  </div>

  <div id="upgradeHintMenu" class="overlay hidden">
    <div class="panel">
      <h2>Character Upgrades</h2>
      <p class="subtitle">You have 20 Silver. Hit C to open Character Upgrades and spend it.</p>
      <div class="small space-continue">Hit space to continue</div>
    </div>
  </div>

  <div id="storyMenu" class="overlay hidden">
    <div class="panel" style="max-width:520px;text-align:center">
      <p id="storyText" style="font-size:15px;line-height:1.75;color:#d7f1ff;margin-bottom:24px"></p>
      <div class="small space-continue" id="storyHint" style="margin-top:10px">Hit space to continue</div>
    </div>
  </div>
  <div id="mainMenu" class="overlay">
    <div class="panel main-menu-panel">
      <div class="main-menu-copy">
        <h1 class="title">Head-Butt-Alotl</h1>
        <p class="subtitle">Save the pond by headbutting alien invaders and gobbling worms for power.</p>
        <div class="menu-buttons">
          <button id="newGameBtn">New Game</button>
          <button id="continueBtn">Continue</button>
          <button id="optionsBtn" class="secondary">Options</button>
          <button id="patchNotesBtn" class="secondary">Patch Notes</button>
        </div>
        <div id="versionTag">${gameVersion} by Phishie</div>
      </div>
      <div class="main-menu-art" aria-hidden="true">
        <div id="menuPreview"></div>
      </div>
    </div>
  </div>

  <div id="patchNotesMenu" class="overlay hidden">
    <div class="panel">
      <h2>Patch Notes</h2>
      <div id="patchNotesList" class="stack"></div>
      <div class="stack" style="margin-top:16px">
        <button id="closePatchNotesBtn">Back</button>
      </div>
    </div>
  </div>

  <div id="pauseMenu" class="overlay hidden">
    <div class="panel">
      <h2>Paused</h2>
      <div class="menu-buttons">
        <button id="resumeBtn">Resume</button>
        <button id="charBtn">Character Upgrades</button>
        <button id="pauseOptionsBtn" class="secondary">Options</button>
        <button id="quitBtn" class="secondary">Quit to Title</button>
      </div>
    </div>
  </div>

  <div id="optionsMenu" class="overlay hidden">
    <div class="panel">
      <h2>Options</h2>
      <div class="row"><span>Graphics</span><span class="value" id="graphicsValue"></span></div>
      <div class="row"><button id="graphicsDown" class="secondary">Lower</button><button id="graphicsUp" class="secondary">Raise</button></div>
      <div class="row"><span>Sound</span><span class="value" id="soundValue"></span></div>
      <input id="soundSlider" type="range" min="0" max="100" />
      <div class="row"><span>Music</span><span class="value" id="musicValue"></span></div>
      <input id="musicSlider" type="range" min="0" max="100" />
      <h3>Keybinds</h3>
      <div id="keybindList"></div>
      <p class="small">Click a keybind, then press a new key.</p>
      <div class="stack" style="margin-top:16px">
        <button id="closeOptionsBtn">Done</button>
      </div>
    </div>
  </div>

  <div id="upgradeMenu" class="overlay hidden">
    <div class="panel" style="width:min(96vw,820px);max-width:820px">
      <h2>Axolotl Evolution</h2>
      <p class="subtitle">Spend Silver on upgrades.</p>
      <div class="row"><span>Level</span><span class="value" id="upLevel"></span></div>
      <div class="row"><span>Silver</span><span class="value" id="upCurrency"></span></div>
      <div class="bar"><div id="upgradeXpFill" class="fill"></div><div class="barLabel" id="upgradeXpLabel"></div></div>
      <div style="height:12px"></div>
      <div id="upgradeList"></div>
      <div class="stack" style="margin-top:16px">
        <button id="closeUpgradeBtn">Back</button>
      </div>
    </div>
  </div>

  <div class="topbar">
    <div class="card" id="scoreCard">Silver: <span id="currency">0</span></div>
    <div class="card" id="statCard">Aliens bonked: <span id="aliensBonked">0</span></div>
  </div>

  <div id="notice"></div>
  <div id="crosshair"><div class="dot"></div></div>
  <div id="healthHud" class="card hp-card">
    <div class="hud-title">HP</div>
    <div class="bar"><div id="healthFill" class="fill"></div><div class="barLabel" id="healthLabel"></div></div>
  </div>
  <div id="hud">
    <div class="bar xp-bar-shell"><div id="xpFill" class="fill"></div><div class="barLabel" id="xpLabel"></div></div>
  </div>
  <div id="depthIndicator" class="card depth-card">
    <div class="depth-label">DEPTH</div>
    <div class="depth-bar"><div id="depthFill" class="depth-fill"></div></div>
    <div id="depthZoneName" class="depth-zone-name">Surface Waters</div>
  </div>
  <div id="xpBurst" class="hidden">✦ XP GAIN ✦</div>
  <div id="levelUpFlash" class="hidden">✦ LEVEL UP ✦</div>
</div>`;

const el = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
const storyParagraphs = [
  'Axo was just a weird little pond creature with a thick skull and no plans beyond snacks and floating around.',
  'Then the newcomers showed up. Not fish, not frogs, definitely not friendly. They oozed in from the dark and started warping the water.',
  'Plants twisted. Creatures changed. The whole pond got meaner, stranger, and way louder than anybody asked for.',
  'Most things hid. Axo did not. Axo discovered a sacred truth: if your head is hard enough, problems can be solved by swimming directly into them.',
  'Now the pond is full of invaders, hungry wildlife, and ancient nonsense lurking below the surface.',
  'Good thing Axo was built for chaos. Bonk first, ask questions never.'
];
let storyIndex = 0;

function loadData() {
  try {
    const raw = localStorage.getItem(saveKey);
    if (!raw) return structuredClone(defaults);
    const parsed = JSON.parse(raw);
    return {
      options: { ...defaults.options, ...parsed.options, keybinds: { ...defaults.options.keybinds, ...(parsed.options?.keybinds || {}) } },
      save: { ...defaults.save, ...parsed.save, upgrades: { ...defaults.save.upgrades, ...(parsed.save?.upgrades || {}) }, stats: { ...defaults.save.stats, ...(parsed.save?.stats || {}) } }
    };
  } catch {
    return structuredClone(defaults);
  }
}

function persist() {
  data.save = { hasSave: true, xp: state.xp, level: state.level, currency: state.currency, health: state.health, upgrades: state.upgrades, stats: state.stats };
  localStorage.setItem(saveKey, JSON.stringify(data));
}

function resetState() {
  upgradeHintShown = false;
  roundStartedAt = performance.now();
  Object.assign(state, structuredClone(defaults.save));
  state.health = config.maxHealth();
  persist();
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b5ea8, 18, 180);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 2, 6);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, data.options.graphics === 'low' ? 1 : data.options.graphics === 'medium' ? 1.5 : 2));
app.prepend(renderer.domElement);

scene.add(new THREE.AmbientLight(0x89c9ff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(20, 30, 10);
scene.add(sun);

const water = new THREE.Mesh(
  new THREE.CylinderGeometry(140, 140, 90, data.options.graphics === 'low' ? 24 : 64),
  new THREE.MeshPhongMaterial({ color: 0x1f8fff, emissive: 0x0b4f96, transparent: true, opacity: 0.88, shininess: 45 })
);
water.position.y = -40;
scene.add(water);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(142, 142, 8, 64),
  new THREE.MeshStandardMaterial({ color: 0xd1b276, roughness: 0.95 })
);
floor.position.y = -86;
scene.add(floor);

const reeds = [];
const grassColors = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x32ade6, 0x5856d6, 0xaf52de];
for (let i = 0; i < 260; i++) {
  const reed = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.2 + Math.random() * 2.8, 0.1),
    new THREE.MeshStandardMaterial({ color: grassColors[i % grassColors.length], roughness: 0.82 })
  );
  const r = 8 + Math.random() * 92;
  const a = Math.random() * Math.PI * 2;
  reed.position.set(Math.cos(a) * r, -83 + reed.geometry.parameters.height / 2, Math.sin(a) * r);
  reeds.push(reed);
  scene.add(reed);
}

const coral = [];
for (let i = 0; i < 90; i++) {
  const group = new THREE.Group();
  const colors = [0xff7aa2, 0xff9966, 0xa66cff, 0xffcc66, 0x66e0ff, 0xff6680];
  const color = colors[i % colors.length];
  const branchCount = 4 + Math.floor(Math.random() * 6);
  for (let j = 0; j < branchCount; j++) {
    const h = 1.4 + Math.random() * 6.5;
    const branch = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 + Math.random() * 0.5, h, 0.35 + Math.random() * 0.5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.86 })
    );
    const angle = (j / branchCount) * Math.PI * 2;
    const radius = Math.random() * 1.4;
    branch.position.set(Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius);
    branch.rotation.z = (Math.random() - 0.5) * 0.5;
    branch.rotation.x = (Math.random() - 0.5) * 0.25;
    group.add(branch);
    if (Math.random() > 0.45) {
      const nub = new THREE.Mesh(
        new THREE.BoxGeometry(0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5),
        new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
      );
      nub.position.set(branch.position.x + (Math.random() - 0.5) * 0.6, h + (Math.random() - 0.2) * 0.8, branch.position.z + (Math.random() - 0.5) * 0.6);
      group.add(nub);
    }
  }
  const scale = 0.8 + Math.random() * 3.6;
  group.scale.setScalar(scale);
  const r = 12 + Math.random() * 90;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -83, Math.sin(a) * r);
  coral.push(group);
  scene.add(group);
}

const shells = [];
for (let i = 0; i < 60; i++) {
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.18, 0.35),
    new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf5ddc8 : 0xe9c6ff, roughness: 0.9 })
  );
  const r = 10 + Math.random() * 95;
  const a = Math.random() * Math.PI * 2;
  shell.position.set(Math.cos(a) * r, -83.7, Math.sin(a) * r);
  shell.rotation.y = Math.random() * Math.PI;
  shells.push(shell);
  scene.add(shell);
}

function resolveSolidCollision(pos, solidPos, radius) {
  const offset = pos.clone().sub(solidPos);
  const dist = offset.length();
  if (dist === 0 || dist >= radius) return false;
  offset.normalize().multiplyScalar(radius - dist + 0.001);
  pos.add(offset);
  return true;
}

const whale = new THREE.Group();
const whaleBody = new THREE.Mesh(new THREE.BoxGeometry(67.5, 24, 24), new THREE.MeshStandardMaterial({ color: 0x4a6f96, roughness: 0.8 }));
const whaleHead = new THREE.Mesh(new THREE.BoxGeometry(29, 19, 19), new THREE.MeshStandardMaterial({ color: 0x5d84aa, roughness: 0.75 }));
const whaleTailL = new THREE.Mesh(new THREE.BoxGeometry(9, 0.9, 7.5), new THREE.MeshStandardMaterial({ color: 0x486b90 }));
const whaleTailR = whaleTailL.clone();
const whaleFinL = new THREE.Mesh(new THREE.BoxGeometry(9, 0.75, 4), new THREE.MeshStandardMaterial({ color: 0x3e6186 }));
const whaleFinR = whaleFinL.clone();
whaleHead.position.set(42, 1, 0);
whaleTailL.position.set(-44, 3.5, 9);
whaleTailR.position.set(-44, 3.5, -9);
whaleTailL.rotation.y = 0.45;
whaleTailR.rotation.y = -0.45;
whaleFinL.position.set(4, -9, 13.5);
whaleFinR.position.set(4, -9, -13.5);
whale.add(whaleBody, whaleHead, whaleTailL, whaleTailR, whaleFinL, whaleFinR);
whale.position.set(180, -65, -100);
whale.visible = false;
scene.add(whale);
let whaleSwimAngle = 0;

const stars = new THREE.Group();
for (let i = 0; i < 120; i++) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xb8ffb0 }));
  p.position.set((Math.random() - 0.5) * 140, 20 + Math.random() * 45, (Math.random() - 0.5) * 140);
  stars.add(p);
}
scene.add(stars);

const player = {
  pos: new THREE.Vector3(0, -12, 0),
  yaw: 0,
  pitch: 0,
  velocity: new THREE.Vector3(),
  radius: 1.2,
  verticalVelocity: 0,
  forwardBoost: 1,
  sprinting: false
};

const axolotl = new THREE.Group();
const axBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xff9ecf, roughness: 0.85 }));
const axBodyStripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.12), new THREE.MeshStandardMaterial({ color: 0xf58cbc, roughness: 0.9 }));
const axHead = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 1.05), new THREE.MeshStandardMaterial({ color: 0xffadd7, roughness: 0.8 }));
const axMouth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: 0x7a3050 }));
const axTail = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.45, 0.75), new THREE.MeshStandardMaterial({ color: 0xf58cbc, roughness: 0.8 }));
const axTailTip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.45), new THREE.MeshStandardMaterial({ color: 0xffbddf, roughness: 0.85 }));
const axLegFL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.35), new THREE.MeshStandardMaterial({ color: 0xff8fca }));
const axLegFR = axLegFL.clone();
const axLegBL = axLegFL.clone();
const axLegBR = axLegFL.clone();
const axGillL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.95), new THREE.MeshStandardMaterial({ color: 0xff5ca8, transparent: true, opacity: 0.9 }));
const axGillR = axGillL.clone();
const axEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
const axEyeR = axEyeL.clone();
const axEyeShineL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
const axEyeShineR = axEyeShineL.clone();
axBody.position.set(0, 0, 0);
axBodyStripe.position.set(0.1, 0.12, 0);
axHead.position.set(1.4, 0.06, 0);
axMouth.position.set(1.92, -0.12, 0);
axTail.position.set(-1.42, -0.02, 0);
axTailTip.position.set(-2.12, -0.02, 0);
axLegFL.position.set(0.6, -0.42, 0.42);
axLegFR.position.set(0.6, -0.42, -0.42);
axLegBL.position.set(-0.5, -0.42, 0.42);
axLegBR.position.set(-0.5, -0.42, -0.42);
axGillL.position.set(1.05, 0.22, 0.92);
axGillR.position.set(1.05, 0.22, -0.92);
axEyeL.position.set(1.96, 0.24, 0.34);
axEyeR.position.set(1.96, 0.24, -0.34);
axEyeShineL.position.set(2.04, 0.31, 0.38);
axEyeShineR.position.set(2.04, 0.31, -0.30);
axolotl.add(axBody, axBodyStripe, axHead, axMouth, axTail, axTailTip, axLegFL, axLegFR, axLegBL, axLegBR, axGillL, axGillR, axEyeL, axEyeR, axEyeShineL, axEyeShineR);
scene.add(axolotl);

const menuPreviewScene = new THREE.Scene();
const menuPreviewCamera = new THREE.PerspectiveCamera(35, 360 / 320, 0.1, 100);
menuPreviewCamera.position.set(0, 1.2, 8);
const menuPreviewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
menuPreviewRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
menuPreviewRenderer.setSize(360, 320);
menuPreviewRenderer.domElement.className = 'menu-preview-canvas';
el.menuPreview.appendChild(menuPreviewRenderer.domElement);
menuPreviewScene.add(new THREE.AmbientLight(0xffffff, 1.8));
const menuPreviewLight = new THREE.DirectionalLight(0xcfefff, 1.6);
menuPreviewLight.position.set(2, 3, 4);
menuPreviewScene.add(menuPreviewLight);
const menuPreviewAxolotl = axolotl.clone(true);
menuPreviewAxolotl.position.set(0, 0, 0);
menuPreviewAxolotl.rotation.set(0.15, -0.7, 0);
menuPreviewScene.add(menuPreviewAxolotl);

// --- Upgrade visual meshes (dynamically shown/hidden based on upgrade level) ---
const upgradeVisuals = {
  fins: [],    // extra side fins
  head: [],    // head armor plates + spikes
  lungs: [],   // extra gill filaments
  bite: []     // jaw widen + teeth shine
};

function refreshAxolotlVisuals() {
  // Remove old upgrade visuals
  for (const key of Object.keys(upgradeVisuals)) {
    for (const m of upgradeVisuals[key]) axolotl.remove(m);
    upgradeVisuals[key] = [];
  }
  // ── Fins: extra dorsal fins appear at fin level 2+ ──
  const finLvl = state.upgrades.fins;
  if (finLvl >= 2) {
    const dorsalFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.55 + finLvl * 0.15, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xff78bc, roughness: 0.75 })
    );
    dorsalFin.position.set(-0.2, 0.52 + finLvl * 0.08, 0);
    axolotl.add(dorsalFin);
    upgradeVisuals.fins.push(dorsalFin);
  }
  if (finLvl >= 4) {
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.55), new THREE.MeshStandardMaterial({ color: 0xff60b0, roughness: 0.7 }));
    const finR = finL.clone();
    finL.position.set(-0.3, 0.28, 0.55); finR.position.set(-0.3, 0.28, -0.55);
    axolotl.add(finL, finR);
    upgradeVisuals.fins.push(finL, finR);
  }
  // ── Head: armor plates + spikes appear at head level 2+ ──
  const headLvl = state.upgrades.head;
  if (headLvl >= 1) {
    const plate1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.85), new THREE.MeshStandardMaterial({ color: 0xd96ba8, roughness: 0.6, metalness: 0.12 }));
    plate1.position.set(1.38, 0.52, 0);
    axolotl.add(plate1);
    upgradeVisuals.head.push(plate1);
  }
  if (headLvl >= 2) {
    const spike1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), new THREE.MeshStandardMaterial({ color: 0xffc4e3, emissive: 0x6b1848, roughness: 0.4 }));
    const spike2 = spike1.clone();
    spike1.position.set(1.35, 0.82, 0.28); spike2.position.set(1.35, 0.82, -0.28);
    axolotl.add(spike1, spike2);
    upgradeVisuals.head.push(spike1, spike2);
  }
  if (headLvl >= 4) {
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.65), new THREE.MeshStandardMaterial({ color: 0xe870c0, emissive: 0x5a1040, roughness: 0.45, metalness: 0.2 }));
    crest.position.set(0.9, 0.62, 0);
    axolotl.add(crest);
    upgradeVisuals.head.push(crest);
    // glowing eyes
    axEyeL.material = new THREE.MeshStandardMaterial({ color: 0xffee44, emissive: 0xffee44, emissiveIntensity: 0.6 });
    axEyeR.material = axEyeL.material.clone();
  }
  // ── Lungs: extra gill filaments at lung level 2+ ──
  const lungsLvl = state.upgrades.lungs;
  if (lungsLvl >= 2) {
    for (let i = 0; i < Math.min(lungsLvl, 3); i++) {
      const gillExtra = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45 + i * 0.12, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xff3a9e, transparent: true, opacity: 0.85 }));
      gillExtra.position.set(1.0, 0.28 + i * 0.22, 0);
      axolotl.add(gillExtra);
      upgradeVisuals.lungs.push(gillExtra);
    }
  }
  if (lungsLvl >= 4) {
    const lungGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff88cc, emissive: 0xff44aa, emissiveIntensity: 0.7, transparent: true, opacity: 0.5 }));
    lungGlow.position.set(1.05, 0.28, 0);
    axolotl.add(lungGlow);
    upgradeVisuals.lungs.push(lungGlow);
  }
  // ── Bite: jaw widen + tooth flash at bite level 2+ ──
  const biteLvl = state.upgrades.bite;
  if (biteLvl >= 2) {
    axMouth.scale.x = 1.4 + biteLvl * 0.12;
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xaaffee, emissiveIntensity: 0.3 }));
    const tooth2 = tooth1.clone();
    tooth1.position.set(1.88, -0.06, 0.12); tooth2.position.set(1.88, -0.06, -0.12);
    axolotl.add(tooth1, tooth2);
    upgradeVisuals.bite.push(tooth1, tooth2);
  }
  if (biteLvl >= 4) {
    const jawPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.58), new THREE.MeshStandardMaterial({ color: 0xcc5588, roughness: 0.55, metalness: 0.18 }));
    jawPlate.position.set(1.88, -0.22, 0);
    axolotl.add(jawPlate);
    upgradeVisuals.bite.push(jawPlate);
  }
}
refreshAxolotlVisuals();

const cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();

const aliens = [];
const pickups = [];
const sharks = [];
const octopi = [];
const narwhals = [];
const leviathans = [];
const floatingTexts = [];
const ripples = [];
const jellyfish = [];
const seahorses = [];
const glowOrbs = [];
const anemones = [];
const loreTablets = [];
const bubbles = [];
const kelpBlades = [];
const urchins = [];
const crabs = [];
// starfish removed
const crystals = [];
const tentacles = [];
const depthZones = [];
const pearls = [];
const planktonPatches = [];
const anglerfish = [];
let screenShake = { intensity: 0, duration: 0, offsetX: 0, offsetY: 0 };
const moteGroup = new THREE.Group();
scene.add(moteGroup);
let trailParticles = [];
const particleBurst = [];
let damageTextStack = 0;

// ── Light rays from surface ──
const lightRays = new THREE.Group();
for (let i = 0; i < 18; i++) {
  const ray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 + Math.random() * 0.22, 0.04, 28 + Math.random() * 18, 5),
    new THREE.MeshBasicMaterial({ color: 0xd4f0ff, transparent: true, opacity: 0.07 + Math.random() * 0.06, side: THREE.DoubleSide })
  );
  const angle = (i / 18) * Math.PI * 2;
  ray.position.set(Math.cos(angle) * (8 + Math.random() * 28), -6 + Math.random() * 6, Math.sin(angle) * (8 + Math.random() * 28));
  ray.rotation.z = (Math.random() - 0.5) * 0.4;
  ray.rotation.x = (Math.random() - 0.5) * 0.25;
  lightRays.add(ray);
}
scene.add(lightRays);
const keys = new Set();
let lastTime = performance.now();
let alienSpawnTimer = 0;
let pickupSpawnTimer = 0;
let sharkSpawnTimer = 0;
let anglerSpawnTimer = 0;
let leviathanSpawnTimer = 0;
let continueAllowed = !!data.save.hasSave;
const worldRadius = 100;
let isGameOver = false;
let narwhalBuffUntil = 0;
let whaleChatCooldownUntil = 0;
let lastScubaAt = 0;
let audioUnlocked = false;

const audio = {
  underwater: new Audio('./assets/audio/underwater-loop.mp3'),
  scuba: new Audio('./assets/audio/scuba.mp3'),
  whoosh: new Audio('./assets/audio/whoosh.mp3'),
  whale: new Audio('./assets/audio/whale.mp3'),
  menu: new Audio('./assets/audio/menu.mp3'),
  eat: new Audio('./assets/audio/eat.mp3'),
  gameOver: new Audio('./assets/audio/game_over.mp3'),
  bigShark: new Audio('./assets/audio/big-shark.mp3')
};
audio.underwater.loop = true;
audio.underwater.volume = 0.35;
audio.scuba.volume = 0.5;
audio.whoosh.loop = true;
audio.whoosh.volume = 0.35;
audio.whale.volume = 0.55;
audio.menu.volume = 0.45;
audio.eat.volume = 0.5;
audio.gameOver.volume = 0.65;
audio.bigShark.loop = true;
audio.bigShark.volume = 0.5;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  for (const sound of Object.values(audio)) {
    sound.play().then(() => {
      sound.pause();
      sound.currentTime = 0;
    }).catch(() => {});
  }
}

function makeAlien() {
  const group = new THREE.Group();
  const types = [
    { name: 'grunt', body: 0x88d66f, head: 0x8cf07d, belly: 0xb8f29a, horn: true, arms: true, scaleMin: 0.6, scaleMax: 1.4, hp: 1, speed: 1.1, damage: 1 },
    { name: 'brute', body: 0x5678ff, head: 0x7a92ff, belly: 0xb7c2ff, horn: false, arms: true, scaleMin: 1.8, scaleMax: 3.4, hp: 2.8, speed: 0.7, damage: 2.7 },
    { name: 'spike', body: 0xd66f88, head: 0xf08ca8, belly: 0xf2b8c9, horn: true, arms: false, scaleMin: 0.9, scaleMax: 2.1, hp: 1.6, speed: 1.0, damage: 1.8 },
    { name: 'tiny', body: 0xe0d45a, head: 0xf7ed8e, belly: 0xfff6b8, horn: false, arms: true, scaleMin: 0.35, scaleMax: 0.7, hp: 0.55, speed: 1.6, damage: 0.55 }
  ];
  const type = types[Math.floor(Math.random() * types.length)];

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.95), new THREE.MeshStandardMaterial({ color: type.body, emissive: 0x214d15, roughness: 0.45, metalness: 0.08 }));
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 0.2), new THREE.MeshStandardMaterial({ color: type.belly, roughness: 0.7 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: type.head, emissive: 0x245d1b, roughness: 0.35, metalness: 0.15 }));
  const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const eye2 = eye1.clone();
  const pupil1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
  const pupil2 = pupil1.clone();
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), new THREE.MeshStandardMaterial({ color: type.body }));
  const armR = armL.clone();
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.95, 0.24), new THREE.MeshStandardMaterial({ color: type.body }));
  const legR = legL.clone();
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x365421 }));
  head.position.set(0, 0.7, 0);
  belly.position.set(0, -0.05, 0.38);
  eye1.position.set(-0.25, 0.82, 0.55); eye2.position.set(0.25, 0.82, 0.55);
  pupil1.position.set(-0.25, 0.82, 0.68); pupil2.position.set(0.25, 0.82, 0.68);
  armL.position.set(-0.6, 0.08, 0); armR.position.set(0.6, 0.08, 0);
  legL.position.set(-0.28, -0.98, 0); legR.position.set(0.28, -0.98, 0);
  armL.rotation.z = 0.65; armR.rotation.z = -0.65;
  mouth.position.set(0, 0.42, 0.62);
  group.add(body, belly, head, eye1, eye2, pupil1, pupil2, legL, legR, mouth);
  if (type.arms) group.add(armL, armR);
  if (type.horn) {
    const horn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), new THREE.MeshStandardMaterial({ color: 0xb8ffb0, emissive: 0x274611 }));
    const horn2 = horn.clone();
    horn.position.set(-0.28, 1.38, 0.12);
    horn2.position.set(0.28, 1.38, 0.12);
    group.add(horn, horn2);
  } else {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.35), new THREE.MeshStandardMaterial({ color: type.head, emissive: 0x1a2d44, transparent: true, opacity: 0.7 }));
    fin.position.y = 1.1;
    group.add(fin);
  }

  const scale = type.scaleMin + Math.random() * (type.scaleMax - type.scaleMin);
  group.scale.setScalar(scale);
  const r = 20 + Math.random() * 42;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -72 + Math.random() * 62, Math.sin(a) * r);
  scene.add(group);
  const sizeDamageMultiplier = scale >= 2 ? 4.5 : scale >= 1.5 ? 2.5 : 1;
  aliens.push({ mesh: group, hp: (38 + state.level * 9) * scale * 1.8 * type.hp * 2, speed: Math.max(0.35, type.speed - scale * 0.12) + Math.random() * 0.35, bob: Math.random() * Math.PI * 2, scale, damage: 6 * scale * type.damage * sizeDamageMultiplier, kind: type.name, collisionRadius: 1.2 * scale });
}

function makePickup(kind = Math.random() < 0.12 ? 'steak' : Math.random() < 0.45 ? 'fish' : 'worm') {
  const group = new THREE.Group();
  if (kind === 'steak') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.7), new THREE.MeshStandardMaterial({ color: 0xa52f2f, roughness: 0.32, metalness: 0.08 }));
    const fat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.16), new THREE.MeshStandardMaterial({ color: 0xf4d5c2, roughness: 0.9 }));
    const marbling1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), new THREE.MeshStandardMaterial({ color: 0xf7e4d8 }));
    const marbling2 = marbling1.clone();
    fat.position.set(0.02, 0.18, 0.28);
    marbling1.rotation.z = 1.1;
    marbling2.rotation.z = -0.8;
    marbling1.position.set(-0.15, 0.02, 0.2);
    marbling2.position.set(0.18, -0.05, -0.12);
    const shine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xffeee6, emissive: 0x663333, roughness: 0.05, metalness: 0.2 }));
    shine.position.set(-0.06, 0.1, -0.18);
    group.add(base, fat, marbling1, marbling2, shine);
  } else if (kind === 'fish') {
    const colors = [0x5cc8ff, 0x66f0d1, 0xffc857, 0xff7f50, 0xb784ff];
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.45), new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.55 }));
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.32), new THREE.MeshStandardMaterial({ color: 0xe8fbff, roughness: 0.7 }));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.7), new THREE.MeshStandardMaterial({ color: 0x88e0ff }));
    const topFin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.12), new THREE.MeshStandardMaterial({ color: 0xb8f2ff }));
    const sideFinL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.18), new THREE.MeshStandardMaterial({ color: 0xa8f0ff }));
    const sideFinR = sideFinL.clone();
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    const eyeR = eyeL.clone();
    const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.46), new THREE.MeshStandardMaterial({ color: 0x1b6ca8 }));
    const stripe2 = stripe1.clone();
    belly.position.set(0.05, -0.18, 0);
    tail.position.set(-0.72, 0, 0);
    topFin.position.set(0.05, 0.34, 0);
    sideFinL.position.set(0.1, -0.03, 0.3);
    sideFinR.position.set(0.1, -0.03, -0.3);
    eyeL.position.set(0.42, 0.08, 0.16);
    eyeR.position.set(0.42, 0.08, -0.16);
    stripe1.position.set(-0.1, 0, 0);
    stripe2.position.set(0.18, 0, 0);
    group.add(body, belly, tail, topFin, sideFinL, sideFinR, eyeL, eyeR, stripe1, stripe2);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0xc98a52, roughness: 0.95 }));
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x9c6436 }));
    const band2 = band1.clone();
    band1.position.set(-0.08, 0.03, 0.05);
    band2.position.set(0.14, -0.03, -0.04);
    band1.rotation.x = 1.2;
    band2.rotation.x = 1.05;
    group.add(body, band1, band2);
  }
  const minR = kind === 'fish' ? 28 : 8;
  const maxR = kind === 'fish' ? 110 : 48;
  const r = minR + Math.random() * (maxR - minR);
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -76 + Math.random() * 68, Math.sin(a) * r);
  group.rotation.set(Math.random(), Math.random(), Math.random());
  scene.add(group);
  const collisionRadius = kind === 'steak' ? 1.1 : kind === 'fish' ? 0.95 : 0.7;
  pickups.push({ mesh: group, kind, spin: (Math.random() - 0.5) * 1.4, collisionRadius });
}

function spawnRipple(position, color = 0xffffff) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position);
  scene.add(mesh);
  ripples.push({ mesh, life: 0.7 });
}

function spawnDamageText(position, amount, crit = false) {
  const rounded = Math.max(1, Math.round(amount));
  if (!crit && rounded < 2) return;
  const elText = document.createElement('div');
  elText.className = `damage-number${crit ? ' crit' : ''}`;
  elText.textContent = `${crit ? 'CRIT ' : ''}-${rounded}`;
  document.getElementById('ui').appendChild(elText);
  const x = window.innerWidth * 0.5 + (Math.random() - 0.5) * 120;
  const y = window.innerHeight * 0.42 + damageTextStack * 18;
  damageTextStack = (damageTextStack + 1) % 4;
  elText.style.left = `${x}px`;
  elText.style.top = `${y}px`;
  floatingTexts.push({
    el: elText,
    hudX: x,
    hudY: y,
    rise: 0,
    life: crit ? 1.1 : 0.8,
    crit
  });
  requestAnimationFrame(() => elText.classList.add('show'));
}

function makeNarwhal(index = narwhals.length) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: 0xd7f1ff, roughness: 0.7 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.05), new THREE.MeshStandardMaterial({ color: 0xeaf8ff, roughness: 0.6 }));
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xf5f0d8, roughness: 0.5 }));
  const tailBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xb9dced }));
  const tailFlukeTop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.42), new THREE.MeshStandardMaterial({ color: 0xb9dced }));
  const tailFlukeBottom = tailFlukeTop.clone();
  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.45), new THREE.MeshStandardMaterial({ color: 0xc8e7f5 }));
  const finR = finL.clone();
  const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.18), new THREE.MeshStandardMaterial({ color: 0xcdefff }));
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x101820 }));
  const eyeR = eyeL.clone();
  head.position.set(3.0, 0.08, 0);
  horn.rotation.z = Math.PI / 2;
  horn.position.set(4.25, 0.45, 0);
  tailBase.position.set(-2.65, 0, 0);
  tailFlukeTop.position.set(-3.0, 0.42, 0);
  tailFlukeBottom.position.set(-3.0, -0.42, 0);
  tailFlukeTop.rotation.z = 0.85;
  tailFlukeBottom.rotation.z = -0.85;
  finL.position.set(0.6, -0.45, 0.62);
  finR.position.set(0.6, -0.45, -0.62);
  finL.rotation.z = 0.35;
  finR.rotation.z = -0.35;
  dorsal.position.set(-0.4, 0.7, 0);
  eyeL.position.set(3.65, 0.22, 0.34);
  eyeR.position.set(3.65, 0.22, -0.34);
  group.add(body, head, horn, tailBase, tailFlukeTop, tailFlukeBottom, finL, finR, dorsal, eyeL, eyeR);
  const angle = (Math.PI * 2 * index) / 3;
  group.position.set(Math.cos(angle) * 28, -42 + Math.sin(index) * 4, Math.sin(angle) * 28);
  scene.add(group);
  narwhals.push({ mesh: group, bob: Math.random() * Math.PI * 2, collisionRadius: 4.5, angle, orbitRadius: 28 + index * 2, orbitSpeed: 2.8 + index * 0.18, depthOffset: -42 + index * 1.2 });
}

function makeLeviathan() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(28, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2f4358, roughness: 0.72 }));
  const fin = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 1.2), new THREE.MeshStandardMaterial({ color: 0x394f66 }));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 6), new THREE.MeshStandardMaterial({ color: 0x2d4258 }));
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0xdedede }));
  fin.position.set(0, 4.8, 0);
  tail.position.set(-15, 0, 0);
  jaw.position.set(13.5, -1.5, 0);
  group.add(body, fin, tail, jaw);
  const r = 70 + Math.random() * 40;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -45 + Math.random() * 18, Math.sin(a) * r);
  scene.add(group);
  leviathans.push({ mesh: group, speed: 8 + Math.random() * 3, damage: 100, hp: 1800, bob: Math.random() * Math.PI * 2 });
}

function makeShark() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.35, 1.35), new THREE.MeshStandardMaterial({ color: 0x6f8897, roughness: 0.7 }));
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 1.05), new THREE.MeshStandardMaterial({ color: 0x5f7685, roughness: 0.78 }));
  const belly = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.38, 0.9), new THREE.MeshStandardMaterial({ color: 0xdfe8ea, roughness: 0.9 }));
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.35), new THREE.MeshStandardMaterial({ color: 0x5b7280 }));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: 0x698391 }));
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.8), new THREE.MeshStandardMaterial({ color: 0xe9e9e9 }));
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const eyeR = eyeL.clone();
  const gillL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0x425563 }));
  const gillR = gillL.clone();
  tail.rotation.y = 0.25;
  back.position.set(-0.2, 0.28, 0);
  belly.position.set(-0.15, -0.42, 0);
  fin.position.set(0.1, 0.9, 0);
  tail.position.set(-2.5, 0, 0);
  jaw.position.set(2.1, -0.25, 0);
  eyeL.position.set(1.75, 0.1, 0.38);
  eyeR.position.set(1.75, 0.1, -0.38);
  gillL.position.set(1.1, -0.05, 0.68);
  gillR.position.set(1.1, -0.05, -0.68);
  group.add(body, back, belly, fin, tail, jaw, eyeL, eyeR, gillL, gillR);
  const r = 20 + Math.random() * 75;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -60 + Math.random() * 40, Math.sin(a) * r);
  scene.add(group);
  sharks.push({ mesh: group, speed: 2 + Math.random() * 1.5, damage: 18 + Math.random() * 12, bob: Math.random() * Math.PI * 2, hp: (85 + Math.random() * 45) * 2, hitCooldown: 0, collisionRadius: 3.2 });
}

function makeOctopus() {
  const group = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4), new THREE.MeshStandardMaterial({ color: 0xa45bff, roughness: 0.8 }));
  head.position.y = 0.35;
  for (let i = 0; i < 8; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x8b47dd, roughness: 0.85 }));
    const angle = (i / 8) * Math.PI * 2;
    arm.position.set(Math.cos(angle) * 0.5, -1.15, Math.sin(angle) * 0.5);
    arm.rotation.z = (Math.random() - 0.5) * 0.6;
    group.add(arm);
  }
  group.add(head);
  const r = 10 + Math.random() * 70;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -52 + Math.random() * 22, Math.sin(a) * r);
  scene.add(group);
  octopi.push({ mesh: group, bob: Math.random() * Math.PI * 2 });
}

function makeJellyfish() {
  const group = new THREE.Group();
  const bellColors = [0xff88dd, 0x88ddff, 0xddffcc, 0xffcc88, 0xccaaff, 0x88ffcc];
  const color = bellColors[Math.floor(Math.random() * bellColors.length)];
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.65 + Math.random() * 0.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, emissive: color, emissiveIntensity: 0.3, side: THREE.DoubleSide }));
  bell.rotation.x = 0;
  for (let i = 0; i < 6; i++) {
    const tentacle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4 + Math.random() * 1.2, 0.05),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.5 }));
    const angle = (i / 6) * Math.PI * 2;
    tentacle.position.set(Math.cos(angle) * 0.42, -0.8, Math.sin(angle) * 0.42);
    tentacle.rotation.z = (Math.random() - 0.5) * 0.35;
    group.add(tentacle);
  }
  group.add(bell);
  const r = 15 + Math.random() * 75;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -38 + Math.random() * 32, Math.sin(a) * r);
  scene.add(group);
  jellyfish.push({ mesh: group, bob: Math.random() * Math.PI * 2, phase: Math.random() * Math.PI * 2, color });
}

function makeSeahorse() {
  const group = new THREE.Group();
  const bodyColors = [0xffd700, 0xff8844, 0x44ddff, 0xff44bb, 0x88ff44];
  const color = bodyColors[Math.floor(Math.random() * bodyColors.length)];
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.32), new THREE.MeshStandardMaterial({ color, roughness: 0.65 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.28), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }));
  const curl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  head.position.set(0.18, 0.72, 0);
  snout.position.set(0.38, 0.62, 0);
  curl.position.set(-0.12, -0.62, 0);
  curl.rotation.z = 0.5;
  group.add(body, head, snout, curl);
  const r = 8 + Math.random() * 65;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -60 + Math.random() * 55, Math.sin(a) * r);
  scene.add(group);
  seahorses.push({ mesh: group, bob: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5, wanderAngle: Math.random() * Math.PI * 2 });
}

function makeGlowOrb() {
  const colors = [0x44ffaa, 0x88aaff, 0xff66dd, 0x66ffee, 0xffee44];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28 + Math.random() * 0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, transparent: true, opacity: 0.8 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 }));
  const group = new THREE.Group();
  group.add(orb, halo);
  const r = 10 + Math.random() * 85;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -72 + Math.random() * 58, Math.sin(a) * r);
  scene.add(group);
  glowOrbs.push({ mesh: group, bob: Math.random() * Math.PI * 2, phase: Math.random() * Math.PI * 2, color });
}

function makeAnemone() {
  const group = new THREE.Group();
  const baseColor = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xff6688, roughness: 0.85 }));
  group.add(baseColor);
  const tentacleColors = [0xff88aa, 0xffaacc, 0xffccdd, 0xff99bb];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const tColor = tentacleColors[Math.floor(Math.random() * tentacleColors.length)];
    const tentacle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8 + Math.random() * 0.9, 0.08),
      new THREE.MeshStandardMaterial({ color: tColor, roughness: 0.8 }));
    tentacle.position.set(Math.cos(angle) * 0.28, 0.65, Math.sin(angle) * 0.28);
    tentacle.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(tentacle);
  }
  const r = 8 + Math.random() * 90;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -84.5, Math.sin(a) * r);
  scene.add(group);
  anemones.push({ mesh: group, bob: Math.random() * Math.PI * 2, tentacles: group.children.slice(1) });
}

const loreTexts = [
  'The ancient axolotl warriors defended this sacred pond for centuries.',
  'Aliens came from the black sky, drawn by the pond\'s magical waters.',
  'Only the strongest heads can drive the invaders back.',
  'The whale remembers the old ways. Listen to its wisdom.',
  'Narwhals once swam these depths. Now they are rare and sacred.',
  'The pond grows darker each day. The light must not go out.',
  'Every worm eaten makes you stronger. Every alien bonked buys another day.',
  'The ancient ones say: swim fast, head-butt harder, never stop.'
];

function makeUrchin() {
  const group = new THREE.Group();
  const colors = [0x7be0ff, 0xff8ce8, 0xffc84a, 0x8aff8a, 0xff8080];
  const color = colors[Math.floor(Math.random() * colors.length)];
  for (let i = 0; i < 14; i++) {
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.55 + Math.random() * 0.45, 4),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    const angle = (i / 14) * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    spine.position.set(Math.sin(phi) * Math.cos(angle) * 0.32, Math.cos(phi) * 0.32, Math.sin(phi) * Math.sin(angle) * 0.32);
    spine.rotation.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    group.add(spine);
  }
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 }));
  group.add(body);
  const r = 10 + Math.random() * 88; const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -83.5, Math.sin(a) * r);
  scene.add(group);
  urchins.push({ mesh: group, hp: (18 + Math.random() * 12) * 2, bob: Math.random() * Math.PI * 2, hitCooldown: 0 });
}

function makeCrab() {
  const group = new THREE.Group();
  const shellColor = 0xd4451a + Math.floor(Math.random() * 3) * 0x111100;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 8),
    new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.75 }));
  shell.scale.y = 0.55;
  group.add(shell);
  for (let i = 0; i < 6; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.07),
      new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.8 }));
    const side = i < 3 ? 1 : -1;
    const idx = i % 3;
    leg.position.set(side * 0.52, -0.22, (idx - 1) * 0.28);
    leg.rotation.z = side * 0.55;
    group.add(leg);
  }
  const claw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xcc5522, roughness: 0.7 }));
  claw.position.set(0.72, -0.04, 0);
  const clawL = claw.clone(); clawL.position.set(-0.72, -0.04, 0);
  group.add(claw, clawL);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const eyeR = eyeL.clone();
  eyeL.position.set(0.18, 0.28, 0.14); eyeR.position.set(0.18, 0.28, -0.14);
  group.add(eyeL, eyeR);
  const r = 8 + Math.random() * 90; const a2 = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a2) * r, 50.0, Math.sin(a2) * r);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  crabs.push({ mesh: group, hp: (14 + Math.random() * 8) * 2, speed: 0.8 + Math.random() * 1.2, bob: Math.random() * Math.PI * 2, wanderAngle: Math.random() * Math.PI * 2, hitCooldown: 0 });
}

function makeStarfish() {
  const group = new THREE.Group();
  const colors = [0xff6644, 0xff44aa, 0x44ffaa, 0xffdd44, 0xdd88ff];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const armCount = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < armCount; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.14),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
    arm.rotation.z = (i / armCount) * Math.PI * 2;
    arm.position.set(Math.cos(arm.rotation.z) * 0.55, Math.sin(arm.rotation.z) * 0.55, 0);
    group.add(arm);
  }
  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, armCount),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }));
  group.add(center);
  const r = 8 + Math.random() * 88; const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -84.0, Math.sin(a) * r);
  group.rotation.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  scene.add(group);
  starfish.push({ mesh: group, color, bob: Math.random() * Math.PI * 2 });
}

function makeCrystal() {
  const group = new THREE.Group();
  const colors = [0x44ddff, 0xdd44ff, 0xff44dd, 0x44ffaa, 0xffdd44];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const clusterCount = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < clusterCount; i++) {
    const h = 0.9 + Math.random() * 2.5;
    const shard = new THREE.Mesh(new THREE.CylinderGeometry(0.04 + Math.random() * 0.08, 0.02, h, 5),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.75, roughness: 0.1, metalness: 0.6 }));
    shard.position.set((Math.random() - 0.5) * 0.9, h / 2, (Math.random() - 0.5) * 0.9);
    shard.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * Math.PI, (Math.random() - 0.5) * 0.4);
    group.add(shard);
  }
  const r = 12 + Math.random() * 80; const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -55 + Math.random() * 60, Math.sin(a) * r);
  scene.add(group);
  crystals.push({ mesh: group, color, bob: Math.random() * Math.PI * 2, phase: Math.random() * Math.PI * 2 });
}

function makeKraken() {
  const baseAngle = Math.random() * Math.PI * 2;
  const mesh = new THREE.Group();
  const segs = [];
  for (let s = 0; s < 7; s++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.32 - s * 0.035, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x6a2d8a, roughness: 0.85 }));
    seg.position.x = s * 0.52;
    mesh.add(seg);
    segs.push(seg);
  }
  mesh.rotation.y = baseAngle;
  const r = 30 + Math.random() * 65; const a = Math.random() * Math.PI * 2;
  mesh.position.set(Math.cos(a) * r, -78, Math.sin(a) * r);
  scene.add(mesh);
  tentacles.push({ mesh, segs, baseAngle, phase: Math.random() * Math.PI * 2 });
}

function makeAnglerfish() {
  const group = new THREE.Group();
  const bodyColor = 0x1a1a2e;
  // Main body — elongated and deep
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.3),
    new THREE.MeshStandardMaterial({ color: 0x22223a, roughness: 0.8 }));
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.75 }));
  const belly = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x4a3a5a, roughness: 0.9 }));
  const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x2a2a3e }));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.9),
    new THREE.MeshStandardMaterial({ color: bodyColor }));
  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x1e1e30 }));
  const finR = finL.clone();
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffee44 }));
  const eyeR = eyeL.clone();

  // Glowing lure stalk + light
  const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x334455 }));
  const lureColor = Math.random() < 0.5 ? 0x00ffcc : Math.random() < 0.5 ? 0xff66ff : 0x44ffaa;
  const lure = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color: lureColor, emissive: lureColor, emissiveIntensity: 2.2, transparent: true, opacity: 0.85 }));
  const lureHalo = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8),
    new THREE.MeshBasicMaterial({ color: lureColor, transparent: true, opacity: 0.12 }));

  // Teeth
  for (let t = 0; t < 6; t++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xeef5ff, roughness: 0.3, metalness: 0.4 }));
    tooth.position.set(0.7 + t * 0.12, -0.12, (t % 2 ? 1 : -1) * 0.28);
    group.add(tooth);
  }

  group.add(body, head, jaw, belly, dorsal, tail, finL, finR, eyeL, eyeR, stalk, lure, lureHalo);

  body.position.set(0, 0, 0);
  head.position.set(2.0, 0.1, 0);
  jaw.position.set(2.9, -0.28, 0);
  belly.position.set(0.2, -0.6, 0);
  dorsal.position.set(-0.5, 0.95, 0);
  tail.position.set(-1.7, 0, 0);
  finL.position.set(0.2, 0, 0.8); finL.rotation.z = 0.4;
  finR.position.set(0.2, 0, -0.8); finR.rotation.z = -0.4;
  eyeL.position.set(2.3, 0.32, 0.38); eyeR.position.set(2.3, 0.32, -0.38);
  stalk.position.set(1.8, 1.1, 0);
  lure.position.set(1.8, 1.95, 0);
  lureHalo.position.set(1.8, 1.95, 0);

  const r = 35 + Math.random() * 55;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -68 + Math.random() * 30, Math.sin(a) * r);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  anglerfish.push({ mesh: group, lureMesh: lure, lureHalo, lureColor,
    speed: 2.5 + Math.random() * 1.8, damage: 14 + Math.random() * 8,
    hp: (55 + Math.random() * 35) * 2, bob: Math.random() * Math.PI * 2,
    hitCooldown: 0, collisionRadius: 3.0, huntTimer: 0, lurePhase: Math.random() * Math.PI * 2 });
}

function updateAnglerfish(dt, now) {
  anglerSpawnTimer += dt;
  const elapsed = (performance.now() - roundStartedAt) / 1000;
  if (state.level >= 5 && elapsed >= 150 && anglerfish.length < 1 && anglerSpawnTimer > 25) {
    anglerSpawnTimer = 0;
    makeAnglerfish();
  }
  for (let i = anglerfish.length - 1; i >= 0; i--) {
    const af = anglerfish[i];
    // Recycle around player
    const dx = af.mesh.position.x - player.pos.x;
    const dz = af.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius || Math.abs(dz) > worldRadius) {
      const r = 30 + Math.random() * 50;
      const a = Math.random() * Math.PI * 2;
      af.mesh.position.x = player.pos.x + Math.cos(a) * r;
      af.mesh.position.z = player.pos.z + Math.sin(a) * r;
      af.mesh.position.y = -68 + Math.random() * 30;
    }

    af.bob += dt * 2.2;
    af.lurePhase += dt * 1.4;
    af.mesh.position.y += Math.sin(af.bob) * 0.015;

    // Pulse the lure
    const lureIntensity = 1.8 + Math.sin(af.lurePhase * 2.5) * 0.8;
    af.lureMesh.material.emissiveIntensity = lureIntensity;
    af.lureHalo.material.opacity = 0.08 + Math.sin(af.lurePhase * 2) * 0.06;

    // Hunt: if player is in deep water and within range, chase aggressively
    const toPlayer = player.pos.clone().sub(af.mesh.position);
    const dist = toPlayer.length();
    const isDeep = player.pos.y < -45;

    if (dist < 45 && isDeep) {
      af.huntTimer = Math.min(af.huntTimer + dt, 3.0);
    } else {
      af.huntTimer = Math.max(af.huntTimer - dt * 0.5, 0);
    }

    let chaseSpeed = af.speed * 0.4; // slow patrol by default
    if (af.huntTimer > 0.5 && isDeep) {
      chaseSpeed = af.speed * (0.5 + af.huntTimer * 0.4); // ramp up chase
    }

    if (dist > 0.001) {
      af.mesh.position.addScaledVector(toPlayer.normalize(), chaseSpeed * hostileSpeedMultiplier * dt);
      af.mesh.lookAt(player.pos);
    }

    // Contact damage
    if (dist < af.collisionRadius + player.radius) {
      if (af.hitCooldown <= 0) {
        takeDamage(af.damage * dt, 'an anglerfish');
        af.hitCooldown = 0.4;
        spawnRipple(af.mesh.position, af.lureColor || 0x00ffcc);
        // Push player away slightly
        const pushDir = player.pos.clone().sub(af.mesh.position).normalize();
        player.pos.addScaledVector(pushDir, dt * 3);
      } else {
        af.hitCooldown -= dt;
      }
      resolveSolidCollision(player.pos, af.mesh.position, af.collisionRadius + player.radius);
    }

    // Take damage when rammed by player
    if (dist < af.collisionRadius + player.radius && player.velocity.length() > 2.5) {
      const dmgMult = narwhalBuffUntil > performance.now() ? 1.5 : 1;
      const ram = player.velocity.length() * config.ramPower() * 0.16 * dmgMult;
      const sprintingCrit = player.sprinting && Math.random() < 0.5;
      const movingCrit = !player.sprinting && player.velocity.length() > 2.5 && Math.random() < 0.25;
      const crit = sprintingCrit || movingCrit;
      af.hp -= crit ? ram * 1.5 : ram;
      spawnDamageText(af.mesh.position, crit ? ram * 1.5 : ram, crit);
      if (crit) { screenShake.intensity = 0.4; screenShake.duration = 0.2; }
      spawnRipple(af.mesh.position, af.lureColor || 0x00ffcc);
      audio.eat.currentTime = 0;
      audio.eat.play().catch(() => {});
    }

    if (af.hp <= 0) {
      scene.remove(af.mesh);
      anglerfish.splice(i, 1);
      state.currency += 22;
      addXp(28);
      spawnRipple(af.mesh.position, af.lureColor || 0x00ffcc);
      showNotice('🐟 Anglerfish defeated! Deep sea champion! +28 XP');
      continue;
    }
  }
}

function makePearl() {
  const colors = [0xfff4e8, 0xffe8f4, 0xe8f4ff, 0xfff8e8, 0xf4ffe8];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 10, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.85, roughness: 0.05, metalness: 0.8 }));
  const r = 10 + Math.random() * 85; const a = Math.random() * Math.PI * 2;
  orb.position.set(Math.cos(a) * r, -83.2, Math.sin(a) * r);
  scene.add(orb);
  pearls.push({ mesh: orb, spin: (Math.random() - 0.5) * 2.0, bob: Math.random() * Math.PI * 2 });
}

function makePlanktonPatch() {
  const group = new THREE.Group();
  const colors = [0x44ffaa, 0x88ffaa, 0x44ddff, 0xccffee, 0x88ffcc];
  for (let i = 0; i < 28; i++) {
    const col = colors[Math.floor(Math.random() * colors.length)];
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.08, 4, 4),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45 }));
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 2.8;
    p.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 2.5, Math.sin(angle) * radius);
    p.userData.baseOpacity = 0.25 + Math.random() * 0.3;
    p.userData.phase = Math.random() * Math.PI * 2;
    group.add(p);
  }
  const r = 15 + Math.random() * 75; const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -52 + Math.random() * 38, Math.sin(a) * r);
  scene.add(group);
  planktonPatches.push({ mesh: group, bob: Math.random() * Math.PI * 2, phase: Math.random() * Math.PI * 2 });
}

function makeDepthZones() {
  const zoneDefs = [
    { y: -8,  color: 0x88ccff, opacity: 0.07, label: 'Surface Waters' },
    { y: -28, color: 0x2288cc, opacity: 0.09, label: 'Shallow Reef' },
    { y: -52, color: 0x1155aa, opacity: 0.11, label: 'Mid Twilight' },
    { y: -78, color: 0x0a2266, opacity: 0.13, label: 'Abyssal Deep' }
  ];
  for (const def of zoneDefs) {
    const zone = new THREE.Mesh(
      new THREE.CylinderGeometry(220, 220, 18, 28, 1, true),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: def.opacity, side: THREE.BackSide })
    );
    zone.position.y = def.y;
    scene.add(zone);
    depthZones.push(zone);
  }
}

function makeMotes() {
  const moteColors = [0xaaffcc, 0xffd4aa, 0xccddff, 0xddffaa, 0xffccff];
  for (let i = 0; i < 80; i++) {
    const color = moteColors[Math.floor(Math.random() * moteColors.length)];
    const mote = new THREE.Mesh(new THREE.SphereGeometry(0.07 + Math.random() * 0.09, 5, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    mote.position.set((Math.random() - 0.5) * worldRadius, -20 + Math.random() * 80, (Math.random() - 0.5) * worldRadius);
    mote.userData.phase = Math.random() * Math.PI * 2;
    mote.userData.speed = 0.5 + Math.random() * 0.9;
    mote.userData.baseY = mote.position.y;
    moteGroup.add(mote);
  }
}

function makeLoreTablet() {
  const group = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x8a9ba8, roughness: 0.95, metalness: 0.05 }));
  const glyphs = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x44ffcc, emissive: 0x22aa88, emissiveIntensity: 0.5 }));
  glyphs.position.z = 0.17;
  group.add(stone, glyphs);
  const r = 15 + Math.random() * 70;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -83.8, Math.sin(a) * r);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
  const text = loreTexts[Math.floor(Math.random() * loreTexts.length)];
  loreTablets.push({ mesh: group, text, read: false, bob: Math.random() * Math.PI * 2 });
}

// Animated kelp
for (let i = 0; i < 40; i++) {
  const color = [0x3d8b37, 0x4aaa42, 0x2d7a27, 0x5cbf4a][Math.floor(Math.random() * 4)];
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 2.5 + Math.random() * 3.5, 0.12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
  );
  const r = 6 + Math.random() * 92;
  const a = Math.random() * Math.PI * 2;
  blade.position.set(Math.cos(a) * r, -83.5 + blade.geometry.parameters.height / 2, Math.sin(a) * r);
  blade.userData.phase = Math.random() * Math.PI * 2;
  blade.userData.speed = 0.8 + Math.random() * 0.6;
  scene.add(blade);
  kelpBlades.push(blade);
}

for (let i = 0; i < 18; i++) makePickup();
for (let i = 0; i < 7; i++) makeJellyfish();
for (let i = 0; i < 5; i++) makeSeahorse();
for (let i = 0; i < 12; i++) makeGlowOrb();
for (let i = 0; i < 14; i++) makeAnemone();
for (let i = 0; i < 4; i++) makeLoreTablet();
for (let i = 0; i < 7; i++) makeCrab();
// starfish removed
for (let i = 0; i < 6; i++) makeCrystal();
for (let i = 0; i < 4; i++) makeKraken();
for (let i = 0; i < 10; i++) makePearl();
for (let i = 0; i < 8; i++) makePlanktonPatch();
makeDepthZones();
makeMotes();

function addXp(amount) {
  state.xp += amount;
  el.xpBurst.classList.remove('hidden');
  clearTimeout(addXp.burstTimer);
  addXp.burstTimer = setTimeout(() => el.xpBurst.classList.add('hidden'), 550);
  while (state.xp >= config.xpToNext()) {
    state.xp -= config.xpToNext();
    state.level += 1;
    state.currency += 15;
    el.levelUpFlash.classList.remove('hidden');
    clearTimeout(addXp.levelTimer);
    addXp.levelTimer = setTimeout(() => el.levelUpFlash.classList.add('hidden'), 1600);
    showNotice(`Level up! Now level ${state.level}`);
  }
}

function takeDamage(amount, cause = null) {
  if (cause) lastDamageCause = cause;
  state.health = Math.max(0, state.health - amount);
  if (state.health <= 0 && !isGameOver) {
    isGameOver = true;
    paused = true;
    pointerLocked = false;
    const captions = [
      `You got folded by ${lastDamageCause}. Skill issue, honestly.`,
      `${lastDamageCause} sent you to the horny jail of the deep.`,
      `Cause of death: ${lastDamageCause}. That pond spanked you stupid.`,
      `You got absolutely wrecked by ${lastDamageCause}. Respectfully pathetic.`,
      `${lastDamageCause} turned your little swim into an adults-only cautionary tale.`
    ];
    el.gameOverCaption.textContent = captions[Math.floor(Math.random() * captions.length)];
    audio.gameOver.currentTime = 0;
    audio.gameOver.play().catch(() => {});
    document.exitPointerLock();
    openOverlay('gameOverMenu');
  }
}

function buyUpgrade(key) {
  const meta = upgradesMeta.find(u => u.key === key);
  const level = state.upgrades[key];
  if (level >= 5) return;
  const cost = meta.cost(level);
  if (state.currency < cost) return showNotice('Not enough Silver');
  state.currency -= cost;
  state.upgrades[key] += 1;
  if (key === 'lungs') state.health = Math.min(config.maxHealth(), state.health + 20);
  showNotice(`${meta.name} upgraded`);
  persist();
  refreshAxolotlVisuals();
  renderUpgradeMenu();
}

function showNotice(text) {
  el.notice.textContent = text;
  el.notice.classList.add('show');
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => el.notice.classList.remove('show'), 1800);
}

function updateHUD() {
  if (audioUnlocked) {
    if (whale.visible && player.pos.distanceTo(whale.position) < 120) {
      if (audio.whale.paused) audio.whale.play().catch(() => {});
    } else {
      audio.whale.pause();
      audio.whale.currentTime = 0;
    }
  }
  const xpNeed = config.xpToNext();
  el.xpFill.style.width = `${(state.xp / xpNeed) * 100}%`;
  el.xpFill.classList.toggle('xp-bursting', !el.xpBurst.classList.contains('hidden'));
  el.xpLabel.textContent = `XP ${state.xp}/${xpNeed}  •  Level ${state.level}`;
  el.healthFill.style.width = `${(state.health / config.maxHealth()) * 100}%`;
  el.healthFill.classList.toggle('sprint-flash', !!player.sprinting);
  el.healthLabel.textContent = `Health ${Math.round(state.health)}/${config.maxHealth()}`;
  el.currency.textContent = state.currency;
  el.aliensBonked.textContent = state.stats.aliensBonked;
  if (!upgradeHintShown && state.currency >= 20) {
    showUpgradeHintPopup();
    return;
  }
  if (whale.visible && player.pos.distanceTo(whale.position) < 115 && performance.now() > whaleChatCooldownUntil && !paused) {
    paused = true;
    whaleChatCooldownUntil = performance.now() + 120000;
    openOverlay('whaleChatMenu');
  }
  if (narwhalBuffUntil > performance.now()) {
    showNotice('🦄 Narwhal buff active, +50% damage for 1 minute');
  }
}

function renderUpgradeMenu() {
  el.upLevel.textContent = state.level;
  el.upCurrency.textContent = state.currency;
  const xpNeed = config.xpToNext();
  el.upgradeXpFill.style.width = `${(state.xp / xpNeed) * 100}%`;
  el.upgradeXpLabel.textContent = `XP ${state.xp}/${xpNeed}`;
  el.upgradeList.innerHTML = '';
  for (const meta of upgradesMeta) {
    const lvl = state.upgrades[meta.key];
    const cost = meta.cost(lvl);
    const row = document.createElement('div');
    row.className = 'upgrade';
    row.innerHTML = `<div><strong>${meta.name}</strong><div class="small">${meta.desc} (Level ${lvl}/5)</div></div><div class="value">${lvl >= 5 ? 'MAX' : cost + ' Silver'}</div>`;
    const btn = document.createElement('button');
    btn.textContent = lvl >= 5 ? 'Maxed' : 'Upgrade';
    btn.disabled = lvl >= 5 || state.currency < cost;
    btn.onclick = () => buyUpgrade(meta.key);
    row.appendChild(btn);
    el.upgradeList.appendChild(row);
  }
}

function renderPatchNotes() {
  el.patchNotesList.innerHTML = '';
  for (const note of patchNotes) {
    const row = document.createElement('div');
    row.className = 'patch-note';
    row.textContent = note;
    el.patchNotesList.appendChild(row);
  }
}

function renderOptions() {
  el.graphicsValue.textContent = data.options.graphics;
  el.soundValue.textContent = `${data.options.sound}%`;
  el.musicValue.textContent = `${data.options.music}%`;
  el.soundSlider.value = data.options.sound;
  el.musicSlider.value = data.options.music;
  el.keybindList.innerHTML = '';
  const labels = { forward: 'Forward', backward: 'Backward', left: 'Left', right: 'Right', jump: 'Surface Jump', sprint: 'Sprint', upgrades: 'Upgrades', pause: 'Pause' };
  for (const [key, code] of Object.entries(data.options.keybinds)) {
    const row = document.createElement('div');
    row.className = 'keybind';
    const btn = document.createElement('button');
    btn.className = 'secondary keybtn';
    btn.textContent = code.replace('Key', '').replace('Digit', '');
    if (rebinding === key) btn.classList.add('listening');
    btn.onclick = () => { rebinding = key; renderOptions(); };
    row.innerHTML = `<span>${labels[key]}</span>`;
    row.appendChild(btn);
    el.keybindList.appendChild(row);
  }
}

function setGraphics(delta) {
  const order = ['low', 'medium', 'high'];
  const index = Math.max(0, Math.min(2, order.indexOf(data.options.graphics) + delta));
  data.options.graphics = order[index];
  renderer.setPixelRatio(Math.min(devicePixelRatio, data.options.graphics === 'low' ? 1 : data.options.graphics === 'medium' ? 1.5 : 2));
  persist();
  renderOptions();
}

function openOverlay(id) {
  for (const key of ['mainMenu', 'pauseMenu', 'optionsMenu', 'upgradeMenu', 'gameOverMenu', 'whaleChatMenu', 'patchNotesMenu', 'tutorialMenu', 'upgradeHintMenu', 'storyMenu']) el[key].classList.add('hidden');
  if (id) el[id].classList.remove('hidden');
  if (renderer?.domElement) renderer.domElement.style.opacity = (id === 'mainMenu' || id === 'storyMenu' || id === 'tutorialMenu') ? '0' : '1';
}

function startGame(continueGame = false) {
  if (!continueGame) resetState();
  else Object.assign(state, structuredClone(data.save));
  state.health = Math.min(config.maxHealth(), state.health || config.maxHealth());
  player.pos.set(0, -18, 0);
  player.verticalVelocity = 0;
  paused = false;
  isGameOver = false;
  gameStarted = true;
  openOverlay(null);
  unlockAudio();
  if (audioUnlocked) audio.underwater.play().catch(() => {});
  renderer.domElement.requestPointerLock();
  persist();
  refreshAxolotlVisuals();
  updateHUD();
  renderUpgradeMenu();
  continueAllowed = true;
  el.continueBtn.disabled = false;
}

function prepareNewGame() {
  resetState();
  state.health = Math.min(config.maxHealth(), state.health || config.maxHealth());
  player.pos.set(0, -18, 0);
  player.verticalVelocity = 0;
  paused = true;
  isGameOver = false;
  gameStarted = true;
  persist();
  refreshAxolotlVisuals();
  updateHUD();
  renderUpgradeMenu();
  continueAllowed = true;
  el.continueBtn.disabled = false;
}

function continueWhaleDialog() {
  paused = false;
  openOverlay(null);
  renderer.domElement.requestPointerLock();
}

function continueTutorial() {
  unlockAudio();
  audio.menu.currentTime = 0;
  audio.menu.play().catch(() => {});
  paused = false;
  openOverlay(null);
  renderer.domElement.requestPointerLock();
}

function continueUpgradeHint() {
  unlockAudio();
  audio.menu.currentTime = 0;
  audio.menu.play().catch(() => {});
  paused = false;
  openOverlay(null);
  renderer.domElement.requestPointerLock();
}

function showUpgradeHintPopup() {
  upgradeHintShown = true;
  paused = true;
  document.exitPointerLock();
  openOverlay('upgradeHintMenu');
}

function advanceStory() {
  storyIndex++;
  if (storyIndex >= storyParagraphs.length) {
    storyIndex = 0;
    openOverlay('tutorialMenu');
  } else {
    el.storyText.textContent = storyParagraphs[storyIndex];
  }
}

function quitToTitle() {
  paused = true;
  for (const sound of Object.values(audio)) {
    sound.pause();
    sound.currentTime = 0;
  }
  document.exitPointerLock();
  openOverlay('mainMenu');
  persist();
}

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (!pointerLocked && gameStarted && !paused) {
    paused = true;
    openOverlay('pauseMenu');
  }
});

document.addEventListener('mousemove', e => {
  if (!pointerLocked || paused) return;
  player.yaw -= e.movementX * 0.0028;
  player.pitch -= e.movementY * 0.0036;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
});

document.addEventListener('keydown', e => {
  if (rebinding) {
    data.options.keybinds[rebinding] = e.code;
    rebinding = null;
    persist();
    renderOptions();
    return;
  }
  if (!el.whaleChatMenu.classList.contains('hidden') && e.code === 'Space') {
    e.preventDefault();
    continueWhaleDialog();
    return;
  }
  if (!el.storyMenu.classList.contains('hidden') && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    return;
  }
  if (!el.tutorialMenu.classList.contains('hidden') && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    continueTutorial();
    return;
  }
  if (!el.upgradeHintMenu.classList.contains('hidden') && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    continueUpgradeHint();
    return;
  }
  keys.add(e.code);
  if (e.code === data.options.keybinds.pause && gameStarted) {
    paused = !paused;
    if (paused) {
      document.exitPointerLock();
      openOverlay('pauseMenu');
    } else {
      openOverlay(null);
      renderer.domElement.requestPointerLock();
    }
  }
  if ((e.code === data.options.keybinds.upgrades || e.code === 'KeyC') && gameStarted) {
    paused = true;
    document.exitPointerLock();
    renderUpgradeMenu();
    openOverlay('upgradeMenu');
  }
});

document.addEventListener('keyup', e => {
  keys.delete(e.code);
  if (!el.storyMenu.classList.contains('hidden') && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) {
    advanceStory();
    return;
  }
  if (!el.tutorialMenu.classList.contains('hidden') && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) {
    continueTutorial();
    return;
  }
  if (!el.upgradeHintMenu.classList.contains('hidden') && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) {
    continueUpgradeHint();
  }
});
renderer.domElement.addEventListener('click', () => {
  unlockAudio();
  if (gameStarted && !pointerLocked && !paused) renderer.domElement.requestPointerLock();
});

el.newGameBtn.onclick = () => { unlockAudio(); audio.menu.currentTime = 0; audio.menu.play().catch(() => {}); prepareNewGame(); storyIndex = 0; el.storyText.textContent = storyParagraphs[0]; openOverlay('storyMenu'); };
el.continueBtn.onclick = () => { unlockAudio(); audio.menu.currentTime = 0; audio.menu.play().catch(() => {}); continueAllowed && startGame(true); };
el.continueBtn.disabled = !continueAllowed;
el.optionsBtn.onclick = () => { unlockAudio(); audio.menu.currentTime = 0; audio.menu.play().catch(() => {}); renderOptions(); openOverlay('optionsMenu'); };
el.pauseOptionsBtn.onclick = () => { unlockAudio(); audio.menu.currentTime = 0; audio.menu.play().catch(() => {}); renderOptions(); openOverlay('optionsMenu'); };
el.patchNotesBtn.onclick = () => { unlockAudio(); audio.menu.currentTime = 0; audio.menu.play().catch(() => {}); renderPatchNotes(); openOverlay('patchNotesMenu'); };
el.closePatchNotesBtn.onclick = () => { unlockAudio(); audio.menu.currentTime = 0; audio.menu.play().catch(() => {}); openOverlay('mainMenu'); };
el.closeOptionsBtn.onclick = () => { unlockAudio(); audio.menu.currentTime = 0; audio.menu.play().catch(() => {}); openOverlay(gameStarted && paused && !isGameOver ? 'pauseMenu' : 'mainMenu'); };
el.resumeBtn.onclick = () => { unlockAudio(); paused = false; openOverlay(null); renderer.domElement.requestPointerLock(); };
el.charBtn.onclick = () => { renderUpgradeMenu(); openOverlay('upgradeMenu'); };
el.closeUpgradeBtn.onclick = () => openOverlay('pauseMenu');
el.quitBtn.onclick = quitToTitle;
el.retryBtn.onclick = () => { unlockAudio(); startGame(false); };
el.gameOverTitleBtn.onclick = quitToTitle;
el.graphicsDown.onclick = () => setGraphics(-1);
el.graphicsUp.onclick = () => setGraphics(1);
el.soundSlider.oninput = e => { data.options.sound = Number(e.target.value); persist(); renderOptions(); };
el.musicSlider.oninput = e => { data.options.music = Number(e.target.value); persist(); renderOptions(); };

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function updatePlayer(dt) {
  const moveInput = new THREE.Vector2(
    (keys.has(data.options.keybinds.right) ? 1 : 0) - (keys.has(data.options.keybinds.left) ? 1 : 0),
    (keys.has(data.options.keybinds.forward) ? 1 : 0) - (keys.has(data.options.keybinds.backward) ? 1 : 0)
  );
  const jumpPressed = keys.has(data.options.keybinds.jump);
  const sprintPressed = keys.has(data.options.keybinds.sprint);

  const flatForward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-flatForward.z, 0, flatForward.x);
  const flatDir = new THREE.Vector3();
  if (moveInput.lengthSq() > 0) {
    moveInput.normalize();
    flatDir.addScaledVector(right, moveInput.x);
    flatDir.addScaledVector(flatForward, moveInput.y);
    flatDir.normalize();
  }

  const lookVertical = Math.sin(player.pitch);
  const verticalIntent = moveInput.y !== 0 ? Math.sign(moveInput.y) * Math.sign(lookVertical) * Math.pow(Math.abs(lookVertical), 0.7) : 0;
  const desiredVelocity = new THREE.Vector3(flatDir.x, 0, flatDir.z);
  const isMoving = moveInput.lengthSq() > 0;
  player.sprinting = sprintPressed && isMoving;
  if (!paused && gameStarted) {
    updateHUD();
  }
  const holdingForward = moveInput.y > 0.05;
  if (holdingForward) player.forwardBoost = Math.min(config.maxBoostMultiplier(), player.forwardBoost + dt * 0.75);
  else player.forwardBoost = Math.max(1, player.forwardBoost - dt * 1.6);

  const sprintMultiplier = (sprintPressed ? 1.9 : (keys.has('Mouse0') ? 1.45 : 1)) * player.forwardBoost;
  if (desiredVelocity.lengthSq() > 0) desiredVelocity.normalize().multiplyScalar(config.moveSpeed() * sprintMultiplier);
  player.velocity.x = THREE.MathUtils.lerp(player.velocity.x, desiredVelocity.x, Math.min(0.22, dt * config.accel()));
  player.velocity.z = THREE.MathUtils.lerp(player.velocity.z, desiredVelocity.z, Math.min(0.22, dt * config.accel()));
  if (!desiredVelocity.lengthSq()) {
    player.velocity.x *= Math.max(0.9, 1 - dt * 2.6);
    player.velocity.z *= Math.max(0.9, 1 - dt * 2.6);
  }

  player.verticalVelocity = verticalIntent * config.moveSpeed() * Math.min(3.1, player.forwardBoost * 1.25);

  player.pos.x += player.velocity.x * dt;
  player.pos.z += player.velocity.z * dt;
  player.pos.y += player.verticalVelocity * dt;

  for (const coralPiece of coral) {
    resolveSolidCollision(player.pos, coralPiece.position, Math.max(2.2, coralPiece.scale.x * 2.2));
  }
  for (const shell of shells) {
    resolveSolidCollision(player.pos, shell.position, 0.8);
  }
  for (const octo of octopi) {
    resolveSolidCollision(player.pos, octo.mesh.position, 1.8);
  }
  for (const narwhal of narwhals) {
    resolveSolidCollision(player.pos, narwhal.mesh.position, narwhal.collisionRadius + player.radius * 0.3);
  }

  // Endless forward travel: keep player in continuous world space while scenery recycles around them.
  if (player.pos.y < -82) {
    player.pos.y = -82;
    player.verticalVelocity = Math.max(0, player.verticalVelocity);
  }
  if (player.pos.y > -2.5) {
    player.pos.y = -2.5;
    player.verticalVelocity = Math.min(0, player.verticalVelocity);
  }
  if (audioUnlocked) {
    if (!paused && audio.underwater.paused) audio.underwater.play().catch(() => {});
    if (sprintPressed && desiredVelocity.lengthSq() > 0) {
      if (audio.whoosh.paused) audio.whoosh.play().catch(() => {});
    } else {
      audio.whoosh.pause();
      audio.whoosh.currentTime = 0;
    }
    if (performance.now() - lastScubaAt > 20000) {
      lastScubaAt = performance.now();
      audio.scuba.currentTime = 0;
      audio.scuba.play().catch(() => {});
    }
  }
  if (sprintPressed && desiredVelocity.lengthSq() > 0) {
    takeDamage(dt * config.sprintDrain(), 'sprinting too hard like a maniac');
  }

  axolotl.position.copy(player.pos);
  if (player.velocity.lengthSq() > 0.001) {
    axolotl.rotation.y = Math.atan2(-player.velocity.x, -player.velocity.z) + Math.PI / 2;
  } else {
    axolotl.rotation.y = player.yaw + Math.PI / 2;
  }
  const swimSpeed = Math.min(3.2, 0.6 + player.velocity.length() * 0.25);
  const swimPhase = performance.now() * 0.006 * swimSpeed;
  axolotl.rotation.x = player.pitch * 0.28;
  axolotl.rotation.z = Math.sin(swimPhase) * 0.05;
  axBody.position.y = Math.sin(swimPhase * 0.7) * 0.08;
  axHead.position.y = 0.06 + Math.sin(swimPhase * 0.7 + 0.4) * 0.05;
  axTail.rotation.y = Math.sin(swimPhase * 1.3) * 0.55;
  axTailTip.rotation.y = Math.sin(swimPhase * 1.8) * 0.7;
  axLegFL.rotation.z = 0.18 + Math.sin(swimPhase * 1.4) * 0.18;
  axLegFR.rotation.z = -0.18 - Math.sin(swimPhase * 1.4) * 0.18;
  axLegBL.rotation.z = 0.1 - Math.sin(swimPhase * 1.4) * 0.14;
  axLegBR.rotation.z = -0.1 + Math.sin(swimPhase * 1.4) * 0.14;

  if (screenShake.duration > 0) {
    screenShake.duration -= dt;
    const amt = screenShake.intensity * Math.max(0, screenShake.duration / 0.22);
    screenShake.offsetX = (Math.random() - 0.5) * amt;
    screenShake.offsetY = (Math.random() - 0.5) * amt;
  } else {
    screenShake.offsetX = 0;
    screenShake.offsetY = 0;
  }

  cameraOffset.set(Math.sin(player.yaw) * 7.4, 2.8 - Math.sin(player.pitch) * 1.2, Math.cos(player.yaw) * 7.4);
  cameraTarget.copy(player.pos).add(new THREE.Vector3(0, 0.7, 0));
  scene.fog.color.set(player.pos.y > -10 ? 0x5cbcff : 0x0b5ea8);
  const desiredCameraPos = cameraTarget.clone().add(cameraOffset).add(new THREE.Vector3(screenShake.offsetX, screenShake.offsetY, 0));
  camera.position.lerp(desiredCameraPos, 0.22);
  const lookTarget = cameraTarget.clone().add(new THREE.Vector3(-Math.sin(player.yaw) * 8, Math.sin(player.pitch) * 8, -Math.cos(player.yaw) * 8));
  camera.lookAt(lookTarget);
  renderer.setClearColor(player.pos.y > -10 ? 0x7ed0ff : 0x1676d2);

  // Depth indicator update
  const depthY = Math.max(-85, Math.min(0, player.pos.y));
  const depthPercent = Math.min(100, Math.max(0, (-depthY / 85) * 100));
  el.depthFill.style.height = `${depthPercent}%`;
  const zoneNames = ['Surface', 'Shallow', 'Midwater', 'Deep', 'Abyssal'];
  const zoneIndex = Math.min(4, Math.floor(depthPercent / 20));
  el.depthZoneName.textContent = zoneNames[zoneIndex];
  el.depthIndicator.style.borderColor = depthPercent > 70 ? 'rgba(160,60,220,0.5)' : depthPercent > 40 ? 'rgba(60,120,200,0.4)' : 'rgba(100,200,255,0.3)';

  water.position.x = player.pos.x;
  water.position.z = player.pos.z;
  floor.position.x = player.pos.x;
  floor.position.z = player.pos.z;
  for (const reed of reeds) {
    if (reed.position.x - player.pos.x > worldRadius) reed.position.x -= worldRadius * 2;
    if (reed.position.x - player.pos.x < -worldRadius) reed.position.x += worldRadius * 2;
    if (reed.position.z - player.pos.z > worldRadius) reed.position.z -= worldRadius * 2;
    if (reed.position.z - player.pos.z < -worldRadius) reed.position.z += worldRadius * 2;
  }
  for (const coralPiece of coral) {
    if (coralPiece.position.x - player.pos.x > worldRadius) coralPiece.position.x -= worldRadius * 2;
    if (coralPiece.position.x - player.pos.x < -worldRadius) coralPiece.position.x += worldRadius * 2;
    if (coralPiece.position.z - player.pos.z > worldRadius) coralPiece.position.z -= worldRadius * 2;
    if (coralPiece.position.z - player.pos.z < -worldRadius) coralPiece.position.z += worldRadius * 2;
  }
  for (const shell of shells) {
    if (shell.position.x - player.pos.x > worldRadius) shell.position.x -= worldRadius * 2;
    if (shell.position.x - player.pos.x < -worldRadius) shell.position.x += worldRadius * 2;
    if (shell.position.z - player.pos.z > worldRadius) shell.position.z -= worldRadius * 2;
    if (shell.position.z - player.pos.z < -worldRadius) shell.position.z += worldRadius * 2;
  }
}

document.addEventListener('mousedown', e => { if (e.button === 0) keys.add('Mouse0'); });
document.addEventListener('mouseup', e => { if (e.button === 0) keys.delete('Mouse0'); });

function updateAliens(dt, now) {
  alienSpawnTimer += dt;
  const elapsed = (performance.now() - roundStartedAt) / 1000;
  let targetAliens = 0;
  if (elapsed >= 30 && elapsed < 60) targetAliens = 1;
  else if (elapsed >= 60 && elapsed < 120) targetAliens = 2;
  else if (elapsed >= 120 && elapsed < 180) targetAliens = 3;
  else if (elapsed >= 180) targetAliens = 4;
  if (alienSpawnTimer > 7.5 && aliens.length < targetAliens) { alienSpawnTimer = 0; makeAlien(); }
  for (const alien of aliens) {
    if (alien.mesh.position.x - player.pos.x > worldRadius) alien.mesh.position.x -= worldRadius * 2;
    if (alien.mesh.position.x - player.pos.x < -worldRadius) alien.mesh.position.x += worldRadius * 2;
    if (alien.mesh.position.z - player.pos.z > worldRadius) alien.mesh.position.z -= worldRadius * 2;
    if (alien.mesh.position.z - player.pos.z < -worldRadius) alien.mesh.position.z += worldRadius * 2;
    if (alien.mesh.position.y - player.pos.y > 45) alien.mesh.position.y -= 90;
    if (alien.mesh.position.y - player.pos.y < -45) alien.mesh.position.y += 90;
  }
  for (let i = aliens.length - 1; i >= 0; i--) {
    const alien = aliens[i];
    const toPlayer = player.pos.clone().sub(alien.mesh.position);
    const dist = toPlayer.length();
    if (dist > 0.001) alien.mesh.position.addScaledVector(toPlayer.normalize(), alien.speed * hostileSpeedMultiplier * dt);
    alien.bob += dt * (1.2 + alien.scale * 0.2);
    alien.mesh.position.y += Math.sin(alien.bob) * 0.01 * alien.scale;
    alien.mesh.lookAt(player.pos);

    if (dist < (alien.collisionRadius + player.radius)) {
      let killed = false;
      if (!alien.hitCooldown || now - alien.hitCooldown > 120) {
        const damageMultiplier = narwhalBuffUntil > performance.now() ? 1.5 : 1;
        const ram = player.velocity.length() * config.ramPower() * 0.18 * damageMultiplier;
        const sprintingCrit = player.sprinting && Math.random() < 0.5;
        const movingCrit = !player.sprinting && player.velocity.length() > 0.8 && Math.random() < 0.25;
        const crit = sprintingCrit || movingCrit;
        const dealt = crit ? ram * 1.5 : ram;
        alien.hp -= dealt;
        killed = alien.hp <= 0;
        audio.eat.currentTime = 0;
        audio.eat.play().catch(() => {});
        spawnDamageText(alien.mesh.position, dealt, crit);
        alien.hitCooldown = now;
        if (ram > 1.5) {
          spawnRipple(alien.mesh.position, crit ? 0xff4444 : 0xffe08a);
          if (crit) { screenShake.intensity = 0.45; screenShake.duration = 0.22; }
          else if (ram > 4) { screenShake.intensity = 0.22; screenShake.duration = 0.18; }
        }
      }
      if (!killed) {
        resolveSolidCollision(player.pos, alien.mesh.position, alien.collisionRadius + player.radius);
      }
      takeDamage(alien.damage * dt + 5 * (1 - Math.min(1, player.velocity.length() / (4 + state.upgrades.head))) * dt, `${alien.type || 'some weird'} alien nonsense`);
      if (alien.hp <= 0) {
        scene.remove(alien.mesh);
        aliens.splice(i, 1);
        state.currency += 8 + Math.floor(Math.random() * 5);
        state.stats.aliensBonked += 1;
        addXp(12);
        spawnRipple(alien.mesh.position, 0x9aff9a);
      }
    }
  }
}

function updatePickups(dt) {
  pickupSpawnTimer += dt;
  if (pickupSpawnTimer > 2.4 && pickups.length < 24) { pickupSpawnTimer = 0; makePickup(); }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (p.mesh.position.x - player.pos.x > worldRadius) p.mesh.position.x -= worldRadius * 2;
    if (p.mesh.position.x - player.pos.x < -worldRadius) p.mesh.position.x += worldRadius * 2;
    if (p.mesh.position.z - player.pos.z > worldRadius) p.mesh.position.z -= worldRadius * 2;
    if (p.mesh.position.z - player.pos.z < -worldRadius) p.mesh.position.z += worldRadius * 2;
    if (p.mesh.position.y - player.pos.y > 45) p.mesh.position.y -= 90;
    if (p.mesh.position.y - player.pos.y < -45) p.mesh.position.y += 90;
    p.mesh.rotation.y += dt * p.spin;
    p.mesh.position.y += Math.sin(performance.now() * 0.002 + i) * 0.01;
    const dist = p.mesh.position.distanceTo(player.pos);
    if (dist < (config.pickupRadius() + p.collisionRadius * 0.5)) {
      scene.remove(p.mesh);
      pickups.splice(i, 1);
      if (p.kind === 'steak') {
        state.stats.steakEaten += 1;
        addXp(20);
        state.currency += 10;
        state.health = Math.min(config.maxHealth(), state.health + 10);
        showNotice('Rare steak! Big XP boost');
      } else if (p.kind === 'fish') {
        addXp(10);
        state.currency += 4;
        state.health = Math.min(config.maxHealth(), state.health + 4);
        showNotice('You snapped up a fish');
      } else {
        state.stats.wormsEaten += 1;
        addXp(6);
        state.currency += 2;
      }
      spawnRipple(player.pos, p.kind === 'steak' ? 0xff7f7f : 0xffd27d);
    }
  }
}

function updateNarwhals(dt) {
}

function updateLeviathans(dt, now) {
  leviathanSpawnTimer += dt;
  const elapsed = (performance.now() - roundStartedAt) / 1000;
  if (state.level >= 7 && elapsed >= 210 && leviathans.length < 1 && leviathanSpawnTimer > 45) {
    leviathanSpawnTimer = 0;
    makeLeviathan();
  }
  let nearLeviathan = false;
  for (let i = leviathans.length - 1; i >= 0; i--) {
    const leviathan = leviathans[i];
    if (leviathan.mesh.position.x - player.pos.x > worldRadius) leviathan.mesh.position.x -= worldRadius * 2;
    if (leviathan.mesh.position.x - player.pos.x < -worldRadius) leviathan.mesh.position.x += worldRadius * 2;
    if (leviathan.mesh.position.z - player.pos.z > worldRadius) leviathan.mesh.position.z -= worldRadius * 2;
    if (leviathan.mesh.position.z - player.pos.z < -worldRadius) leviathan.mesh.position.z += worldRadius * 2;
    const toPlayer = player.pos.clone().sub(leviathan.mesh.position);
    const dist = toPlayer.length();
    if (dist < 40) nearLeviathan = true;
    if (dist > 0.001) leviathan.mesh.position.addScaledVector(toPlayer.normalize(), leviathan.speed * hostileSpeedMultiplier * dt);
    leviathan.mesh.lookAt(player.pos);
  }
  if (nearLeviathan) {
    if (audio.bigShark.paused) audio.bigShark.play().catch(() => {});
  } else {
    audio.bigShark.pause();
    audio.bigShark.currentTime = 0;
  }
}

function updateSharks(dt, now) {
  sharkSpawnTimer += dt;
  const elapsed = (performance.now() - roundStartedAt) / 1000;
  if (state.level >= 3 && elapsed >= 90 && sharks.length < 1 && sharkSpawnTimer > 20) {
    sharkSpawnTimer = 0;
    makeShark();
  }
  for (let i = sharks.length - 1; i >= 0; i--) {
    const shark = sharks[i];
    if (shark.mesh.position.x - player.pos.x > worldRadius) shark.mesh.position.x -= worldRadius * 2;
    if (shark.mesh.position.x - player.pos.x < -worldRadius) shark.mesh.position.x += worldRadius * 2;
    if (shark.mesh.position.z - player.pos.z > worldRadius) shark.mesh.position.z -= worldRadius * 2;
    if (shark.mesh.position.z - player.pos.z < -worldRadius) shark.mesh.position.z += worldRadius * 2;
    if (shark.mesh.position.y - player.pos.y > 45) shark.mesh.position.y -= 90;
    if (shark.mesh.position.y - player.pos.y < -45) shark.mesh.position.y += 90;
    const toPlayer = player.pos.clone().sub(shark.mesh.position);
    const dist = toPlayer.length();
    if (dist > 0.001) shark.mesh.position.addScaledVector(toPlayer.normalize(), shark.speed * hostileSpeedMultiplier * dt);
    shark.bob += dt * 2.8;
    shark.mesh.position.y += Math.sin(shark.bob) * 0.02;
    shark.mesh.lookAt(player.pos);
    shark.mesh.rotation.y -= Math.PI / 2;
    if (dist < (shark.collisionRadius + player.radius)) {
      let killed = false;
      if (!shark.hitCooldown || now - shark.hitCooldown > 120) {
        const damageMultiplier = narwhalBuffUntil > performance.now() ? 1.5 : 1;
        const ram = player.velocity.length() * config.ramPower() * 0.16 * damageMultiplier;
        const sprintingCrit = player.sprinting && Math.random() < 0.5;
        const movingCrit = !player.sprinting && player.velocity.length() > 0.8 && Math.random() < 0.25;
        const crit = sprintingCrit || movingCrit;
        const dealt = crit ? ram * 1.5 : ram;
        shark.hp -= dealt;
        killed = shark.hp <= 0;
        audio.eat.currentTime = 0;
        audio.eat.play().catch(() => {});
        spawnDamageText(shark.mesh.position, dealt, crit);
        shark.hitCooldown = now;
        spawnRipple(shark.mesh.position, crit ? 0xff4444 : 0xff8888);
        if (crit) { screenShake.intensity = 0.5; screenShake.duration = 0.25; }
        else if (ram > 4) { screenShake.intensity = 0.28; screenShake.duration = 0.2; }
      }
      if (!killed) {
        resolveSolidCollision(player.pos, shark.mesh.position, shark.collisionRadius + player.radius);
      }
      takeDamage(shark.damage * dt, 'a shark');
      if (shark.hp <= 0) {
        scene.remove(shark.mesh);
        sharks.splice(i, 1);
        state.currency += 18;
        addXp(22);
        continue;
      }
    }
  }
}

function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const text = floatingTexts[i];
    text.life -= dt;
    text.rise += dt * 55;
    text.el.style.left = `${text.hudX}px`;
    text.el.style.top = `${text.hudY - text.rise}px`;
    text.el.style.opacity = `${Math.max(0, Math.min(1, text.life * 1.4))}`;
    if (text.life <= 0) {
      text.el.remove();
      floatingTexts.splice(i, 1);
    }
  }
}

function updateRipples(dt) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.life -= dt;
    r.mesh.scale.addScalar(dt * 2.5);
    r.mesh.material.opacity = Math.max(0, r.life);
    if (r.life <= 0) {
      scene.remove(r.mesh);
      ripples.splice(i, 1);
    }
  }
}

function updateCreatureInteractions(now) {
  // Jellyfish — headbutt them for XP + currency
  for (let i = jellyfish.length - 1; i >= 0; i--) {
    const jf = jellyfish[i];
    const dist = jf.mesh.position.distanceTo(player.pos);
    if (dist < 2.2 && player.velocity.length() > 1.5) {
      const dmg = player.velocity.length() * config.ramPower() * 0.12;
      if (dmg > 2) {
        scene.remove(jf.mesh);
        jellyfish.splice(i, 1);
        state.currency += 3 + Math.floor(Math.random() * 3);
        addXp(8);
        spawnRipple(jf.mesh.position, jf.color || 0xff88cc);
        showNotice('💙 Jellyfish bonked! Shimmering XP');
        audio.eat.currentTime = 0;
        audio.eat.play().catch(() => {});
      }
    }
  }
  // Seahorses — headbutt to collect, then they respawn elsewhere
  for (let i = seahorses.length - 1; i >= 0; i--) {
    const sh = seahorses[i];
    const dist = sh.mesh.position.distanceTo(player.pos);
    if (dist < 2.0 && player.velocity.length() > 1.2) {
      scene.remove(sh.mesh);
      seahorses.splice(i, 1);
      state.currency += 2;
      addXp(5);
      spawnRipple(sh.mesh.position, 0xffd700);
      showNotice('🐴 Seahorse startled! +5 XP');
      setTimeout(() => { if (gameStarted) makeSeahorse(); }, 3000);
    }
  }
  // Glow Orbs — swim through to collect (no headbutt needed, just proximity when moving fast)
  for (let i = glowOrbs.length - 1; i >= 0; i--) {
    const orb = glowOrbs[i];
    const dist = orb.mesh.position.distanceTo(player.pos);
    if (dist < 2.5) {
      scene.remove(orb.mesh);
      glowOrbs.splice(i, 1);
      state.currency += 5;
      addXp(15);
      spawnRipple(orb.mesh.position, orb.color || 0x44ffaa);
      showNotice('✨ Bioluminescent orb absorbed! +15 XP');
      setTimeout(() => { if (gameStarted && glowOrbs.length < 16) makeGlowOrb(); }, 5000);
    }
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  stars.rotation.y += dt * 0.03;
  lightRays.rotation.y += dt * 0.04;
  whaleSwimAngle += dt * 0.08;
  whale.position.x = 180 + Math.cos(whaleSwimAngle) * 90;
  whale.position.z = -100 + Math.sin(whaleSwimAngle) * 70;
  whale.position.y = -65 + Math.sin(whaleSwimAngle * 1.7) * 6;
  whale.lookAt(180 + Math.cos(whaleSwimAngle + 0.2) * 90, whale.position.y, -100 + Math.sin(whaleSwimAngle + 0.2) * 70);
  if (!paused && gameStarted) {
    updatePlayer(dt);
    updateAliens(dt, now);
    updateNarwhals(dt);
    updateLeviathans(dt, now);
    updateAnglerfish(dt, now);
    updateSharks(dt, now);
    updatePickups(dt);
    for (const octo of octopi) {
      octo.bob += dt * 1.5;
      octo.mesh.position.y = -82 + Math.sin(octo.bob) * 0.5;
    }
    updateJellyfish(dt);
    updateSeahorses(dt);
    updateGlowOrbs(dt, now);
    updateAnemones(dt);
    updateLoreTablets(dt);
    updateBubbles(dt);
    updateKelp(dt);
    updateFloatingTexts(dt);
    updateRipples(dt);
    updateCreatureInteractions(now);
    updateSeabedCreatures(dt, now);
    persist();
    updateHUD();
  }
  renderer.render(scene, camera);
  if (!el.mainMenu.classList.contains('hidden')) {
    menuPreviewAxolotl.rotation.y += dt * 0.9;
    menuPreviewRenderer.render(menuPreviewScene, menuPreviewCamera);
  }
}

function updateJellyfish(dt) {
  for (const jf of jellyfish) {
    jf.bob += dt * 1.1;
    jf.phase += dt * 0.6;
    jf.mesh.position.y += Math.sin(jf.bob) * 0.018;
    jf.mesh.position.x += Math.sin(jf.phase) * 0.006;
    jf.mesh.position.z += Math.cos(jf.phase * 0.7) * 0.006;
    // Pulse the bell
    const bell = jf.mesh.children[0];
    if (bell) bell.scale.y = 0.9 + Math.sin(jf.bob * 2) * 0.12;
    // Recycle
    const dx = jf.mesh.position.x - player.pos.x;
    const dz = jf.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius || Math.abs(dz) > worldRadius) {
      jf.mesh.position.x = player.pos.x + (Math.random() - 0.5) * worldRadius * 1.6;
      jf.mesh.position.z = player.pos.z + (Math.random() - 0.5) * worldRadius * 1.6;
    }
  }
}

function updateSeahorses(dt) {
  for (const sh of seahorses) {
    sh.bob += dt * 1.4;
    sh.mesh.position.y += Math.sin(sh.bob) * 0.015;
    sh.wanderAngle += dt * 0.4;
    sh.mesh.position.x += Math.cos(sh.wanderAngle) * sh.speed * dt;
    sh.mesh.position.z += Math.sin(sh.wanderAngle) * sh.speed * dt;
    sh.mesh.rotation.y = sh.wanderAngle + Math.PI / 2;
    const dx = sh.mesh.position.x - player.pos.x;
    const dz = sh.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius || Math.abs(dz) > worldRadius) {
      sh.wanderAngle = Math.random() * Math.PI * 2;
      sh.mesh.position.x = player.pos.x + (Math.random() - 0.5) * worldRadius * 1.4;
      sh.mesh.position.z = player.pos.z + (Math.random() - 0.5) * worldRadius * 1.4;
    }
  }
}

function updateGlowOrbs(dt, now) {
  for (const orb of glowOrbs) {
    orb.bob += dt * 2.2;
    orb.phase += dt * 0.8;
    orb.mesh.position.y += Math.sin(orb.bob) * 0.012;
    const intensity = 0.8 + Math.sin(orb.phase * 3 + now * 0.001) * 0.4;
    orb.mesh.children[0].material.emissiveIntensity = intensity;
    orb.mesh.children[1].material.opacity = 0.08 + Math.sin(orb.phase * 2) * 0.07;
    const dx = orb.mesh.position.x - player.pos.x;
    const dz = orb.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius || Math.abs(dz) > worldRadius) {
      orb.mesh.position.x = player.pos.x + (Math.random() - 0.5) * worldRadius * 1.6;
      orb.mesh.position.z = player.pos.z + (Math.random() - 0.5) * worldRadius * 1.6;
    }
  }
}

function updateAnemones(dt) {
  for (const anem of anemones) {
    anem.bob += dt * 1.6;
    for (const tentacle of anem.tentacles) {
      tentacle.rotation.z = (Math.random() - 0.5) * 0.6 + Math.sin(anem.bob + tentacle.position.x) * 0.3;
    }
    const dx = anem.mesh.position.x - player.pos.x;
    const dz = anem.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius || Math.abs(dz) > worldRadius) {
      const r = 8 + Math.random() * 90;
      const a = Math.random() * Math.PI * 2;
      anem.mesh.position.x = player.pos.x + Math.cos(a) * r;
      anem.mesh.position.z = player.pos.z + Math.sin(a) * r;
    }
  }
}

function updateLoreTablets(dt) {
  for (const tablet of loreTablets) {
    tablet.bob += dt * 0.8;
    tablet.mesh.position.y = -83.8 + Math.sin(tablet.bob) * 0.08;
    const dist = tablet.mesh.position.distanceTo(player.pos);
    if (dist < 5 && !tablet.read) {
      tablet.read = true;
      showNotice(`📜 "${tablet.text}"`);
    }
    if (dist > 14 && tablet.read) tablet.read = false;
    const dx = tablet.mesh.position.x - player.pos.x;
    const dz = tablet.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius || Math.abs(dz) > worldRadius) {
      const r = 15 + Math.random() * 70;
      const a = Math.random() * Math.PI * 2;
      tablet.mesh.position.x = player.pos.x + Math.cos(a) * r;
      tablet.mesh.position.z = player.pos.z + Math.sin(a) * r;
      tablet.read = false;
    }
  }
}

function updateBubbles(dt) {
  // Spawn bubbles from axolotl
  if (Math.random() < 0.18) {
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 + Math.random() * 0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.55 })
    );
    b.position.copy(axolotl.position).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.5, (Math.random() - 0.5) * 0.8));
    scene.add(b);
    bubbles.push({ mesh: b, life: 2.2 + Math.random() * 1.2, speed: 1.2 + Math.random() * 0.8 });
  }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.life -= dt;
    b.mesh.position.y += b.speed * dt;
    b.mesh.material.opacity = Math.max(0, b.life * 0.3);
    if (b.life <= 0) { scene.remove(b.mesh); bubbles.splice(i, 1); }
  }
}

function updateKelp(dt) {
  const t = performance.now() * 0.001;
  for (const blade of kelpBlades) {
    blade.rotation.z = Math.sin(t * blade.userData.speed + blade.userData.phase) * 0.25;
    blade.rotation.x = Math.sin(t * blade.userData.speed * 0.7 + blade.userData.phase) * 0.08;
    const dx = blade.position.x - player.pos.x;
    const dz = blade.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius || Math.abs(dz) > worldRadius) {
      const r = 6 + Math.random() * 92;
      const a = Math.random() * Math.PI * 2;
      blade.position.x = player.pos.x + Math.cos(a) * r;
      blade.position.z = player.pos.z + Math.sin(a) * r;
    }
  }
}

updateHUD();
renderPatchNotes();
renderOptions();
renderUpgradeMenu();
animate(performance.now());

// ── Seabed creature interactions ──
function updateSeabedCreatures(dt, now) {
  // Sea urchins — spike damage on contact, like touching coral
  for (const urchin of urchins) {
    urchin.bob += dt * 1.3;
    urchin.mesh.position.y = -83.5 + Math.sin(urchin.bob) * 0.05;
    urchin.mesh.rotation.y += dt * 0.4;
    const dx = urchin.mesh.position.x - player.pos.x;
    const dz = urchin.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius) urchin.mesh.position.x = player.pos.x + (Math.random() - 0.5) * worldRadius * 1.8;
    if (Math.abs(dz) > worldRadius) urchin.mesh.position.z = player.pos.z + (Math.random() - 0.5) * worldRadius * 1.8;
    if (urchin.hitCooldown > 0) urchin.hitCooldown -= dt;
    const dist = urchin.mesh.position.distanceTo(player.pos);
    if (dist < 1.8 + player.radius) {
      resolveSolidCollision(player.pos, urchin.mesh.position, 1.8 + player.radius);
      if (urchin.hitCooldown <= 0) {
        takeDamage(4 * dt, 'a sea urchin');
        urchin.hitCooldown = 0.5;
      }
    }
  }

  // Crabs — scuttle around, deal contact damage and scatter when touched
  for (const crab of crabs) {
    crab.bob += dt * 1.6;
    crab.mesh.position.y = -83.5 + Math.sin(crab.bob) * 0.04;
    crab.wanderAngle += dt * 0.5;
    crab.mesh.rotation.y = crab.wanderAngle;
    crab.mesh.position.x += Math.cos(crab.wanderAngle) * crab.speed * hostileSpeedMultiplier * dt * 0.6;
    crab.mesh.position.z += Math.sin(crab.wanderAngle) * crab.speed * hostileSpeedMultiplier * dt * 0.6;
    if (crab.hitCooldown > 0) crab.hitCooldown -= dt;
    const dx = crab.mesh.position.x - player.pos.x;
    const dz = crab.mesh.position.z - player.pos.z;
    if (Math.abs(dx) > worldRadius) { crab.wanderAngle = Math.random() * Math.PI * 2; crab.mesh.position.x = player.pos.x + (Math.random() - 0.5) * worldRadius * 1.6; }
    if (Math.abs(dz) > worldRadius) { crab.wanderAngle = Math.random() * Math.PI * 2; crab.mesh.position.z = player.pos.z + (Math.random() - 0.5) * worldRadius * 1.6; }
    const dist = crab.mesh.position.distanceTo(player.pos);
    if (dist < 1.5 + player.radius) {
      resolveSolidCollision(player.pos, crab.mesh.position, 1.5 + player.radius);
      if (crab.hitCooldown <= 0) {
        takeDamage(3 * dt, 'a crab with attitude');
        crab.hitCooldown = 0.4;
        crab.wanderAngle = Math.random() * Math.PI * 2;
      }
    }
  }

}
