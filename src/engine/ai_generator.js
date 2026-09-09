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

    // Determine target anchor ground coordinates (placed safely in front of player)
    const targetDistance = size === 'large' ? 20 : (size === 'small' ? 10 : 14);
    const targetX = Math.floor(playerPos.x + playerLookDir.x * targetDistance);
    const targetZ = Math.floor(playerPos.z + playerLookDir.z * targetDistance);
    const targetY = this.world.getSurfaceY(targetX, targetZ);

    if (onProgress) onProgress({ status: 'analyzing', message: 'Analyzing architectural concept & spatial bounds...' });

    let structureData = null;
    try {
      if (onProgress) onProgress({ status: 'contacting_ai', message: 'Consulting Gemini AI Master Architect...' });
      structureData = await this.callGeminiAPI(prompt, size);
    } catch (err) {
      console.warn('Gemini API call failed, activating Dynamic Procedural Synthesizer:', err);
      if (onProgress) onProgress({ status: 'fallback', message: `AI Note: ${err.message}. Synthesizing high-fidelity procedural architecture!` });
      structureData = this.getFallbackStructure(prompt, size);
    }

    if (!structureData || !structureData.commands) {
      throw new Error('Failed to generate structural blueprint.');
    }

    if (onProgress) onProgress({ status: 'compiling', message: 'Compiling architectural geometry & structural physics...' });

    // Compile commands into 3D voxel list with architectural rules and validation
    const voxelsToPlace = this.compileCommandsToVoxels(structureData.commands, targetX, targetY, targetZ, playerLookDir);

    if (voxelsToPlace.length === 0) {
      throw new Error('No voxels generated for structure.');
    }

    // Save previous world state for Undo
    const previousState = [];
    for (const v of voxelsToPlace) {
      const old = this.world.getBlock(v.x, v.y, v.z);
      previousState.push({ x: v.x, y: v.y, z: v.z, oldBlock: old });
    }
    this.undoHistory.push(previousState);

    // Materialize in world with layer-by-layer animation, particle effects and sound
    this.isBuilding = true;
    this.sound.playAIMagicChime();
    this.particles.startAIConstructionFX(targetX, targetY, targetZ, 14);

    await this.materializeVoxels(voxelsToPlace, onProgress);

    this.particles.stopAIConstructionFX();
    this.isBuilding = false;

    return {
      name: structureData.name || 'Architectural Wonder',
      description: structureData.description || 'Crafted with AI Spatial Architecture',
      blockCount: voxelsToPlace.length,
      anchor: { x: targetX, y: targetY, z: targetZ }
    };
  }

  // Call Gemini API with master architectural prompt and macro-primitives
  async callGeminiAPI(prompt, size = 'medium') {
    const maxDimension = size === 'small' ? 12 : (size === 'large' ? 24 : 16);

    const systemPrompt = `You are a Master 3D Voxel Architect and spatial designer.
Generate 3D voxel structures by returning a single valid, raw JSON object containing architectural macro-commands.
DO NOT wrap the output in markdown codeblocks (\`\`\`json). Output RAW JSON ONLY.

ARCHITECTURAL SCALE & PROPORTIONS:
- 1 block = 1 meter. Player height = 2 blocks.
- Ceilings must be 3-5 blocks high so rooms feel spacious.
- Doorways must be 2 blocks wide by 3 blocks high so players walk in easily.
- Roofs must have 1-block eave overhangs past walls for realistic depth and shadow.
- Every building MUST have at least one entrance (open doorway) so players can explore inside!

MATERIAL PALETTES (100+ Available Blocks):
- Woods: oak_wood, oak_planks, birch_wood, birch_planks, spruce_wood, spruce_planks, jungle_wood, acacia_wood, dark_oak_wood, cherry_wood
- Stones: stone, cobblestone, stone_bricks, mossy_cobblestone, marble, obsidian, quartz, polished_granite, polished_diorite, blackstone
- Masonry & Roofs: bricks, roof_tile, sandstone, prismarine
- Minerals & Metals: iron_block, gold_block, diamond_block, emerald_block, copper_block, amethyst_block
- Translucent: glass, tinted_glass, water, ice
- Illumination: glowstone, lamp_table, neon_cyan, neon_orange, neon_pink, sea_lantern
- Studio Studded Parts: baseplate, spawn_plate, stud_brick_red, stud_brick_blue, stud_brick_yellow
- Authentic Furniture: sofa_red, sofa_blue, wood_table, chair_wood, bed_red, bed_blue, lamp_table, television, kitchen_fridge, kitchen_stove, kitchen_sink, toilet, bath_tub, wall_clock, house_plant, office_computer, bookshelf

HIGH-LEVEL ARCHITECTURAL COMMANDS:
1. Complete Framed Building:
   {"type": "framed_building", "cx": 0, "cz": 0, "base_y": 0, "width": 10, "length": 12, "height": 5, "wall_block": "oak_planks", "corner_block": "oak_wood", "floor_block": "spruce_planks", "roof_type": "gable", "roof_block": "roof_tile", "door_side": "front"}
   (roof_type can be "gable", "pitched", "flat", or "none")

2. Peaked Gable Roof (Triangular A-Frame with Overhangs):
   {"type": "gable_roof", "cx": 0, "cz": 0, "base_y": 5, "width": 10, "length": 12, "axis": "x", "block": "roof_tile", "gable_block": "oak_planks"}

3. Hipped / Pitched Pyramid Roof:
   {"type": "pitched_roof", "cx": 0, "cz": 0, "base_y": 5, "width": 10, "length": 10, "block": "roof_tile"}

4. Arched Doorway / Entrance:
   {"type": "doorway", "x": 0, "y": 1, "z": -5, "dir": "x", "width": 2, "height": 3, "frame_block": "stone"}

5. Furnished Room Interior:
   {"type": "room_interior", "cx": 0, "cz": 0, "floor_y": 1, "width": 8, "length": 10, "theme": "living_room"}
   (themes: "living_room", "bedroom", "kitchen", "office", "library", "tavern", "throne_room", "scifi_bridge")

6. Curved / Spiral Staircase:
   {"type": "spiral_staircase", "cx": 3, "cz": 3, "base_y": 1, "height": 5, "radius": 2, "block": "stone"}

7. Straight Staircase:
   {"type": "straight_staircase", "x": 0, "y": 1, "z": -2, "length": 6, "width": 2, "dir": "+z", "block": "oak_planks"}

8. Garden Foliage Tree:
   {"type": "garden_tree", "cx": 6, "cz": -6, "base_y": 0, "height": 6, "trunk_block": "oak_wood", "leaf_block": "leaves", "style": "oak"}
   (style: "oak", "pine", "cherry")

9. Paved Entrance Path:
   {"type": "pathway", "x1": 0, "z1": -6, "x2": 0, "z2": -12, "y": 0, "width": 2, "block": "cobblestone"}

10. Balcony & Protective Railing:
    {"type": "balcony", "x1": -4, "z1": -5, "x2": 4, "z2": -5, "y": 5, "block": "oak_wood"}

11. Core Primitives (Fine Control):
    - {"type": "fill_box", "x1": -3, "y1": 0, "z1": -3, "x2": 3, "y2": 4, "z2": 3, "block": "stone", "hollow": true}
    - {"type": "cylinder", "cx": 0, "cz": 0, "base_y": 0, "height": 8, "radius": 4, "block": "marble", "hollow": true}
    - {"type": "dome", "cx": 0, "cy": 8, "cz": 0, "radius": 4, "block": "glass", "hollow": true}
    - {"type": "columns", "x1": -5, "z1": -5, "x2": 5, "z2": 5, "base_y": 0, "height": 6, "spacing": 3, "block": "marble"}
    - {"type": "clear_box", "x1": -1, "y1": 1, "z1": -5, "x2": 1, "y2": 3, "z2": -5}
    - {"type": "set_blocks", "blocks": [{"x": 0, "y": 4, "z": 0, "block": "glowstone"}]}

DESIGN RULES:
- Always give buildings contrasting corner columns vs wall infill for depth.
- Coordinate bounding box: Center around (0, 0). Max dimension: ${maxDimension}x${maxDimension}x${maxDimension * 1.5}.
- Always include interior illumination (glowstone / lanterns) and furniture.

EXAMPLE JSON OUTPUT:
{
  "name": "Cozy Nordic Alpine Cabin",
  "description": "Timber log cabin with stone chimney, peaked gable roof, furnished fireplace lounge, and stone walkway.",
  "commands": [
    {"type": "framed_building", "cx": 0, "cz": 0, "base_y": 0, "width": 10, "length": 12, "height": 5, "wall_block": "spruce_planks", "corner_block": "spruce_wood", "floor_block": "oak_planks", "roof_type": "gable", "roof_block": "roof_tile", "door_side": "front"},
    {"type": "room_interior", "cx": 0, "cz": 0, "floor_y": 1, "width": 8, "length": 10, "theme": "living_room"},
    {"type": "pathway", "x1": 0, "z1": -6, "x2": 0, "z2": -12, "y": 0, "width": 2, "block": "cobblestone"},
    {"type": "garden_tree", "cx": 7, "cz": -5, "base_y": 0, "height": 6, "trunk_block": "spruce_wood", "leaf_block": "leaves", "style": "pine"}
  ]
}`;

    const userMessage = `User request: "${prompt}". Scale: ${size} (max dimension ${maxDimension} blocks).
Produce a complete, highly-detailed, stunning architectural structure JSON using appropriate macro-commands and fine-tuned details.`;

    // Try modern Gemini models in order of capability
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
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
              temperature: 0.25,
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

        // Clean json string (strip any markdown ```json ... ``` wrapper)
        const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (err) {
        lastError = err;
        console.warn(`Attempt with ${model} failed:`, err);
      }
    }

    throw lastError || new Error('All Gemini API endpoints failed');
  }

  // Compile abstract CSG commands into concrete world voxels with post-processing polish
  compileCommandsToVoxels(commands, originX, originY, originZ, playerLookDir = null) {
    const voxelMap = new Map(); // "x,y,z" -> { x, y, z, blockId }

    const setVoxel = (lx, ly, lz, blockName) => {
      const blockId = getBlockIdByName(blockName);
      const wx = Math.floor(originX + lx);
      const wy = Math.floor(originY + ly);
      const wz = Math.floor(originZ + lz);
      if (wy >= 0 && wy < 128) {
        if (blockId === BLOCK_TYPES.AIR) {
          voxelMap.delete(`${wx},${wy},${wz}`);
        } else {
          voxelMap.set(`${wx},${wy},${wz}`, { x: wx, y: wy, z: wz, blockId });
        }
      }
    };

    for (const cmd of commands) {
      if (!cmd || !cmd.type) continue;

      switch (cmd.type) {
        // --- 1. FRAMED ARCHITECTURAL BUILDING ---
        case 'framed_building': {
          const w = cmd.width || 10;
          const l = cmd.length || 12;
          const h = cmd.height || 5;
          const cx = cmd.cx || 0;
          const cz = cmd.cz || 0;
          const baseY = cmd.base_y || 0;
          const xmin = cx - Math.floor(w / 2);
          const xmax = cx + Math.ceil(w / 2) - 1;
          const zmin = cz - Math.floor(l / 2);
          const zmax = cz + Math.ceil(l / 2) - 1;

          const wallBlock = cmd.wall_block || 'oak_planks';
          const cornerBlock = cmd.corner_block || 'oak_wood';
          const floorBlock = cmd.floor_block || 'spruce_planks';
          const roofType = cmd.roof_type || 'gable';
          const roofBlock = cmd.roof_block || 'roof_tile';
          const windowBlock = cmd.window_block || 'glass';
          const doorSide = cmd.door_side || 'front'; // front (zmin), back (zmax), left (xmin), right (xmax)

          // 1. Solid Floor
          for (let x = xmin; x <= xmax; x++) {
            for (let z = zmin; z <= zmax; z++) {
              setVoxel(x, baseY, z, floorBlock);
            }
          }

          // 2. Corner Pillars & Top Tie-Beams
          for (let y = baseY; y <= baseY + h; y++) {
            setVoxel(xmin, y, zmin, cornerBlock);
            setVoxel(xmax, y, zmin, cornerBlock);
            setVoxel(xmin, y, zmax, cornerBlock);
            setVoxel(xmax, y, zmax, cornerBlock);
          }
          for (let x = xmin; x <= xmax; x++) {
            setVoxel(x, baseY + h, zmin, cornerBlock);
            setVoxel(x, baseY + h, zmax, cornerBlock);
          }
          for (let z = zmin; z <= zmax; z++) {
            setVoxel(xmin, baseY + h, z, cornerBlock);
            setVoxel(xmax, baseY + h, z, cornerBlock);
          }

          // 3. Walls & Centered Windows
          // North/Front wall (z = zmin)
          for (let x = xmin + 1; x < xmax; x++) {
            for (let y = baseY + 1; y < baseY + h; y++) {
              const isDoor = doorSide === 'front' && Math.abs(x - cx) <= 0 && y <= baseY + 3;
              if (isDoor) {
                setVoxel(x, y, zmin, 'air');
              } else {
                const isWin = (y === baseY + 2 || y === baseY + 3) && Math.abs(x - cx) >= 2 && (x % 2 === 0);
                setVoxel(x, y, zmin, isWin ? windowBlock : wallBlock);
              }
            }
          }

          // South/Back wall (z = zmax)
          for (let x = xmin + 1; x < xmax; x++) {
            for (let y = baseY + 1; y < baseY + h; y++) {
              const isDoor = doorSide === 'back' && Math.abs(x - cx) <= 0 && y <= baseY + 3;
              if (isDoor) {
                setVoxel(x, y, zmax, 'air');
              } else {
                const isWin = (y === baseY + 2 || y === baseY + 3) && Math.abs(x - cx) >= 2 && (x % 2 === 0);
                setVoxel(x, y, zmax, isWin ? windowBlock : wallBlock);
              }
            }
          }

          // West/Left wall (x = xmin)
          for (let z = zmin + 1; z < zmax; z++) {
            for (let y = baseY + 1; y < baseY + h; y++) {
              const isDoor = doorSide === 'left' && Math.abs(z - cz) <= 0 && y <= baseY + 3;
              if (isDoor) {
                setVoxel(xmin, y, z, 'air');
              } else {
                const isWin = (y === baseY + 2 || y === baseY + 3) && Math.abs(z - cz) >= 2 && (z % 2 === 0);
                setVoxel(xmin, y, z, isWin ? windowBlock : wallBlock);
              }
            }
          }

          // East/Right wall (x = xmax)
          for (let z = zmin + 1; z < zmax; z++) {
            for (let y = baseY + 1; y < baseY + h; y++) {
              const isDoor = doorSide === 'right' && Math.abs(z - cz) <= 0 && y <= baseY + 3;
              if (isDoor) {
                setVoxel(xmax, y, z, 'air');
              } else {
                const isWin = (y === baseY + 2 || y === baseY + 3) && Math.abs(z - cz) >= 2 && (z % 2 === 0);
                setVoxel(xmax, y, z, isWin ? windowBlock : wallBlock);
              }
            }
          }

          // 4. Ceiling
          for (let x = xmin; x <= xmax; x++) {
            for (let z = zmin; z <= zmax; z++) {
              setVoxel(x, baseY + h, z, floorBlock);
            }
          }

          // 5. Roof Generation
          if (roofType === 'gable') {
            this.buildGableRoof(setVoxel, cx, cz, baseY + h, w, l, 'x', roofBlock, wallBlock, 1);
          } else if (roofType === 'pitched') {
            this.buildPitchedRoof(setVoxel, cx, cz, baseY + h, w, l, roofBlock, 1);
          } else if (roofType === 'flat') {
            // Roof terrace parapet railing
            for (let x = xmin; x <= xmax; x++) {
              setVoxel(x, baseY + h + 1, zmin, cornerBlock);
              setVoxel(x, baseY + h + 1, zmax, cornerBlock);
            }
            for (let z = zmin; z <= zmax; z++) {
              setVoxel(xmin, baseY + h + 1, z, cornerBlock);
              setVoxel(xmax, baseY + h + 1, z, cornerBlock);
            }
          }

          // Symmetrical Interior Chandelier
          setVoxel(cx, baseY + h - 1, cz, 'glowstone');
          break;
        }

        // --- 2. GABLE ROOF (A-FRAME WITH OVERHANGS) ---
        case 'gable_roof': {
          const w = cmd.width || 10;
          const l = cmd.length || 12;
          const cx = cmd.cx || 0;
          const cz = cmd.cz || 0;
          const baseY = cmd.base_y || 0;
          const axis = cmd.axis || 'x';
          const block = cmd.block || 'roof_tile';
          const gableBlock = cmd.gable_block || 'oak_planks';
          const overhang = cmd.overhang !== undefined ? cmd.overhang : 1;
          this.buildGableRoof(setVoxel, cx, cz, baseY, w, l, axis, block, gableBlock, overhang);
          break;
        }

        // --- 3. PITCHED / HIPPED PYRAMID ROOF ---
        case 'pitched_roof': {
          const w = cmd.width || 10;
          const l = cmd.length || 10;
          const cx = cmd.cx || 0;
          const cz = cmd.cz || 0;
          const baseY = cmd.base_y || 0;
          const block = cmd.block || 'roof_tile';
          const overhang = cmd.overhang !== undefined ? cmd.overhang : 1;
          this.buildPitchedRoof(setVoxel, cx, cz, baseY, w, l, block, overhang);
          break;
        }

        // --- 4. DOORWAY / ENTRANCE ARCH ---
        case 'doorway':
        case 'archway': {
          const x = cmd.x || 0;
          const y = cmd.y || 1;
          const z = cmd.z || 0;
          const w = cmd.width || 2;
          const h = cmd.height || 3;
          const dir = cmd.dir || 'x'; // axis of wall opening
          const frame = cmd.frame_block || 'stone';

          const halfW = Math.floor(w / 2);
          for (let di = -halfW; di < -halfW + w; di++) {
            for (let dy = 0; dy < h; dy++) {
              const dx = dir === 'x' ? di : 0;
              const dz = dir === 'z' ? di : 0;
              setVoxel(x + dx, y + dy, z + dz, 'air');
            }
          }
          // Doorstep
          for (let di = -halfW; di < -halfW + w; di++) {
            const dx = dir === 'x' ? di : 0;
            const dz = dir === 'z' ? di : 0;
            setVoxel(x + dx, y - 1, z + dz, frame);
          }
          break;
        }

        // --- 5. ROOM INTERIOR FURNISHING ---
        case 'room_interior': {
          const cx = cmd.cx || 0;
          const cz = cmd.cz || 0;
          const y = cmd.floor_y || 1;
          const w = cmd.width || 8;
          const l = cmd.length || 10;
          const theme = cmd.theme || 'living_room';
          this.buildRoomInterior(setVoxel, cx, cz, y, w, l, theme);
          break;
        }

        // --- 6. SPIRAL STAIRCASE ---
        case 'spiral_staircase': {
          const cx = cmd.cx || 0;
          const cz = cmd.cz || 0;
          const baseY = cmd.base_y || 0;
          const height = cmd.height || 6;
          const r = cmd.radius || 2;
          const block = cmd.block || 'stone';

          // Central column
          for (let dy = 0; dy <= height; dy++) {
            setVoxel(cx, baseY + dy, cz, block);
          }
          // Spiraling radial steps
          for (let dy = 0; dy < height; dy++) {
            const angle = (dy / 4) * Math.PI * 2;
            const sx = Math.round(Math.cos(angle) * r);
            const sz = Math.round(Math.sin(angle) * r);
            setVoxel(cx + sx, baseY + dy, cz + sz, block);
            // Clear headroom above step
            setVoxel(cx + sx, baseY + dy + 1, cz + sz, 'air');
            setVoxel(cx + sx, baseY + dy + 2, cz + sz, 'air');
          }
          break;
        }

        // --- 7. STRAIGHT STAIRCASE ---
        case 'straight_staircase': {
          const x = cmd.x || 0;
          const y = cmd.y || 0;
          const z = cmd.z || 0;
          const len = cmd.length || 6;
          const w = cmd.width || 2;
          const dir = cmd.dir || '+z';
          const block = cmd.block || 'oak_planks';

          for (let step = 0; step < len; step++) {
            for (let wi = 0; wi < w; wi++) {
              let sx = x;
              let sz = z;
              if (dir === '+x') { sx = x + step; sz = z + wi; }
              else if (dir === '-x') { sx = x - step; sz = z + wi; }
              else if (dir === '+z') { sx = x + wi; sz = z + step; }
              else if (dir === '-z') { sx = x + wi; sz = z - step; }

              for (let sy = 0; sy <= step; sy++) {
                setVoxel(sx, y + sy, sz, block);
              }
              // Headroom
              setVoxel(sx, y + step + 1, sz, 'air');
              setVoxel(sx, y + step + 2, sz, 'air');
            }
          }
          break;
        }

        // --- 8. GARDEN FOLIAGE TREE ---
        case 'garden_tree': {
          const cx = cmd.cx || 0;
          const cz = cmd.cz || 0;
          const baseY = cmd.base_y || 0;
          const h = cmd.height || 6;
          const trunkBlock = cmd.trunk_block || 'oak_wood';
          const leafBlock = cmd.leaf_block || 'leaves';
          const style = cmd.style || 'oak';

          // Trunk
          for (let dy = 0; dy < h; dy++) {
            setVoxel(cx, baseY + dy, cz, trunkBlock);
          }

          if (style === 'pine') {
            // Conical foliage
            for (let r = 3; r >= 1; r--) {
              const layerY = baseY + h - r;
              for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                  if (Math.abs(dx) + Math.abs(dz) <= r + 1) {
                    if (dx !== 0 || dz !== 0) setVoxel(cx + dx, layerY, cz + dz, leafBlock);
                  }
                }
              }
            }
            setVoxel(cx, baseY + h, cz, leafBlock);
          } else {
            // Round canopy (Oak / Cherry)
            const leafRadius = 2;
            for (let dx = -leafRadius; dx <= leafRadius; dx++) {
              for (let dy = -1; dy <= 2; dy++) {
                for (let dz = -leafRadius; dz <= leafRadius; dz++) {
                  const distSq = dx * dx + dy * dy + dz * dz;
                  if (distSq <= leafRadius * leafRadius + 1) {
                    if (dx !== 0 || dz !== 0 || dy > 0) {
                      setVoxel(cx + dx, baseY + h + dy, cz + dz, leafBlock);
                    }
                  }
                }
              }
            }
          }
          break;
        }

        // --- 9. PAVED PATHWAY ---
        case 'pathway': {
          const x1 = cmd.x1 || 0;
          const z1 = cmd.z1 || 0;
          const x2 = cmd.x2 || 0;
          const z2 = cmd.z2 || 0;
          const y = cmd.y || 0;
          const w = cmd.width || 2;
          const block = cmd.block || 'cobblestone';

          const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1), 1);
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const curX = Math.round(x1 + (x2 - x1) * t);
            const curZ = Math.round(z1 + (z2 - z1) * t);
            for (let wi = -Math.floor(w / 2); wi <= Math.floor(w / 2); wi++) {
              const px = Math.abs(x2 - x1) >= Math.abs(z2 - z1) ? curX : curX + wi;
              const pz = Math.abs(x2 - x1) >= Math.abs(z2 - z1) ? curZ + wi : curZ;
              setVoxel(px, y, pz, block);
            }
          }
          break;
        }

        // --- 10. BALCONY / RAILING ---
        case 'balcony':
        case 'fence_railing': {
          const x1 = Math.min(cmd.x1, cmd.x2);
          const x2 = Math.max(cmd.x1, cmd.x2);
          const z1 = Math.min(cmd.z1, cmd.z2);
          const z2 = Math.max(cmd.z1, cmd.z2);
          const y = cmd.y || 0;
          const block = cmd.block || 'oak_wood';

          for (let x = x1; x <= x2; x++) {
            setVoxel(x, y, z1, block);
            setVoxel(x, y, z2, block);
          }
          for (let z = z1; z <= z2; z++) {
            setVoxel(x1, y, z, block);
            setVoxel(x2, y, z, block);
          }
          break;
        }

        // --- 11. FILL BOX ---
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

        // --- 12. CLEAR BOX ---
        case 'clear_box': {
          const xmin = Math.min(cmd.x1, cmd.x2);
          const xmax = Math.max(cmd.x1, cmd.x2);
          const ymin = Math.min(cmd.y1, cmd.y2);
          const ymax = Math.max(cmd.y1, cmd.y2);
          const zmin = Math.min(cmd.z1, cmd.z2);
          const zmax = Math.max(cmd.z1, cmd.z2);

          for (let x = xmin; x <= xmax; x++) {
            for (let y = ymin; y <= ymax; y++) {
              for (let z = zmin; z <= zmax; z++) {
                setVoxel(x, y, z, 'air');
              }
            }
          }
          break;
        }

        // --- 13. CYLINDER ---
        case 'cylinder': {
          const cx = cmd.cx || 0;
          const cz = cmd.cz || 0;
          const baseY = cmd.base_y || 0;
          const height = cmd.height || 6;
          const r = cmd.radius || 4;
          const hollow = !!cmd.hollow;

          for (let dy = 0; dy < height; dy++) {
            const y = baseY + dy;
            for (let dx = -r; dx <= r; dx++) {
              for (let dz = -r; dz <= r; dz++) {
                const distSq = dx * dx + dz * dz;
                if (distSq <= r * r) {
                  if (hollow) {
                    if (distSq >= (r - 1.2) * (r - 1.2)) {
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

        // --- 14. DOME ---
        case 'dome': {
          const cx = cmd.cx || 0;
          const cy = cmd.cy || 0;
          const cz = cmd.cz || 0;
          const r = cmd.radius || 4;
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

        // --- 15. COLUMNS ---
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

        // --- 16. SET BLOCKS ---
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

    // --- ARCHITECTURAL POLISH & POST-PROCESSING ---
    this.applyArchitecturalPolish(voxelMap, originX, originY, originZ, playerLookDir);

    // Sort voxels from ground up (lowest Y first) for satisfying materialization animation
    const result = Array.from(voxelMap.values());
    result.sort((a, b) => a.y - b.y);
    return result;
  }

  // Build triangular Gable Roof along axis
  buildGableRoof(setVoxel, cx, cz, baseY, width, length, axis, block, gableBlock, overhang = 1) {
    if (axis === 'x') {
      // Slopes up from zmin and zmax towards center Z
      const halfL = Math.floor(length / 2);
      const halfW = Math.floor(width / 2);
      const roofH = Math.ceil(halfL * 0.9);

      for (let step = 0; step <= roofH; step++) {
        const curZRadius = halfL + overhang - step;
        if (curZRadius < 0) break;
        const curY = baseY + step;

        for (let x = cx - halfW - overhang; x <= cx + halfW + overhang; x++) {
          setVoxel(x, curY, cz - curZRadius, block);
          setVoxel(x, curY, cz + curZRadius, block);

          // Ridge cap when meeting in center
          if (curZRadius === 0) {
            setVoxel(x, curY, cz, block);
          }
        }

        // Triangular Gable End Wall Infill
        if (gableBlock && curZRadius > 0) {
          for (let z = cz - curZRadius + 1; z <= cz + curZRadius - 1; z++) {
            setVoxel(cx - halfW, curY, z, gableBlock);
            setVoxel(cx + halfW, curY, z, gableBlock);
          }
        }
      }
    } else {
      // Slopes up from xmin and xmax towards center X
      const halfW = Math.floor(width / 2);
      const halfL = Math.floor(length / 2);
      const roofH = Math.ceil(halfW * 0.9);

      for (let step = 0; step <= roofH; step++) {
        const curXRadius = halfW + overhang - step;
        if (curXRadius < 0) break;
        const curY = baseY + step;

        for (let z = cz - halfL - overhang; z <= cz + halfL + overhang; z++) {
          setVoxel(cx - curXRadius, curY, z, block);
          setVoxel(cx + curXRadius, curY, z, block);

          if (curXRadius === 0) {
            setVoxel(cx, curY, z, block);
          }
        }

        if (gableBlock && curXRadius > 0) {
          for (let x = cx - curXRadius + 1; x <= cx + curXRadius - 1; x++) {
            setVoxel(x, curY, cz - halfL, gableBlock);
            setVoxel(x, curY, cz + halfL, gableBlock);
          }
        }
      }
    }
  }

  // Build 4-sided Hipped / Pitched Pyramid Roof with Overhang
  buildPitchedRoof(setVoxel, cx, cz, baseY, width, length, block, overhang = 1) {
    const maxRadius = Math.max(Math.floor(width / 2), Math.floor(length / 2)) + overhang;
    let step = 0;

    for (let r = maxRadius; r >= 0; r--) {
      const curY = baseY + step++;
      const curRx = Math.max(0, Math.floor(width / 2) + overhang - step);
      const curRz = Math.max(0, Math.floor(length / 2) + overhang - step);

      for (let x = cx - curRx; x <= cx + curRx; x++) {
        for (let z = cz - curRz; z <= cz + curRz; z++) {
          if (x === cx - curRx || x === cx + curRx || z === cz - curRz || z === cz + curRz) {
            setVoxel(x, curY, z, block);
          }
        }
      }
      if (curRx === 0 && curRz === 0) break;
    }
  }

  // Furnish Room Interior by Theme
  buildRoomInterior(setVoxel, cx, cz, y, w, l, theme) {
    const hw = Math.floor(w / 2) - 1;
    const hl = Math.floor(l / 2) - 1;

    switch (theme) {
      case 'living_room':
        // Plush lounge couch facing TV
        setVoxel(cx - 1, y, cz + hl - 1, 'sofa_red');
        setVoxel(cx, y, cz + hl - 1, 'sofa_red');
        setVoxel(cx + 1, y, cz + hl - 1, 'sofa_red');
        setVoxel(cx - 2, y, cz + hl - 2, 'sofa_blue');
        // Oak coffee table
        setVoxel(cx, y, cz, 'wood_table');
        setVoxel(cx, y + 1, cz, 'house_plant');
        // Widescreen television & media stand
        setVoxel(cx, y, cz - hl + 1, 'bookshelf');
        setVoxel(cx, y + 1, cz - hl + 1, 'television');
        // Corner lamps & plants
        setVoxel(cx - hw, y, cz + hl, 'lamp_table');
        setVoxel(cx + hw, y, cz + hl, 'lamp_table');
        setVoxel(cx - hw, y, cz - hl + 1, 'house_plant');
        setVoxel(cx + hw, y, cz - hl + 1, 'house_plant');
        break;

      case 'bedroom':
        // King bed
        setVoxel(cx - 1, y, cz - hl + 1, 'bed_red');
        setVoxel(cx, y, cz - hl + 1, 'bed_red');
        // Bedside tables and lamps
        setVoxel(cx - 2, y, cz - hl + 1, 'wood_table');
        setVoxel(cx - 2, y + 1, cz - hl + 1, 'lamp_table');
        setVoxel(cx + 1, y, cz - hl + 1, 'wood_table');
        setVoxel(cx + 1, y + 1, cz - hl + 1, 'lamp_table');
        // Study desk with PC
        setVoxel(cx + hw, y, cz, 'wood_table');
        setVoxel(cx + hw, y + 1, cz, 'office_computer');
        setVoxel(cx + hw - 1, y, cz, 'chair_wood');
        // Bookshelf and clock
        setVoxel(cx - hw, y, cz + hl, 'bookshelf');
        setVoxel(cx, y + 2, cz + hl, 'wall_clock');
        break;

      case 'kitchen':
        // Counters with stove, sink, fridge
        setVoxel(cx - 2, y, cz - hl + 1, 'kitchen_fridge');
        setVoxel(cx - 2, y + 1, cz - hl + 1, 'kitchen_fridge');
        setVoxel(cx - 1, y, cz - hl + 1, 'kitchen_stove');
        setVoxel(cx, y, cz - hl + 1, 'polished_diorite');
        setVoxel(cx + 1, y, cz - hl + 1, 'kitchen_sink');
        // Central dining table & chairs
        setVoxel(cx, y, cz + 1, 'wood_table');
        setVoxel(cx - 1, y, cz + 1, 'chair_wood');
        setVoxel(cx + 1, y, cz + 1, 'chair_wood');
        setVoxel(cx, y + 1, cz + 1, 'house_plant');
        break;

      case 'office':
      case 'library':
        // Perimeter bookshelves
        for (let x = cx - hw; x <= cx + hw; x++) {
          setVoxel(x, y, cz - hl + 1, 'bookshelf');
          setVoxel(x, y + 1, cz - hl + 1, 'bookshelf');
        }
        // Central double desk
        setVoxel(cx - 1, y, cz, 'wood_table');
        setVoxel(cx + 1, y, cz, 'wood_table');
        setVoxel(cx - 1, y + 1, cz, 'office_computer');
        setVoxel(cx + 1, y + 1, cz, 'lamp_table');
        setVoxel(cx - 1, y, cz + 1, 'chair_wood');
        setVoxel(cx + 1, y, cz + 1, 'chair_wood');
        break;

      case 'throne_room':
        // Red carpet runner down center
        for (let z = cz - hl; z <= cz + hl; z++) {
          setVoxel(cx, y, z, 'wool_red');
        }
        // Elevated golden throne
        setVoxel(cx, y, cz + hl - 1, 'gold_block');
        setVoxel(cx, y + 1, cz + hl - 1, 'sofa_red');
        setVoxel(cx - 2, y + 1, cz + hl - 1, 'glowstone');
        setVoxel(cx + 2, y + 1, cz + hl - 1, 'glowstone');
        break;

      case 'scifi_bridge':
        // Captain's seat
        setVoxel(cx, y, cz, 'sofa_blue');
        // Holo screens and controls
        setVoxel(cx - 1, y, cz - 2, 'office_computer');
        setVoxel(cx, y, cz - 2, 'neon_cyan');
        setVoxel(cx + 1, y, cz - 2, 'office_computer');
        setVoxel(cx - 2, y + 1, cz, 'neon_pink');
        setVoxel(cx + 2, y + 1, cz, 'neon_pink');
        break;
    }
  }

  // Intelligent Post-Processor: Foundations, Accessible Entrances, and Lighting
  applyArchitecturalPolish(voxelMap, originX, originY, originZ, playerLookDir) {
    if (voxelMap.size === 0) return;

    // 1. Level Foundations to World Surface
    // Detect lowest floor voxels and extend down to actual ground terrain
    const footprint = new Map(); // "wx,wz" -> lowest wy
    for (const v of voxelMap.values()) {
      if (v.y <= originY + 2) {
        const key = `${v.x},${v.z}`;
        if (!footprint.has(key) || v.y < footprint.get(key)) {
          footprint.set(key, v.y);
        }
      }
    }

    for (const [key, baseWy] of footprint.entries()) {
      const [wxStr, wzStr] = key.split(',');
      const wx = parseInt(wxStr, 10);
      const wz = parseInt(wzStr, 10);
      const surfY = this.world.getSurfaceY(wx, wz);

      if (surfY < baseWy) {
        // Foundation gap detected! Fill downwards into terrain
        for (let y = baseWy - 1; y >= Math.max(0, surfY); y--) {
          const vkey = `${wx},${y},${wz}`;
          if (!voxelMap.has(vkey)) {
            voxelMap.set(vkey, { x: wx, y: y, z: wz, blockId: BLOCK_TYPES.COBBLESTONE });
          }
        }
      }
    }

    // 2. Guarantee Accessible Entrance
    // Check if the structure forms an enclosed building without any door
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const v of voxelMap.values()) {
      if (v.y === originY + 1 || v.y === originY + 2) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
      }
    }

    if (maxX - minX >= 4 && maxZ - minZ >= 4) {
      // Check if any of the 4 outer walls has an entrance opening at eye level
      let hasEntrance = false;

      // Check minZ wall
      for (let x = minX + 1; x < maxX; x++) {
        if (!voxelMap.has(`${x},${originY + 1},${minZ}`) && !voxelMap.has(`${x},${originY + 2},${minZ}`)) {
          hasEntrance = true;
          break;
        }
      }
      // Check maxZ wall
      if (!hasEntrance) {
        for (let x = minX + 1; x < maxX; x++) {
          if (!voxelMap.has(`${x},${originY + 1},${maxZ}`) && !voxelMap.has(`${x},${originY + 2},${maxZ}`)) {
            hasEntrance = true;
            break;
          }
        }
      }
      // Check minX wall
      if (!hasEntrance) {
        for (let z = minZ + 1; z < maxZ; z++) {
          if (!voxelMap.has(`${minX},${originY + 1},${z}`) && !voxelMap.has(`${minX},${originY + 2},${z}`)) {
            hasEntrance = true;
            break;
          }
        }
      }
      // Check maxX wall
      if (!hasEntrance) {
        for (let z = minZ + 1; z < maxZ; z++) {
          if (!voxelMap.has(`${maxX},${originY + 1},${z}`) && !voxelMap.has(`${maxX},${originY + 2},${z}`)) {
            hasEntrance = true;
            break;
          }
        }
      }

      // If no entrance was found across all 4 walls, carve a clean 2x3 doorway facing the player
      if (!hasEntrance) {
        let face = 'minZ'; // default front
        if (playerLookDir) {
          if (Math.abs(playerLookDir.z) >= Math.abs(playerLookDir.x)) {
            face = playerLookDir.z >= 0 ? 'minZ' : 'maxZ';
          } else {
            face = playerLookDir.x >= 0 ? 'minX' : 'maxX';
          }
        }

        const midX = Math.floor((minX + maxX) / 2);
        const midZ = Math.floor((minZ + maxZ) / 2);

        if (face === 'minZ' || face === 'maxZ') {
          const doorZ = face === 'minZ' ? minZ : maxZ;
          for (let di = 0; di <= 1; di++) {
            const dx = midX + di;
            for (let dy = 1; dy <= 3; dy++) {
              voxelMap.delete(`${dx},${originY + dy},${doorZ}`);
            }
            // Doorstep
            voxelMap.set(`${dx},${originY},${doorZ}`, { x: dx, y: originY, z: doorZ, blockId: BLOCK_TYPES.STONE_BRICKS });
            // Path in front of door
            const frontZ = face === 'minZ' ? doorZ - 1 : doorZ + 1;
            voxelMap.set(`${dx},${originY},${frontZ}`, { x: dx, y: originY, z: frontZ, blockId: BLOCK_TYPES.COBBLESTONE });
          }
          // Ambient entrance lantern
          voxelMap.set(`${midX},${originY + 4},${doorZ}`, { x: midX, y: originY + 4, z: doorZ, blockId: BLOCK_TYPES.GLOWSTONE });
        } else {
          const doorX = face === 'minX' ? minX : maxX;
          for (let dj = 0; dj <= 1; dj++) {
            const dz = midZ + dj;
            for (let dy = 1; dy <= 3; dy++) {
              voxelMap.delete(`${doorX},${originY + dy},${dz}`);
            }
            voxelMap.set(`${doorX},${originY},${dz}`, { x: doorX, y: originY, z: dz, blockId: BLOCK_TYPES.STONE_BRICKS });
            const frontX = face === 'minX' ? doorX - 1 : doorX + 1;
            voxelMap.set(`${frontX},${originY},${dz}`, { x: frontX, y: originY, z: dz, blockId: BLOCK_TYPES.COBBLESTONE });
          }
          voxelMap.set(`${doorX},${originY + 4},${midZ}`, { x: doorX, y: originY + 4, z: midZ, blockId: BLOCK_TYPES.GLOWSTONE });
        }
      }
    }

    // 3. Guarantee Interior Lighting
    let hasLighting = false;
    for (const v of voxelMap.values()) {
      if ([BLOCK_TYPES.GLOWSTONE, BLOCK_TYPES.LAMP_TABLE, BLOCK_TYPES.NEON_CYAN, BLOCK_TYPES.NEON_ORANGE, BLOCK_TYPES.NEON_PINK].includes(v.blockId)) {
        hasLighting = true;
        break;
      }
    }
    if (!hasLighting) {
      // Place aesthetic glowing chandelier in center at ceiling level
      voxelMap.set(`${originX},${originY + 4},${originZ}`, {
        x: originX,
        y: originY + 4,
        z: originZ,
        blockId: BLOCK_TYPES.GLOWSTONE
      });
    }
  }

  // Animated materialization layer by layer
  async materializeVoxels(voxels, onProgress) {
    const total = voxels.length;
    const batchSize = Math.max(14, Math.floor(total / 60)); // Smooth 60-step progressive build
    let placed = 0;

    for (let i = 0; i < total; i += batchSize) {
      const batch = voxels.slice(i, i + batchSize);
      for (const v of batch) {
        this.world.setBlock(v.x, v.y, v.z, v.blockId);
      }
      placed += batch.length;

      // Subtle audio pop with ascending pitch
      this.sound.playAIBuildPop(0.9 + (i / total) * 0.9);

      if (onProgress) {
        const pct = Math.round((placed / total) * 100);
        onProgress({ status: 'materializing', percent: pct, message: `Materializing architecture: ${pct}%` });
      }

      await new Promise(resolve => setTimeout(resolve, 18));
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

  // Dynamic Modular Procedural Synthesizer (Offline & Fallback Brain)
  getFallbackStructure(prompt, size = 'medium') {
    const p = prompt.toLowerCase();

    // 1. Interior Rooms
    if (p.includes('living') || p.includes('sofa') || p.includes('couch') || p.includes('tv') || p.includes('furniture')) {
      return this.blueprintFurnishedRoom(size, 'living_room', 'Modern Furnished Lounge', 'Contemporary lounge with plush red couch, oak coffee table, widescreen TV, and house plants.');
    }
    if (p.includes('bedroom') || p.includes('bed') || p.includes('sleep') || p.includes('suite')) {
      return this.blueprintFurnishedRoom(size, 'bedroom', 'Master Bedroom Suite', 'Spacious master suite featuring king bed, study desk with PC workstation, and bedside lamps.');
    }
    if (p.includes('kitchen') || p.includes('cook') || p.includes('stove') || p.includes('fridge') || p.includes('dining')) {
      return this.blueprintFurnishedRoom(size, 'kitchen', 'Chef Kitchen & Dining Nook', 'Equipped kitchen with stainless cooking stove, refrigerator, marble sink, and dining table.');
    }
    if (p.includes('office') || p.includes('library') || p.includes('study') || p.includes('desk')) {
      return this.blueprintFurnishedRoom(size, 'office', 'Executive Study & Library', 'Walnut bookshelves, computer workstation desk, table lamps, and armchairs.');
    }

    // 2. Themed Structures
    if (p.includes('castle') || p.includes('fortress') || p.includes('keep')) {
      return this.blueprintCastle(size);
    }
    if (p.includes('pagoda') || p.includes('shrine') || p.includes('temple') || p.includes('japanese') || p.includes('zen') || p.includes('oriental')) {
      return this.blueprintPagoda(size);
    }
    if (p.includes('villa') || p.includes('modern') || p.includes('mansion') || p.includes('glass') || p.includes('pool')) {
      return this.blueprintModernVilla(size);
    }
    if (p.includes('cabin') || p.includes('cottage') || p.includes('wood') || p.includes('rustic') || p.includes('cozy') || p.includes('lodge')) {
      return this.blueprintAlpineCabin(size);
    }
    if (p.includes('wizard') || p.includes('spire') || p.includes('magic') || p.includes('tower')) {
      return this.blueprintWizardTower(size);
    }
    if (p.includes('cyberpunk') || p.includes('sci-fi') || p.includes('monolith') || p.includes('future') || p.includes('neon')) {
      return this.blueprintCyberpunkMonolith(size);
    }
    if (p.includes('ship') || p.includes('boat') || p.includes('pirate') || p.includes('galleon')) {
      return this.blueprintPirateShip(size);
    }
    if (p.includes('portal') || p.includes('rift') || p.includes('gate') || p.includes('nether')) {
      return this.blueprintNetherPortal(size);
    }

    // Default to Alpine Cabin if house-like, or Medieval Castle
    if (p.includes('house') || p.includes('home') || p.includes('building')) {
      return this.blueprintAlpineCabin(size);
    }
    return this.blueprintCastle(size);
  }

  // Parametric Furnished Room Blueprint
  blueprintFurnishedRoom(size, theme, name, description) {
    const w = size === 'large' ? 12 : (size === 'small' ? 8 : 10);
    const l = size === 'large' ? 14 : (size === 'small' ? 8 : 12);
    const h = 5;

    return {
      name,
      description,
      commands: [
        {
          type: 'framed_building',
          cx: 0,
          cz: 0,
          base_y: 0,
          width: w,
          length: l,
          height: h,
          wall_block: 'marble',
          corner_block: 'oak_wood',
          floor_block: 'oak_planks',
          roof_type: 'flat',
          door_side: 'front'
        },
        {
          type: 'room_interior',
          cx: 0,
          cz: 0,
          floor_y: 1,
          width: w - 2,
          length: l - 2,
          theme
        },
        {
          type: 'pathway',
          x1: 0,
          z1: -Math.floor(l / 2),
          x2: 0,
          z2: -Math.floor(l / 2) - 5,
          y: 0,
          width: 2,
          block: 'cobblestone'
        }
      ]
    };
  }

  // Alpine Log Cabin with Gable Roof & Garden
  blueprintAlpineCabin(size) {
    const w = size === 'large' ? 12 : 10;
    const l = size === 'large' ? 14 : 12;
    const h = 5;

    return {
      name: 'Cozy Alpine Log Cabin',
      description: 'Rustic timber cabin with contrasting oak log columns, peaked roof tile eaves, furnished living lounge, stone chimney, and pine trees.',
      commands: [
        {
          type: 'framed_building',
          cx: 0,
          cz: 0,
          base_y: 0,
          width: w,
          length: l,
          height: h,
          wall_block: 'spruce_planks',
          corner_block: 'spruce_wood',
          floor_block: 'oak_planks',
          roof_type: 'gable',
          roof_block: 'roof_tile',
          door_side: 'front'
        },
        {
          type: 'room_interior',
          cx: 0,
          cz: 0,
          floor_y: 1,
          width: w - 2,
          length: l - 2,
          theme: 'living_room'
        },
        // Stone Chimney on side
        {
          type: 'fill_box',
          x1: Math.floor(w / 2),
          y1: 0,
          z1: -1,
          x2: Math.floor(w / 2) + 1,
          y2: h + 4,
          z2: 1,
          block: 'cobblestone'
        },
        // Path and Garden Trees
        {
          type: 'pathway',
          x1: 0,
          z1: -Math.floor(l / 2),
          x2: 0,
          z2: -Math.floor(l / 2) - 6,
          y: 0,
          width: 2,
          block: 'cobblestone'
        },
        {
          type: 'garden_tree',
          cx: Math.floor(w / 2) + 3,
          cz: -Math.floor(l / 2) + 1,
          base_y: 0,
          height: 7,
          trunk_block: 'spruce_wood',
          leaf_block: 'leaves',
          style: 'pine'
        }
      ]
    };
  }

  // Medieval Castle Keep
  blueprintCastle(size) {
    const s = size === 'large' ? 16 : 12;
    const h = 7;
    const r = Math.floor(s / 2);

    return {
      name: 'Medieval Fortress Keep',
      description: 'Stone fortress keep with 4 defensive circular towers, crenellated parapets, throne banquet hall, and arched entrance.',
      commands: [
        // Courtyard floor
        { type: 'fill_box', x1: -r, y1: 0, z1: -r, x2: r, y2: 0, z2: r, block: 'cobblestone' },
        // Outer defensive walls
        { type: 'fill_box', x1: -r, y1: 1, z1: -r, x2: r, y2: h - 1, z2: r, block: 'stone_bricks', hollow: true },
        // Arched entrance
        { type: 'doorway', x: 0, y: 1, z: -r, dir: 'x', width: 2, height: 4, frame_block: 'cobblestone' },
        // 4 Corner Towers with Parapets
        { type: 'cylinder', cx: -r, cz: -r, base_y: 1, height: h + 3, radius: 2, block: 'stone_bricks' },
        { type: 'cylinder', cx: r, cz: -r, base_y: 1, height: h + 3, radius: 2, block: 'stone_bricks' },
        { type: 'cylinder', cx: -r, cz: r, base_y: 1, height: h + 3, radius: 2, block: 'stone_bricks' },
        { type: 'cylinder', cx: r, cz: r, base_y: 1, height: h + 3, radius: 2, block: 'stone_bricks' },
        { type: 'cylinder', cx: -r, cz: -r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        { type: 'cylinder', cx: r, cz: -r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        { type: 'cylinder', cx: -r, cz: r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        { type: 'cylinder', cx: r, cz: r, base_y: h + 4, height: 1, radius: 2, block: 'stone', hollow: true },
        // Walkable roof deck
        { type: 'fill_box', x1: -r + 1, y1: h - 1, z1: -r + 1, x2: r - 1, y2: h - 1, z2: r - 1, block: 'oak_wood' },
        // Interior Throne Hall
        { type: 'room_interior', cx: 0, cz: 0, floor_y: 1, width: s - 3, length: s - 3, theme: 'throne_room' },
        // Corner Lanterns
        {
          type: 'set_blocks',
          blocks: [
            { x: -r, y: h + 5, z: -r, block: 'glowstone' },
            { x: r, y: h + 5, z: -r, block: 'glowstone' },
            { x: -r, y: h + 5, z: r, block: 'glowstone' },
            { x: r, y: h + 5, z: r, block: 'glowstone' }
          ]
        }
      ]
    };
  }

  // Japanese Multi-Tiered Pagoda Temple
  blueprintPagoda(size) {
    return {
      name: 'Japanese Pagoda Temple',
      description: 'Multi-tiered sanctuary with sweeping roof tile eaves, cherry wood columns, lantern finial, and Zen cherry blossom trees.',
      commands: [
        // Stone plinth
        { type: 'fill_box', x1: -6, y1: 0, z1: -6, x2: 6, y2: 1, z2: 6, block: 'stone' },
        // Tier 1 sanctuary
        { type: 'framed_building', cx: 0, cz: 0, base_y: 2, width: 8, length: 8, height: 4, wall_block: 'oak_planks', corner_block: 'cherry_wood', floor_block: 'oak_wood', roof_type: 'pitched', roof_block: 'roof_tile', door_side: 'front' },
        // Tier 2 sanctuary & roof
        { type: 'fill_box', x1: -3, y1: 8, z1: -3, x2: 3, y2: 11, z2: 3, block: 'oak_planks', hollow: true },
        { type: 'pitched_roof', cx: 0, cz: 0, base_y: 11, width: 7, length: 7, block: 'roof_tile', overhang: 1 },
        // Tier 3 sanctuary & spire
        { type: 'fill_box', x1: -2, y1: 14, z1: -2, x2: 2, y2: 16, z2: 2, block: 'oak_planks', hollow: true },
        { type: 'pitched_roof', cx: 0, cz: 0, base_y: 16, width: 5, length: 5, block: 'roof_tile', overhang: 1 },
        // Golden spire & finial
        {
          type: 'set_blocks',
          blocks: [
            { x: 0, y: 19, z: 0, block: 'gold_block' },
            { x: 0, y: 20, z: 0, block: 'gold_block' },
            { x: 0, y: 21, z: 0, block: 'glowstone' }
          ]
        },
        // Cherry Blossom Tree in forecourt
        {
          type: 'garden_tree',
          cx: -6,
          cz: -7,
          base_y: 0,
          height: 6,
          trunk_block: 'cherry_wood',
          leaf_block: 'cherry_leaves',
          style: 'cherry'
        },
        {
          type: 'pathway',
          x1: 0,
          z1: -6,
          x2: 0,
          z2: -12,
          y: 0,
          width: 2,
          block: 'gravel'
        }
      ]
    };
  }

  // Modern Glass Villa & Illuminated Pool
  blueprintModernVilla(size) {
    return {
      name: 'Modern Glass Villa & Illuminated Pool',
      description: 'Luxury architectural residence with marble terraces, floor-to-ceiling glass, furnished lounge, and illuminated swimming pool.',
      commands: [
        // Marble foundation terrace
        { type: 'fill_box', x1: -7, y1: 0, z1: -7, x2: 7, y2: 0, z2: 7, block: 'marble' },
        // Swimming pool with water & underwater lanterns
        { type: 'fill_box', x1: 2, y1: 0, z1: -5, x2: 6, y2: 0, z2: 2, block: 'water' },
        { type: 'set_blocks', blocks: [
          { x: 4, y: -1, z: -2, block: 'glowstone' },
          { x: 4, y: -1, z: 0, block: 'glowstone' }
        ]},
        // Ground residence with furnished living room
        {
          type: 'framed_building',
          cx: -3,
          cz: -1,
          base_y: 1,
          width: 7,
          length: 9,
          height: 4,
          wall_block: 'marble',
          corner_block: 'iron_block',
          floor_block: 'oak_planks',
          roof_type: 'flat',
          door_side: 'front'
        },
        {
          type: 'room_interior',
          cx: -3,
          cz: -1,
          floor_y: 2,
          width: 5,
          length: 7,
          theme: 'living_room'
        },
        // Cantilevered 2nd floor suite
        {
          type: 'fill_box',
          x1: -4,
          y1: 6,
          z1: -3,
          x2: 2,
          y2: 9,
          z2: 3,
          block: 'iron_block',
          hollow: true
        },
        // Panoramic glass facade on upper suite
        { type: 'fill_box', x1: -4, y1: 6, z1: 3, x2: 2, y2: 8, z2: 3, block: 'glass' },
        // Flat roof deck with glass railing
        { type: 'fill_box', x1: -4, y1: 10, z1: -3, x2: 2, y2: 10, z2: 3, block: 'marble' },
        { type: 'balcony', x1: -4, z1: -3, x2: 2, z2: 3, y: 11, block: 'glass' }
      ]
    };
  }

  // Wizard Arcane Spire
  blueprintWizardTower(size) {
    return {
      name: 'Wizard Arcane Spire',
      description: 'Spiral obsidian tower carved with glowing observation balconies and floating diamond celestial energy orb.',
      commands: [
        { type: 'cylinder', cx: 0, cz: 0, base_y: 0, height: 16, radius: 4, block: 'obsidian', hollow: true },
        // Observation balconies
        { type: 'cylinder', cx: 0, cz: 0, base_y: 8, height: 1, radius: 5, block: 'marble' },
        { type: 'cylinder', cx: 0, cz: 0, base_y: 16, height: 1, radius: 5, block: 'marble' },
        // Glass crown
        { type: 'cylinder', cx: 0, cz: 0, base_y: 17, height: 4, radius: 3, block: 'glass', hollow: true },
        // Floating celestial orb
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

  // Cyberpunk Neon Monolith
  blueprintCyberpunkMonolith(size) {
    return {
      name: 'Cyberpunk Neon Monolith',
      description: 'Futuristic sci-fi tower with glowing neon conduits, tech command bridge, and observation sensors.',
      commands: [
        { type: 'fill_box', x1: -5, y1: 0, z1: -5, x2: 5, y2: 1, z2: 5, block: 'iron_block' },
        { type: 'fill_box', x1: -3, y1: 2, z1: -3, x2: 3, y2: 18, z2: 3, block: 'obsidian', hollow: true },
        // Glowing Neon Conduits
        { type: 'fill_box', x1: 0, y1: 2, z1: -4, x2: 0, y2: 17, z2: -4, block: 'neon_cyan' },
        { type: 'fill_box', x1: 0, y1: 2, z1: 4, x2: 0, y2: 17, z2: 4, block: 'neon_pink' },
        { type: 'fill_box', x1: -4, y1: 2, z1: 0, x2: -4, y2: 17, z2: 0, block: 'neon_orange' },
        { type: 'fill_box', x1: 4, y1: 2, z1: 0, x2: 4, y2: 17, z2: 0, block: 'neon_cyan' },
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

  // Pirate Galleon Ship
  blueprintPirateShip(size) {
    return {
      name: 'Galleon Pirate Vessel',
      description: 'Stately wooden galleon with carved hull, quarterdeck cabin, tall masts, and crows nest.',
      commands: [
        { type: 'fill_box', x1: -3, y1: 0, z1: -8, x2: 3, y2: 3, z2: 8, block: 'oak_wood', hollow: true },
        { type: 'fill_box', x1: -3, y1: 4, z1: 4, x2: 3, y2: 6, z2: 8, block: 'oak_wood', hollow: true },
        { type: 'fill_box', x1: -2, y1: 4, z1: 8, x2: 2, y2: 5, z2: 8, block: 'glass' },
        { type: 'fill_box', x1: 0, y1: 3, z1: 0, x2: 0, y2: 14, z2: 0, block: 'oak_wood' },
        { type: 'fill_box', x1: 0, y1: 3, z1: -4, x2: 0, y2: 12, z2: -4, block: 'oak_wood' },
        { type: 'fill_box', x1: -1, y1: 12, z1: -1, x2: 1, y2: 12, z2: 1, block: 'oak_wood' },
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

  // Nether Rift Shrine
  blueprintNetherPortal(size) {
    return {
      name: 'Nether Rift Gateway',
      description: 'Ancient obsidian monolith gateway surrounded by gold altars and illuminated runes.',
      commands: [
        { type: 'fill_box', x1: -5, y1: 0, z1: -5, x2: 5, y2: 1, z2: 5, block: 'cobblestone' },
        { type: 'fill_box', x1: -2, y1: 2, z1: 0, x2: 2, y2: 7, z2: 0, block: 'obsidian', hollow: true },
        { type: 'fill_box', x1: -1, y1: 3, z1: 0, x2: 1, y2: 6, z2: 0, block: 'water' },
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
