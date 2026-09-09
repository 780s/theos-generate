import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_DEFS } from './blocks.js';
import { SkinManager } from './skins.js';

export class Player {
  constructor(camera, world, soundEngine, particleSystem, callbacks = {}) {
    this.camera = camera;
    this.world = world;
    this.sound = soundEngine;
    this.particles = particleSystem;
    this.callbacks = callbacks;

    // Skin Manager
    this.skinManager = new SkinManager();

    // Dimensions
    this.height = 1.75;
    this.eyeHeight = 1.62;
    this.radius = 0.35;

    // Position & velocities
    this.position = new THREE.Vector3(8, 30, 8);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // State
    this.isFlying = false;
    this.onGround = false;
    this.isSprinting = false;
    this.inWater = false;
    this.isSubmerged = false;

    // Speed settings
    this.walkSpeed = 5.5;
    this.sprintSpeed = 8.5;
    this.swimSpeed = 4.2;
    this.swimSprintSpeed = 6.8;
    this.flySpeed = 16.0;
    this.jumpForce = 7.5;
    this.gravity = 22.0;

    // Raycasting & Block interaction
    this.reachDistance = 5.5;
    this.targetBlock = null;
    this.selectedBlockType = BLOCK_TYPES.GRASS;

    // Block Coloring & Painting System
    this.isPaintMode = false;
    this.activeColor = '#e74c3c'; // Default Crimson
    this.autoTintOnPlace = false;

    // Digging state
    this.isDigging = false;
    this.digProgress = 0;
    this.digTarget = null;
    this.lastHitSoundTime = 0;

    // Footstep & Swim timer
    this.stepDistance = 0;
    this.swimPaddleTimer = 0;

    // Screen Shake / Trauma system
    this.trauma = 0;
    this.screenShakeOffset = new THREE.Vector3();

    // Highlight wireframe box
    this.createHighlightBox();

    // Dual Hands (Left Hand + Right Hand)
    this.createDualHands();
  }

  createHighlightBox() {
    const geom = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    const edges = new THREE.EdgesGeometry(geom);
    this.highlightBox = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, transparent: true, opacity: 0.6 })
    );
    this.highlightBox.visible = false;
    this.world.scene.add(this.highlightBox);
  }

  createDualHands() {
    this.armsRoot = new THREE.Group();
    this.camera.add(this.armsRoot);

    const armGeom = new THREE.BoxGeometry(0.12, 0.45, 0.12);

    // Advanced arm materials with diffuse + glowing emissive circuit channels
    const skinTextures = this.skinManager.generateSkinTextures();
    this.armMaterial = new THREE.MeshStandardMaterial({
      map: skinTextures.diffuse,
      emissiveMap: skinTextures.emissive,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.95,
      roughness: 0.65,
      metalness: 0.35
    });

    // 1. Right Hand Group
    this.rightHandGroup = new THREE.Group();
    this.rightArmMesh = new THREE.Mesh(armGeom, this.armMaterial);
    this.rightArmMesh.position.set(0, 0, 0);
    this.rightHandGroup.add(this.rightArmMesh);

    // Matter Manipulator (Theo's signature sci-fi architect tool)
    this.toolGroup = new THREE.Group();

    // Tool body chassis
    const bodyGeom = new THREE.BoxGeometry(0.045, 0.28, 0.065);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      metalness: 0.9,
      roughness: 0.2
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.set(0, 0.18, 0);
    this.toolGroup.add(bodyMesh);

    // Auric conduit lines
    const conduitGeom = new THREE.BoxGeometry(0.052, 0.12, 0.02);
    const conduitMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15
    });
    const conduitMesh = new THREE.Mesh(conduitGeom, conduitMat);
    conduitMesh.position.set(0, 0.18, 0.028);
    this.toolGroup.add(conduitMesh);

    // Dual Quantum Emitter Prongs
    const prongGeom = new THREE.BoxGeometry(0.014, 0.14, 0.02);
    const prongMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.9,
      roughness: 0.15
    });
    const leftProng = new THREE.Mesh(prongGeom, prongMat);
    leftProng.position.set(-0.032, 0.35, 0);
    leftProng.rotation.z = -0.15;
    this.toolGroup.add(leftProng);

    const rightProng = new THREE.Mesh(prongGeom, prongMat);
    rightProng.position.set(0.032, 0.35, 0);
    rightProng.rotation.z = 0.15;
    this.toolGroup.add(rightProng);

    // Floating Pulsing Plasma Matter Core
    const coreGeom = new THREE.OctahedronGeometry(0.035, 1);
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      metalness: 0.1
    });
    this.plasmaCore = new THREE.Mesh(coreGeom, this.coreMat);
    this.plasmaCore.position.set(0, 0.34, 0);
    this.toolGroup.add(this.plasmaCore);

    // Holographic Emitter Focus Ring
    const ringGeom = new THREE.TorusGeometry(0.055, 0.005, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    this.focusRing = new THREE.Mesh(ringGeom, ringMat);
    this.focusRing.rotation.x = Math.PI / 2;
    this.focusRing.position.set(0, 0.34, 0);
    this.toolGroup.add(this.focusRing);

    this.rightHandGroup.add(this.toolGroup);

    // Held Block (in right hand)
    const blockGeom = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.blockMeshMat = new THREE.MeshStandardMaterial({
      map: this.world.textureAtlas.texture,
      roughness: 0.9,
      metalness: 0.05
    });
    this.heldBlockMesh = new THREE.Mesh(blockGeom, this.blockMeshMat);
    this.heldBlockMesh.position.set(0, 0.25, 0);
    this.heldBlockMesh.visible = false;
    this.rightHandGroup.add(this.heldBlockMesh);

    // Position Right Hand
    this.rightHandGroup.position.set(0.36, -0.32, -0.55);
    this.rightHandGroup.rotation.set(0.25, -0.35, 0.1);

    // 2. Left Hand Group (Clean off-hand with advanced gauntlet - NO blue block!)
    this.leftHandGroup = new THREE.Group();
    this.leftArmMesh = new THREE.Mesh(armGeom, this.armMaterial);
    this.leftHandGroup.add(this.leftArmMesh);

    // Position Left Hand
    this.leftHandGroup.position.set(-0.36, -0.34, -0.55);
    this.leftHandGroup.rotation.set(0.25, 0.35, -0.1);

    this.armsRoot.add(this.rightHandGroup);
    this.armsRoot.add(this.leftHandGroup);

    this.swingProgress = 0;
    this.isSwinging = false;
  }

  setSkin(skinId) {
    this.skinManager.setSkin(skinId);
    const textures = this.skinManager.generateSkinTextures(skinId);
    this.armMaterial.map = textures.diffuse;
    this.armMaterial.emissiveMap = textures.emissive;
    this.armMaterial.needsUpdate = true;

    // Harmonize Matter Manipulator's plasma core with character skin glow
    const skinDef = this.skinManager.getSkin(skinId);
    if (this.coreMat && skinDef) {
      this.coreMat.color.set(skinDef.glowColor);
      this.coreMat.emissive.set(skinDef.glowColor);
    }
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  toggleFly() {
    this.isFlying = !this.isFlying;
    this.onGround = false;
    this.velocity.set(0, 0, 0);
    this.sound.playFlightToggle(this.isFlying);
    return this.isFlying;
  }

  addTrauma(amount = 0.5) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  setHeldBlock(type) {
    this.selectedBlockType = type;
    if (type === BLOCK_TYPES.AIR || type === BLOCK_TYPES.STONE) {
      this.toolGroup.visible = true;
      this.heldBlockMesh.visible = false;
    } else {
      this.toolGroup.visible = false;
      this.heldBlockMesh.visible = true;
      this.updateHeldBlockUVs(type);
    }
  }

  updateHeldBlockUVs(type) {
    const def = BLOCK_DEFS[type];
    if (!def) return;
    const geom = this.heldBlockMesh.geometry;
    const uvs = geom.attributes.uv;
    if (!uvs) return;

    const faceNames = ['side', 'side', 'top', 'bottom', 'side', 'side'];
    for (let f = 0; f < 6; f++) {
      let tileKey = 'dirt';
      if (def.faces) {
        if (def.faces.all) tileKey = def.faces.all;
        else if (faceNames[f] === 'top' && def.faces.top) tileKey = def.faces.top;
        else if (faceNames[f] === 'bottom' && def.faces.bottom) tileKey = def.faces.bottom;
        else if (def.faces.side) tileKey = def.faces.side;
      }
      const { u0, v0, u1, v1 } = this.world.textureAtlas.getTileUV(tileKey);
      const offset = f * 4;
      uvs.setXY(offset + 0, u0, v1);
      uvs.setXY(offset + 1, u1, v1);
      uvs.setXY(offset + 2, u0, v0);
      uvs.setXY(offset + 3, u1, v0);
    }
    uvs.needsUpdate = true;
  }

  update(delta, input) {
    this.checkWaterState();
    this.updateMovement(delta, input);
    this.updateRaycast();
    this.updateDigging(delta);
    this.updateHandAnimation(delta);
    this.updateScreenShake(delta);
  }

  checkWaterState() {
    const footBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z));
    const eyeBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + this.eyeHeight), Math.floor(this.position.z));

    const wasInWater = this.inWater;
    this.inWater = (footBlock === BLOCK_TYPES.WATER || eyeBlock === BLOCK_TYPES.WATER);
    this.isSubmerged = (eyeBlock === BLOCK_TYPES.WATER);

    // Splash sound on entering or leaving water
    if (!wasInWater && this.inWater) {
      this.sound.playSplash();
      this.particles.spawnWaterSplash(this.position.x, this.position.y, this.position.z);
      if (this.callbacks.onWaterEnter) this.callbacks.onWaterEnter();
    } else if (wasInWater && !this.inWater) {
      this.sound.playSplash();
      this.particles.spawnWaterSplash(this.position.x, this.position.y, this.position.z);
      if (this.callbacks.onWaterExit) this.callbacks.onWaterExit();
    }
  }

  updateMovement(delta, input) {
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const camRight = new THREE.Vector3();
    camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

    // 1. FLIGHT PHYSICS
    if (this.isFlying) {
      this.onGround = false;
      const flySpeed = this.flySpeed;
      const flyDir = new THREE.Vector3();

      if (input.forward) flyDir.add(camDir);
      if (input.backward) flyDir.sub(camDir);
      if (input.right) flyDir.add(camRight);
      if (input.left) flyDir.sub(camRight);

      if (input.joystickActive && (input.joystickX !== 0 || input.joystickY !== 0)) {
        flyDir.addScaledVector(camRight, input.joystickX);
        flyDir.addScaledVector(camDir, -input.joystickY);
      }

      if (flyDir.lengthSq() > 0.001) flyDir.normalize();

      // Clean vertical lift strictly controlled by ascend/descend (no jump interference)
      let verticalLift = 0;
      if (input.ascend) verticalLift += 1.0;
      if (input.descend) verticalLift -= 1.0;

      const speedMult = input.sprint ? 1.5 : 1.0;
      const cruiseSpeed = flySpeed * speedMult;
      const targetVx = flyDir.x * cruiseSpeed;
      const targetVy = (flyDir.y * cruiseSpeed * 0.7) + (verticalLift * 9.0);
      const targetVz = flyDir.z * cruiseSpeed;

      const flightDamping = 10.0;
      this.velocity.x += (targetVx - this.velocity.x) * Math.min(1.0, flightDamping * delta);
      this.velocity.y += (targetVy - this.velocity.y) * Math.min(1.0, flightDamping * delta);
      this.velocity.z += (targetVz - this.velocity.z) * Math.min(1.0, flightDamping * delta);

      const nextX = this.position.x + this.velocity.x * delta;
      const nextY = this.position.y + this.velocity.y * delta;
      const nextZ = this.position.z + this.velocity.z * delta;

      if (!this.checkCollision(nextX, this.position.y, this.position.z)) this.position.x = nextX;
      if (!this.checkCollision(this.position.x, nextY, this.position.z)) {
        this.position.y = Math.max(1.0, nextY);
      } else {
        this.velocity.y = 0;
      }
      if (!this.checkCollision(this.position.x, this.position.y, nextZ)) this.position.z = nextZ;

      this.camera.position.copy(this.position);
      this.camera.position.y += this.eyeHeight;
      return;
    }

    // 2. SWIMMING MECHANICS
    if (this.inWater) {
      const currentSwimSpeed = input.sprint ? this.swimSprintSpeed : this.swimSpeed;
      const moveDir = new THREE.Vector3();

      if (input.forward) moveDir.add(camDir);
      if (input.backward) moveDir.sub(camDir);
      if (input.right) moveDir.add(camRight);
      if (input.left) moveDir.sub(camRight);

      if (input.joystickActive && (input.joystickX !== 0 || input.joystickY !== 0)) {
        moveDir.addScaledVector(camRight, input.joystickX);
        moveDir.addScaledVector(camDir, -input.joystickY);
      }

      if (moveDir.lengthSq() > 0.001) moveDir.normalize();

      // Fluid water drag and buoyancy
      this.velocity.x += (moveDir.x * currentSwimSpeed - this.velocity.x) * Math.min(1.0, 6.0 * delta);
      this.velocity.z += (moveDir.z * currentSwimSpeed - this.velocity.z) * Math.min(1.0, 6.0 * delta);

      // Vertical swim propulsion
      let swimY = -1.5 * delta; // Gentle sinking buoyancy
      if (input.jump || input.ascend) swimY = 4.0; // Swim up
      if (input.sneak || input.descend) swimY = -4.0; // Dive down

      // Look-direction swim pitch when swimming forward
      if (input.forward && Math.abs(camDir.y) > 0.1) {
        swimY += camDir.y * currentSwimSpeed * 0.8;
      }

      this.velocity.y += (swimY - this.velocity.y) * Math.min(1.0, 5.0 * delta);

      // Swimming sound & bubble effects
      this.swimPaddleTimer += delta;
      if (this.swimPaddleTimer > 0.7 && (Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5 || Math.abs(this.velocity.y) > 1.0)) {
        this.sound.playSwim();
        this.particles.spawnBubbles(this.position.x, this.position.y + 0.8, this.position.z, 5);
        this.swimPaddleTimer = 0;
      }

      this.handleCollisions(delta);
      this.camera.position.copy(this.position);
      this.camera.position.y += this.eyeHeight;
      return;
    }

    // 3. GROUND WALKING / RUNNING PHYSICS
    const groundForward = new THREE.Vector3(camDir.x, 0, camDir.z).normalize();
    const groundRight = new THREE.Vector3();
    groundRight.crossVectors(groundForward, new THREE.Vector3(0, 1, 0)).normalize();

    const walkDir = new THREE.Vector3();
    if (input.forward) walkDir.add(groundForward);
    if (input.backward) walkDir.sub(groundForward);
    if (input.right) walkDir.add(groundRight);
    if (input.left) walkDir.sub(groundRight);

    if (input.joystickActive && (input.joystickX !== 0 || input.joystickY !== 0)) {
      walkDir.addScaledVector(groundRight, input.joystickX);
      walkDir.addScaledVector(groundForward, -input.joystickY);
    }

    if (walkDir.lengthSq() > 0.001) walkDir.normalize();

    const targetSpeed = input.sprint ? this.sprintSpeed : this.walkSpeed;
    const accel = this.onGround ? 18.0 : 4.0;
    this.velocity.x += (walkDir.x * targetSpeed - this.velocity.x) * Math.min(1.0, accel * delta);
    this.velocity.z += (walkDir.z * targetSpeed - this.velocity.z) * Math.min(1.0, accel * delta);

    // Gravity
    this.velocity.y -= this.gravity * delta;

    // Jump (strictly on ground and not flying)
    if (input.jump && this.onGround && !this.isFlying) {
      this.velocity.y = this.jumpForce;
      this.onGround = false;
      this.sound.playFootstep('stone');
    }

    // Collision detection (Clean wall stops, NO auto-jump)
    this.handleCollisions(delta);

    this.camera.position.copy(this.position);
    this.camera.position.y += this.eyeHeight;

    // Footsteps
    if (this.onGround && (Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5)) {
      this.stepDistance += Math.hypot(this.velocity.x, this.velocity.z) * delta;
      if (this.stepDistance > 2.2) {
        this.stepDistance = 0;
        const groundBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y - 0.2), Math.floor(this.position.z));
        const soundType = BLOCK_DEFS[groundBlock]?.sound || 'grass';
        this.sound.playFootstep(soundType);
      }
    }
  }

  handleCollisions(delta) {
    const dx = this.velocity.x * delta;
    const dy = this.velocity.y * delta;
    const dz = this.velocity.z * delta;

    // Y collision
    const nextY = this.position.y + dy;
    if (dy < 0) {
      if (this.checkCollision(this.position.x, nextY, this.position.z)) {
        this.position.y = Math.floor(nextY) + 1.0;
        this.velocity.y = 0;
        this.onGround = true;
      } else {
        this.position.y = nextY;
        this.onGround = false;
      }
    } else if (dy > 0) {
      if (this.checkCollision(this.position.x, nextY + this.height, this.position.z)) {
        this.position.y = Math.floor(nextY + this.height) - this.height;
        this.velocity.y = 0;
      } else {
        this.position.y = nextY;
      }
    }

    // X collision (Stop at walls)
    const nextX = this.position.x + dx;
    if (this.checkCollision(nextX, this.position.y, this.position.z)) {
      this.velocity.x = 0;
    } else {
      this.position.x = nextX;
    }

    // Z collision (Stop at walls)
    const nextZ = this.position.z + dz;
    if (this.checkCollision(this.position.x, this.position.y, nextZ)) {
      this.velocity.z = 0;
    } else {
      this.position.z = nextZ;
    }
  }

  checkCollision(px, py, pz) {
    const minX = Math.floor(px - this.radius);
    const maxX = Math.floor(px + this.radius);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + this.height - 0.1);
    const minZ = Math.floor(pz - this.radius);
    const maxZ = Math.floor(pz + this.radius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = this.world.getBlock(x, y, z);
          if (block !== BLOCK_TYPES.AIR && block !== BLOCK_TYPES.WATER && BLOCK_DEFS[block]?.solid) {
            return true;
          }
        }
      }
    }
    return false;
  }

  updateRaycast() {
    const eyePos = this.camera.position;
    const rayDir = new THREE.Vector3();
    this.camera.getWorldDirection(rayDir);

    let x = Math.floor(eyePos.x);
    let y = Math.floor(eyePos.y);
    let z = Math.floor(eyePos.z);

    const stepX = Math.sign(rayDir.x);
    const stepY = Math.sign(rayDir.y);
    const stepZ = Math.sign(rayDir.z);

    const tDeltaX = Math.abs(1 / rayDir.x);
    const tDeltaY = Math.abs(1 / rayDir.y);
    const tDeltaZ = Math.abs(1 / rayDir.z);

    let tMaxX = stepX > 0 ? (x + 1 - eyePos.x) * tDeltaX : (eyePos.x - x) * tDeltaX;
    let tMaxY = stepY > 0 ? (y + 1 - eyePos.y) * tDeltaY : (eyePos.y - y) * tDeltaY;
    let tMaxZ = stepZ > 0 ? (z + 1 - eyePos.z) * tDeltaZ : (eyePos.z - z) * tDeltaZ;

    let normal = [0, 0, 0];
    let dist = 0;
    this.targetBlock = null;

    while (dist < this.reachDistance) {
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          dist = tMaxX;
          tMaxX += tDeltaX;
          normal = [-stepX, 0, 0];
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          normal = [0, 0, -stepZ];
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          dist = tMaxY;
          tMaxY += tDeltaY;
          normal = [0, -stepY, 0];
        } else {
          z += stepZ;
          dist = tMaxZ;
          tMaxZ += tDeltaZ;
          normal = [0, 0, -stepZ];
        }
      }

      const block = this.world.getBlock(x, y, z);
      if (block !== BLOCK_TYPES.AIR && block !== BLOCK_TYPES.WATER) {
        this.targetBlock = { x, y, z, faceNorm: normal, type: block };
        break;
      }
    }

    if (this.targetBlock) {
      this.highlightBox.position.set(this.targetBlock.x + 0.5, this.targetBlock.y + 0.5, this.targetBlock.z + 0.5);
      this.highlightBox.visible = true;
    } else {
      this.highlightBox.visible = false;
    }
  }

  startDigging() {
    this.isDigging = true;
    this.triggerSwing();
  }

  stopDigging() {
    this.isDigging = false;
    this.digProgress = 0;
    this.digTarget = null;
  }

  updateDigging(delta) {
    if (!this.isDigging || !this.targetBlock) {
      this.digProgress = 0;
      this.digTarget = null;
      return;
    }

    const tb = this.targetBlock;
    if (!this.digTarget || this.digTarget.x !== tb.x || this.digTarget.y !== tb.y || this.digTarget.z !== tb.z) {
      this.digTarget = { ...tb };
      this.digProgress = 0;
    }

    const def = BLOCK_DEFS[tb.type] || { hardness: 1.0, color: '#7f7f7f', sound: 'stone' };
    const breakSpeed = 1.0 / Math.max(0.1, def.hardness);
    this.digProgress += breakSpeed * delta * 2.5;

    const now = performance.now();
    if (now - this.lastHitSoundTime > 220) {
      this.sound.playDigHit(def.sound);
      this.particles.spawnBlockBreakParticles(tb.x, tb.y, tb.z, def.color, 4);
      this.triggerSwing();
      this.lastHitSoundTime = now;
    }

    if (this.digProgress >= 1.0) {
      this.sound.playBlockBreak(def.sound);
      this.particles.spawnBlockBreakParticles(tb.x, tb.y, tb.z, def.color, 24);
      this.world.setBlock(tb.x, tb.y, tb.z, BLOCK_TYPES.AIR);
      this.digProgress = 0;
      this.digTarget = null;
    }
  }

  placeBlock() {
    if (!this.targetBlock) return false;

    const px = this.targetBlock.x + this.targetBlock.faceNorm[0];
    const py = this.targetBlock.y + this.targetBlock.faceNorm[1];
    const pz = this.targetBlock.z + this.targetBlock.faceNorm[2];

    const playerMinX = this.position.x - this.radius;
    const playerMaxX = this.position.x + this.radius;
    const playerMinY = this.position.y;
    const playerMaxY = this.position.y + this.height;
    const playerMinZ = this.position.z - this.radius;
    const playerMaxZ = this.position.z + this.radius;

    if (
      px >= Math.floor(playerMinX) && px <= Math.floor(playerMaxX) &&
      py >= Math.floor(playerMinY) && py <= Math.floor(playerMaxY) &&
      pz >= Math.floor(playerMinZ) && pz <= Math.floor(playerMaxZ)
    ) {
      return false;
    }

    this.world.setBlock(px, py, pz, this.selectedBlockType);
    if (this.autoTintOnPlace && this.activeColor) {
      this.world.setBlockColor(px, py, pz, this.activeColor);
    }
    this.sound.playBlockPlace();
    this.triggerSwing();
    return true;
  }

  // Paint/Color targeted block with active color tint
  paintTargetBlock(colorHex = this.activeColor) {
    if (!this.targetBlock) return false;
    const tb = this.targetBlock;
    this.world.setBlockColor(tb.x, tb.y, tb.z, colorHex);
    if (this.sound.playPaintSound) this.sound.playPaintSound();
    if (this.particles.spawnBlockBreakParticles) {
      this.particles.spawnBlockBreakParticles(tb.x, tb.y, tb.z, colorHex || '#ffffff', 14);
    }
    this.triggerSwing();
    return true;
  }

  updateHandAnimation(delta) {
    if (this.isSwinging) {
      this.swingProgress += delta * 12;
      if (this.swingProgress >= Math.PI) {
        this.swingProgress = 0;
        this.isSwinging = false;
      }
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const bob = Math.sin(performance.now() * 0.009) * Math.min(speed * 0.012, 0.04);
    const swingAngle = Math.sin(this.swingProgress) * 0.8;

    // Right hand motion
    this.rightHandGroup.rotation.x = 0.25 + swingAngle;
    this.rightHandGroup.rotation.y = -0.35 - swingAngle * 0.5;
    this.rightHandGroup.position.y = -0.32 + bob - swingAngle * 0.1;

    // Matter Manipulator plasma core spin & pulse
    if (this.plasmaCore) {
      this.plasmaCore.rotation.x += delta * 2.2;
      this.plasmaCore.rotation.y += delta * 3.4;
      const pulse = 1.0 + Math.sin(performance.now() * 0.007) * 0.15 + Math.sin(this.swingProgress) * 0.4;
      this.plasmaCore.scale.setScalar(pulse);
    }
    if (this.focusRing) {
      this.focusRing.rotation.z -= delta * 1.6;
    }

    // Left hand motion (gentle off-hand sway)
    const leftSway = Math.cos(performance.now() * 0.009) * Math.min(speed * 0.01, 0.03);
    this.leftHandGroup.position.y = -0.34 - leftSway;
    this.leftHandGroup.rotation.x = 0.25 + leftSway * 0.5;
  }

  updateScreenShake(delta) {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - delta * 1.5);
      const shakePower = this.trauma * this.trauma;
      const shakeYaw = (Math.random() - 0.5) * 0.1 * shakePower;
      const shakePitch = (Math.random() - 0.5) * 0.1 * shakePower;
      const shakeRoll = (Math.random() - 0.5) * 0.12 * shakePower;

      this.camera.rotation.z = shakeRoll;
      this.camera.rotation.x += shakePitch;
      this.camera.rotation.y += shakeYaw;
    } else {
      this.camera.rotation.z = 0;
    }
  }
}
