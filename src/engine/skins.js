import * as THREE from 'three';

export const SKINS = {
  THEO: {
    id: 'THEO',
    name: "Theo (Master Architect)",
    description: "Quantum nanotech suit with titanium gauntlets, gold auric trim, and cyan plasma conduits",
    baseColor: '#0f2438',
    armorColor: '#1e3a5f',
    trimColor: '#eab308',
    glowColor: '#00f0ff',
    gloveColor: '#0a1520',
    accentColor: '#38bdf8'
  },
  CYBER_STRIKER: {
    id: 'CYBER_STRIKER',
    name: "Cyber Striker V-2",
    description: "Matte carbon weave armor with illuminated electric cyan fiber-optic circuitry",
    baseColor: '#121214',
    armorColor: '#222328',
    trimColor: '#00ffff',
    glowColor: '#00ffff',
    gloveColor: '#08080a',
    accentColor: '#06b6d4'
  },
  VOID_WALKER: {
    id: 'VOID_WALKER',
    name: "Quantum Void Walker",
    description: "Deep obsidian battle-plate with pulsing amethyst void fractures and cosmic runes",
    baseColor: '#13091f',
    armorColor: '#25123d',
    trimColor: '#c084fc',
    glowColor: '#d946ef',
    gloveColor: '#0a0412',
    accentColor: '#9333ea'
  },
  SOLAR_AEGIS: {
    id: 'SOLAR_AEGIS',
    name: "Solarium Paladin",
    description: "Mirror-polished auric gold armor with radiant amber reactor core and sunburst engravings",
    baseColor: '#422006',
    armorColor: '#ca8a04',
    trimColor: '#fef08a',
    glowColor: '#f59e0b',
    gloveColor: '#291404',
    accentColor: '#fbbf24'
  },
  MAGMA_TITAN: {
    id: 'MAGMA_TITAN',
    name: "Magma Forged Titan",
    description: "Chiseled volcanic basalt armor plates with molten lava fissures and thermal exhaust vents",
    baseColor: '#210e0e',
    armorColor: '#3d1616',
    trimColor: '#ff5500',
    glowColor: '#ff3300',
    gloveColor: '#150808',
    accentColor: '#ea580c'
  },
  SPECTRE_OPERATIVE: {
    id: 'SPECTRE_OPERATIVE',
    name: "Spectre Operative",
    description: "Pearlescent white ceramic composite with carbon knuckles and emerald laser guides",
    baseColor: '#e2e8f0',
    armorColor: '#cbd5e1',
    trimColor: '#10b981',
    glowColor: '#34d399',
    gloveColor: '#334155',
    accentColor: '#059669'
  },
  CHRONO_SORCERER: {
    id: 'CHRONO_SORCERER',
    name: "Chrono Sorcerer",
    description: "Royal celestial midnight silk with golden clockwork inlays and azure temporal runes",
    baseColor: '#1e1b4b',
    armorColor: '#312e81',
    trimColor: '#fbbf24',
    glowColor: '#6366f1',
    gloveColor: '#0f0e26',
    accentColor: '#818cf8'
  },
  PRISMARINE_CORE: {
    id: 'PRISMARINE_CORE',
    name: "Abyssal Hydro-Guardian",
    description: "Iridescent aquamarine carapace with oceanic titanium bracers and bioluminescent gills",
    baseColor: '#064e3b',
    armorColor: '#0f766e',
    trimColor: '#2dd4bf',
    glowColor: '#14b8a6',
    gloveColor: '#042f2e',
    accentColor: '#5eead4'
  }
};

export class SkinManager {
  constructor() {
    this.currentSkinId = localStorage.getItem('theo_skin') || 'THEO';
    // Migration fallback in case an older skin key was saved
    if (!SKINS[this.currentSkinId]) {
      this.currentSkinId = 'THEO';
    }
    this.diffuseTextures = new Map();
    this.emissiveTextures = new Map();
  }

  getSkin(skinId = this.currentSkinId) {
    return SKINS[skinId] || SKINS.THEO;
  }

  setSkin(skinId) {
    if (SKINS[skinId]) {
      this.currentSkinId = skinId;
      localStorage.setItem('theo_skin', skinId);
    }
  }

  // Generate high-resolution 64x128 pixel art diffuse and emissive textures
  generateSkinTextures(skinId = this.currentSkinId) {
    if (this.diffuseTextures.has(skinId) && this.emissiveTextures.has(skinId)) {
      return {
        diffuse: this.diffuseTextures.get(skinId),
        emissive: this.emissiveTextures.get(skinId)
      };
    }

    const skin = this.getSkin(skinId);
    const W = 64;
    const H = 128;

    // 1. DIFFUSE CANVAS
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = W;
    diffCanvas.height = H;
    const ctx = diffCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 2. EMISSIVE CANVAS (Black background with glowing elements)
    const emCanvas = document.createElement('canvas');
    emCanvas.width = W;
    emCanvas.height = H;
    const emCtx = emCanvas.getContext('2d');
    emCtx.imageSmoothingEnabled = false;
    emCtx.fillStyle = '#000000';
    emCtx.fillRect(0, 0, W, H);

    // --- BASE LAYER: Bicep / Upper Arm (Y: 0 to 44) ---
    // Gradient fabric base
    const upperGrad = ctx.createLinearGradient(0, 0, W, 0);
    upperGrad.addColorStop(0, skin.baseColor);
    upperGrad.addColorStop(0.5, skin.accentColor);
    upperGrad.addColorStop(1, skin.baseColor);
    ctx.fillStyle = upperGrad;
    ctx.fillRect(0, 0, W, 44);

    // Subtle carbon/hex cross-hatching
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < 44; y += 4) {
      for (let x = 0; x < W; x += 4) {
        if ((x + y) % 8 === 0) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    // Shoulder pauldron trim & seam
    ctx.fillStyle = skin.trimColor;
    ctx.fillRect(0, 0, W, 4);
    ctx.fillRect(0, 40, W, 4);

    // Glowing upper-arm conduit lines
    emCtx.fillStyle = skin.glowColor;
    emCtx.fillRect(14, 8, 4, 30);
    emCtx.fillRect(46, 8, 4, 30);
    emCtx.fillRect(18, 22, 28, 4);

    ctx.fillStyle = skin.glowColor;
    ctx.fillRect(14, 8, 4, 30);
    ctx.fillRect(46, 8, 4, 30);
    ctx.fillRect(18, 22, 28, 4);

    // --- ELBOW BRACER RING (Y: 44 to 54) ---
    ctx.fillStyle = skin.trimColor;
    ctx.fillRect(0, 44, W, 10);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 52, W, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(0, 44, W, 2);

    // Center emitter diode
    emCtx.fillStyle = skin.glowColor;
    emCtx.fillRect(28, 46, 8, 6);
    ctx.fillStyle = skin.glowColor;
    ctx.fillRect(28, 46, 8, 6);

    // --- FOREARM GAUNTLET (Y: 54 to 98) ---
    // Heavy armor plate
    const armGrad = ctx.createLinearGradient(0, 54, W, 54);
    armGrad.addColorStop(0, skin.armorColor);
    armGrad.addColorStop(0.3, skin.accentColor);
    armGrad.addColorStop(0.7, skin.armorColor);
    armGrad.addColorStop(1, skin.armorColor);
    ctx.fillStyle = armGrad;
    ctx.fillRect(0, 54, W, 44);

    // Beveled armor plates
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(6, 56, W - 12, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(6, 95, W - 12, 3);

    // Sci-Fi Circuit Conduits & Data Glyph
    emCtx.fillStyle = skin.glowColor;
    // Main vertical power trace
    emCtx.fillRect(30, 58, 4, 34);
    // Angular circuit branches
    emCtx.fillRect(12, 64, 18, 3);
    emCtx.fillRect(12, 64, 3, 14);
    emCtx.fillRect(34, 78, 18, 3);
    emCtx.fillRect(49, 70, 3, 11);

    // Wrist Hologram / Chronometer Display Screen
    emCtx.fillRect(20, 88, 24, 6);

    ctx.fillStyle = skin.glowColor;
    ctx.fillRect(30, 58, 4, 34);
    ctx.fillRect(12, 64, 18, 3);
    ctx.fillRect(12, 64, 3, 14);
    ctx.fillRect(34, 78, 18, 3);
    ctx.fillRect(49, 70, 3, 11);
    ctx.fillRect(20, 88, 24, 6);

    // Screen border
    ctx.fillStyle = skin.trimColor;
    ctx.strokeRect(19, 87, 26, 8);

    // --- WRIST CUFF (Y: 98 to 106) ---
    ctx.fillStyle = skin.trimColor;
    ctx.fillRect(0, 98, W, 8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 104, W, 2);

    // --- GAUNTLET HAND & KNUCKLES (Y: 106 to 128) ---
    ctx.fillStyle = skin.gloveColor;
    ctx.fillRect(0, 106, W, 22);

    // Armored knuckle plates (4 knuckles)
    for (let k = 0; k < 4; k++) {
      const kx = 6 + k * 14;
      ctx.fillStyle = skin.armorColor;
      ctx.fillRect(kx, 110, 10, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(kx, 110, 10, 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(kx, 116, 10, 2);

      // Knuckle glow node
      emCtx.fillStyle = skin.glowColor;
      emCtx.fillRect(kx + 3, 113, 4, 2);
      ctx.fillStyle = skin.glowColor;
      ctx.fillRect(kx + 3, 113, 4, 2);
    }

    // Textured grip on fingertips
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(4, 122, W - 8, 4);

    // Build Three.js textures
    const diffTexture = new THREE.CanvasTexture(diffCanvas);
    diffTexture.magFilter = THREE.NearestFilter;
    diffTexture.minFilter = THREE.NearestFilter;
    diffTexture.generateMipmaps = false;

    const emTexture = new THREE.CanvasTexture(emCanvas);
    emTexture.magFilter = THREE.NearestFilter;
    emTexture.minFilter = THREE.NearestFilter;
    emTexture.generateMipmaps = false;

    this.diffuseTextures.set(skinId, diffTexture);
    this.emissiveTextures.set(skinId, emTexture);

    return { diffuse: diffTexture, emissive: emTexture };
  }

  getArmTexture(skinId = this.currentSkinId) {
    return this.generateSkinTextures(skinId).diffuse;
  }

  getEmissiveTexture(skinId = this.currentSkinId) {
    return this.generateSkinTextures(skinId).emissive;
  }
}
