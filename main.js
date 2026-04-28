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
      up: 'Space',
      down: 'ShiftLeft',
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
  moveSpeed: () => 6 + state.upgrades.fins * 1.2,
  ramPower: () => 18 + state.upgrades.head * 6,
  maxHealth: () => 100 + state.upgrades.lungs * 20,
  pickupRadius: () => 1.4 + state.upgrades.bite * 0.25,
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
  <div id="mainMenu" class="overlay">
    <div class="panel">
      <h1 class="title">Axolotl Alien Fighter</h1>
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
scene.fog = new THREE.Fog(0x0f3a55, 12, 120);
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
  new THREE.CylinderGeometry(50, 50, 12, data.options.graphics === 'low' ? 24 : 64),
  new THREE.MeshPhongMaterial({ color: 0x1a6d8a, transparent: true, opacity: 0.92 })
);
water.position.y = -6;
scene.add(water);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(52, 52, 2, 64),
  new THREE.MeshStandardMaterial({ color: 0x4f6f36 })
);
floor.position.y = -13;
scene.add(floor);

for (let i = 0; i < 80; i++) {
  const reed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 2 + Math.random() * 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x77a85d })
  );
  const r = 20 + Math.random() * 26;
  const a = Math.random() * Math.PI * 2;
  reed.position.set(Math.cos(a) * r, -10.5 + reed.geometry.parameters.height / 2, Math.sin(a) * r);
  scene.add(reed);
}

const stars = new THREE.Group();
for (let i = 0; i < 120; i++) {
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xb8ffb0 }));
  p.position.set((Math.random() - 0.5) * 100, 8 + Math.random() * 20, (Math.random() - 0.5) * 100);
  stars.add(p);
}
scene.add(stars);

const player = {
  pos: new THREE.Vector3(0, -1.6, 0),
  yaw: 0,
  pitch: 0,
  velocity: new THREE.Vector3(),
  radius: 1.2
};

const axolotl = new THREE.Group();
const axBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.8, 6, 12), new THREE.MeshStandardMaterial({ color: 0xff9ecf, roughness: 0.7 }));
const axHead = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffadd7, roughness: 0.7 }));
const axTail = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.5, 10), new THREE.MeshStandardMaterial({ color: 0xf58cbc, roughness: 0.7 }));
const axFinL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0xff74b6, transparent: true, opacity: 0.8 }));
const axFinR = axFinL.clone();
const axGillL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.7), new THREE.MeshStandardMaterial({ color: 0xff5ca8, transparent: true, opacity: 0.85 }));
const axGillR = axGillL.clone();
const axEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
const axEyeR = axEyeL.clone();
axBody.rotation.z = Math.PI / 2;
axHead.position.set(1.15, 0.1, 0);
axTail.position.set(-1.45, 0.02, 0);
axTail.rotation.z = -Math.PI / 2;
axFinL.position.set(0, -0.25, 0.72);
axFinR.position.set(0, -0.25, -0.72);
axGillL.position.set(0.95, 0.45, 0.78);
axGillR.position.set(0.95, 0.45, -0.78);
axEyeL.position.set(1.52, 0.26, 0.23);
axEyeR.position.set(1.52, 0.26, -0.23);
axolotl.add(axBody, axHead, axTail, axFinL, axFinR, axGillL, axGillR, axEyeL, axEyeR);
scene.add(axolotl);

const cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();

const aliens = [];
const pickups = [];
const ripples = [];
const keys = new Set();
let lastTime = performance.now();
let alienSpawnTimer = 0;
let pickupSpawnTimer = 0;
let continueAllowed = !!data.save.hasSave;

function makeAlien() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 14), new THREE.MeshStandardMaterial({ color: 0x8cf07d, emissive: 0x245d1b }));
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const eye2 = eye1.clone();
  eye1.position.set(-0.25, 0.18, 0.7); eye2.position.set(0.25, 0.18, 0.7);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xb8ffb0 }));
  horn.position.y = 0.95;
  group.add(body, eye1, eye2, horn);
  const r = 12 + Math.random() * 28;
  const a = Math.random() * Math.PI * 2;
  group.position.set(Math.cos(a) * r, -1.5 + Math.random() * 3, Math.sin(a) * r);
  scene.add(group);
  aliens.push({ mesh: group, hp: 18 + state.level * 5, speed: 1.2 + Math.random() * 1.1, bob: Math.random() * Math.PI * 2 });
}

function makePickup(kind = Math.random() < 0.12 ? 'steak' : 'worm') {
  const color = kind === 'steak' ? 0xa22f2f : 0xc7944d;
  const geo = kind === 'steak' ? new THREE.BoxGeometry(0.8, 0.45, 0.55) : new THREE.TorusKnotGeometry(0.22, 0.07, 30, 5);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: kind === 'steak' ? 0x330000 : 0x2d220c }));
  const r = Math.random() * 30;
  const a = Math.random() * Math.PI * 2;
  mesh.position.set(Math.cos(a) * r, -2 + Math.random() * 3.5, Math.sin(a) * r);
  mesh.rotation.set(Math.random(), Math.random(), Math.random());
  scene.add(mesh);
  pickups.push({ mesh, kind, spin: (Math.random() - 0.5) * 2 });
}

function spawnRipple(position, color = 0xffffff) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position);
  scene.add(mesh);
  ripples.push({ mesh, life: 0.7 });
}

for (let i = 0; i < 8; i++) makeAlien();
for (let i = 0; i < 22; i++) makePickup();

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
  if (state.health <= 0) {
    paused = true;
    pointerLocked = false;
    document.exitPointerLock();
    el.pauseMenu.classList.remove('hidden');
    showNotice('You got bonked out. Resume or quit to title.');
    state.health = config.maxHealth();
    player.pos.set(0, -1.6, 0);
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
  const xpNeed = config.xpToNext();
  el.xpFill.style.width = `${(state.xp / xpNeed) * 100}%`;
  el.xpLabel.textContent = `XP ${state.xp}/${xpNeed}  •  Level ${state.level}`;
  el.healthFill.style.width = `${(state.health / config.maxHealth()) * 100}%`;
  el.healthLabel.textContent = `Health ${Math.round(state.health)}/${config.maxHealth()}`;
  el.currency.textContent = state.currency;
  el.aliensBonked.textContent = state.stats.aliensBonked;
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
  const labels = { forward: 'Forward', backward: 'Backward', left: 'Left', right: 'Right', up: 'Swim Up', down: 'Swim Down', upgrades: 'Upgrades', pause: 'Pause' };
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
  for (const key of ['mainMenu', 'pauseMenu', 'optionsMenu', 'upgradeMenu']) el[key].classList.add('hidden');
  if (id) el[id].classList.remove('hidden');
}

function startGame(continueGame = false) {
  if (!continueGame) resetState();
  else Object.assign(state, structuredClone(data.save));
  state.health = Math.min(config.maxHealth(), state.health || config.maxHealth());
  player.pos.set(0, -1.6, 0);
  paused = false;
  gameStarted = true;
  openOverlay(null);
  renderer.domElement.requestPointerLock();
  persist();
  updateHUD();
  renderUpgradeMenu();
  continueAllowed = true;
  el.continueBtn.disabled = false;
}

function quitToTitle() {
  paused = true;
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
  player.yaw -= e.movementX * 0.0023;
  player.pitch -= e.movementY * 0.0021;
  player.pitch = Math.max(-1.3, Math.min(1.3, player.pitch));
});

document.addEventListener('keydown', e => {
  if (rebinding) {
    data.options.keybinds[rebinding] = e.code;
    rebinding = null;
    persist();
    renderOptions();
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
  if (gameStarted && !pointerLocked && !paused) renderer.domElement.requestPointerLock();
});

el.newGameBtn.onclick = () => startGame(false);
el.continueBtn.onclick = () => continueAllowed && startGame(true);
el.continueBtn.disabled = !continueAllowed;
el.optionsBtn.onclick = () => { renderOptions(); openOverlay('optionsMenu'); };
el.pauseOptionsBtn.onclick = () => { renderOptions(); openOverlay('optionsMenu'); };
el.closeOptionsBtn.onclick = () => openOverlay(gameStarted && paused ? 'pauseMenu' : 'mainMenu');
el.resumeBtn.onclick = () => { paused = false; openOverlay(null); renderer.domElement.requestPointerLock(); };
el.charBtn.onclick = () => { renderUpgradeMenu(); openOverlay('upgradeMenu'); };
el.closeUpgradeBtn.onclick = () => openOverlay('pauseMenu');
el.quitBtn.onclick = quitToTitle;
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
  const dir = new THREE.Vector3();
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  if (keys.has(data.options.keybinds.forward)) dir.add(forward);
  if (keys.has(data.options.keybinds.backward)) dir.sub(forward);
  if (keys.has(data.options.keybinds.right)) dir.add(right);
  if (keys.has(data.options.keybinds.left)) dir.sub(right);
  if (keys.has(data.options.keybinds.up)) dir.y += 1;
  if (keys.has(data.options.keybinds.down)) dir.y -= 1;
  if (dir.lengthSq()) dir.normalize();

  const speed = config.moveSpeed() * (keys.has('Mouse0') ? 1.5 : 1);
  player.velocity.lerp(dir.multiplyScalar(speed), 0.08);
  player.pos.addScaledVector(player.velocity, dt);

  const radius = 34;
  if (player.pos.length() > radius) player.pos.setLength(radius);
  player.pos.y = Math.max(-8.5, Math.min(4.5, player.pos.y));

  axolotl.position.copy(player.pos);
  if (player.velocity.lengthSq() > 0.001) {
    axolotl.rotation.y = Math.atan2(-player.velocity.x, -player.velocity.z);
  } else {
    axolotl.rotation.y = player.yaw;
  }
  axolotl.rotation.z = Math.sin(performance.now() * 0.006) * 0.08;
  axTail.rotation.y = Math.sin(performance.now() * 0.01) * 0.45;
  axFinL.rotation.x = Math.sin(performance.now() * 0.012) * 0.35;
  axFinR.rotation.x = -Math.sin(performance.now() * 0.012) * 0.35;

  cameraOffset.set(Math.sin(player.yaw) * 6, 3.2 + Math.sin(player.pitch) * 1.5, Math.cos(player.yaw) * 6);
  cameraTarget.copy(player.pos).add(new THREE.Vector3(0, 1.2, 0));
  camera.position.lerp(cameraTarget.clone().add(cameraOffset), 0.12);
  camera.lookAt(cameraTarget);
}

document.addEventListener('mousedown', e => { if (e.button === 0) keys.add('Mouse0'); });
document.addEventListener('mouseup', e => { if (e.button === 0) keys.delete('Mouse0'); });

function updateAliens(dt) {
  alienSpawnTimer += dt;
  if (alienSpawnTimer > 4 && aliens.length < 18) { alienSpawnTimer = 0; makeAlien(); }
  for (let i = aliens.length - 1; i >= 0; i--) {
    const alien = aliens[i];
    const toPlayer = player.pos.clone().sub(alien.mesh.position);
    const dist = toPlayer.length();
    if (dist > 0.001) alien.mesh.position.addScaledVector(toPlayer.normalize(), alien.speed * dt);
    alien.bob += dt * 2;
    alien.mesh.position.y += Math.sin(alien.bob) * 0.01;
    alien.mesh.lookAt(player.pos);

    if (dist < 1.8) {
      const ram = player.velocity.length() * config.ramPower() * 0.18;
      alien.hp -= ram;
      takeDamage(7 * dt + 4 * (1 - Math.min(1, player.velocity.length() / 4)) * dt);
      if (ram > 1.5) spawnRipple(alien.mesh.position, 0xffe08a);
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
  if (pickupSpawnTimer > 1.8 && pickups.length < 28) { pickupSpawnTimer = 0; makePickup(); }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.mesh.rotation.y += dt * p.spin;
    p.mesh.position.y += Math.sin(performance.now() * 0.002 + i) * 0.002;
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
      } else {
        state.stats.wormsEaten += 1;
        addXp(6);
        state.currency += 2;
      }
      spawnRipple(player.pos, p.kind === 'steak' ? 0xff7f7f : 0xffd27d);
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
    updateAliens(dt);
    updatePickups(dt);
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
