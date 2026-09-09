import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { BLOCK_TYPES, BLOCK_DEFS } from './blocks.js';

export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Z = 16;
export const CHUNK_SIZE_Y = 64;
export const SEA_LEVEL = 18;

// Face orientation vectors and CCW outward-facing corners
const FACES = [
  { // 0: +X (Right)
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]
    ],
    norm: [1, 0, 0],
    faceName: 'side'
  },
  { // 1: -X (Left)
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]
    ],
    norm: [-1, 0, 0],
    faceName: 'side'
  },
  { // 2: +Y (Top)
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]
    ],
    norm: [0, 1, 0],
    faceName: 'top'
  },
  { // 3: -Y (Bottom)
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]
    ],
    norm: [0, -1, 0],
    faceName: 'bottom'
  },
  { // 4: +Z (Front)
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
    ],
    norm: [0, 0, 1],
    faceName: 'front'
  },
  { // 5: -Z (Back)
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]
    ],
    norm: [0, 0, -1],
    faceName: 'back'
  }
];

export class Chunk {
  constructor(cx, cz, world) {
    this.cx = cx;
    this.cz = cz;
    this.world = world;
    this.voxels = new Uint8Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
    this.mesh = null;
    this.transMesh = null;
    this.waterMesh = null;
    this.dirty = true;
    this.isBuilt = false;
  }

  dispose(scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.transMesh) {
      scene.remove(this.transMesh);
      this.transMesh.geometry.dispose();
      this.transMesh = null;
    }
    if (this.waterMesh) {
      scene.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
    this.isBuilt = false;
  }

  getIndex(lx, ly, lz) {
    return lx + lz * CHUNK_SIZE_X + ly * (CHUNK_SIZE_X * CHUNK_SIZE_Z);
  }

  getBlock(lx, ly, lz) {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_SIZE_Y || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return this.world.getBlock(this.cx * CHUNK_SIZE_X + lx, ly, this.cz * CHUNK_SIZE_Z + lz);
    }
    return this.voxels[this.getIndex(lx, ly, lz)];
  }

  setBlock(lx, ly, lz, type) {
    if (lx < 0 || lx >= CHUNK_SIZE_X || ly < 0 || ly >= CHUNK_SIZE_Y || lz < 0 || lz >= CHUNK_SIZE_Z) {
      return;
    }
    this.voxels[this.getIndex(lx, ly, lz)] = type;
    this.dirty = true;
  }
}

export class World {
  constructor(scene, textureAtlas) {
    this.scene = scene;
    this.textureAtlas = textureAtlas;
    this.chunks = new Map();
    this.noise2D = createNoise2D();
    this.worldType = localStorage.getItem('theo_world_type') || 'baseplate';
    this.currentRenderRadius = 3;

    // Solid opaque blocks: Clean glossy plastic with studs
    this.solidMaterial = new THREE.MeshStandardMaterial({
      map: this.textureAtlas.texture,
      roughness: 0.35,
      metalness: 0.02,
      vertexColors: true,
      side: THREE.FrontSide,
      transparent: false,
      depthTest: true,
      depthWrite: true
    });

    // Transparent blocks (Glass, Leaves): Cutout transparency, depth writing enabled
    this.transMaterial = new THREE.MeshStandardMaterial({
      map: this.textureAtlas.texture,
      roughness: 0.25,
      metalness: 0.08,
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.2,
      depthTest: true,
      depthWrite: true
    });

    // Water material: double-sided with transparency
    this.waterMaterial = new THREE.MeshStandardMaterial({
      map: this.textureAtlas.texture,
      transparent: true,
      opacity: 0.8,
      roughness: 0.05,
      metalness: 0.1,
      vertexColors: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.initInfiniteBaseplate();
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunk(cx, cz) {
    return this.chunks.get(this.chunkKey(cx, cz));
  }

  getOrCreateChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz, this);
      this.generateChunkTerrain(chunk);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_SIZE_Y) return BLOCK_TYPES.AIR;
    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return BLOCK_TYPES.AIR;
    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;
    return chunk.voxels[chunk.getIndex(lx, y, lz)];
  }

  setBlock(x, y, z, type) {
    if (y < 0 || y >= CHUNK_SIZE_Y) return false;
    const cx = Math.floor(x / CHUNK_SIZE_X);
    const cz = Math.floor(z / CHUNK_SIZE_Z);
    const chunk = this.getOrCreateChunk(cx, cz);
    const lx = ((x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    chunk.setBlock(lx, y, lz, type);

    // If on border, also flag neighbor chunk as dirty
    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE_X - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE_Z - 1) this.markChunkDirty(cx, cz + 1);

    this.rebuildChunkMesh(chunk);
    return true;
  }

  markChunkDirty(cx, cz) {
    const c = this.chunks.get(this.chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  // Multi-world terrain generation: Classic Baseplate vs Normal World
  generateChunkTerrain(chunk) {
    if (this.worldType === 'baseplate') {
      this.generateBaseplateChunk(chunk);
    } else {
      this.generateNormalChunk(chunk);
    }
  }

  // Classic Baseplate: Flat medium stone grey slab with central spawn pad
  generateBaseplateChunk(chunk) {
    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        // Bedrock at Y=0
        chunk.voxels[chunk.getIndex(lx, 0, lz)] = BLOCK_TYPES.OBSIDIAN;

        // Dark slate foundation layer at Y=3
        chunk.voxels[chunk.getIndex(lx, 3, lz)] = BLOCK_TYPES.DEEPSLATE;

        // Central spawn pad in chunk (0, 0)
        const isSpawnPad = (chunk.cx === 0 && chunk.cz === 0 && lx >= 6 && lx <= 9 && lz >= 6 && lz <= 9);
        const isSpawnBorder = (chunk.cx === 0 && chunk.cz === 0 && (((lx === 5 || lx === 10) && lz >= 5 && lz <= 10) || ((lz === 5 || lz === 10) && lx >= 5 && lx <= 10)));

        if (isSpawnPad) {
          chunk.voxels[chunk.getIndex(lx, 4, lz)] = BLOCK_TYPES.SPAWN_PLATE;
        } else if (isSpawnBorder) {
          chunk.voxels[chunk.getIndex(lx, 4, lz)] = BLOCK_TYPES.NEON_CYAN;
        } else {
          // Classic Medium Stone Grey Baseplate with studs
          chunk.voxels[chunk.getIndex(lx, 4, lz)] = BLOCK_TYPES.BASEPLATE;
        }
      }
    }
  }

  // Multi-octave natural terrain generation with rolling hills and biomes
  generateNormalChunk(chunk) {
    const worldX0 = chunk.cx * CHUNK_SIZE_X;
    const worldZ0 = chunk.cz * CHUNK_SIZE_Z;

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
        const wx = worldX0 + lx;
        const wz = worldZ0 + lz;

        // Broad, majestic rolling hill octaves
        const n1 = this.noise2D(wx * 0.008, wz * 0.008);
        const n2 = this.noise2D(wx * 0.022, wz * 0.022) * 0.4;
        const n3 = this.noise2D(wx * 0.05, wz * 0.05) * 0.15;

        const combined = (n1 + n2 + n3) / 1.55;
        const height = Math.floor(SEA_LEVEL + 4 + combined * 13);

        for (let y = 0; y < CHUNK_SIZE_Y; y++) {
          if (y === 0) {
            // Bedrock
            chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.OBSIDIAN;
          } else if (y < height - 4) {
            // Deep stone with rich ore veins
            const oreNoise = Math.sin(wx * 1.3 + y * 2.1) * Math.cos(wz * 1.5 + y * 1.9);
            if (oreNoise > 0.94 && y < 14) {
              chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.DIAMOND_BLOCK;
            } else if (oreNoise > 0.88 && y < 24) {
              chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.GOLD_BLOCK;
            } else if (oreNoise > 0.82) {
              chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.IRON_BLOCK;
            } else {
              chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.STONE;
            }
          } else if (y < height) {
            // Loam soil layer
            chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.DIRT;
          } else if (y === height) {
            // Surface biome layer
            if (height <= SEA_LEVEL + 1) {
              chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.SAND;
            } else if (height > SEA_LEVEL + 12) {
              // Sculpted highland plateaus
              const peakNoise = this.noise2D(wx * 0.08, wz * 0.08);
              chunk.voxels[chunk.getIndex(lx, y, lz)] = peakNoise > 0.3 ? BLOCK_TYPES.MARBLE : BLOCK_TYPES.GRANITE;
            } else {
              chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.GRASS;
            }
          } else if (y <= SEA_LEVEL) {
            // Ocean / river water
            chunk.voxels[chunk.getIndex(lx, y, lz)] = BLOCK_TYPES.WATER;
          }
        }
      }
    }

    // Scatter diverse organic trees on grass
    for (let lx = 2; lx < CHUNK_SIZE_X - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE_Z - 2; lz++) {
        const wx = worldX0 + lx;
        const wz = worldZ0 + lz;
        const treeChance = (this.noise2D(wx * 0.12, wz * 0.12) + 1) * 0.5;

        if (treeChance > 0.78) {
          for (let y = CHUNK_SIZE_Y - 10; y >= SEA_LEVEL + 2; y--) {
            if (chunk.voxels[chunk.getIndex(lx, y, lz)] === BLOCK_TYPES.GRASS) {
              this.spawnTree(chunk, lx, y + 1, lz);
              break;
            }
          }
        }
      }
    }
  }

  spawnTree(chunk, lx, baseY, lz) {
    const isCherry = Math.random() > 0.75;
    const isBirch = !isCherry && Math.random() > 0.65;
    const woodBlock = isCherry ? BLOCK_TYPES.CHERRY_WOOD : (isBirch ? BLOCK_TYPES.BIRCH_WOOD : BLOCK_TYPES.OAK_WOOD);
    const leafBlock = isCherry ? BLOCK_TYPES.CHERRY_LEAVES : BLOCK_TYPES.OAK_LEAVES;

    const trunkHeight = 4 + Math.floor(Math.random() * 3);
    for (let dy = 0; dy < trunkHeight; dy++) {
      if (baseY + dy < CHUNK_SIZE_Y) {
        chunk.voxels[chunk.getIndex(lx, baseY + dy, lz)] = woodBlock;
      }
    }

    // Organic rounded cloud canopies: overlapping spheres of foliage
    const canopyCenterY = baseY + trunkHeight;
    const canopySpheres = [
      { dx: 0, dy: 0, dz: 0, r: 2.8 },
      { dx: 1, dy: -1, dz: 0, r: 2.1 },
      { dx: -1, dy: -1, dz: 1, r: 2.0 },
      { dx: 0, dy: 1, dz: -1, r: 1.9 }
    ];

    for (const sphere of canopySpheres) {
      const cx = lx + sphere.dx;
      const cy = canopyCenterY + sphere.dy;
      const cz = lz + sphere.dz;
      const r = sphere.r;
      const rCeil = Math.ceil(r);

      for (let ox = -rCeil; ox <= rCeil; ox++) {
        for (let oy = -rCeil; oy <= rCeil; oy++) {
          for (let oz = -rCeil; oz <= rCeil; oz++) {
            const distSq = ox * ox + oy * oy * 1.3 + oz * oz;
            if (distSq <= r * r) {
              const tx = cx + ox;
              const ty = cy + oy;
              const tz = cz + oz;
              if (tx >= 0 && tx < CHUNK_SIZE_X && tz >= 0 && tz < CHUNK_SIZE_Z && ty < CHUNK_SIZE_Y && ty >= 0) {
                const idx = chunk.getIndex(tx, ty, tz);
                if (chunk.voxels[idx] === BLOCK_TYPES.AIR) {
                  chunk.voxels[idx] = leafBlock;
                }
              }
            }
          }
        }
      }
    }
  }

  // Calculate Voxel Ambient Occlusion (AO)
  calculateVertexAO(side1Block, side2Block, cornerBlock) {
    const s1 = side1Block !== BLOCK_TYPES.AIR && !BLOCK_DEFS[side1Block]?.transparent ? 1 : 0;
    const s2 = side2Block !== BLOCK_TYPES.AIR && !BLOCK_DEFS[side2Block]?.transparent ? 1 : 0;
    const c = cornerBlock !== BLOCK_TYPES.AIR && !BLOCK_DEFS[cornerBlock]?.transparent ? 1 : 0;

    if (s1 && s2) {
      return 0; // Fully occluded corner
    }
    return 3 - (s1 + s2 + c); // 0, 1, 2, or 3
  }

  // Mesh a chunk with greedy face culling and vertex ambient occlusion
  rebuildChunkMesh(chunk) {
    // Solid buffers
    const positions = [];
    const normals = [];
    const uvs = [];
    const colors = [];

    // Transparent buffers (Glass, Leaves)
    const transPositions = [];
    const transNormals = [];
    const transUvs = [];
    const transColors = [];

    // Water buffers
    const waterPositions = [];
    const waterNormals = [];
    const waterUvs = [];
    const waterColors = [];

    const aoLevels = [0.55, 0.72, 0.88, 1.0];

    for (let lx = 0; lx < CHUNK_SIZE_X; lx++) {
      for (let ly = 0; ly < CHUNK_SIZE_Y; ly++) {
        for (let lz = 0; lz < CHUNK_SIZE_Z; lz++) {
          const block = chunk.getBlock(lx, ly, lz);
          if (block === BLOCK_TYPES.AIR) continue;

          const def = BLOCK_DEFS[block];
          const isWater = block === BLOCK_TYPES.WATER;
          const isTrans = def.transparent && !isWater;

          let targetPos = positions;
          let targetNorm = normals;
          let targetUvs = uvs;
          let targetColors = colors;

          if (isWater) {
            targetPos = waterPositions;
            targetNorm = waterNormals;
            targetUvs = waterUvs;
            targetColors = waterColors;
          } else if (isTrans) {
            targetPos = transPositions;
            targetNorm = transNormals;
            targetUvs = transUvs;
            targetColors = transColors;
          }

          const wx = chunk.cx * CHUNK_SIZE_X + lx;
          const wy = ly;
          const wz = chunk.cz * CHUNK_SIZE_Z + lz;

          // Check all 6 faces
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = lx + face.dir[0];
            const ny = ly + face.dir[1];
            const nz = lz + face.dir[2];

            const neighbor = chunk.getBlock(nx, ny, nz);
            const neighborDef = BLOCK_DEFS[neighbor];

            // Cull hidden internal faces
            let shouldDraw = false;
            if (isWater) {
              shouldDraw = (neighbor === BLOCK_TYPES.AIR) || (f === 2 && neighbor !== BLOCK_TYPES.WATER);
            } else if (isTrans) {
              // Transparent block: only draw if neighbor is not identical transparent block
              shouldDraw = (neighbor !== block);
            } else {
              // Solid block drawn if neighbor is air, water, or transparent
              shouldDraw = (neighbor === BLOCK_TYPES.AIR) || (neighborDef && neighborDef.transparent);
            }

            if (!shouldDraw) continue;

            // Texture UVs
            let tileKey = 'dirt';
            if (def.faces) {
              if (def.faces.all) tileKey = def.faces.all;
              else if (face.faceName === 'top' && def.faces.top) tileKey = def.faces.top;
              else if (face.faceName === 'bottom' && def.faces.bottom) tileKey = def.faces.bottom;
              else if (face.faceName === 'front' && def.faces.front) tileKey = def.faces.front;
              else if (face.faceName === 'back' && def.faces.back) tileKey = def.faces.back;
              else if (def.faces.side) tileKey = def.faces.side;
              else if (def.faces.front) tileKey = def.faces.front;
            }

            const { u0, v0, u1, v1 } = this.textureAtlas.getTileUV(tileKey);

            // Quad corners:
            // c0 = bottom-left (u0, v0)
            // c1 = bottom-right (u1, v0)
            // c2 = top-right (u1, v1)
            // c3 = top-left (u0, v1)
            const c0 = face.corners[0];
            const c1 = face.corners[1];
            const c2 = face.corners[2];
            const c3 = face.corners[3];

            // Compute AO for corners
            const vColors = [];
            for (let c = 0; c < 4; c++) {
              let ao = 3;
              if (!isWater && wy > 0) {
                const corner = face.corners[c];
                const cxOffset = corner[0] === 0 ? -1 : 1;
                const cyOffset = corner[1] === 0 ? -1 : 1;
                const czOffset = corner[2] === 0 ? -1 : 1;

                const s1 = chunk.getBlock(lx + cxOffset, ly, lz);
                const s2 = chunk.getBlock(lx, ly + cyOffset, lz);
                const cn = chunk.getBlock(lx + cxOffset, ly + cyOffset, lz);
                ao = this.calculateVertexAO(s1, s2, cn);
              }
              const brightness = aoLevels[ao];
              vColors.push(brightness, brightness, brightness);
            }

            // Two triangles with correct CCW winding: (c0, c1, c2) and (c0, c2, c3)
            // 100% Watertight flush integer vertices (zero gaps, zero cracks, clean snap-fit bricks)
            const addVertex = (corner, u, v, aoIdx) => {
              targetPos.push(wx + corner[0], wy + corner[1], wz + corner[2]);
              targetNorm.push(face.norm[0], face.norm[1], face.norm[2]);
              targetUvs.push(u, v);
              targetColors.push(vColors[aoIdx * 3], vColors[aoIdx * 3 + 1], vColors[aoIdx * 3 + 2]);
            };

            addVertex(c0, u0, v0, 0);
            addVertex(c1, u1, v0, 1);
            addVertex(c2, u1, v1, 2);

            addVertex(c0, u0, v0, 0);
            addVertex(c2, u1, v1, 2);
            addVertex(c3, u0, v1, 3);
          }
        }
      }
    }

    // Dispose old meshes
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.transMesh) {
      this.scene.remove(chunk.transMesh);
      chunk.transMesh.geometry.dispose();
      chunk.transMesh = null;
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }

    // Build solid geometry
    if (positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      chunk.mesh = new THREE.Mesh(geom, this.solidMaterial);
      chunk.mesh.castShadow = true;
      chunk.mesh.receiveShadow = true;
      this.scene.add(chunk.mesh);
    }

    // Build transparent geometry (Glass, Leaves)
    if (transPositions.length > 0) {
      const transGeom = new THREE.BufferGeometry();
      transGeom.setAttribute('position', new THREE.Float32BufferAttribute(transPositions, 3));
      transGeom.setAttribute('normal', new THREE.Float32BufferAttribute(transNormals, 3));
      transGeom.setAttribute('uv', new THREE.Float32BufferAttribute(transUvs, 2));
      transGeom.setAttribute('color', new THREE.Float32BufferAttribute(transColors, 3));

      chunk.transMesh = new THREE.Mesh(transGeom, this.transMaterial);
      this.scene.add(chunk.transMesh);
    }

    // Build water geometry
    if (waterPositions.length > 0) {
      const waterGeom = new THREE.BufferGeometry();
      waterGeom.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
      waterGeom.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));
      waterGeom.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
      waterGeom.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));

      chunk.waterMesh = new THREE.Mesh(waterGeom, this.waterMaterial);
      this.scene.add(chunk.waterMesh);
    }

    chunk.dirty = false;
    chunk.isBuilt = true;
  }

  initInfiniteBaseplate() {
    try {
      const tileIdx = this.textureAtlas.tileIndices['baseplate_top'] || 0;
      const col = tileIdx % this.textureAtlas.atlasCols;
      const row = Math.floor(tileIdx / this.textureAtlas.atlasCols);
      const ts = this.textureAtlas.tileSize || 32;

      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = ts;
      tileCanvas.height = ts;
      const tctx = tileCanvas.getContext('2d');
      tctx.drawImage(
        this.textureAtlas.canvas,
        col * ts, row * ts, ts, ts,
        0, 0, ts, ts
      );

      const baseplateTexture = new THREE.CanvasTexture(tileCanvas);
      baseplateTexture.wrapS = THREE.RepeatWrapping;
      baseplateTexture.wrapT = THREE.RepeatWrapping;
      const planeSize = 4096;
      baseplateTexture.repeat.set(planeSize, planeSize);
      baseplateTexture.magFilter = THREE.LinearFilter;
      baseplateTexture.minFilter = THREE.LinearMipmapLinearFilter;
      baseplateTexture.colorSpace = THREE.SRGBColorSpace;

      const baseplateMat = new THREE.MeshStandardMaterial({
        map: baseplateTexture,
        roughness: 0.35,
        metalness: 0.02
      });

      const geom = new THREE.PlaneGeometry(planeSize, planeSize);
      this.infiniteBaseplateMesh = new THREE.Mesh(geom, baseplateMat);
      this.infiniteBaseplateMesh.rotation.x = -Math.PI / 2;
      // Position at Y = 3.99 so voxel blocks placed at Y = 4 sit flush on top with zero z-fighting
      this.infiniteBaseplateMesh.position.set(0, 3.99, 0);
      this.infiniteBaseplateMesh.receiveShadow = true;
      this.infiniteBaseplateMesh.visible = (this.worldType === 'baseplate');
      this.scene.add(this.infiniteBaseplateMesh);
    } catch (e) {
      console.warn('Infinite baseplate backdrop initialization error:', e);
    }
  }

  updateChunkStreaming(playerX, playerZ, radius = 3) {
    this.currentRenderRadius = radius;
    const pcx = Math.floor(playerX / CHUNK_SIZE_X);
    const pcz = Math.floor(playerZ / CHUNK_SIZE_Z);

    // Keep infinite baseplate plane centered near player in baseplate mode
    if (this.infiniteBaseplateMesh) {
      this.infiniteBaseplateMesh.visible = (this.worldType === 'baseplate');
      if (this.worldType === 'baseplate') {
        this.infiniteBaseplateMesh.position.x = pcx * CHUNK_SIZE_X;
        this.infiniteBaseplateMesh.position.z = pcz * CHUNK_SIZE_Z;
      }
    }

    // Build chunks within render distance
    for (let cx = pcx - radius; cx <= pcx + radius; cx++) {
      for (let cz = pcz - radius; cz <= pcz + radius; cz++) {
        const chunk = this.getOrCreateChunk(cx, cz);
        if (chunk.dirty) {
          this.rebuildChunkMesh(chunk);
        }
      }
    }

    // Unload distant chunk meshes to avoid memory leaks during infinite flight/exploration
    const unloadDist = radius + 2;
    for (const chunk of this.chunks.values()) {
      if (Math.abs(chunk.cx - pcx) > unloadDist || Math.abs(chunk.cz - pcz) > unloadDist) {
        if (chunk.isBuilt) {
          chunk.dispose(this.scene);
        }
      }
    }
  }

  initArea(centerChunkX = 0, centerChunkZ = 0, radius = 3) {
    this.currentRenderRadius = radius;
    for (let cx = centerChunkX - radius; cx <= centerChunkX + radius; cx++) {
      for (let cz = centerChunkZ - radius; cz <= centerChunkZ + radius; cz++) {
        const chunk = this.getOrCreateChunk(cx, cz);
        if (chunk.dirty) {
          this.rebuildChunkMesh(chunk);
        }
      }
    }
  }

  switchWorld(newType) {
    this.worldType = newType;
    localStorage.setItem('theo_world_type', newType);

    // Dispose and remove all active chunk meshes
    for (const chunk of this.chunks.values()) {
      chunk.dispose(this.scene);
    }
    this.chunks.clear();

    if (this.infiniteBaseplateMesh) {
      this.infiniteBaseplateMesh.visible = (newType === 'baseplate');
    }

    // Re-initialize area around origin with current render distance
    this.initArea(0, 0, this.currentRenderRadius || 3);
  }

  getSurfaceY(x, z) {
    for (let y = CHUNK_SIZE_Y - 1; y >= 0; y--) {
      const b = this.getBlock(x, y, z);
      if (b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.WATER) {
        return y + 1;
      }
    }
    return SEA_LEVEL + 1;
  }
}
