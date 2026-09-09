import * as THREE from 'three';

// 32x32 Authentic Roblox Aesthetic Texture Atlas Generator for Theo's Generate
// Features signature circular studs, smooth plastic, vibrant primary colors, and clean materials.
export class TextureAtlas {
  constructor() {
    this.tileSize = 32;
    this.atlasCols = 16; // 16x16 = 256 tile capacity
    this.atlasRows = 16;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.tileSize * this.atlasCols;
    this.canvas.height = this.tileSize * this.atlasRows;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    this.tileIndices = {};
    this.currentTile = 0;

    this.generateAllTextures();

    // Three.js Texture with smooth linear filtering and mipmaps
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.generateMipmaps = true;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  getTileUV(name) {
    const idx = this.tileIndices[name] !== undefined ? this.tileIndices[name] : 0;
    const col = idx % this.atlasCols;
    const row = Math.floor(idx / this.atlasCols);

    const eps = 0.0001;
    const u0 = (col / this.atlasCols) + eps;
    const v0 = (1 - (row + 1) / this.atlasRows) + eps;
    const u1 = ((col + 1) / this.atlasCols) - eps;
    const v1 = (1 - row / this.atlasRows) - eps;

    return { u0, v0, u1, v1 };
  }

  registerTile(name, drawPixels) {
    const idx = this.currentTile++;
    this.tileIndices[name] = idx;
    const col = idx % this.atlasCols;
    const row = Math.floor(idx / this.atlasCols);
    const originX = col * this.tileSize;
    const originY = row * this.tileSize;

    this.ctx.save();
    this.ctx.translate(originX, originY);
    this.ctx.clearRect(0, 0, this.tileSize, this.tileSize);
    drawPixels(this.ctx, this.tileSize);
    this.ctx.restore();
  }

  // --- SIGNATURE ROBLOX GRAPHIC PRIMITIVES ---

  // Classic Roblox 4-Stud Top Face
  drawStuds(ctx, baseCol, studCol, shadowCol, highlightCol, drawGrid = true) {
    ctx.fillStyle = baseCol;
    ctx.fillRect(0, 0, 32, 32);

    // Subtle edge grid line (classic Roblox part seam)
    if (drawGrid) {
      ctx.strokeStyle = shadowCol;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 31, 31);
    }

    // 4 Roblox Studs (2x2 grid)
    const centers = [
      [8, 8], [24, 8], [8, 24], [24, 24]
    ];
    const r = 4.8;

    centers.forEach(([cx, cy]) => {
      // 1. Soft stud cast shadow
      ctx.fillStyle = shadowCol;
      ctx.beginPath();
      ctx.arc(cx, cy + 1.2, r, 0, Math.PI * 2);
      ctx.fill();

      // 2. Stud cylinder body with directional gradient
      const sg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      sg.addColorStop(0, highlightCol);
      sg.addColorStop(0.35, studCol);
      sg.addColorStop(1, shadowCol);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // 3. Top rim specular highlight
      ctx.strokeStyle = highlightCol;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy - 0.4, r - 0.6, 0, Math.PI * 2);
      ctx.stroke();

      // 4. Center stud indent circle (iconic Roblox core)
      ctx.fillStyle = shadowCol;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Smooth Plastic Side
  drawSmoothPlastic(ctx, baseCol, lightCol, shadowCol) {
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, lightCol);
    g.addColorStop(0.08, baseCol);
    g.addColorStop(0.92, baseCol);
    g.addColorStop(1, shadowCol);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);

    // Subtle edge bevel
    ctx.strokeStyle = shadowCol;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(0.5, 0.5, 31, 31);
  }

  // Clean Roblox Wood Planks
  drawPlanks(ctx, baseCol, lineCol, shadowCol, lightCol) {
    ctx.fillStyle = baseCol;
    ctx.fillRect(0, 0, 32, 32);

    // 4 horizontal plank boards
    for (let p = 0; p < 4; p++) {
      const y = p * 8;
      ctx.fillStyle = lightCol;
      ctx.fillRect(0, y, 32, 1);
      ctx.fillStyle = shadowCol;
      ctx.fillRect(0, y + 7, 32, 1);
      ctx.fillStyle = lineCol;
      ctx.fillRect(0, y + 7.5, 32, 0.5);
    }

    // Vertical seams
    ctx.fillStyle = lineCol;
    ctx.fillRect(15, 0, 1, 8);
    ctx.fillRect(23, 8, 1, 8);
    ctx.fillRect(7, 16, 1, 8);
    ctx.fillRect(19, 24, 1, 8);
  }

  // Classic Roblox Slate / Stone
  drawSlate(ctx, baseCol, darkCol, lightCol) {
    ctx.fillStyle = baseCol;
    ctx.fillRect(0, 0, 32, 32);

    // Clean subtle slate strata
    ctx.strokeStyle = darkCol;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 9); ctx.lineTo(32, 10);
    ctx.moveTo(0, 20); ctx.lineTo(32, 19);
    ctx.stroke();

    ctx.strokeStyle = lightCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 10.5); ctx.lineTo(32, 11.5);
    ctx.moveTo(0, 21.5); ctx.lineTo(32, 20.5);
    ctx.stroke();

    ctx.strokeStyle = darkCol;
    ctx.strokeRect(0.5, 0.5, 31, 31);
  }

  // Pure glowing Neon Part
  drawNeon(ctx, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 32, 32);
    // Pure inner bloom
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(16, 16, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- TEXTURE REGISTRATIONS ---

  generateAllTextures() {
    // 1. ROBLOX BASEPLATE: Medium Stone Grey with iconic studs
    this.registerTile('baseplate_top', (ctx) => {
      this.drawStuds(ctx, '#636466', '#696a6c', '#464749', '#8a8b8d', true);
    });
    this.registerTile('baseplate_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#636466', '#7e7f82', '#4b4c4e');
    });

    // 2. ROBLOX SPAWN PAD: Classic blue/white directional emblem
    this.registerTile('spawn_plate_top', (ctx) => {
      this.drawStuds(ctx, '#0d69ac', '#117ecf', '#074878', '#54b4f5', true);
      // White spawn symbol
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(16, 16, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0d69ac';
      ctx.beginPath();
      ctx.arc(16, 16, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(16, 16, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. ROBLOX GRASS: Signature green plastic with studs
    this.registerTile('grass_top', (ctx) => {
      this.drawStuds(ctx, '#3aa322', '#44ba29', '#277017', '#60d941', true);
    });
    this.registerTile('grass_side', (ctx) => {
      // Dirt brown base with bright green plastic rim on top
      ctx.fillStyle = '#784c28';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#3aa322';
      ctx.fillRect(0, 0, 32, 8);
      ctx.fillStyle = '#60d941';
      ctx.fillRect(0, 0, 32, 1.5);
      ctx.strokeStyle = '#543419';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(0.5, 0.5, 31, 31);
    });

    // 4. ROBLOX DIRT
    this.registerTile('dirt', (ctx) => {
      this.drawSmoothPlastic(ctx, '#784c28', '#946137', '#543419');
    });

    // 5. ROBLOX STONE & COBBLESTONE
    this.registerTile('stone', (ctx) => {
      this.drawStuds(ctx, '#7b7c82', '#86878e', '#595a60', '#a4a5ad', true);
    });
    this.registerTile('cobblestone', (ctx) => {
      this.drawSlate(ctx, '#686970', '#4a4a50', '#8c8d96');
    });

    // 6. ROBLOX WOOD LOGS & PLANKS
    this.registerTile('wood_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#604325', '#7d5934', '#422c15');
    });
    this.registerTile('wood_top', (ctx) => {
      this.drawStuds(ctx, '#9e7b4a', '#ab8754', '#70542e', '#c49e68', true);
    });
    this.registerTile('oak_planks', (ctx) => {
      this.drawPlanks(ctx, '#ba9558', '#685332', '#826437', '#d9b375');
    });

    // 7. ROBLOX LEAVES: Clean stylized green foliage
    this.registerTile('leaves', (ctx) => {
      ctx.fillStyle = '#2d8c1c';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#3eb526';
      ctx.fillRect(3, 3, 10, 10);
      ctx.fillRect(19, 19, 10, 10);
      ctx.strokeStyle = '#1d5e12';
      ctx.strokeRect(0.5, 0.5, 31, 31);
    });

    // 8. ROBLOX GLASS: Crisp translucent sky-blue pane with bevel
    this.registerTile('glass', (ctx) => {
      ctx.fillStyle = 'rgba(180, 225, 255, 0.35)';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, 30, 30);
      // Clean specular reflection lines
      ctx.beginPath();
      ctx.moveTo(8, 2); ctx.lineTo(2, 8);
      ctx.moveTo(16, 2); ctx.lineTo(2, 16);
      ctx.stroke();
    });

    // 9. ROBLOX SAND
    this.registerTile('sand', (ctx) => {
      this.drawStuds(ctx, '#d9c282', '#e5cf91', '#b39d62', '#fae7aa', true);
    });

    // 10. ROBLOX WATER
    this.registerTile('water', (ctx) => {
      ctx.fillStyle = 'rgba(28, 125, 217, 0.78)';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 0.5, 31, 31);
      ctx.beginPath();
      ctx.arc(16, 16, 9, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 11. ROBLOX RED BRICKS
    this.registerTile('bricks', (ctx) => {
      ctx.fillStyle = '#c4281c';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      // Classic white brick mortar lines
      for (let y = 0; y <= 32; y += 8) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(32, y); ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(16, 8);
      ctx.moveTo(8, 8); ctx.lineTo(8, 16); ctx.moveTo(24, 8); ctx.lineTo(24, 16);
      ctx.moveTo(16, 16); ctx.lineTo(16, 24);
      ctx.moveTo(8, 24); ctx.lineTo(8, 32); ctx.moveTo(24, 24); ctx.lineTo(24, 32);
      ctx.stroke();
    });

    // 12. ROBLOX ROOF TILES
    this.registerTile('roof_tile', (ctx) => {
      this.drawStuds(ctx, '#b83b23', '#c9472e', '#8a2411', '#e56147', true);
    });

    // 13. ROBLOX STUD BRICKS (Primary Colors)
    this.registerTile('stud_red_top', (ctx) => {
      this.drawStuds(ctx, '#c4281c', '#d63428', '#941b12', '#f25044', true);
    });
    this.registerTile('stud_red_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#c4281c', '#e63d30', '#8f1a11');
    });

    this.registerTile('stud_blue_top', (ctx) => {
      this.drawStuds(ctx, '#0d69ac', '#137bc7', '#084b7d', '#3ea4ed', true);
    });
    this.registerTile('stud_blue_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#0d69ac', '#1c88d9', '#084573');
    });

    this.registerTile('stud_yellow_top', (ctx) => {
      this.drawStuds(ctx, '#f5cd30', '#fad846', '#c29f19', '#fff08a', true);
    });
    this.registerTile('stud_yellow_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#f5cd30', '#fae066', '#bd980f');
    });

    // 14. METALLIC BLOCKS (Gold, Iron, Diamond)
    this.registerTile('gold', (ctx) => {
      this.drawStuds(ctx, '#e8b827', '#f7c936', '#b58c14', '#ffe778', true);
    });
    this.registerTile('diamond', (ctx) => {
      this.drawStuds(ctx, '#2cc4c4', '#3cd4d4', '#1b8f8f', '#82ffff', true);
    });
    this.registerTile('iron', (ctx) => {
      this.drawSmoothPlastic(ctx, '#c8cdd4', '#e6eaf0', '#9da2a8');
    });

    // 15. NEON PARTS
    this.registerTile('neon_cyan', (ctx) => this.drawNeon(ctx, '#00ffff'));
    this.registerTile('neon_orange', (ctx) => this.drawNeon(ctx, '#ff6600'));
    this.registerTile('neon_pink', (ctx) => this.drawNeon(ctx, '#ff00aa'));

    // 16. GLOWSTONE / OBSIDIAN / MARBLE / BOOKSHELF / SNOW
    this.registerTile('glowstone', (ctx) => this.drawNeon(ctx, '#ffea47'));
    this.registerTile('obsidian', (ctx) => {
      this.drawStuds(ctx, '#1f162b', '#2e2040', '#0f0a17', '#4b3763', true);
    });
    this.registerTile('marble', (ctx) => {
      this.drawSmoothPlastic(ctx, '#f0f2f5', '#ffffff', '#caced4');
    });
    this.registerTile('bookshelf', (ctx) => {
      this.drawPlanks(ctx, '#7d5934', '#422c15', '#573a1d', '#9e7347');
    });
    this.registerTile('snow', (ctx) => {
      this.drawStuds(ctx, '#f0f5fc', '#ffffff', '#ccd9e8', '#ffffff', true);
    });

    // 17. EXPANDED WOODS & PLANKS
    this.registerTile('birch_wood', (ctx) => this.drawSmoothPlastic(ctx, '#d9d7ce', '#ffffff', '#a8a69e'));
    this.registerTile('birch_planks', (ctx) => this.drawPlanks(ctx, '#d9c8a0', '#8f7e5b', '#b09e76', '#f2e5c4'));
    this.registerTile('spruce_wood', (ctx) => this.drawSmoothPlastic(ctx, '#3b2b1a', '#543e26', '#241a0e'));
    this.registerTile('spruce_planks', (ctx) => this.drawPlanks(ctx, '#684e2c', '#3d2b14', '#4a361c', '#83653b'));
    this.registerTile('jungle_wood', (ctx) => this.drawSmoothPlastic(ctx, '#57461c', '#755e26', '#3b2f13'));
    this.registerTile('jungle_planks', (ctx) => this.drawPlanks(ctx, '#9e7352', '#69472e', '#7a5438', '#b58a69'));
    this.registerTile('acacia_wood', (ctx) => this.drawSmoothPlastic(ctx, '#655e54', '#827a6f', '#47423a'));
    this.registerTile('acacia_planks', (ctx) => this.drawPlanks(ctx, '#ba6336', '#7d3816', '#944822', '#d57f50'));
    this.registerTile('dark_oak_wood', (ctx) => this.drawSmoothPlastic(ctx, '#322312', '#4a351d', '#1f1509'));
    this.registerTile('dark_oak_planks', (ctx) => this.drawPlanks(ctx, '#442d17', '#221509', '#301d0d', '#593d23'));
    this.registerTile('cherry_wood', (ctx) => this.drawSmoothPlastic(ctx, '#4c2633', '#693647', '#301720'));
    this.registerTile('cherry_leaves', (ctx) => {
      ctx.fillStyle = '#fca5c6';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, 4, 8, 8); ctx.fillRect(20, 20, 8, 8);
    });
    this.registerTile('cherry_planks', (ctx) => this.drawPlanks(ctx, '#e49aa8', '#a85767', '#bf6e7f', '#f3b8c3'));

    // 18. ORES
    this.registerTile('coal_ore', (ctx) => this.drawStuds(ctx, '#333333', '#404040', '#1f1f1f', '#575757', true));
    this.registerTile('iron_ore', (ctx) => this.drawStuds(ctx, '#d8af93', '#e3c2ac', '#ab8367', '#f2d6c4', true));
    this.registerTile('copper_ore', (ctx) => this.drawStuds(ctx, '#cf6a42', '#de7c54', '#9e4624', '#eda182', true));
    this.registerTile('gold_ore', (ctx) => this.drawStuds(ctx, '#fcee4b', '#fff269', '#bfb21d', '#fff9ab', true));
    this.registerTile('redstone_ore', (ctx) => this.drawStuds(ctx, '#e61d1d', '#f53838', '#ab0707', '#ff7373', true));
    this.registerTile('lapis_ore', (ctx) => this.drawStuds(ctx, '#1747a6', '#225bcf', '#0e2f73', '#4f82f2', true));
    this.registerTile('emerald_ore', (ctx) => this.drawStuds(ctx, '#16c449', '#25d95b', '#0d8731', '#5ef58c', true));
    this.registerTile('diamond_ore', (ctx) => this.drawStuds(ctx, '#4ef0e4', '#66f5eb', '#24aba0', '#9efaf4', true));
    this.registerTile('quartz_ore', (ctx) => this.drawStuds(ctx, '#ded9cf', '#ece8e1', '#a8a399', '#ffffff', true));

    // 19. GEOLOGICAL STONES
    this.registerTile('granite', (ctx) => this.drawSmoothPlastic(ctx, '#986a59', '#b58270', '#6e4738'));
    this.registerTile('polished_granite', (ctx) => this.drawStuds(ctx, '#9e6d5b', '#b37f6d', '#784d3d', '#cca091', true));
    this.registerTile('diorite', (ctx) => this.drawSmoothPlastic(ctx, '#c4c4c5', '#e0e0e0', '#969698'));
    this.registerTile('polished_diorite', (ctx) => this.drawStuds(ctx, '#d5d5d6', '#e6e6e7', '#a3a3a4', '#ffffff', true));
    this.registerTile('andesite', (ctx) => this.drawSmoothPlastic(ctx, '#888889', '#a6a6a8', '#636364'));
    this.registerTile('polished_andisite', (ctx) => this.drawStuds(ctx, '#8a8a8b', '#a3a3a4', '#666667', '#c2c2c4', true));
    this.registerTile('deepslate', (ctx) => this.drawSmoothPlastic(ctx, '#4a4a52', '#62626c', '#313137'));
    this.registerTile('cobbled_deepslate', (ctx) => this.drawSlate(ctx, '#393940', '#242429', '#54545c'));
    this.registerTile('basalt', (ctx) => this.drawSmoothPlastic(ctx, '#4c4c52', '#63636b', '#333338'));
    this.registerTile('blackstone', (ctx) => this.drawStuds(ctx, '#2a242a', '#3b333b', '#171417', '#544954', true));
    this.registerTile('netherrack', (ctx) => this.drawSmoothPlastic(ctx, '#682525', '#853232', '#451616'));
    this.registerTile('soul_sand', (ctx) => this.drawSmoothPlastic(ctx, '#4d3b31', '#664f42', '#332720'));
    this.registerTile('end_stone', (ctx) => this.drawStuds(ctx, '#e0dfa7', '#ebeac0', '#b5b47d', '#faf9db', true));
    this.registerTile('prismarine', (ctx) => this.drawStuds(ctx, '#5d9c94', '#72b3ab', '#3f7069', '#96ded5', true));
    this.registerTile('dark_prismarine', (ctx) => this.drawSmoothPlastic(ctx, '#2f4f49', '#416b63', '#1c332e'));
    this.registerTile('sea_lantern', (ctx) => this.drawNeon(ctx, '#b4e8e1'));
    this.registerTile('amethyst', (ctx) => this.drawStuds(ctx, '#875ca6', '#9c6fbd', '#5d3d75', '#bd94de', true));

    // 20. UTILITY & INTERACTIVE
    this.registerTile('crafting_top', (ctx) => {
      this.drawStuds(ctx, '#9e724a', '#b08258', '#6e4c2c', '#c79b71', true);
    });
    this.registerTile('crafting_side', (ctx) => {
      this.drawPlanks(ctx, '#8f653d', '#523820', '#6d4b2b', '#b38454');
    });
    this.registerTile('furnace_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#737373', '#8f8f8f', '#4f4f4f');
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(8, 14, 16, 12);
    });
    this.registerTile('chest_top', (ctx) => {
      this.drawSmoothPlastic(ctx, '#88623b', '#a37748', '#5c4125');
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(13, 27, 6, 4);
    });
    this.registerTile('chest_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#88623b', '#a37748', '#5c4125');
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(13, 8, 6, 6);
    });
    this.registerTile('tnt_top', (ctx) => {
      this.drawStuds(ctx, '#c9382b', '#db4637', '#942319', '#f2685a', true);
    });
    this.registerTile('tnt_side', (ctx) => {
      ctx.fillStyle = '#c9382b';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 10, 32, 12);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('TNT', 6, 20);
    });
    this.registerTile('tnt_bottom', (ctx) => {
      this.drawSmoothPlastic(ctx, '#8f2319', '#b53326', '#61160e');
    });
    this.registerTile('sponge', (ctx) => {
      this.drawStuds(ctx, '#c4bf49', '#d4ce57', '#918d2f', '#ede779', true);
    });
    this.registerTile('slime', (ctx) => {
      ctx.fillStyle = 'rgba(95, 204, 75, 0.8)';
      ctx.fillRect(0, 0, 32, 32);
    });
    this.registerTile('honeycomb', (ctx) => {
      this.drawStuds(ctx, '#e8921a', '#fa9f23', '#ad6707', '#ffbc5e', true);
    });
    this.registerTile('hay_top', (ctx) => {
      this.drawStuds(ctx, '#a8942b', '#baa534', '#756619', '#d6c04f', true);
    });
    this.registerTile('hay_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#a8942b', '#baa534', '#756619');
      ctx.fillStyle = '#b01e1e';
      ctx.fillRect(0, 8, 32, 3); ctx.fillRect(0, 21, 32, 3);
    });

    // 21. NATURE & PLANTS
    this.registerTile('pumpkin_top', (ctx) => {
      this.drawStuds(ctx, '#cf6915', '#de7821', '#944607', '#f29549', true);
    });
    this.registerTile('pumpkin_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#cf6915', '#de7821', '#944607');
    });
    this.registerTile('jack_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#cf6915', '#de7821', '#944607');
      ctx.fillStyle = '#ffee44';
      ctx.beginPath();
      ctx.moveTo(6, 8); ctx.lineTo(12, 14); ctx.lineTo(6, 14); ctx.closePath(); ctx.fill();
      ctx.moveTo(26, 8); ctx.lineTo(20, 14); ctx.lineTo(26, 14); ctx.closePath(); ctx.fill();
      ctx.fillRect(6, 20, 20, 4);
    });
    this.registerTile('melon_top', (ctx) => {
      this.drawStuds(ctx, '#89a629', '#99ba30', '#5e7317', '#b5d943', true);
    });
    this.registerTile('melon_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#5c801d', '#729e24', '#3e5711');
    });
    this.registerTile('cactus_top', (ctx) => {
      this.drawStuds(ctx, '#4c7c22', '#599128', '#325215', '#73b839', true);
    });
    this.registerTile('cactus_side', (ctx) => {
      this.drawSmoothPlastic(ctx, '#4c7c22', '#599128', '#325215');
    });
    this.registerTile('cactus_bottom', (ctx) => {
      this.drawSmoothPlastic(ctx, '#3a6117', '#487a1c', '#243d0d');
    });
    this.registerTile('mushroom_red', (ctx) => {
      this.drawStuds(ctx, '#ba2825', '#cc312d', '#851917', '#e8514d', true);
    });

    // 22. VIBRANT ROBLOX PLASTIC PALETTE (10 Colors with Studs)
    this.registerTile('wool_white', (ctx) => {
      this.drawStuds(ctx, '#f2f3f3', '#ffffff', '#c5c7c9', '#ffffff', true);
    });
    this.registerTile('wool_red', (ctx) => {
      this.drawStuds(ctx, '#c4281c', '#d63428', '#941b12', '#f25044', true);
    });
    this.registerTile('wool_blue', (ctx) => {
      this.drawStuds(ctx, '#0d69ac', '#137bc7', '#084b7d', '#3ea4ed', true);
    });
    this.registerTile('wool_green', (ctx) => {
      this.drawStuds(ctx, '#287f46', '#329c57', '#1a572f', '#46c474', true);
    });
    this.registerTile('wool_yellow', (ctx) => {
      this.drawStuds(ctx, '#f5cd30', '#fad846', '#c29f19', '#fff08a', true);
    });
    this.registerTile('wool_black', (ctx) => {
      this.drawStuds(ctx, '#1b2a35', '#283c4a', '#0e171f', '#3f5a6e', true);
    });
    this.registerTile('wool_orange', (ctx) => {
      this.drawStuds(ctx, '#da8541', '#e89451', '#a66028', '#fab178', true);
    });
    this.registerTile('wool_purple', (ctx) => {
      this.drawStuds(ctx, '#6b327c', '#7e3d91', '#4b2157', '#a15ab8', true);
    });
    this.registerTile('wool_cyan', (ctx) => {
      this.drawStuds(ctx, '#00a2ff', '#24b0ff', '#0075b8', '#63c5ff', true);
    });
    this.registerTile('wool_pink', (ctx) => {
      this.drawStuds(ctx, '#e878a0', '#f28cb0', '#b55476', '#ffa8c5', true);
    });

    // =========================================================================
    // 23. AUTHENTIC 32x32 FURNITURE PIECES & PROPS
    // =========================================================================

    // 1. Red Plush Sofa
    this.registerTile('sofa_red_top', (ctx) => {
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(0, 0, 32, 32);
      // Left and right armrests
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(0, 0, 6, 32);
      ctx.fillRect(26, 0, 6, 32);
      // Two plush cushions in center with seam
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(7, 4, 8, 24);
      ctx.fillRect(17, 4, 8, 24);
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1;
      ctx.strokeRect(7, 4, 8, 24);
      ctx.strokeRect(17, 4, 8, 24);
    });
    this.registerTile('sofa_red_front', (ctx) => {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(0, 0, 32, 26);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(2, 4, 13, 18);
      ctx.fillRect(17, 4, 13, 18);
      // Wooden base trim & legs
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 24, 32, 3);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(2, 27, 4, 5);
      ctx.fillRect(26, 27, 4, 5);
    });
    this.registerTile('sofa_red_side', (ctx) => {
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(0, 0, 32, 26);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(16, 12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 24, 32, 3);
      ctx.fillRect(3, 27, 4, 5);
      ctx.fillRect(25, 27, 4, 5);
    });

    // 2. Blue Modern Sofa
    this.registerTile('sofa_blue_top', (ctx) => {
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 0, 6, 32);
      ctx.fillRect(26, 0, 6, 32);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(7, 4, 8, 24);
      ctx.fillRect(17, 4, 8, 24);
      ctx.strokeStyle = '#172554';
      ctx.strokeRect(7, 4, 8, 24);
      ctx.strokeRect(17, 4, 8, 24);
    });
    this.registerTile('sofa_blue_front', (ctx) => {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 0, 32, 26);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(2, 4, 13, 18);
      ctx.fillRect(17, 4, 13, 18);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 24, 32, 3);
      ctx.fillRect(2, 27, 4, 5);
      ctx.fillRect(26, 27, 4, 5);
    });
    this.registerTile('sofa_blue_side', (ctx) => {
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 0, 32, 26);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 24, 32, 3);
      ctx.fillRect(3, 27, 4, 5);
      ctx.fillRect(25, 27, 4, 5);
    });

    // 3. Oak Table
    this.registerTile('table_top', (ctx) => {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1.5, 1.5, 29, 29);
      ctx.strokeStyle = '#92400e';
      ctx.beginPath();
      ctx.moveTo(8, 2); ctx.lineTo(8, 30);
      ctx.moveTo(16, 2); ctx.lineTo(16, 30);
      ctx.moveTo(24, 2); ctx.lineTo(24, 30);
      ctx.stroke();
    });
    this.registerTile('table_side', (ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 0, 32, 6); // table apron top
      ctx.fillStyle = '#92400e';
      ctx.fillRect(2, 6, 5, 26);  // left leg
      ctx.fillRect(25, 6, 5, 26); // right leg
      // Open air center
      ctx.fillStyle = '#3e2008';
      ctx.fillRect(7, 6, 18, 26);
    });

    // 4. Wooden Chair
    this.registerTile('chair_seat', (ctx) => {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(4, 4, 24, 24);
      ctx.strokeStyle = '#78350f';
      ctx.strokeRect(4, 4, 24, 24);
    });
    this.registerTile('chair_front', (ctx) => {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(2, 10, 28, 4); // seat cushion edge
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 14, 4, 18);  // legs
      ctx.fillRect(24, 14, 4, 18);
      ctx.fillRect(4, 22, 24, 2);  // crossbar
    });
    this.registerTile('chair_back', (ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(3, 0, 26, 4);  // top rail
      ctx.fillRect(4, 4, 4, 28);   // side posts
      ctx.fillRect(24, 4, 4, 28);
      ctx.fillRect(11, 4, 3, 10);  // vertical slats
      ctx.fillRect(18, 4, 3, 10);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(2, 14, 28, 4);  // seat edge
    });
    this.registerTile('chair_side', (ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 0, 4, 32);   // back post
      ctx.fillRect(24, 14, 4, 18); // front leg
      ctx.fillStyle = '#b45309';
      ctx.fillRect(4, 14, 24, 4);  // seat
    });

    // 5. Beds (Red & Blue)
    this.registerTile('bed_red_top', (ctx) => {
      // White Pillow at top
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(3, 3, 26, 8);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(3, 3, 26, 8);
      // Duvet turn-down white sheet
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(3, 12, 26, 3);
      // Red quilted duvet blanket
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(3, 15, 26, 17);
      ctx.strokeStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(3, 23); ctx.lineTo(29, 23);
      ctx.moveTo(16, 15); ctx.lineTo(16, 32);
      ctx.stroke();
    });
    this.registerTile('bed_front', (ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 16, 32, 16);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(2, 26, 5, 6);
      ctx.fillRect(25, 26, 5, 6);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(2, 12, 28, 6);
    });
    this.registerTile('bed_red_side', (ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 18, 32, 14); // wooden rail
      ctx.fillStyle = '#92400e';
      ctx.fillRect(1, 24, 5, 8);   // legs
      ctx.fillRect(26, 24, 5, 8);
      // Red blanket drape & white pillow profile
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(6, 10, 26, 8);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(2, 8, 6, 8);
    });

    this.registerTile('bed_blue_top', (ctx) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(3, 3, 26, 8);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(3, 3, 26, 8);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(3, 12, 26, 3);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(3, 15, 26, 17);
      ctx.strokeStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.moveTo(3, 23); ctx.lineTo(29, 23);
      ctx.moveTo(16, 15); ctx.lineTo(16, 32);
      ctx.stroke();
    });
    this.registerTile('bed_blue_side', (ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 18, 32, 14);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(1, 24, 5, 8);
      ctx.fillRect(26, 24, 5, 8);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(6, 10, 26, 8);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(2, 8, 6, 8);
    });

    // 6. Warm Bedside Lamp
    this.registerTile('lamp_top', (ctx) => {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(16, 16, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    this.registerTile('lamp_side', (ctx) => {
      // Glow background
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 32, 32);
      // Trapezoid lampshade
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(10, 4); ctx.lineTo(22, 4);
      ctx.lineTo(26, 18); ctx.lineTo(6, 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.stroke();
      // Brass stem & pedestal
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(14, 18, 4, 10);
      ctx.fillRect(9, 28, 14, 3);
    });

    // 7. Flat Screen Television
    this.registerTile('tv_front', (ctx) => {
      ctx.fillStyle = '#0f172a'; // Black bezel
      ctx.fillRect(0, 0, 32, 32);
      // Vivid glowing TV screen display
      const tg = ctx.createLinearGradient(0, 2, 0, 26);
      tg.addColorStop(0, '#0369a1');
      tg.addColorStop(0.5, '#0284c7');
      tg.addColorStop(1, '#38bdf8');
      ctx.fillStyle = tg;
      ctx.fillRect(2, 2, 28, 22);
      // Screen reflection diagonal gloss
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(2, 2); ctx.lineTo(16, 2); ctx.lineTo(2, 16); ctx.closePath();
      ctx.fill();
      // Bottom chin & green power LED
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 24, 32, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(26, 25, 2, 2);
      // TV Stand
      ctx.fillStyle = '#475569';
      ctx.fillRect(13, 28, 6, 2);
      ctx.fillRect(10, 30, 12, 2);
    });
    this.registerTile('tv_top', (ctx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(2, 12, 28, 8);
    });
    this.registerTile('tv_side', (ctx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(12, 2, 8, 26);
    });

    // 8. Kitchen Refrigerator
    this.registerTile('fridge_front', (ctx) => {
      // Brushed Stainless Steel
      const fg = ctx.createLinearGradient(0, 0, 32, 0);
      fg.addColorStop(0, '#94a3b8');
      fg.addColorStop(0.3, '#cbd5e1');
      fg.addColorStop(0.7, '#e2e8f0');
      fg.addColorStop(1, '#94a3b8');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, 32, 32);
      // Freezer / fridge door division seam
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 11, 32, 2);
      // Two vertical chrome door handles
      ctx.fillStyle = '#334155';
      ctx.fillRect(26, 4, 3, 5);
      ctx.fillRect(26, 15, 3, 10);
    });
    this.registerTile('fridge_side', (ctx) => {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 30, 32, 2);
    });

    // 9. Kitchen Cooking Stove
    this.registerTile('stove_top', (ctx) => {
      ctx.fillStyle = '#1e293b'; // Glass ceramic cooktop
      ctx.fillRect(0, 0, 32, 32);
      // 4 circular burner hobs with red heating elements
      const burners = [[8, 8, 4.5], [24, 8, 3.5], [8, 24, 3.5], [24, 24, 5]];
      burners.forEach(([bx, by, br]) => {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(bx, by, br * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    this.registerTile('stove_front', (ctx) => {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 32, 32);
      // Control knob panel
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, 32, 6);
      ctx.fillStyle = '#cbd5e1';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(5 + i * 7, 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Glass oven door
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(3, 8, 26, 18);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // interior warmth
      ctx.fillRect(6, 11, 20, 12);
      // Oven door chrome handle
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(5, 7, 22, 2);
    });
    this.registerTile('stove_side', (ctx) => {
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, 0, 32, 32);
    });

    // 10. Kitchen Sink Basin
    this.registerTile('sink_top', (ctx) => {
      ctx.fillStyle = '#f8fafc'; // White ceramic marble countertop
      ctx.fillRect(0, 0, 32, 32);
      // Recessed sink basin
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(5, 6, 22, 20);
      ctx.fillStyle = '#38bdf8'; // water in basin
      ctx.fillRect(7, 8, 18, 16);
      ctx.fillStyle = '#64748b'; // chrome drain
      ctx.beginPath();
      ctx.arc(16, 16, 2, 0, Math.PI * 2);
      ctx.fill();
      // Chrome mixer tap faucet
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(14, 2, 4, 6);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(13, 2, 6, 2);
    });
    this.registerTile('sink_front', (ctx) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(2, 4, 13, 24);
      ctx.strokeRect(17, 4, 13, 24);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(13, 12, 2, 6);
      ctx.fillRect(17, 12, 2, 6);
    });

    // 11. Ceramic Toilet
    this.registerTile('toilet_top', (ctx) => {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 32, 32);
      // Toilet tank at back
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(4, 2, 24, 8);
      ctx.fillStyle = '#94a3b8'; // chrome flush button
      ctx.beginPath(); ctx.arc(16, 6, 2, 0, Math.PI * 2); ctx.fill();
      // Oval porcelain bowl
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(16, 20, 10, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8'; // water inside
      ctx.beginPath();
      ctx.ellipse(16, 21, 6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    this.registerTile('toilet_front', (ctx) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(4, 0, 24, 10); // tank front
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(16, 18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(10, 22, 12, 10); // pedestal
    });

    // 12. Bathtub
    this.registerTile('bathtub_top', (ctx) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 32, 32);
      // Tub basin cavity
      ctx.fillStyle = '#0284c7'; // fresh water
      ctx.beginPath();
      ctx.roundRect(3, 4, 26, 24, 6);
      ctx.fill();
      // Chrome taps at head
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(14, 2, 4, 4);
    });
    this.registerTile('bathtub_side', (ctx) => {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(1, 1, 30, 30);
    });

    // 13. Analog Wall Clock
    this.registerTile('clock_face', (ctx) => {
      // Mahogany wooden circular frame
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(16, 16, 15, 0, Math.PI * 2);
      ctx.fill();
      // Cream dial
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, Math.PI * 2);
      ctx.fill();
      // Tick marks for 12, 3, 6, 9
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(15, 5, 2, 2);
      ctx.fillRect(25, 15, 2, 2);
      ctx.fillRect(15, 25, 2, 2);
      ctx.fillRect(5, 15, 2, 2);
      // Clock hands pointing at 10:10
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(16, 16); ctx.lineTo(11, 10); // hour hand
      ctx.moveTo(16, 16); ctx.lineTo(21, 9);  // minute hand
      ctx.stroke();
    });
    this.registerTile('clock_side', (ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(2, 2, 28, 28);
    });

    // 14. Potted House Plant
    this.registerTile('plant_top', (ctx) => {
      ctx.fillStyle = '#78350f'; // potting soil
      ctx.fillRect(0, 0, 32, 32);
      // Lush green tropical leaves
      const leaves = [[16, 8], [8, 16], [24, 16], [16, 24], [10, 10], [22, 22]];
      leaves.forEach(([lx, ly]) => {
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(lx, ly, 7, 4, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    this.registerTile('plant_side', (ctx) => {
      // Leaves spilling over top
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(16, 6, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(10, 4, 6, 0, Math.PI * 2);
      ctx.arc(22, 4, 6, 0, Math.PI * 2);
      ctx.fill();
      // Terracotta clay pot
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.moveTo(4, 8); ctx.lineTo(28, 8);
      ctx.lineTo(24, 30); ctx.lineTo(8, 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ea580c'; // pot rim
      ctx.fillRect(2, 8, 28, 4);
    });

    // 15. Workstation PC & Monitor
    this.registerTile('computer_screen', (ctx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 32, 32);
      // Monitor with blue code editor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(2, 2, 20, 16);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(4, 4, 16, 12);
      // Code syntax colored lines
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(6, 6, 8, 1.5);
      ctx.fillStyle = '#a855f7'; ctx.fillRect(6, 9, 10, 1.5);
      ctx.fillStyle = '#34d399'; ctx.fillRect(6, 12, 6, 1.5);
      // Keyboard on desk
      ctx.fillStyle = '#475569';
      ctx.fillRect(2, 22, 18, 7);
      ctx.fillStyle = '#94a3b8';
      for (let k = 0; k < 6; k++) ctx.fillRect(3 + k * 2.8, 23, 2, 2);
      for (let k = 0; k < 6; k++) ctx.fillRect(3 + k * 2.8, 26, 2, 2);
      // PC Tower on right with RGB glow
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(23, 2, 8, 28);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(25, 6, 4, 2);
      ctx.fillRect(25, 10, 4, 2);
      ctx.fillRect(25, 14, 4, 2);
    });
    this.registerTile('computer_top', (ctx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(23, 2, 8, 28);
    });
    this.registerTile('computer_side', (ctx) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#06b6d4'; // RGB accent
      ctx.fillRect(4, 12, 24, 2);
    });
  }
}
