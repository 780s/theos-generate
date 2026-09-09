import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_DEFS } from './engine/blocks.js';
import { TextureAtlas } from './engine/textures.js';
import { SoundEngine } from './engine/audio.js';
import { ParticleSystem } from './engine/particles.js';
import { World, CHUNK_SIZE_X, CHUNK_SIZE_Z } from './engine/world.js';
import { Player } from './engine/player.js';
import { InputManager } from './engine/controls.js';
import { AIGenerator, DEFAULT_GEMINI_KEY } from './engine/ai_generator.js';
import { SKINS } from './engine/skins.js';

// --- GAME INITIALIZATION ---
const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// Sound, Textures, Particles
const soundEngine = new SoundEngine();
const textureAtlas = new TextureAtlas();
const particleSystem = new ParticleSystem(scene);

// Render distance configuration (default 3 chunks radius = 7x7 chunk grid)
let currentRenderRadius = parseInt(localStorage.getItem('theo_render_distance') || '3');
if (isNaN(currentRenderRadius) || currentRenderRadius < 2 || currentRenderRadius > 5) {
  currentRenderRadius = 3;
}

// World & Player
const world = new World(scene, textureAtlas);
world.initArea(0, 0, currentRenderRadius);

const flightBadge = document.getElementById('flight-badge');
const swimBadge = document.getElementById('swim-badge');

const player = new Player(camera, world, soundEngine, particleSystem, {
  onWaterEnter: () => {
    if (swimBadge) swimBadge.classList.remove('hidden');
  },
  onWaterExit: () => {
    if (swimBadge) swimBadge.classList.add('hidden');
  }
});
// Spawn player at surface
const spawnX = 8;
const spawnZ = 8;
const spawnY = world.getSurfaceY(spawnX, spawnZ) + 1.5;
player.position.set(spawnX, spawnY, spawnZ);

// AI Generator
const aiGenerator = new AIGenerator(world, soundEngine, particleSystem);

// --- LIGHTING & ATMOSPHERE ---
const ambientLight = new THREE.HemisphereLight(0x87ceeb, 0x3d352e, 0.45);
scene.add(ambientLight);

// Directional Sunlight with shadows
const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 120;
const d = 35;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

// Directional Moonlight
const moonLight = new THREE.DirectionalLight(0x6688cc, 0.25);
scene.add(moonLight);

// Sky Celestial Bodies: Sun and Moon
const celestialGroup = new THREE.Group();
scene.add(celestialGroup);

const sunGeom = new THREE.SphereGeometry(6, 16, 16);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });
const sunMesh = new THREE.Mesh(sunGeom, sunMat);
sunMesh.position.set(0, 80, 0);
celestialGroup.add(sunMesh);

const moonGeom = new THREE.SphereGeometry(4, 16, 16);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xddedff });
const moonMesh = new THREE.Mesh(moonGeom, moonMat);
moonMesh.position.set(0, -80, 0);
celestialGroup.add(moonMesh);

// Starfield
const starGeom = new THREE.BufferGeometry();
const starCount = 600;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 2 - 1);
  const r = 180;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);
}
starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0 });
const starField = new THREE.Points(starGeom, starMat);
scene.add(starField);

// Atmospheric Fog
scene.fog = new THREE.FogExp2(0x87ceeb, 0.012);

// Time of day (0.0 = Noon, 0.25 = Sunset, 0.5 = Midnight, 0.75 = Sunrise)
let timeOfDay = 0.05;
let timeSpeed = 0.005; // Normal speed

function updateAtmosphere(delta) {
  timeOfDay = (timeOfDay + timeSpeed * delta * 0.1) % 1.0;

  const sunAngle = timeOfDay * Math.PI * 2;
  celestialGroup.rotation.z = sunAngle;

  const sunY = Math.cos(sunAngle);
  const sunX = Math.sin(sunAngle);

  // Position directional light matching celestial group
  sunLight.position.set(player.position.x + sunX * 60, player.position.y + sunY * 60, player.position.z + 20);
  sunLight.target.position.copy(player.position);
  sunLight.target.updateMatrixWorld();

  moonLight.position.set(player.position.x - sunX * 60, player.position.y - sunY * 60, player.position.z - 20);
  moonLight.target.position.copy(player.position);
  moonLight.target.updateMatrixWorld();

  starField.position.copy(player.position);

  // Underwater deep-blue atmospheric immersion
  if (player.isSubmerged) {
    renderer.setClearColor(0x0a325c);
    scene.fog.color.setHex(0x0a325c);
    scene.fog.density = 0.045;
    ambientLight.color.setHex(0x196096);
    ambientLight.groundColor.setHex(0x051d38);
    ambientLight.intensity = 0.55;
    sunLight.intensity = 0.25;
    starMat.opacity = 0;
    return;
  }

  // Restore normal atmospheric fog density when above water
  scene.fog.density = 0.012;

  // Interpolate Sky & Fog Colors
  if (sunY > 0.2) {
    // Day
    const dayFactor = Math.min(1.0, (sunY - 0.2) / 0.4);
    renderer.setClearColor(0x87ceeb);
    scene.fog.color.setHex(0x87ceeb);
    ambientLight.color.setHex(0xaad8f5);
    ambientLight.groundColor.setHex(0x4a4235);
    ambientLight.intensity = 0.4 + dayFactor * 0.2;
    sunLight.intensity = 1.0 + dayFactor * 0.4;
    starMat.opacity = 0;
  } else if (sunY > -0.15) {
    // Sunset / Sunrise
    const sunsetFactor = (sunY + 0.15) / 0.35;
    const sunsetColor = new THREE.Color(0xfd5e53).lerp(new THREE.Color(0x87ceeb), sunsetFactor);
    renderer.setClearColor(sunsetColor);
    scene.fog.color.copy(sunsetColor);
    ambientLight.color.setHex(0xf97316);
    ambientLight.intensity = 0.4;
    sunLight.intensity = 0.7;
    starMat.opacity = (1 - sunsetFactor) * 0.6;
  } else {
    // Night
    renderer.setClearColor(0x060913);
    scene.fog.color.setHex(0x060913);
    ambientLight.color.setHex(0x1e293b);
    ambientLight.groundColor.setHex(0x020617);
    ambientLight.intensity = 0.18;
    sunLight.intensity = 0.0;
    starMat.opacity = 0.95;
  }
}

// --- HOTBAR SETUP ---
const HOTBAR_BLOCKS = [
  BLOCK_TYPES.BASEPLATE,
  BLOCK_TYPES.STUD_BRICK_RED,
  BLOCK_TYPES.STUD_BRICK_BLUE,
  BLOCK_TYPES.STUD_BRICK_YELLOW,
  BLOCK_TYPES.NEON_CYAN,
  BLOCK_TYPES.GRASS,
  BLOCK_TYPES.OAK_PLANKS,
  BLOCK_TYPES.BRICKS,
  BLOCK_TYPES.GLASS
];

let activeSlotIndex = 0;
const hotbarEl = document.getElementById('hotbar');

function getBlockPreviewDataURL(blockId) {
  const def = BLOCK_DEFS[blockId];
  if (!def) return '';
  let tileKey = 'dirt';
  if (def.faces) {
    if (def.faces.front) tileKey = def.faces.front;
    else if (def.faces.all) tileKey = def.faces.all;
    else if (def.faces.side) tileKey = def.faces.side;
    else if (def.faces.top) tileKey = def.faces.top;
  }
  const idx = textureAtlas.tileIndices[tileKey] !== undefined ? textureAtlas.tileIndices[tileKey] : 0;
  const col = idx % textureAtlas.atlasCols;
  const row = Math.floor(idx / textureAtlas.atlasCols);

  const ts = textureAtlas.tileSize || 32;
  const preview = document.createElement('canvas');
  preview.width = ts;
  preview.height = ts;
  const pctx = preview.getContext('2d');
  pctx.imageSmoothingEnabled = true;
  pctx.drawImage(
    textureAtlas.canvas,
    col * ts, row * ts, ts, ts,
    0, 0, ts, ts
  );
  return preview.toDataURL();
}

function renderHotbar() {
  hotbarEl.innerHTML = '';
  HOTBAR_BLOCKS.forEach((blockId, idx) => {
    const def = BLOCK_DEFS[blockId] || { name: 'Block', color: '#7f7f7f' };
    const slot = document.createElement('div');
    slot.className = `hotbar-slot ${idx === activeSlotIndex ? 'active' : ''}`;
    slot.dataset.slot = idx;

    // Slot number label (Modern 01 - 09)
    const num = document.createElement('span');
    num.className = 'slot-num';
    num.textContent = String(idx + 1).padStart(2, '0');
    slot.appendChild(num);

    // Pixel art icon preview
    const icon = document.createElement('img');
    icon.className = 'slot-icon';
    icon.src = getBlockPreviewDataURL(blockId);
    icon.title = def.name;
    slot.appendChild(icon);

    slot.addEventListener('click', () => selectHotbarSlot(idx));
    hotbarEl.appendChild(slot);
  });
}

function selectHotbarSlot(slotIdx) {
  activeSlotIndex = slotIdx;
  document.querySelectorAll('.hotbar-slot').forEach((el, idx) => {
    el.classList.toggle('active', idx === slotIdx);
  });
  const selectedBlock = HOTBAR_BLOCKS[slotIdx];
  player.setHeldBlock(selectedBlock);
}

renderHotbar();
player.setHeldBlock(HOTBAR_BLOCKS[0]);

// --- BLOCK CATALOG MODAL ---
const catalogGrid = document.getElementById('block-catalog-grid');
let currentCatalogCategory = 'all';

function getBlockCategory(def) {
  if (def.category) return def.category;
  const id = def.id;
  if (id >= 83 && id <= 90) return 'classic';
  if (id >= 91 && id <= 106) return 'furniture';
  if ([1, 2, 5, 6, 8, 9, 19, 21, 23, 25, 27, 29, 31, 32, 68, 70, 71, 72].includes(id)) return 'nature';
  return 'building';
}

function populateBlockCatalog(selectedCat = currentCatalogCategory) {
  currentCatalogCategory = selectedCat;
  if (!catalogGrid) return;
  catalogGrid.innerHTML = '';

  Object.values(BLOCK_DEFS).forEach(def => {
    if (def.id === BLOCK_TYPES.AIR) return;
    const cat = getBlockCategory(def);
    if (selectedCat !== 'all' && cat !== selectedCat) return;

    const card = document.createElement('div');
    card.className = 'block-card';

    const icon = document.createElement('img');
    icon.className = 'block-card-icon';
    icon.src = getBlockPreviewDataURL(def.id);
    icon.alt = def.name;

    const name = document.createElement('span');
    name.className = 'block-card-name';
    name.textContent = def.name;

    card.appendChild(icon);
    card.appendChild(name);

    card.addEventListener('click', () => {
      HOTBAR_BLOCKS[activeSlotIndex] = def.id;
      renderHotbar();
      player.setHeldBlock(def.id);
      closeModal('modal-inventory');
      soundEngine.playBlockPlace();
    });

    catalogGrid.appendChild(card);
  });
}

document.querySelectorAll('#catalog-category-tabs .cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#catalog-category-tabs .cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    populateBlockCatalog(tab.dataset.category);
  });
});

populateBlockCatalog('all');

// --- CHARACTER SKINS CUSTOMIZER ---
const skinsGrid = document.getElementById('skins-grid');

function getSkinPreviewDataURL(skinId) {
  const tex = player.skinManager.getArmTexture(skinId);
  if (tex && tex.image) {
    return tex.image.toDataURL();
  }
  return '';
}

function populateSkinsGrid() {
  if (!skinsGrid) return;
  skinsGrid.innerHTML = '';
  const currentSkinId = player.skinManager.currentSkinId;

  Object.values(SKINS).forEach(skin => {
    const card = document.createElement('div');
    card.className = `skin-card ${skin.id === currentSkinId ? 'active' : ''}`;
    card.dataset.skinId = skin.id;

    const img = document.createElement('img');
    img.className = 'skin-preview-arm';
    img.src = getSkinPreviewDataURL(skin.id);
    img.alt = skin.name;

    const name = document.createElement('span');
    name.className = 'skin-card-name';
    name.textContent = skin.name;

    const desc = document.createElement('span');
    desc.className = 'skin-card-desc';
    desc.textContent = skin.description;

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(desc);

    card.addEventListener('click', () => {
      player.setSkin(skin.id);
      document.querySelectorAll('.skin-card').forEach(c => {
        c.classList.toggle('active', c.dataset.skinId === skin.id);
      });
      soundEngine.playBlockPlace();
    });

    skinsGrid.appendChild(card);
  });
}
populateSkinsGrid();

// --- INPUT & CONTROLS ---
const controls = new InputManager(canvas, camera, player, {
  onPointerLockChange: (isLocked) => {
    const welcome = document.getElementById('click-to-play');
    if (isLocked) {
      welcome.classList.add('hidden');
      soundEngine.resume();
    }
  },
  onFlyToggle: (isFlying) => {
    flightBadge.classList.toggle('hidden', !isFlying);
    const descendBtn = document.getElementById('btn-descend');
    if (descendBtn) descendBtn.classList.toggle('hidden', !isFlying);
    const jumpBtnLabel = document.querySelector('#btn-jump .label');
    if (jumpBtnLabel) {
      jumpBtnLabel.textContent = isFlying ? 'ASCEND' : 'JUMP';
    }
  },
  onSelectSlot: (slotIdx) => {
    selectHotbarSlot(slotIdx);
  },
  onOpenAIModal: () => {
    openModal('modal-ai');
  },
  onOpenInventory: () => {
    openModal('modal-inventory');
  },
  onTogglePaintMode: () => {
    togglePaintMode();
  },
  onColorChange: (newHex) => {
    updateActiveColorUI(newHex);
  }
});

// --- MODAL HELPERS ---
function openModal(modalId) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('hidden');
  // Exit pointer lock while modal is open
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    closeModal(btn.dataset.close);
  });
});

// Close modal on click outside card
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

// Click to play button
const startGame = () => {
  soundEngine.init();
  soundEngine.resume();
  document.getElementById('click-to-play').classList.add('hidden');
  if (!controls.isMobile) {
    canvas.requestPointerLock();
  }
};

document.getElementById('btn-start-game').addEventListener('click', startGame);
document.getElementById('click-to-play')?.addEventListener('touchstart', (e) => {
  if (e.target.id === 'btn-start-game' || e.target.closest('#btn-start-game')) {
    startGame();
  }
}, { passive: true });

// Top toolbar events
document.getElementById('btn-world-select')?.addEventListener('click', () => openModal('modal-worlds'));
document.getElementById('btn-ai-prompt').addEventListener('click', () => openModal('modal-ai'));
document.getElementById('btn-skins')?.addEventListener('click', () => {
  populateSkinsGrid();
  openModal('modal-skins');
});
document.getElementById('btn-settings').addEventListener('click', () => {
  if (settingWorldType) settingWorldType.value = world.worldType;
  openModal('modal-settings');
});
document.getElementById('btn-help').addEventListener('click', () => openModal('modal-help'));
document.getElementById('btn-inventory-mobile')?.addEventListener('click', () => openModal('modal-inventory'));
document.getElementById('btn-ai-mobile')?.addEventListener('click', () => openModal('modal-ai'));

// World Management & UI
const worldBadgeText = document.getElementById('world-badge-text');
const settingWorldType = document.getElementById('setting-world-type');

function updateWorldUI(type) {
  const label = type === 'baseplate' ? 'Baseplate' : 'Normal World';
  if (worldBadgeText) worldBadgeText.textContent = label;
  if (settingWorldType) settingWorldType.value = type;

  document.querySelectorAll('.world-card').forEach(card => {
    card.classList.toggle('active', card.dataset.worldId === type);
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

function handleSwitchWorld(newType) {
  if (world.worldType === newType) return;
  world.switchWorld(newType);
  updateWorldUI(newType);

  // Teleport player safely to surface
  const pX = 8;
  const pZ = 8;
  const pY = world.getSurfaceY(pX, pZ) + 1.5;
  player.position.set(pX, pY, pZ);
  player.velocity.set(0, 0, 0);

  showToast(`Switched to ${newType === 'baseplate' ? 'Classic Baseplate' : 'Normal World'}!`);
}

// Initial World UI Sync
updateWorldUI(world.worldType);

// World Card selection in modal-worlds
document.querySelectorAll('.world-card').forEach(card => {
  card.addEventListener('click', () => {
    const targetWorld = card.dataset.worldId;
    handleSwitchWorld(targetWorld);
    closeModal('modal-worlds');
  });
});

// Time of day toggle button
const timeIcon = document.getElementById('time-icon');
document.getElementById('btn-time').addEventListener('click', () => {
  if (timeOfDay < 0.2) {
    timeOfDay = 0.25; // Sunset
    timeIcon.textContent = '🌅';
  } else if (timeOfDay < 0.45) {
    timeOfDay = 0.55; // Night
    timeIcon.textContent = '🌙';
  } else if (timeOfDay < 0.7) {
    timeOfDay = 0.78; // Sunrise
    timeIcon.textContent = '🌄';
  } else {
    timeOfDay = 0.05; // Noon
    timeIcon.textContent = '☀️';
  }
  soundEngine.playFootstep('stone');
});

// Sound toggle
const audioIcon = document.getElementById('audio-icon');
document.getElementById('btn-audio').addEventListener('click', () => {
  soundEngine.resume();
  const muted = soundEngine.toggleMute();
  audioIcon.textContent = muted ? '🔇' : '🔊';
});

// --- AI GENERATOR UI INTERACTION ---
const aiPromptInput = document.getElementById('ai-prompt-input');
const aiSizeSelect = document.getElementById('ai-size-select');
const aiProgressBox = document.getElementById('ai-progress-box');
const aiProgressText = document.getElementById('ai-progress-text');
const aiProgressBar = document.getElementById('ai-progress-bar');
const btnGenerateAI = document.getElementById('btn-generate-ai');
const btnAIUndo = document.getElementById('btn-ai-undo');

// Preset chip selection
document.querySelectorAll('.preset-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    aiPromptInput.value = chip.dataset.prompt;
    aiPromptInput.focus();
  });
});

// Generate button
btnGenerateAI.addEventListener('click', async () => {
  const prompt = aiPromptInput.value.trim();
  if (!prompt) {
    alert('Please enter a description of the structure you want AI to generate!');
    return;
  }

  const size = aiSizeSelect.value;
  btnGenerateAI.disabled = true;
  aiProgressBox.classList.remove('hidden');
  aiProgressBar.style.width = '0%';
  aiProgressText.textContent = 'Consulting Gemini AI architect...';

  // Compute look direction in front of player
  const lookDir = new THREE.Vector3();
  camera.getWorldDirection(lookDir);
  lookDir.y = 0;
  if (lookDir.lengthSq() < 0.01) lookDir.set(0, 0, 1);
  lookDir.normalize();

  try {
    const result = await aiGenerator.generateStructure(prompt, player.position, lookDir, size, (prog) => {
      if (prog.status === 'materializing') {
        aiProgressBar.style.width = `${prog.percent}%`;
        aiProgressText.textContent = prog.message;
      } else {
        aiProgressText.textContent = prog.message;
      }
    });

    aiProgressText.textContent = `Completed! Built ${result.name} (${result.blockCount} voxels)`;
    aiProgressBar.style.width = '100%';

    setTimeout(() => {
      closeModal('modal-ai');
      aiProgressBox.classList.add('hidden');
      btnGenerateAI.disabled = false;
    }, 1000);
  } catch (err) {
    console.error('AI Generation error:', err);
    aiProgressText.textContent = `Error: ${err.message}`;
    btnGenerateAI.disabled = false;
  }
});

// Undo AI build button
btnAIUndo.addEventListener('click', () => {
  const success = aiGenerator.undo();
  if (success) {
    alert('Previous AI structure reverted cleanly!');
  } else {
    alert('No previous AI structures in history to undo.');
  }
});

// Settings Modal inputs
const settingApiKey = document.getElementById('setting-api-key');
settingApiKey.value = aiGenerator.getApiKey();

const settingRenderDistance = document.getElementById('setting-render-distance');
if (settingRenderDistance) {
  settingRenderDistance.value = String(currentRenderRadius);
}

document.getElementById('btn-save-settings').addEventListener('click', () => {
  aiGenerator.setApiKey(settingApiKey.value);
  timeSpeed = parseFloat(document.getElementById('setting-time-speed').value) * 0.005;

  if (settingRenderDistance) {
    const newRadius = parseInt(settingRenderDistance.value);
    if (newRadius !== currentRenderRadius) {
      currentRenderRadius = newRadius;
      localStorage.setItem('theo_render_distance', String(currentRenderRadius));
      const pcx = Math.floor(player.position.x / CHUNK_SIZE_X);
      const pcz = Math.floor(player.position.z / CHUNK_SIZE_Z);
      world.initArea(pcx, pcz, currentRenderRadius);
    }
  }

  if (settingWorldType && settingWorldType.value !== world.worldType) {
    handleSwitchWorld(settingWorldType.value);
  }

  closeModal('modal-settings');
  alert('Settings saved successfully!');
});

document.getElementById('btn-test-api').addEventListener('click', async () => {
  const msgEl = document.getElementById('api-status-msg');
  msgEl.textContent = 'Testing connection...';
  msgEl.style.color = '#38bdf8';
  try {
    const key = settingApiKey.value.trim() || DEFAULT_GEMINI_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Respond with the word OK' }] }]
      })
    });
    if (res.ok) {
      msgEl.textContent = 'Connection verified! Gemini API is active.';
      msgEl.style.color = '#34d399';
    } else {
      const err = await res.json().catch(() => ({}));
      msgEl.textContent = `Error: ${err?.error?.message || 'Check key and permissions'}`;
      msgEl.style.color = '#f43f5e';
    }
  } catch (err) {
    msgEl.textContent = `Failed: ${err.message}`;
    msgEl.style.color = '#f43f5e';
  }
});

// --- BLOCK COLORING & PAINTING TOOL ---
const colorPaletteBar = document.getElementById('color-palette-bar');
const btnToggleColor = document.getElementById('btn-toggle-color');
const btnColorMobile = document.getElementById('btn-color-mobile');
const btnClosePalette = document.getElementById('btn-close-palette');
const activeColorBadge = document.getElementById('active-color-badge');
const customColorInput = document.getElementById('custom-color-input');
const checkAutoTint = document.getElementById('check-auto-tint');
const swatches = document.querySelectorAll('.color-swatch');
const reticleRing = document.querySelector('.reticle-ring');
const reticleDot = document.querySelector('.reticle-dot');
const placeBtnLabel = document.querySelector('#btn-place .label');

function updateActiveColorUI(colorHex) {
  if (colorHex === 'reset' || !colorHex) {
    player.activeColor = null;
    if (activeColorBadge) {
      activeColorBadge.style.backgroundColor = 'transparent';
      activeColorBadge.style.border = '1.5px dashed #fff';
    }
    if (reticleDot) reticleDot.style.background = 'var(--cyan-primary)';
    if (reticleRing) reticleRing.style.borderColor = 'rgba(56, 189, 248, 0.6)';
  } else {
    player.activeColor = colorHex;
    if (activeColorBadge) {
      activeColorBadge.style.backgroundColor = colorHex;
      activeColorBadge.style.border = '1.5px solid #fff';
    }
    if (customColorInput) customColorInput.value = colorHex;
    if (player.isPaintMode) {
      if (reticleDot) reticleDot.style.background = colorHex;
      if (reticleRing) reticleRing.style.borderColor = colorHex;
    }
  }

  swatches.forEach(s => {
    if (colorHex === 'reset' || !colorHex) {
      s.classList.toggle('active', s.dataset.color === 'reset');
    } else {
      s.classList.toggle('active', s.dataset.color && s.dataset.color.toLowerCase() === colorHex.toLowerCase());
    }
  });
}

function togglePaintMode(forceState = null) {
  player.isPaintMode = forceState !== null ? forceState : !player.isPaintMode;
  const active = player.isPaintMode;

  if (colorPaletteBar) colorPaletteBar.classList.toggle('hidden', !active);
  if (btnToggleColor) btnToggleColor.classList.toggle('active', active);
  if (btnColorMobile) btnColorMobile.classList.toggle('active', active);

  if (active) {
    soundEngine.playPaintSound();
    if (placeBtnLabel) placeBtnLabel.textContent = 'PAINT';
    if (reticleDot) reticleDot.style.background = player.activeColor || 'var(--cyan-primary)';
    if (reticleRing) reticleRing.style.borderColor = player.activeColor || 'var(--cyan-primary)';
  } else {
    if (placeBtnLabel) placeBtnLabel.textContent = 'BUILD';
    if (reticleDot) reticleDot.style.background = 'var(--cyan-primary)';
    if (reticleRing) reticleRing.style.borderColor = 'rgba(56, 189, 248, 0.6)';
  }
}

if (btnToggleColor) {
  btnToggleColor.addEventListener('click', () => togglePaintMode());
}
if (btnColorMobile) {
  btnColorMobile.addEventListener('click', () => togglePaintMode());
}
if (btnClosePalette) {
  btnClosePalette.addEventListener('click', () => togglePaintMode(false));
}

swatches.forEach(swatch => {
  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    const col = swatch.dataset.color;
    updateActiveColorUI(col);
    if (!player.isPaintMode) togglePaintMode(true);
    else soundEngine.playClick();
  });
});

if (customColorInput) {
  customColorInput.addEventListener('input', (e) => {
    updateActiveColorUI(e.target.value);
    if (!player.isPaintMode) togglePaintMode(true);
  });
}

if (checkAutoTint) {
  checkAutoTint.addEventListener('change', (e) => {
    player.autoTintOnPlace = e.target.checked;
  });
}

// --- PERFORMANCE & HUD UPDATES ---
const posDisplay = document.getElementById('pos-display');
const fpsDisplay = document.getElementById('fps-display');
let frameCount = 0;
let lastFpsTime = performance.now();

// Resize listener
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Dynamic chunk streamer around player
let lastPlayerChunkX = null;
let lastPlayerChunkZ = null;

function updateChunkStreaming() {
  const pcx = Math.floor(player.position.x / CHUNK_SIZE_X);
  const pcz = Math.floor(player.position.z / CHUNK_SIZE_Z);

  if (pcx !== lastPlayerChunkX || pcz !== lastPlayerChunkZ) {
    lastPlayerChunkX = pcx;
    lastPlayerChunkZ = pcz;

    world.updateChunkStreaming(player.position.x, player.position.z, currentRenderRadius);
  }
}

// --- MAIN RENDER LOOP ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);

  // Atmosphere & day/night lighting
  updateAtmosphere(delta);

  // Player & Controls update
  const input = controls.getInput();
  player.update(delta, input);

  // Chunk streaming
  updateChunkStreaming();

  // Particles & ambient fireflies
  particleSystem.update(delta, player.position);

  // Render
  renderer.render(scene, camera);

  // HUD stats update
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 500) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    fpsDisplay.textContent = fps;
    frameCount = 0;
    lastFpsTime = now;

    posDisplay.textContent = `X: ${Math.floor(player.position.x)}, Y: ${Math.floor(player.position.y)}, Z: ${Math.floor(player.position.z)}`;
  }
}

animate();
