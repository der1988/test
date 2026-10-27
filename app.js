'use strict';

const SIZE = 120;
const BRUSH_RADIUS = 3;
const INTERVAL = 120; // Fixed generation interval in milliseconds.
const canvas = document.getElementById('garden');
const context = canvas.getContext('2d');
const CELL = canvas.width / SIZE;
let current = new Uint8Array(SIZE * SIZE);
let next = new Uint8Array(SIZE * SIZE);
let running = true;
let dirty = true;
let accumulator = 0;
let lastTime = null;
let activePointer = null;
let lastPoint = null;

// Classic B3/S23 rules. Outside the finite grid, cells are inactive.
// Values 1 (surviving) and 2 (newborn) are both alive; color has no effect.
function simulate(source, destination) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE &&
              source[ny * SIZE + nx] !== 0) neighbors++;
        }
      }
      const index = y * SIZE + x;
      destination[index] = source[index]
        ? (neighbors === 2 || neighbors === 3 ? 1 : 0)
        : (neighbors === 3 ? 2 : 0);
    }
  }
}

function render() {
  context.fillStyle = '#0c110d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < current.length; i++) {
    if (!current[i]) continue;
    context.fillStyle = current[i] === 2 ? '#c4a15d' : '#a6bb93';
    context.fillRect((i % SIZE) * CELL, Math.floor(i / SIZE) * CELL,
      CELL - 1, CELL - 1);
  }
  dirty = false;
}

function seedCircle(x, y) {
  for (let dy = -BRUSH_RADIUS; dy <= BRUSH_RADIUS; dy++) {
    for (let dx = -BRUSH_RADIUS; dx <= BRUSH_RADIUS; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (dx * dx + dy * dy <= BRUSH_RADIUS * BRUSH_RADIUS &&
          nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
        current[ny * SIZE + nx] = 2;
      }
    }
  }
  dirty = true;
}

function pointerCell(event) {
  const rect = canvas.getBoundingClientRect();
  // Account for the CSS border when mapping responsive display to grid cells.
  const style = getComputedStyle(canvas);
  const border = parseFloat(style.borderLeftWidth) || 0;
  return {
    x: Math.floor((event.clientX - rect.left - border) / (rect.width - border * 2) * SIZE),
    y: Math.floor((event.clientY - rect.top - border) / (rect.height - border * 2) * SIZE)
  };
}

function paintTo(point) {
  const from = lastPoint || point;
  // Interpolate fast drags so adjacent pointer events leave no empty gaps.
  const steps = Math.max(1, Math.abs(point.x - from.x), Math.abs(point.y - from.y));
  for (let step = 0; step <= steps; step++) {
    seedCircle(Math.round(from.x + (point.x - from.x) * step / steps),
      Math.round(from.y + (point.y - from.y) * step / steps));
  }
  lastPoint = point;
}

canvas.addEventListener('pointerdown', event => {
  if (activePointer !== null || event.button !== 0) return;
  activePointer = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  lastPoint = null;
  paintTo(pointerCell(event));
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId === activePointer) paintTo(pointerCell(event));
});
function endStroke(event) {
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  lastPoint = null;
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('lostpointercapture', endStroke);

document.getElementById('play').addEventListener('click', () => {
  running = !running;
  accumulator = 0;
  document.getElementById('play').innerHTML = running
    ? 'Pausa <span aria-hidden="true">Ⅱ</span>'
    : 'Play <span aria-hidden="true">▷</span>';
  document.getElementById('play').setAttribute('aria-pressed', String(running));
  document.getElementById('status').textContent = running ? 'IN EVOLUZIONE' : 'IN PAUSA';
});
document.getElementById('reset').addEventListener('click', () => {
  current.fill(0);
  next.fill(0);
  accumulator = 0;
  lastPoint = null;
  render();
});
document.getElementById('export').addEventListener('click', () => {
  // Flush pending brush marks even when exporting between animation frames.
  if (dirty) render();
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cellular-garden.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});

function frame(time) {
  if (lastTime === null) lastTime = time;
  // Limit catch-up after interruptions, without tying generations to frames.
  if (running && !document.hidden) accumulator += Math.min(time - lastTime, 250);
  lastTime = time;
  while (accumulator >= INTERVAL) {
    simulate(current, next);
    [current, next] = [next, current];
    accumulator -= INTERVAL;
    dirty = true;
  }
  if (dirty) render();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  lastTime = null;
  accumulator = 0;
});
render();
requestAnimationFrame(frame);
