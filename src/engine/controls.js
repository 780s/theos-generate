import * as THREE from 'three';

export class InputManager {
  constructor(canvas, camera, player, callbacks = {}) {
    this.canvas = canvas;
    this.camera = camera;
    this.player = player;
    this.callbacks = callbacks;

    // Movement state
    this.inputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sneak: false,
      sprint: false,
      ascend: false,
      descend: false,
      joystickActive: false,
      joystickX: 0,
      joystickY: 0
    };

    // Camera rotation angles
    this.yaw = 0;
    this.pitch = 0;
    this.mouseSensitivity = 0.0022;
    this.touchSensitivity = 0.0035;

    this.isPointerLocked = false;
    this.isMobile = false;

    // Touch tracking
    this.activeTouches = new Map();
    this.joystickTouchId = null;
    this.lookTouchId = null;
    this.lastLookPos = { x: 0, y: 0 };
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickRadius = 50;
    this.lastSpaceTime = 0;

    this.setupDesktop();
    this.setupMobile();
  }

  setupDesktop() {
    // Pointer Lock
    this.canvas.addEventListener('click', () => {
      if (!this.isMobile && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.canvas);
      if (this.callbacks.onPointerLockChange) {
        this.callbacks.onPointerLockChange(this.isPointerLocked);
      }
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;

      this.yaw -= e.movementX * this.mouseSensitivity;
      this.pitch -= e.movementY * this.mouseSensitivity;
      this.pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, this.pitch));

      this.applyCameraRotation();
    });

    // Mouse buttons: Left = Dig (or Paint in Paint Mode), Right = Place (or Sample Color in Paint Mode)
    document.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;
      if (e.button === 0) {
        if (this.player.isPaintMode) {
          this.player.paintTargetBlock();
        } else {
          this.player.startDigging();
        }
      } else if (e.button === 2) {
        if (this.player.isPaintMode) {
          const tb = this.player.targetBlock;
          if (tb) {
            const rgb = this.player.world.getBlockColor(tb.x, tb.y, tb.z);
            if (rgb) {
              const hex = '#' + rgb.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
              this.player.activeColor = hex;
              if (this.callbacks.onColorChange) this.callbacks.onColorChange(hex);
            }
          }
        } else {
          this.player.placeBlock();
        }
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.player.stopDigging();
      }
    });

    // Context menu prevention on canvas
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard
    window.addEventListener('keydown', (e) => {
      // Don't capture keys if typing in a modal text field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.inputState.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.inputState.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.inputState.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.inputState.right = true;
          break;
        case 'Space':
          const now = performance.now();
          if (now - this.lastSpaceTime < 300) {
            // Double-tap Space cleanly toggles flight!
            const flying = this.player.toggleFly();
            if (this.callbacks.onFlyToggle) this.callbacks.onFlyToggle(flying);
            this.lastSpaceTime = 0;
            this.inputState.jump = false;
            this.inputState.ascend = flying;
          } else {
            this.lastSpaceTime = now;
            if (this.player.isFlying) {
              this.inputState.ascend = true;
              this.inputState.jump = false;
            } else {
              this.inputState.jump = true;
              this.inputState.ascend = false;
            }
          }
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.inputState.sneak = true;
          this.inputState.descend = true;
          break;
        case 'KeyF':
          const flying = this.player.toggleFly();
          if (this.callbacks.onFlyToggle) this.callbacks.onFlyToggle(flying);
          break;
        case 'KeyG':
          if (this.callbacks.onOpenAIModal) this.callbacks.onOpenAIModal();
          break;
        case 'KeyE':
          if (this.callbacks.onOpenInventory) this.callbacks.onOpenInventory();
          break;
        case 'KeyC':
          if (this.callbacks.onTogglePaintMode) this.callbacks.onTogglePaintMode();
          break;
        // Hotbar 1-9
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4':
        case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
          const slot = parseInt(e.code.replace('Digit', '')) - 1;
          if (this.callbacks.onSelectSlot) this.callbacks.onSelectSlot(slot);
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.inputState.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.inputState.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.inputState.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.inputState.right = false;
          break;
        case 'Space':
          this.inputState.jump = false;
          this.inputState.ascend = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.inputState.sneak = false;
          this.inputState.descend = false;
          break;
      }
    });
  }

  setupMobile() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    this.isMobile = isTouchDevice;

    if (isTouchDevice) {
      document.body.classList.add('touch-device');
    }

    const joystickZone = document.getElementById('joystick-zone');
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');
    const touchLookZone = document.getElementById('touch-look-zone');

    if (!joystickZone || !touchLookZone) return;

    // Dynamic Floating Joystick (centers on initial thumb touch for iPad ergonomics)
    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;

      const rect = joystickZone.getBoundingClientRect();
      // Set anchor center to the touch position
      this.joystickCenter = {
        x: touch.clientX,
        y: touch.clientY
      };

      if (joystickBase) {
        const localX = touch.clientX - (rect.left + rect.width * 0.5);
        const localY = touch.clientY - (rect.top + rect.height * 0.5);
        joystickBase.style.transform = `translate(${localX * 0.4}px, ${localY * 0.4}px)`;
      }

      this.inputState.joystickActive = true;
      this.updateJoystickPosition(touch.clientX, touch.clientY, joystickKnob);
    }, { passive: false });

    joystickZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.updateJoystickPosition(touch.clientX, touch.clientY, joystickKnob);
          break;
        }
      }
    }, { passive: false });

    const resetJoystick = () => {
      this.joystickTouchId = null;
      this.inputState.joystickActive = false;
      this.inputState.joystickX = 0;
      this.inputState.joystickY = 0;
      if (joystickKnob) {
        joystickKnob.style.transform = `translate(0px, 0px)`;
      }
      if (joystickBase) {
        joystickBase.style.transform = `translate(0px, 0px)`;
      }
    };

    joystickZone.addEventListener('touchend', resetJoystick, { passive: false });
    joystickZone.addEventListener('touchcancel', resetJoystick, { passive: false });

    // Look Zone Touch events (right screen swipe for camera rotation & tap to interact)
    let lookStartTime = 0;
    let lookStartPos = { x: 0, y: 0 };

    touchLookZone.addEventListener('touchstart', (e) => {
      const touch = e.changedTouches[0];
      this.lookTouchId = touch.identifier;
      this.lastLookPos = { x: touch.clientX, y: touch.clientY };
      lookStartPos = { x: touch.clientX, y: touch.clientY };
      lookStartTime = performance.now();
    }, { passive: false });

    touchLookZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookTouchId) {
          const dx = touch.clientX - this.lastLookPos.x;
          const dy = touch.clientY - this.lastLookPos.y;

          this.yaw -= dx * this.touchSensitivity;
          this.pitch -= dy * this.touchSensitivity;
          this.pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, this.pitch));

          this.applyCameraRotation();

          this.lastLookPos = { x: touch.clientX, y: touch.clientY };
          break;
        }
      }
    }, { passive: false });

    const resetLook = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.lookTouchId) {
          const dt = performance.now() - lookStartTime;
          const dist = Math.hypot(touch.clientX - lookStartPos.x, touch.clientY - lookStartPos.y);
          // Quick tap on 3D view: paint if paint mode, else place block
          if (dt < 250 && dist < 12) {
            if (this.player.isPaintMode) {
              this.player.paintTargetBlock();
            } else {
              this.player.placeBlock();
            }
          }
          this.lookTouchId = null;
          break;
        }
      }
    };

    touchLookZone.addEventListener('touchend', resetLook, { passive: false });
    touchLookZone.addEventListener('touchcancel', resetLook, { passive: false });

    // Mobile Action Buttons
    this.bindTouchButton('btn-mine', () => this.player.startDigging(), () => this.player.stopDigging());
    this.bindTouchButton('btn-place', () => this.player.placeBlock());
    this.bindTouchButton('btn-fly', () => {
      const isFlying = this.player.toggleFly();
      if (this.callbacks.onFlyToggle) this.callbacks.onFlyToggle(isFlying);
    });
    this.bindTouchButton('btn-jump', () => {
      if (this.player.isFlying) {
        this.inputState.ascend = true;
        this.inputState.jump = false;
      } else {
        this.inputState.jump = true;
        this.inputState.ascend = false;
      }
    }, () => {
      this.inputState.jump = false;
      this.inputState.ascend = false;
    });
    this.bindTouchButton('btn-descend', () => {
      this.inputState.sneak = true;
      this.inputState.descend = true;
    }, () => {
      this.inputState.sneak = false;
      this.inputState.descend = false;
    });

    // Mobile Navigation & Inventory Buttons
    this.bindTouchButton('btn-inventory-mobile', () => {
      if (this.callbacks.onOpenInventory) this.callbacks.onOpenInventory();
    });
    this.bindTouchButton('btn-ai-mobile', () => {
      if (this.callbacks.onOpenAIModal) this.callbacks.onOpenAIModal();
    });
    this.bindTouchButton('btn-color-mobile', () => {
      if (this.callbacks.onTogglePaintMode) this.callbacks.onTogglePaintMode();
    });
  }

  bindTouchButton(id, onStart, onEnd = null) {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('active');
      if (onStart) onStart();
    }, { passive: false });

    const handleEnd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('active');
      if (onEnd) onEnd();
    };

    el.addEventListener('touchend', handleEnd, { passive: false });
    el.addEventListener('touchcancel', handleEnd, { passive: false });
  }

  updateJoystickPosition(clientX, clientY, knobEl) {
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = this.joystickRadius;

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxDist) {
      clampedX = (dx / dist) * maxDist;
      clampedY = (dy / dist) * maxDist;
    }

    if (knobEl) {
      knobEl.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    }

    // Normalized analog movement input (-1 to 1)
    this.inputState.joystickX = clampedX / maxDist;
    this.inputState.joystickY = clampedY / maxDist;
  }

  applyCameraRotation() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getInput() {
    return this.inputState;
  }
}
