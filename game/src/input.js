// input.js — keyboard and mouse state for the game. The game polls axes and
// the fire button every frame, and consumes one-shot key presses (Enter to
// start, P to pause, M to mute, 1–3 to choose an upgrade) so a held key
// never fires an action twice.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedOnce = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.touchAim = null;

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        event.preventDefault();
      }
      if (!this.keys.has(key)) this.pressedOnce.add(key);
      this.keys.add(key);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    canvas.addEventListener('pointermove', (event) => {
      const point = this.toGamePoint(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
    });
    canvas.addEventListener('pointerdown', (event) => {
      const point = this.toGamePoint(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      this.mouse.down = true;
      this.mouse.clicked = true;
      canvas.setPointerCapture?.(event.pointerId);
    });
    window.addEventListener('pointerup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Pointer events arrive in CSS pixels; the game world is the canvas's own
  // pixel grid, so scale by the ratio between the two.
  toGamePoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  axisX() {
    return (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0)
      - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
  }

  axisY() {
    return (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0)
      - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
  }

  firing() {
    return this.mouse.down || this.keys.has(' ');
  }

  // True once per physical press of the named key.
  tapped(key) {
    if (this.pressedOnce.has(key)) {
      this.pressedOnce.delete(key);
      return true;
    }
    return false;
  }

  // Called at the end of every frame: drops unconsumed presses and the
  // one-frame click flag.
  endFrame() {
    this.pressedOnce.clear();
    this.mouse.clicked = false;
  }
}
