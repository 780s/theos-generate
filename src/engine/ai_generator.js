import { BLOCK_TYPES, getBlockIdByName } from './blocks.js';

// Gemini API Key from environment or localStorage
export const DEFAULT_GEMINI_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export class AIGenerator {
  constructor(world, soundEngine, particleSystem) {
    this.world = world;
    this.sound = soundEngine;
    this.particles = particleSystem;
    this.apiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) || DEFAULT_GEMINI_KEY;

    // Undo stack: stores array of { x, y, z, oldBlock } for each AI structure
    this.undoHistory = [];
    this.isBuilding = false;
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gemini_api_key', this.apiKey);
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  // Generate structure from user prompt
  async generateStructure(prompt, playerPos, playerLookDir, size = 'medium', onProgress = null) {
    if (this.isBuilding) {
      throw new Error('Another structure is currently materializing! Please wait.');
    }

    // Determine target anchor ground coordinates (12 blocks in front of player)
    const targetDistance = size === 'large' ? 18 : 12;
    const targetX = Math.floor(playerPos.x + playerLookDir.x * targetDistance);
    const targetZ = Math.floor(playerPos.z + playerLookDir.z * targetDistance);
    const targetY = this.world.getSurfaceY(targetX, targetZ);

    if (onProgress) onProgress({ status: 'contacting_ai', message: 'Consulting Gemini AI architect...' });

    let structureData = null;
    try {
      structureData = await this.callGeminiAPI(prompt, size);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to procedural architectural blueprint:', err);
      if (onProgress) onProgress({ status: 'fallback', message: `AI API note (${err.message}). Using high-fidelity procedural blueprint!` });
      structureData = this.getFallbackStructure(prompt, size);
    }

    if (!structureData || !structureData.commands) {
      throw new Error('Failed to generate structural blueprint.');
    }

    // Compile commands into 3D voxel list
    const voxelsToPlace = this.compileCommandsToVoxels(structureData.commands, targetX, targetY, targetZ);

    // Save previous world state for Undo
    const previousState = [];
    for (const v of voxelsToPlace) {
      const old = this.world.getBlock(v.x, v.y, v.z);
      previousState.push({ x: v.x, y: v.y, z: v.z, oldBlock: old });
    }
    this.undoHistory.push(previousState);

    // Materialize in world with animation and sound
    this.isBuilding = true;
    this.sound.playAIMagicChime();
    this.particles.startAIConstructionFX(targetX, targetY, targetZ, 12);

    await this.materializeVoxels(voxelsToPlace, onProgress);

    this.particles.stopAIConstructionFX();
    this.isBuilding = false;

    return {
      name: structureData.name || 'AI Structure',
      description: structureData.description || 'Generated with Gemini',
      blockCount: voxelsToPlace.length,
      anchor: { x: targetX, y: targetY, z: targetZ }
    };
  }

  // Call Gemini API with structured prompt
  async callGeminiAPI(prompt, size = 'medium') {
    const maxDimension = size === 'small' ? 12 : (size === 'large' ? 24 : 16);

    const systemPrompt = `You are a Master Voxel Architect in a 3D Minecraft clone.
You generate 3D voxel structures by returning a JSON object containing high-level architectural commands.
Output MUST be valid, raw JSON only. Do not include markdown codeblocks (\`\`\`json).

AVAILABLE BLOCKS:
- Structural: stone, cobblestone, bricks, marble, obsidian, iron_block, gold_block, diamond_block
- Woods & Nature: oak_wood, oak_planks, leaves, sand, water, glass, glowstone, roof_tile
- Roblox Parts: baseplate, spawn_plate, neon_cyan, neon_orange, neon_pink, stud_brick_red, stud_brick_blue, stud_brick_yellow
- Furniture & Interior: sofa_red, sofa_blue, wood_table, chair_wood, bed_red, bed_blue, lamp_table, television, kitchen_fridge, kitchen_stove, kitchen_sink, toilet, bath_tub, wall_clock, house_plant, office_computer, bookshelf

AVAILABLE COMMANDS:
1. {"type": "fill_box", "x1": 0, "y1": 0, "z1": 0, "x2": 10, "y2": 4, "z2": 10, "block": "bricks", "hollow": true}
2. {"type": "cylinder", "cx": 5, "cz": 5, "base_y": 0, "height": 8, "radius": 4, "block": "stone", "hollow": true}
3. {"type": "cone_roof", "cx": 5, "cz": 5, "base_y": 8, "height": 6, "radius": 5, "block": "roof_tile"}
4. {"type": "pyramid", "cx": 5, "cz": 5, "base_y": 8, "height": 5, "block": "roof_tile"}
5. {"type": "dome", "cx": 5, "cy": 10, "cz": 5, "radius": 4, "block": "glass", "hollow": true}
6. {"type": "columns", "x1": 0, "z1": 0, "x2": 10, "z2": 10, "base_y": 0, "height": 6, "spacing": 4, "block": "marble"}
7. {"type": "wall_with_windows", "x1": 0, "z1": 0, "x2": 10, "z2": 0, "base_y": 0, "height": 5, "wall_block": "bricks", "window_block": "glass"}
8. {"type": "staircase", "x": 0, "y": 0, "z": 0, "steps": 6, "dir": "x", "block": "stone"}
9. {"type": "set_blocks", "blocks": [{"x": 5, "y": 2, "z": 5, "block": "glowstone"}]}

COORDINATE SYSTEM:
- Local coordinates starting at (0, 0, 0) for the base center/origin.
- Max bounding width/depth: ${maxDimension} blocks, max height: ${maxDimension * 1.5} blocks.
- Center the structure around (0, 0) or [0 .. ${maxDimension}].
- Always add glowing lanterns (glowstone) inside and outside for realistic atmosphere!

EXAMPLE JSON OUTPUT FORMAT:
{
  "name": "Cozy Cabin",
  "description": "A rustic timber cabin with glass windows and stone fireplace",
  "commands": [
    {"type": "fill_box", "x1": -4, "y1": 0, "z1": -4, "x2": 4, "y2": 4, "z2": 4, "block": "oak_wood", "hollow": true},
    {"type": "pyramid", "cx": 0, "cz": 0, "base_y": 5, "height": 4, "block": "roof_tile"},
    {"type": "set_blocks", "blocks": [{"x": 0, "y": 3, "z": 0, "block": "glowstone"}]}
  ]
}`;

    const userMessage = `User request: "${prompt}". Size: ${size} (max dimension ${maxDimension}). Generate complete, detailed, architecturally stunning structure JSON.`;

    // Attempt Gemini 2.5 Flash first, then 1.5 Flash
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userMessage}` }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              topP: 0.85
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${response.status} from ${model}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Empty response from Gemini API');

        // Clean json string (strip markdown ```json ... ``` if present)
        const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (err) {
        lastError = err;
        console.warn(`Attempt with ${model} failed:`, err);
      }
    }

    throw lastError || new Error('All Gemini API endpoints failed');
  }

  // Compile abstract CSG commands into concrete world voxels
  compileCommandsToVoxels(commands, originX, originY, originZ) {
    const voxelMap = new Map(); // "x,y,z" -> { x, y, z, blockId }

    const setVoxel = (lx, ly, lz, blockName) => {
      const blockId = getBlockIdByName(blockName);
      const wx = Math.floor(originX + lx);
      const wy = Math.floor(originY + ly);
      const wz = Math.floor(originZ + lz);
      if (wy >= 0 && wy < 64) {
        voxelMap.set(`${wx},${wy},${wz}`, { x: wx, y: wy, z: wz, blockId });
      }
    };

    for (const cmd of commands) {
      if (!cmd || !cmd.type) continue;

      switch (cmd.type) {
        case 'fill_box': {
          const xmin = Math.min(cmd.x1, cmd.x2);
          const xmax = Math.max(cmd.x1, cmd.x2);
          const ymin = Math.min(cmd.y1, cmd.y2);
          const ymax = Math.max(cmd.y1, cmd.y2);
          const zmin = Math.min(cmd.z1, cmd.z2);
          const zmax = Math.max(cmd.z1, cmd.z2);
          const hollow = !!cmd.hollow;

          for (let x = xmin; x <= xmax; x++) {
            for (let y = ymin; y <= ymax; y++) {
              for (let z = zmin; z <= zmax; z++) {
                if (hollow) {
                  const isWall = (x === xmin || x === xmax || y === ymin || y === ymax || z === zmin || z === zmax);
                  if (isWall) setVoxel(x, y, z, cmd.block);
                  else setVoxel(x, y, z, 'air');
                } else {
                  setVoxel(x, y, z, cmd.block);
                }
              }
            }
          }
          break;
        }

        case 'cylinder': {
          const cx = cmd.cx;
          const cz = cmd.cz;
          const base_y = cmd.base_y;
          const height = cmd.height;
          const r = cmd.radius;
          const hollow = !!cmd.hollow;

          for (let dy = 0; dy < height; dy++) {
            const y = base_y + dy;
            for (let dx = -r; dx <= r; dx++) {
              for (let dz = -r; dz <= r; dz++) {
                const distSq = dx * dx + dz * dz;
                if (distSq <= r * r) {
                  if (hollow) {
                    if (distSq >= (r - 1) * (r - 1)) {
                      setVoxel(cx + dx, y, cz + dz, cmd.block);
                    } else {
                      setVoxel(cx + dx, y, cz + dz, 'air');
                    }
                  } else {
                    setVoxel(cx + dx, y, cz + dz, cmd.block);
                  }
                }
              }
            }
          }
          break;
        }

        case 'cone_roof':
        case 'pyramid': {
          const cx = cmd.cx;
          const cz = cmd.cz;
          const base_y = cmd.base_y;
          const height = cmd.height;
          const baseRadius = cmd.radius || height;

          for (let dy = 0; dy < height; dy++) {
            const y = base_y + dy;
            const curRadius = Math.round(baseRadius * (1 - dy / height));
            for (let dx = -curRadius; dx <= curRadius; dx++) {
              for (let dz = -curRadius; dz <= curRadius; dz++) {
                if (cmd.type === 'cone_roof') {
                  if (dx * dx + dz * dz <= curRadius * curRadius) {
                    setVoxel(cx + dx, y, cz + dz, cmd.block);
                  }
                } else {
                  // Square pyramid
                  setVoxel(cx + dx, y, cz + dz, cmd.block);
                }
              }
            }
          }
          break;
        }

        case 'dome': {
          const cx = cmd.cx;
          const cy = cmd.cy;
          const cz = cmd.cz;
          const r = cmd.radius;
          const hollow = !!cmd.hollow;

          for (let dx = -r; dx <= r; dx++) {
            for (let dy = 0; dy <= r; dy++) {
              for (let dz = -r; dz <= r; dz++) {
                const dSq = dx * dx + dy * dy + dz * dz;
                if (dSq <= r * r) {
                  if (hollow) {
                    if (dSq >= (r - 1.2) * (r - 1.2)) {
                      setVoxel(cx + dx, cy + dy, cz + dz, cmd.block);
                    }
                  } else {
                    setVoxel(cx + dx, cy + dy, cz + dz, cmd.block);
                  }
                }
              }
            }
          }
          break;
        }

        case 'columns': {
          const xmin = Math.min(cmd.x1, cmd.x2);
          const xmax = Math.max(cmd.x1, cmd.x2);
          const zmin = Math.min(cmd.z1, cmd.z2);
          const zmax = Math.max(cmd.z1, cmd.z2);
          const spacing = Math.max(2, cmd.spacing || 3);

          for (let x = xmin; x <= xmax; x += spacing) {
            for (let z = zmin; z <= zmax; z += spacing) {
              if (x === xmin || x + spacing > xmax || z === zmin || z + spacing > zmax) {
                for (let dy = 0; dy < cmd.height; dy++) {
                  setVoxel(x, cmd.base_y + dy, z, cmd.block);
                }
              }
            }
          }
          break;
        }

        case 'wall_with_windows': {
          const xmin = Math.min(cmd.x1, cmd.x2);
          const xmax = Math.max(cmd.x1, cmd.x2);
          const zmin = Math.min(cmd.z1, cmd.z2);
          const zmax = Math.max(cmd.z1, cmd.z2);
          const isXAxis = (xmax - xmin) >= (zmax - zmin);

          if (isXAxis) {
            const z = zmin;
            for (let x = xmin; x <= xmax; x++) {
              for (let dy = 0; dy < cmd.height; dy++) {
                const isWindow = (dy === 2 || dy === 3) && (x % 3 === 1) && x > xmin && x < xmax;
                setVoxel(x, cmd.base_y + dy, z, isWindow ? (cmd.window_block || 'glass') : cmd.wall_block);
              }
            }
          } else {
            const x = xmin;
            for (let z = zmin; z <= zmax; z++) {
              for (let dy = 0; dy < cmd.height; dy++) {
                const isWindow = (dy === 2 || dy === 3) && (z % 3 === 1) && z > zmin && z < zmax;
                setVoxel(x, cmd.base_y + dy, z, isWindow ? (cmd.window_block || 'glass') : cmd.wall_block);
              }
            }
          }
          break;
        }

        case 'staircase': {
          const steps = cmd.steps || 6;
          const dir = cmd.dir || 'x';
          for (let i = 0; i < steps; i++) {
            const sx = cmd.x + (dir === 'x' ? i : 0);
            const sz = cmd.z + (dir === 'z' ? i : 0);
            for (let y = 0; y <= i; y++) {
              setVoxel(sx, cmd.y + y, sz, cmd.block);
            }
          }
          break;
        }

        case 'set_blocks': {
          if (Array.isArray(cmd.blocks)) {
            for (const b of cmd.blocks) {
              setVoxel(b.x, b.y, b.z, b.block);
            }
          }
          break;
        }
      }
    }

    // Sort voxels from bottom (lowest Y) to top (highest Y) for realistic ground-up construction
    const result = Array.from(voxelMap.values());
    result.sort((a, b) => a.y - b.y);
    return result;
  }

  // Animated materialization layer by layer
  async materializeVoxels(voxels, onProgress) {
    const total = voxels.length;
    const batchSize = Math.max(12, Math.floor(total / 60)); // Fast yet visual animation
    let placed = 0;

    for (let i = 0; i < total; i += batchSize) {
      const batch = voxels.slice(i, i + batchSize);
      for (const v of batch) {
        this.world.setBlock(v.x, v.y, v.z, v.blockId);
      }
      placed += batch.length;

      // Subtle audio pop with ascending pitch
      this.sound.playAIBuildPop(1.0 + (i / total) * 0.8);

      if (onProgress) {
        const pct = Math.round((placed / total) * 100);
        onProgress({ status: 'materializing', percent: pct, message: `Materializing structure: ${pct}%` });
      }

      // Small pause for frame render
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  // Undo last generated AI structure
  undo() {
    if (this.undoHistory.length === 0) return false;
    const lastBuild = this.undoHistory.pop();
    for (const v of lastBuild) {
      this.world.setBlock(v.x, v.y, v.z, v.oldBlock);
    }
    this.sound.playBlockBreak('stone');
    return true;
  }

  // Built-in high-quality procedural architectural blueprints
  getFallbackStructure(prompt, size = 'medium') {
    const p = prompt.toLowerCase();

    if (p.includes('living') || p.includes('sofa') || p.includes('couch') || p.includes('tv') || p.includes('furniture')) {
      return this.blueprintLivingRoom(size);
    } else if (p.includes('bedroom') || p.includes('bed') || p.includes('sleep') || p.includes('suite')) {
      return this.blueprintBedroom(size);
    } else if (p.includes('kitchen') || p.includes('cook') || p.includes('stove') || p.includes('fridge') || p.includes('dining')) {
      return this.blueprintKitchen(size);
    } else if (p.includes('castle') || p.includes('fortress') || p.includes('keep')) {
      return this.blueprintCastle(size);
    } else if (p.includes('pagoda') || p.includes('shrine') || p.includes('temple') || p.includes('japanese')) {
      return this.blueprintPagoda(size);
    } else if (p.includes('villa') || p.includes('modern') || p.includes('mansion') || p.includes('pool')) {
      return this.blueprintModernVilla(size);
    } else if (p.includes('wizard') || p.includes('magic') || p.includes('spire') || p.includes('orb')) {
      return this.blueprintWizardTower(size);
    } else if (p.includes('cyberpunk') || p.includes('sci-fi') || p.includes('monolith') || p.includes('future')) {
      return this.blueprintCyberpunkMonolith(size);
    } else if (p.includes('ship') || p.includes('boat') || p.includes('pirate')) {
      return this.blueprintPirateShip(size);
    } else if (p.includes('portal') || p.includes('nether') || p.includes('ruin')) {
      return this.blueprintNetherPortal(size);
    }

    // Default to Living Room if room mentioned, otherwise Castle
    if (p.includes('room') || p.includes('house') || p.includes('interior')) {
      return this.blueprintLivingRoom(size);
    }
    return this.blueprintCastle(size);
  }

  blueprintLivingRoom(size) {
    const w = size === 'large' ? 10 : 8;
    const l = size === 'large' ? 12 : 9;
    const h = 5;
    const hw = Math.floor(w / 2);
    const hl = Math.floor(l / 2);

    return {
      name: 'Modern Furnished Living Room',
      description: 'Contemporary living lounge with plush red sofa, oak coffee table, widescreen TV, warm floor lamp, and potted house plants.',
      commands: [
        // Hardwood parquet floor
        { type: 'fill_box', x1: -hw, y1: 0, z1: -hl, x2: hw, y2: 0, z2: hl, block: 'oak_planks' },
        // Modern plaster walls with large glass windows
        { type: 'fill_box', x1: -hw, y1: 1, z1: -hl, x2: hw, y2: h, z2: hl, block: 'marble', hollow: true },
        // Large panoramic window
        { type: 'fill_box', x1: -hw + 1, y1: 2, z1: -hl, x2: hw - 1, y2: 3, z2: -hl, block: 'glass' },
        // Ceiling
        { type: 'fill_box', x1: -hw, y1: h + 1, z1: -hl, x2: hw, y2: h + 1, z2: hl, block: 'oak_planks' },
        // Red plush sofa lounge
        { type: 'set_blocks', blocks: [
          { x: -1, y: 1, z: 2, block: 'sofa_red' },
          { x: 0, y: 1, z: 2, block: 'sofa_red' },
          { x: 1, y: 1, z: 2, block: 'sofa_red' },
          { x: -2, y: 1, z: 1, block: 'sofa_blue' },
          // Oak coffee table in center
          { x: 0, y: 1, z: 0, block: 'wood_table' },
          // Big screen TV mounted on front wall
          { x: 0, y: 2, z: -hl + 1, block: 'television' },
          { x: 0, y: 1, z: -hl + 1, block: 'bookshelf' },
          // Floor lamps in corners
          { x: -hw + 1, y: 1, z: hl - 1, block: 'lamp_table' },
          { x: hw - 1, y: 1, z: hl - 1, block: 'lamp_table' },
          // Potted plants flanking TV
          { x: -2, y: 1, z: -hl + 1, block: 'house_plant' },
          { x: 2, y: 1, z: -hl + 1, block: 'house_plant' },
          // Wall clock
          { x: hw - 1, y: 3, z: 0, block: 'wall_clock' },
          // Warm lighting
          { x: 0, y: h, z: 0, block: 'glowstone' }
        ]}
      ]
    };
  }

  blueprintBedroom(size) {
    const hw = 4;
    const hl = 5;
    const h = 4;

    return {
      name: 'Luxury Master Bedroom Suite',
      description: 'Spacious bedroom suite featuring a king-size bed with crisp duvets, bedside tables, study workstation PC, and ambient lighting.',
      commands: [
        { type: 'fill_box', x1: -hw, y1: 0, z1: -hl, x2: hw, y2: 0, z2: hl, block: 'spruce_planks' },
        { type: 'fill_box', x1: -hw, y1: 1, z1: -hl, x2: hw, y2: h, z2: hl, block: 'wool_white', hollow: true },
        // Bedroom window
        { type: 'fill_box', x1: -hw, y1: 2, z1: -1, x2: -hw, y2: 3, z2: 1, block: 'glass' },
        { type: 'fill_box', x1: -hw, y1: h + 1, z1: -hl, x2: hw, y2: h + 1, z2: hl, block: 'oak_planks' },
        // Bedroom furniture
        { type: 'set_blocks', blocks: [
          // King bed
          { x: -1, y: 1, z: -hl + 1, block: 'bed_red' },
          { x: 0, y: 1, z: -hl + 1, block: 'bed_red' },
          // Bedside lamps
          { x: -2, y: 1, z: -hl + 1, block: 'lamp_table' },
          { x: 1, y: 1, z: -hl + 1, block: 'lamp_table' },
          // Desk with PC workstation
          { x: hw - 1, y: 1, z: 0, block: 'wood_table' },
          { x: hw - 1, y: 2, z: 0, block: 'office_computer' },
          { x: hw - 2, y: 1, z: 0, block: 'chair_wood' },
          // Bookshelves & plant
          { x: hw - 1, y: 1, z: hl - 1, block: 'bookshelf' },
          { x: hw - 1, y: 2, z: hl - 1, block: 'house_plant' },
          // Clock
          { x: 0, y: 3, z: hl - 1, block: 'wall_clock' },
          { x: 0, y: h, z: 0, block: 'glowstone' }
        ]}
      ]
    };
  }

  blueprintKitchen(size) {
    const hw = 4;
    const hl = 5;
    const h = 4;

    return {
      name: 'Chef Kitchen & Dining Nook',
      description: 'Equipped kitchen with stainless cooking stove, refrigerator, sink basin, marble countertops, and dining table.',
      commands: [
        { type: 'fill_box', x1: -hw, y1: 0, z1: -hl, x2: hw, y2: 0, z2: hl, block: 'polished_diorite' },
        { type: 'fill_box', x1: -hw, y1: 1, z1: -hl, x2: hw, y2: h, z2: hl, block: 'bricks', hollow: true },
        { type: 'fill_box', x1: -2, y1: 2, z1: -hl, x2: 2, y2: 3, z2: -hl, block: 'glass' },
        { type: 'fill_box', x1: -hw, y1: h + 1, z1: -hl, x2: hw, y2: h + 1, z2: hl, block: 'oak_planks' },
        // Kitchen appliances & dining
        { type: 'set_blocks', blocks: [
          // Cooking stove
          { x: -1, y: 1, z: -hl + 1, block: 'kitchen_stove' },
          // Sink basin
          { x: 1, y: 1, z: -hl + 1, block: 'kitchen_sink' },
          // Refrigerator in corner
          { x: -hw + 1, y: 1, z: -hl + 1, block: 'kitchen_fridge' },
          { x: -hw + 1, y: 2, z: -hl + 1, block: 'kitchen_fridge' },
          // Dining Table & Chairs in center
          { x: 0, y: 1, z: 1, block: 'wood_table' },
          { x: -1, y: 1, z: 1, block: 'chair_wood' },
          { x: 1, y: 1, z: 1, block: 'chair_wood' },
          // Plant on table
          { x: 0, y: 2, z: 1, block: 'house_plant' },
          // Clock & ceiling lamp
          { x: 0, y: 3, z: hl - 1, block: 'wall_clock' },
          { x: 0, y: h, z: 0, block: 'glowstone' }
        ]}
      ]
    };
  }

  blueprintCastle(size) {
    const s = size === 'large' ? 14 : 10;
    const h = 7;
    const r = Math.floor(s / 2);

    return {
      name: 'Medieval Fortress Keep',
      description: 'Sturdy stone fortress with 4 defensive corner towers, arched battlement parapets, and interior lanterns.',
      commands: [
        // Main courtyard floor
        { type: 'fill_box', x1: -r, y1: 0, z1: -r, x2: r, y2: 0, z2: r, block: 'cobblestone' },
        // Outer defensive walls
        { type: 'fill_box', x1: -r, y1: 1, z1: -r, x2: r, y2: h - 1, z2: r, block: 'stone', hollow: true },
        // Castle entrance arch
        { type: 'fill_box', x1: -1, y1: 1, z1: -r, x2: 1, y2: 3, z2: -r, block: 'air' },
        // 4 Corner Towers
        { type: 'cylinder', cx: -r, cz: -r, base_y: 1, height: h + 3, radius: 2, block: 'bricks' },
        { type: 'cylinder', cx: r, cz: -r, base_y: 1, height: h + 3, radius: 2, block: 'bricks' },
        { type: 'cylinder', cx: -r, cz: r, base_y: 1, height: h + 3, radius: 2, block: 'bricks' },
        { type: 'cylinder', cx: r, cz: r, base_y: 1, height: h + 3, radius: 2, block: 'bricks' },
        // Battlement parapets on towers
        { type: 'cylinder', cx: -r, cz: -r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        { type: 'cylinder', cx: r, cz: -r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        { type: 'cylinder', cx: -r, cz: r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        { type: 'cylinder', cx: r, cz: r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        // Roof walk
        { type: 'fill_box', x1: -r + 1, y1: h - 1, z1: -r + 1, x2: r - 1, y2: h - 1, z2: r - 1, block: 'oak_wood' },
        // Corner Lanterns
        {
          type: 'set_blocks',
          blocks: [
            { x: -r, y: h + 5, z: -r, block: 'glowstone' },
            { x: r, y: h + 5, z: -r, block: 'glowstone' },
            { x: -r, y: h + 5, z: r, block: 'glowstone' },
            { x: r, y: h + 5, z: r, block: 'glowstone' },
            { x: 0, y: 3, z: 0, block: 'glowstone' }
          ]
        }
      ]
    };
  }

  blueprintPagoda(size) {
    return {
      name: 'Japanese Pagoda Temple',
      description: 'Multi-tiered traditional temple with sweeping roof eaves, wooden columns, and golden ornamental lantern finial.',
      commands: [
        // Stone base plinth
        { type: 'fill_box', x1: -6, y1: 0, z1: -6, x2: 6, y2: 1, z2: 6, block: 'stone' },
        // Tier 1 wooden sanctuary
        { type: 'fill_box', x1: -4, y1: 2, z1: -4, x2: 4, y2: 6, z2: 4, block: 'oak_wood', hollow: true },
        // Tier 1 sweeping roof eaves
        { type: 'pyramid', cx: 0, cz: 0, base_y: 6, height: 3, block: 'roof_tile' },
        // Tier 2 sanctuary
        { type: 'fill_box', x1: -3, y1: 9, z1: -3, x2: 3, y2: 12, z2: 3, block: 'oak_wood', hollow: true },
        // Tier 2 roof
        { type: 'pyramid', cx: 0, cz: 0, base_y: 12, height: 3, block: 'roof_tile' },
        // Tier 3 sanctuary
        { type: 'fill_box', x1: -2, y1: 15, z1: -2, x2: 2, y2: 17, z2: 2, block: 'oak_wood', hollow: true },
        // Top roof
        { type: 'pyramid', cx: 0, cz: 0, base_y: 17, height: 3, block: 'roof_tile' },
        // Ornamental Spire & Golden Lantern
        {
          type: 'set_blocks',
          blocks: [
            { x: 0, y: 20, z: 0, block: 'gold_block' },
            { x: 0, y: 21, z: 0, block: 'glowstone' },
            { x: -4, y: 5, z: -4, block: 'glowstone' },
            { x: 4, y: 5, z: -4, block: 'glowstone' },
            { x: -4, y: 5, z: 4, block: 'glowstone' },
            { x: 4, y: 5, z: 4, block: 'glowstone' }
          ]
        }
      ]
    };
  }

  blueprintModernVilla(size) {
    return {
      name: 'Modern Glass Villa & Pool',
      description: 'Minimalist luxury architectural residence with panoramic floor-to-ceiling glass, marble terraces, and an illuminated swimming pool.',
      commands: [
        // Marble foundation
        { type: 'fill_box', x1: -7, y1: 0, z1: -7, x2: 7, y2: 0, z2: 7, block: 'marble' },
        // Swimming pool excavation & water
        { type: 'fill_box', x1: 2, y1: 0, z1: -5, x2: 6, y2: 0, z2: 2, block: 'water' },
        // Ground floor residence
        { type: 'fill_box', x1: -6, y1: 1, z1: -6, x2: 0, y2: 4, z2: 4, block: 'marble', hollow: true },
        // Panoramic glass facade
        { type: 'fill_box', x1: -6, y1: 1, z1: 4, x2: 0, y2: 3, z2: 4, block: 'glass' },
        { type: 'fill_box', x1: 0, y1: 1, z1: -6, x2: 0, y2: 3, z2: 4, block: 'glass' },
        // Cantilevered 2nd floor suite
        { type: 'fill_box', x1: -5, y1: 5, z1: -4, x2: 3, y2: 8, z2: 3, block: 'iron_block', hollow: true },
        { type: 'fill_box', x1: -5, y1: 5, z1: 3, x2: 3, y2: 7, z2: 3, block: 'glass' },
        // Roof deck
        { type: 'fill_box', x1: -5, y1: 9, z1: -4, x2: 3, y2: 9, z2: 3, block: 'marble' },
        // Submerged pool glowstones and terrace lighting
        {
          type: 'set_blocks',
          blocks: [
            { x: 4, y: 0, z: -2, block: 'glowstone' },
            { x: -3, y: 3, z: 0, block: 'glowstone' },
            { x: -1, y: 7, z: 0, block: 'glowstone' }
          ]
        }
      ]
    };
  }

  blueprintWizardTower(size) {
    return {
      name: 'Wizard Celestial Spire',
      description: 'An arcane spiral tower carved from obsidian and marble with floating glowing celestial energy orb.',
      commands: [
        // Tower base
        { type: 'cylinder', cx: 0, cz: 0, base_y: 0, height: 16, radius: 4, block: 'obsidian', hollow: true },
        // Arched observation balconies
        { type: 'cylinder', cx: 0, cz: 0, base_y: 8, height: 1, radius: 5, block: 'marble' },
        { type: 'cylinder', cx: 0, cz: 0, base_y: 16, height: 1, radius: 5, block: 'marble' },
        // Glass crown
        { type: 'cylinder', cx: 0, cz: 0, base_y: 17, height: 4, radius: 3, block: 'glass', hollow: true },
        // Arcane floating celestial orb
        { type: 'dome', cx: 0, cy: 22, cz: 0, radius: 3, block: 'diamond_block' },
        {
          type: 'set_blocks',
          blocks: [
            { x: 0, y: 22, z: 0, block: 'glowstone' },
            { x: 0, y: 25, z: 0, block: 'glowstone' },
            { x: -4, y: 9, z: 0, block: 'glowstone' },
            { x: 4, y: 9, z: 0, block: 'glowstone' },
            { x: 0, y: 9, z: -4, block: 'glowstone' },
            { x: 0, y: 9, z: 4, block: 'glowstone' }
          ]
        }
      ]
    };
  }

  blueprintCyberpunkMonolith(size) {
    return {
      name: 'Cyberpunk Neon Monolith',
      description: 'Futuristic sci-fi tower with glowing energy conduits, metallic blast panels, and observation antennas.',
      commands: [
        // Reinforced foundation
        { type: 'fill_box', x1: -5, y1: 0, z1: -5, x2: 5, y2: 1, z2: 5, block: 'iron_block' },
        // Monolith core
        { type: 'fill_box', x1: -3, y1: 2, z1: -3, x2: 3, y2: 18, z2: 3, block: 'obsidian', hollow: true },
        // Vertical Neon Conduit strips (Gold / Glowstone / Diamond)
        { type: 'fill_box', x1: 0, y1: 2, z1: -4, x2: 0, y2: 17, z2: -4, block: 'glowstone' },
        { type: 'fill_box', x1: 0, y1: 2, z1: 4, x2: 0, y2: 17, z2: 4, block: 'diamond_block' },
        { type: 'fill_box', x1: -4, y1: 2, z1: 0, x2: -4, y2: 17, z2: 0, block: 'gold_block' },
        { type: 'fill_box', x1: 4, y1: 2, z1: 0, x2: 4, y2: 17, z2: 0, block: 'glowstone' },
        // Top sensor dish
        { type: 'dome', cx: 0, cy: 19, cz: 0, radius: 4, block: 'iron_block', hollow: true },
        {
          type: 'set_blocks',
          blocks: [
            { x: 0, y: 23, z: 0, block: 'diamond_block' },
            { x: 0, y: 24, z: 0, block: 'glowstone' }
          ]
        }
      ]
    };
  }

  blueprintPirateShip(size) {
    return {
      name: 'Galleon Pirate Vessel',
      description: 'Stately wooden galleon with oak hull, deck cabins, tall masts, and crows nest.',
      commands: [
        // Wooden hull
        { type: 'fill_box', x1: -3, y1: 0, z1: -8, x2: 3, y2: 3, z2: 8, block: 'oak_wood', hollow: true },
        // Raised Quarterdeck
        { type: 'fill_box', x1: -3, y1: 4, z1: 4, x2: 3, y2: 6, z2: 8, block: 'oak_wood', hollow: true },
        // Windows on stern
        { type: 'fill_box', x1: -2, y1: 4, z1: 8, x2: 2, y2: 5, z2: 8, block: 'glass' },
        // Main Mast
        { type: 'fill_box', x1: 0, y1: 3, z1: 0, x2: 0, y2: 14, z2: 0, block: 'oak_wood' },
        // Foremast
        { type: 'fill_box', x1: 0, y1: 3, z1: -4, x2: 0, y2: 12, z2: -4, block: 'oak_wood' },
        // Crows nest
        { type: 'fill_box', x1: -1, y1: 12, z1: -1, x2: 1, y2: 12, z2: 1, block: 'oak_wood' },
        // White sails (snow / wool block)
        { type: 'fill_box', x1: -3, y1: 6, z1: 0, x2: 3, y2: 10, z2: 0, block: 'snow' },
        {
          type: 'set_blocks',
          blocks: [
            { x: 0, y: 13, z: 0, block: 'glowstone' },
            { x: 0, y: 7, z: 6, block: 'glowstone' }
          ]
        }
      ]
    };
  }

  blueprintNetherPortal(size) {
    return {
      name: 'Nether Rift Shrine',
      description: 'Ancient obsidian monolith gateway surrounded by gold altars and illuminated runes.',
      commands: [
        // Base altar
        { type: 'fill_box', x1: -5, y1: 0, z1: -5, x2: 5, y2: 1, z2: 5, block: 'cobblestone' },
        // Obsidian portal frame
        { type: 'fill_box', x1: -2, y1: 2, z1: 0, x2: 2, y2: 7, z2: 0, block: 'obsidian', hollow: true },
        // Portal rift (water / glowing interior)
        { type: 'fill_box', x1: -1, y1: 3, z1: 0, x2: 1, y2: 6, z2: 0, block: 'water' },
        // Gold corner pillars
        {
          type: 'set_blocks',
          blocks: [
            { x: -4, y: 2, z: -4, block: 'gold_block' },
            { x: -4, y: 3, z: -4, block: 'glowstone' },
            { x: 4, y: 2, z: -4, block: 'gold_block' },
            { x: 4, y: 3, z: -4, block: 'glowstone' },
            { x: -4, y: 2, z: 4, block: 'gold_block' },
            { x: -4, y: 3, z: 4, block: 'glowstone' },
            { x: 4, y: 2, z: 4, block: 'gold_block' },
            { x: 4, y: 3, z: 4, block: 'glowstone' }
          ]
        }
      ]
    };
  }
}
