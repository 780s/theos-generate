import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    // Shared geometry for debris particles
    this.debrisGeom = new THREE.BoxGeometry(0.12, 0.12, 0.12);

    // AI materialization particle group
    const beamCount = 150;
    const beamGeom = new THREE.BufferGeometry();
    const beamPositions = new Float32Array(beamCount * 3);
    const beamColors = new Float32Array(beamCount * 3);

    for (let i = 0; i < beamCount; i++) {
      beamPositions[i * 3] = 0;
      beamPositions[i * 3 + 1] = -100;
      beamPositions[i * 3 + 2] = 0;

      const r = Math.random();
      if (r > 0.66) {
        beamColors[i * 3] = 0.3; beamColors[i * 3 + 1] = 0.8; beamColors[i * 3 + 2] = 1.0;
      } else if (r > 0.33) {
        beamColors[i * 3] = 1.0; beamColors[i * 3 + 1] = 0.85; beamColors[i * 3 + 2] = 0.3;
      } else {
        beamColors[i * 3] = 0.8; beamColors[i * 3 + 1] = 0.4; beamColors[i * 3 + 2] = 1.0;
      }
    }

    beamGeom.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
    beamGeom.setAttribute('color', new THREE.BufferAttribute(beamColors, 3));

    const beamMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.beamPoints = new THREE.Points(beamGeom, beamMat);
    this.scene.add(this.beamPoints);
    this.beamActive = false;
    this.beamCenter = new THREE.Vector3();
    this.beamRadius = 10;

    // Ambient Glowing Fireflies (Active at dusk and night)
    this.setupFireflies();
  }

  setupFireflies() {
    this.fireflyCount = 120;
    const fireflyGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.fireflyCount * 3);

    for (let i = 0; i < this.fireflyCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = 18 + Math.random() * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }

    fireflyGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.fireflyMat = new THREE.PointsMaterial({
      color: 0xccff44,
      size: 0.45,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.fireflies = new THREE.Points(fireflyGeom, this.fireflyMat);
    this.scene.add(this.fireflies);
  }

  // Spawn break particles when a block is mined
  spawnBlockBreakParticles(x, y, z, colorHex = '#7f7f7f', count = 16) {
    const color = new THREE.Color(colorHex);
    const mat = new THREE.MeshLambertMaterial({ color });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.debrisGeom, mat);
      mesh.position.set(
        x + 0.2 + Math.random() * 0.6,
        y + 0.2 + Math.random() * 0.6,
        z + 0.2 + Math.random() * 0.6
      );

      const vx = (Math.random() - 0.5) * 4.5;
      const vy = 1.5 + Math.random() * 4.5;
      const vz = (Math.random() - 0.5) * 4.5;

      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(vx, vy, vz),
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
        life: 1.0,
        decay: 1.5 + Math.random() * 1.5,
        gravity: 12.0
      });
    }
  }

  // Water splash particles
  spawnWaterSplash(x, y, z, count = 20) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x99ddff, transparent: true, opacity: 0.75 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);

      const vx = (Math.random() - 0.5) * 3.5;
      const vy = 2.0 + Math.random() * 4.0;
      const vz = (Math.random() - 0.5) * 3.5;

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(vx, vy, vz),
        rotSpeed: new THREE.Vector3(),
        life: 0.6,
        decay: 1.8,
        gravity: 14.0
      });
    }
  }

  // Underwater bubble particles
  spawnBubbles(x, y, z, count = 6) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xddf5ff, transparent: true, opacity: 0.6 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), mat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.4, y - 0.2, z + (Math.random() - 0.5) * 0.4);

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.5),
        rotSpeed: new THREE.Vector3(),
        life: 0.8,
        decay: 1.2,
        gravity: -2.0 // Rise upward
      });
    }
  }

  // Massive lightning sparks explosion when shot out of the sky
  spawnLightningStrike(x, y, z) {
    const colors = [0xffffff, 0x55ffff, 0xffff55];
    for (let i = 0; i < 45; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), mat);
      mesh.position.set(x, y, z);

      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 14;
      const vx = Math.cos(angle) * speed;
      const vy = (Math.random() - 0.3) * speed;
      const vz = Math.sin(angle) * speed;

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(vx, vy, vz),
        rotSpeed: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20),
        life: 1.2,
        decay: 1.8,
        gravity: 8.0
      });
    }
  }

  startAIConstructionFX(centerX, centerY, centerZ, radius = 8) {
    this.beamActive = true;
    this.beamCenter.set(centerX, centerY, centerZ);
    this.beamRadius = Math.max(radius, 4);

    const pos = this.beamPoints.geometry.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * this.beamRadius;
      pos[i * 3] = this.beamCenter.x + Math.cos(angle) * dist;
      pos[i * 3 + 1] = this.beamCenter.y + Math.random() * 15;
      pos[i * 3 + 2] = this.beamCenter.z + Math.sin(angle) * dist;
    }
    this.beamPoints.geometry.attributes.position.needsUpdate = true;
  }

  stopAIConstructionFX() {
    this.beamActive = false;
    const pos = this.beamPoints.geometry.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3 + 1] = -100;
    }
    this.beamPoints.geometry.attributes.position.needsUpdate = true;
  }

  update(delta, playerPos = null) {
    // 1. Update debris / splash / lightning particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * delta;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.velocity.y -= (p.gravity || 12.0) * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.rotation.x += p.rotSpeed.x * delta;
      p.mesh.rotation.y += p.rotSpeed.y * delta;

      const s = Math.max(0.01, p.life);
      p.mesh.scale.set(s, s, s);
    }

    // 2. Update AI building sparkles
    if (this.beamActive) {
      const pos = this.beamPoints.geometry.attributes.position.array;
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] += (8 + Math.random() * 6) * delta;
        if (pos[i * 3 + 1] > this.beamCenter.y + 25) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * this.beamRadius;
          pos[i * 3] = this.beamCenter.x + Math.cos(angle) * dist;
          pos[i * 3 + 1] = this.beamCenter.y;
          pos[i * 3 + 2] = this.beamCenter.z + Math.sin(angle) * dist;
        }
      }
      this.beamPoints.geometry.attributes.position.needsUpdate = true;
      this.beamPoints.rotation.y += 0.5 * delta;
    }

    // 3. Update Ambient Glowing Fireflies
    if (this.fireflies && playerPos) {
      const fPos = this.fireflies.geometry.attributes.position.array;
      const time = performance.now() * 0.001;
      for (let i = 0; i < this.fireflyCount; i++) {
        fPos[i * 3] += Math.sin(time + i) * 0.08;
        fPos[i * 3 + 1] += Math.cos(time * 0.8 + i) * 0.04;
        fPos[i * 3 + 2] += Math.cos(time + i * 1.5) * 0.08;

        // Keep fireflies clustered around player
        if (Math.abs(fPos[i * 3] - playerPos.x) > 50) {
          fPos[i * 3] = playerPos.x + (Math.random() - 0.5) * 60;
        }
        if (Math.abs(fPos[i * 3 + 2] - playerPos.z) > 50) {
          fPos[i * 3 + 2] = playerPos.z + (Math.random() - 0.5) * 60;
        }
      }
      this.fireflies.geometry.attributes.position.needsUpdate = true;
    }
  }
}
