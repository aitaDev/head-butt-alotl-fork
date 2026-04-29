import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const app = document.getElementById('app');
const saveKey = 'axolotl-alien-fighter-save';

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
let gameStarted = false;
let paused = true;
let pointerLocked = false;
let rebinding = null;

const state = {
  xp: data.save.xp,
  level: data.save.level,
  currency: data.save.currency,
  health: data.save.health,
  upgrades: { ...data.save.upgrades },
  stats: { ...data.save.stats }
};

const config = {
  moveSpeed: () => 7 + state.upgrades.fins * 1.4,
  ramPower: () => 18 + state.upgrades.head * 6,
  maxHealth: () => 100 + state.upgrades.lungs * 20,
  pickupRadius: () => 1.4 + state.upgrades.bite * 0.25,
  accel: () => 5.8 + state.upgrades.fins * 0.6,
  verticalAccel: () => 10,
  jumpStrength: () => 7.5 + state.upgrades.fins * 0.4,
  sprintDrain: () => 4.5,
  maxBoostMultiplier: () => 5,
  xpToNext: () => 50 + (state.level - 1) * 35
};

const upgradesMeta = [
  { key: 'fins', name: 'Better Fins', desc: 'Swim faster through the pond.', cost: lvl => 20 + lvl * 18 },
  { key: 'head', name: 'Bigger Stronger Head', desc: 'Bonk aliens harder for faster takedowns.', cost: lvl => 25 + lvl * 22 },
  { key: 'lungs', name: 'Pond Lungs', desc: 'More health and better survival.', cost: lvl => 18 + lvl * 20 },
  { key: 'bite', name: 'Power Chomp', desc: 'Grab worms and steak from farther away.', cost: lvl => 16 + lvl * 16 }
];

app.innerHTML = `
<div id="ui">
  <div id="gameOverMenu" class="overlay hidden">
    <div class="panel">
      <h1 style="font-size:44px;color:#ff4d6d;text-shadow:0 0 18px rgba(255,0,64,0.6)">GAME OVER</h1>
      <p class="subtitle" style="color:#ffb3c1">The pond went silent. The aliens are still out there.</p>
      <div class="menu-buttons">
        <button id="retryBtn">Rise Again</button>
        <button id="gameOverTitleBtn" class="secondary">Quit to Title</button>
      </div>
    </div>
  </div>

  <div id="whaleChatMenu" class="overlay hidden">
    <div class="panel">
      <h2>Whale Wisdom</h2>
      <p class="subtitle">"Please help protect the ocean. Trash, oil, plastic, and poison spread everywhere. Clean water means life for all of us."</p>
      <div class="menu-buttons">
        <button id="closeWhaleChatBtn">I Understand</button>
      </div>
    </div>
  </div>
  <div id="mainMenu" class="overlay">
    <div class="panel">
      <h1 class="title">Head-Butt-Alotl</h1>
      <p class="subtitle">Save the pond by headbutting alien invaders and gobbling worms for power.</p>
      <div class="menu-buttons">
        <button id="newGameBtn">New Game</button>
        <button id="continueBtn">Continue</button>
        <button id="optionsBtn" class="secondary">Options</button>
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
    <div class="panel">
      <h2>Axolotl Evolution</h2>
      <p class="subtitle">Spend pond credits on upgrades.</p>
      <div class="row"><span>Level</span><span class="value" id="upLevel"></span></div>
      <div class="row"><span>Currency</span><span class="value" id="upCurrency"></span></div>
      <div class="bar"><div id="upgradeXpFill" class="fill"></div><div class="barLabel" id="upgradeXpLabel"></div></div>
      <div style="height:12px"></div>
      <div id="upgradeList"></div>
      <div class="stack" style="margin-top:16px">
        <button id="closeUpgradeBtn">Back</button>
      </div>
    </div>
  </div>

  <div class="topbar">
    <div class="card" id="scoreCard">Credits: <span id="currency">0</span></div>
    <div class="card" id="statCard">Aliens bonked: <span id="aliensBonked">0</span></div>
  </div>

  <div id="notice"></div>
  <div id="crosshair"><div class="dot"></div></div>
  <div id="hud">
    <div class="bar"><div id="healthFill" class="fill"></div><div class="barLabel" id="healthLabel"></div></div>
    <div class="bar"><div id="xpFill" class="fill"></div><div class="barLabel" id="xpLabel"></div></div>
  </div>
</div>`;

const el = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));

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
  for (let j = 0; j < 5; j++) {
    const branch = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1 + Math.random() * 1.8, 0.28),
      new THREE.MeshStandardMaterial({ color: colors[(i + j) % colors.length], roughness: 0.85 })
    );
    branch.position.set((j - 2) * 0.22, branch.geometry.parameters.height / 2, (Math.random() - 0.5) * 0.45);
    branch.rotation.z = (Math.random() - 0.5) * 0.35;
    group.add(branch);
  }
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

const whale = new THREE.Group();
const whaleBody = new THREE.Mesh(new THREE.BoxGeometry(13.5, 4.8, 4.8), new THREE.MeshStandardMaterial({ color: 0x4a6f96, roughness: 0.8 }));
const whaleHead = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.8, 3.8), new THREE.MeshStandardMaterial({ color: 0x5d84aa, roughness: 0.75 }));
const whaleTailL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 1.5), new THREE.MeshStandardMaterial({ color: 0x486b90 }));
const whaleTailR = whaleTailL.clone();
const whaleFinL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.8), new THREE.MeshStandardMaterial({ color: 0x3e6186 }));
const whaleFinR = whaleFinL.clone();
whaleHead.position.set(8.4, 0.2, 0);
whaleTailL.position.set(-8.8, 0.7, 1.8);
whaleTailR.position.set(-8.8, 0.7, -1.8);
whaleTailL.rotation.y = 0.45;
whaleTailR.rotation.y = -0.45;
whaleFinL.position.set(0.8, -1.8, 2.7);
whaleFinR.position.set(0.8, -1.8, -2.7);
whale.add(whaleBody, whaleHead, whaleTailL, whaleTailR, whaleFinL, whaleFinR);
whale.position.set(18, -56, -10);
scene.add(whale);

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
  forwardBoost: 1
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
const axEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0x111111 }));
const axEyeR = axEyeL.clone();
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
axEyeL.position.set(1.8, 0.22, 0.24);
axEyeR.position.set(1.8, 0.22, -0.24);
axolotl.add(axBody, axBodyStripe, axHead, axMouth, axTail, axTailTip, axLegFL, axLegFR, axLegBL, axLegBR, axGillL, axGillR, axEyeL, axEyeR);
scene.add(axolotl);

const cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();

const aliens = [];
const pickups = [];
const sharks = [];
const octopi = [];
const narwhals = [];
const floatingTexts = [];
const ripples = [];
let damageTextStack = 0;
const keys = new Set();
let lastTime = performance.now();
let alienSpawnTimer = 0;
let pickupSpawnTimer = 0;
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
  whale: new Audio('./assets/audio/freesound_community-lowwhalesong.mp3')
};
audio.underwater.loop = true;
audio.underwater.volume = 0.35;
audio.scuba.volume = 0.5;
audio.whoosh.loop = true;
audio.whoosh.volume = 0.35;
audio.whale.volume = 0.55;

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
  aliens.push({ mesh: group, hp: (38 + state.level * 9) * scale * 1.8 * type.hp, speed: Math.max(0.35, type.speed - scale * 0.12) + Math.random() * 0.35, bob: Math.random() * Math.PI * 2, scale, damage: 6 * scale * type.damage, kind: type.name });
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
  pickups.push({ mesh: group, kind, spin: (Math.random() - 0.5) * 1.4 });
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

function makeNarwhal() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: 0xd7f1ff, roughness: 0.7 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), new THREE.MeshStandardMaterial({ color: 0xeaf8ff, roughness: 0.6 }));
  const horn = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0xf5f0d8, roughness: 0.5 }));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 1.0), new THREE.MeshStandardMaterial({ color: 0xb9dced }));
  body.position.set(0, 0, 0);
  head.position.set(2.7, 0.05, 0);
  horn.position.set(3.7, 0.2, 0);
  tail.position.set(-2.3, 0, 0);
  tail.rotation.y = 0.25;
  group.add(body, head, horn, tail);
  const r = 18 + Math.random() * 65;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -55 + Math.random() * 35, Math.sin(a) * r);
  scene.add(group);
  narwhals.push({ mesh: group, activeUntil: 0, following: false, bob: Math.random() * Math.PI * 2 });
}

function makeShark() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.35, 1.35), new THREE.MeshStandardMaterial({ color: 0x6f8897, roughness: 0.7 }));
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.35), new THREE.MeshStandardMaterial({ color: 0x5b7280 }));
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: 0x698391 }));
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.8), new THREE.MeshStandardMaterial({ color: 0xe9e9e9 }));
  tail.rotation.y = 0.25;
  fin.position.set(0.1, 0.9, 0);
  tail.position.set(-2.5, 0, 0);
  jaw.position.set(2.1, -0.25, 0);
  group.add(body, fin, tail, jaw);
  const r = 20 + Math.random() * 75;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -60 + Math.random() * 40, Math.sin(a) * r);
  scene.add(group);
  sharks.push({ mesh: group, speed: 2 + Math.random() * 1.5, damage: 18 + Math.random() * 12, bob: Math.random() * Math.PI * 2, hp: 85 + Math.random() * 45, hitCooldown: 0 });
}

function makeOctopus() {
  const group = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshStandardMaterial({ color: 0xa45bff, roughness: 0.8 }));
  for (let i = 0; i < 8; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x8b47dd, roughness: 0.85 }));
    const angle = (i / 8) * Math.PI * 2;
    arm.position.set(Math.cos(angle) * 0.35, -1.0, Math.sin(angle) * 0.35);
    arm.rotation.z = (Math.random() - 0.5) * 0.6;
    group.add(arm);
  }
  group.add(head);
  const r = 12 + Math.random() * 90;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -82, Math.sin(a) * r);
  scene.add(group);
  octopi.push({ mesh: group, bob: Math.random() * Math.PI * 2 });
}

for (let i = 0; i < 5; i++) makeAlien();
for (let i = 0; i < 18; i++) makePickup();
for (let i = 0; i < 2; i++) makeShark();
for (let i = 0; i < 10; i++) makeOctopus();
for (let i = 0; i < 2; i++) makeNarwhal();

function addXp(amount) {
  state.xp += amount;
  while (state.xp >= config.xpToNext()) {
    state.xp -= config.xpToNext();
    state.level += 1;
    state.currency += 15;
    showNotice(`Level up! Now level ${state.level}`);
  }
}

function takeDamage(amount) {
  state.health = Math.max(0, state.health - amount);
  if (state.health <= 0 && !isGameOver) {
    isGameOver = true;
    paused = true;
    pointerLocked = false;
    document.exitPointerLock();
    openOverlay('gameOverMenu');
  }
}

function buyUpgrade(key) {
  const meta = upgradesMeta.find(u => u.key === key);
  const level = state.upgrades[key];
  if (level >= 5) return;
  const cost = meta.cost(level);
  if (state.currency < cost) return showNotice('Not enough credits');
  state.currency -= cost;
  state.upgrades[key] += 1;
  if (key === 'lungs') state.health = Math.min(config.maxHealth(), state.health + 20);
  showNotice(`${meta.name} upgraded`);
  persist();
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
    if (player.pos.distanceTo(whale.position) < 18) {
      if (audio.whale.paused) audio.whale.play().catch(() => {});
    } else {
      audio.whale.pause();
      audio.whale.currentTime = 0;
    }
  }
  const xpNeed = config.xpToNext();
  el.xpFill.style.width = `${(state.xp / xpNeed) * 100}%`;
  el.xpLabel.textContent = `XP ${state.xp}/${xpNeed}  •  Level ${state.level}`;
  el.healthFill.style.width = `${(state.health / config.maxHealth()) * 100}%`;
  el.healthLabel.textContent = `Health ${Math.round(state.health)}/${config.maxHealth()}`;
  el.currency.textContent = state.currency;
  el.aliensBonked.textContent = state.stats.aliensBonked;
  if (player.pos.distanceTo(whale.position) < 14 && performance.now() > whaleChatCooldownUntil && !paused) {
    paused = true;
    whaleChatCooldownUntil = performance.now() + 120000;
    openOverlay('whaleChatMenu');
  }
  if (narwhalBuffUntil > performance.now()) {
    showNotice('🦄 Narwhal ally active, double damage for 1 minute');
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
    row.innerHTML = `<div><strong>${meta.name}</strong><div class="small">${meta.desc} (Level ${lvl}/5)</div></div><div class="value">${lvl >= 5 ? 'MAX' : cost + ' cr'}</div>`;
    const btn = document.createElement('button');
    btn.textContent = lvl >= 5 ? 'Maxed' : 'Upgrade';
    btn.disabled = lvl >= 5 || state.currency < cost;
    btn.onclick = () => buyUpgrade(meta.key);
    row.appendChild(btn);
    el.upgradeList.appendChild(row);
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
  for (const key of ['mainMenu', 'pauseMenu', 'optionsMenu', 'upgradeMenu', 'gameOverMenu', 'whaleChatMenu']) el[key].classList.add('hidden');
  if (id) el[id].classList.remove('hidden');
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
  updateHUD();
  renderUpgradeMenu();
  continueAllowed = true;
  el.continueBtn.disabled = false;
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
    el.closeWhaleChatBtn.click();
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
  if (e.code === data.options.keybinds.upgrades && gameStarted) {
    paused = true;
    document.exitPointerLock();
    renderUpgradeMenu();
    openOverlay('upgradeMenu');
  }
});

document.addEventListener('keyup', e => keys.delete(e.code));
renderer.domElement.addEventListener('click', () => {
  unlockAudio();
  if (gameStarted && !pointerLocked && !paused) renderer.domElement.requestPointerLock();
});

el.newGameBtn.onclick = () => startGame(false);
el.continueBtn.onclick = () => continueAllowed && startGame(true);
el.continueBtn.disabled = !continueAllowed;
el.optionsBtn.onclick = () => { renderOptions(); openOverlay('optionsMenu'); };
el.pauseOptionsBtn.onclick = () => { renderOptions(); openOverlay('optionsMenu'); };
el.closeOptionsBtn.onclick = () => openOverlay(gameStarted && paused && !isGameOver ? 'pauseMenu' : 'mainMenu');
el.resumeBtn.onclick = () => { unlockAudio(); paused = false; openOverlay(null); renderer.domElement.requestPointerLock(); };
el.charBtn.onclick = () => { renderUpgradeMenu(); openOverlay('upgradeMenu'); };
el.closeUpgradeBtn.onclick = () => openOverlay('pauseMenu');
el.quitBtn.onclick = quitToTitle;
el.retryBtn.onclick = () => { unlockAudio(); startGame(false); };
el.gameOverTitleBtn.onclick = quitToTitle;
el.closeWhaleChatBtn.onclick = () => { paused = false; openOverlay(null); renderer.domElement.requestPointerLock(); };
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
  const right = new THREE.Vector3(flatForward.z, 0, -flatForward.x);
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
    takeDamage(dt * config.sprintDrain());
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

  cameraOffset.set(Math.sin(player.yaw) * 7.4, 2.8 - Math.sin(player.pitch) * 1.2, Math.cos(player.yaw) * 7.4);
  cameraTarget.copy(player.pos).add(new THREE.Vector3(0, 0.7, 0));
  scene.fog.color.set(player.pos.y > -10 ? 0x5cbcff : 0x0b5ea8);
  const desiredCameraPos = cameraTarget.clone().add(cameraOffset);
  camera.position.lerp(desiredCameraPos, 0.22);
  const lookTarget = cameraTarget.clone().add(new THREE.Vector3(-Math.sin(player.yaw) * 8, Math.sin(player.pitch) * 8, -Math.cos(player.yaw) * 8));
  camera.lookAt(lookTarget);
  renderer.setClearColor(player.pos.y > -10 ? 0x7ed0ff : 0x1676d2);

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
}

document.addEventListener('mousedown', e => { if (e.button === 0) keys.add('Mouse0'); });
document.addEventListener('mouseup', e => { if (e.button === 0) keys.delete('Mouse0'); });

function updateAliens(dt, now) {
  alienSpawnTimer += dt;
  if (alienSpawnTimer > 6 && aliens.length < 10) { alienSpawnTimer = 0; makeAlien(); }
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
    if (dist > 0.001) alien.mesh.position.addScaledVector(toPlayer.normalize(), alien.speed * dt);
    alien.bob += dt * (1.2 + alien.scale * 0.2);
    alien.mesh.position.y += Math.sin(alien.bob) * 0.01 * alien.scale;
    alien.mesh.lookAt(player.pos);

    if (dist < 1.8) {
      if (!alien.hitCooldown || now - alien.hitCooldown > 120) {
        const damageMultiplier = narwhalBuffUntil > performance.now() ? 2 : 1;
        const ram = player.velocity.length() * config.ramPower() * 0.18 * damageMultiplier;
        const crit = player.velocity.length() > config.moveSpeed() * 1.8;
        const dealt = crit ? ram * 1.5 : ram;
        alien.hp -= dealt;
        spawnDamageText(alien.mesh.position, dealt, crit);
        alien.hitCooldown = now;
        if (ram > 1.5) spawnRipple(alien.mesh.position, crit ? 0xff4444 : 0xffe08a);
      }
      takeDamage(alien.damage * dt + 5 * (1 - Math.min(1, player.velocity.length() / (4 + state.upgrades.head))) * dt);
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
    if (dist < config.pickupRadius()) {
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
  for (const narwhal of narwhals) {
    narwhal.bob += dt * 1.8;
    const target = narwhal.following && narwhal.activeUntil > performance.now() ? player.pos : narwhal.mesh.position;
    if (narwhal.following && narwhal.activeUntil > performance.now()) {
      const escortPos = player.pos.clone().add(new THREE.Vector3(Math.sin(performance.now() * 0.001) * 3, 0.8, Math.cos(performance.now() * 0.001) * 3));
      const move = escortPos.sub(narwhal.mesh.position);
      if (move.length() > 0.001) narwhal.mesh.position.addScaledVector(move.normalize(), dt * 6);
      narwhal.mesh.lookAt(player.pos);
    }
    narwhal.mesh.position.y += Math.sin(narwhal.bob) * 0.02;
    if (!narwhal.following && narwhal.mesh.position.distanceTo(player.pos) < 4) {
      narwhal.following = true;
      narwhal.activeUntil = performance.now() + 60000;
      narwhalBuffUntil = narwhal.activeUntil;
      showNotice('A rare narwhal joins you and doubles your damage');
    }
    if (narwhal.following && narwhal.activeUntil <= performance.now()) {
      narwhal.following = false;
      showNotice('Your narwhal friend swims away');
    }
  }
}

function updateSharks(dt, now) {
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
    if (dist > 0.001) shark.mesh.position.addScaledVector(toPlayer.normalize(), shark.speed * dt);
    shark.bob += dt * 2.8;
    shark.mesh.position.y += Math.sin(shark.bob) * 0.02;
    shark.mesh.lookAt(player.pos);
    if (dist < 2.6) {
      if (!shark.hitCooldown || now - shark.hitCooldown > 120) {
        const damageMultiplier = narwhalBuffUntil > performance.now() ? 2 : 1;
        const ram = player.velocity.length() * config.ramPower() * 0.16 * damageMultiplier;
        const crit = player.velocity.length() > config.moveSpeed() * 1.9;
        const dealt = crit ? ram * 1.5 : ram;
        shark.hp -= dealt;
        spawnDamageText(shark.mesh.position, dealt, crit);
        shark.hitCooldown = now;
        spawnRipple(shark.mesh.position, crit ? 0xff4444 : 0xff8888);
      }
      takeDamage(shark.damage * dt);
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

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  stars.rotation.y += dt * 0.03;
  if (!paused && gameStarted) {
    updatePlayer(dt);
    updateAliens(dt, now);
    updateNarwhals(dt);
    updateSharks(dt, now);
    updatePickups(dt);
    for (const octo of octopi) {
      octo.bob += dt * 1.5;
      octo.mesh.position.y = -82 + Math.sin(octo.bob) * 0.5;
    }
    updateFloatingTexts(dt);
    updateRipples(dt);
    persist();
    updateHUD();
  }
  renderer.render(scene, camera);
}

updateHUD();
renderOptions();
renderUpgradeMenu();
animate(performance.now());
