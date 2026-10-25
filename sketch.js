'use strict';

// Math is independent of p5. Angles and the decay integral remain continuous
// when controls change, unlike recomputing frequency * total elapsed time.
const TAU = Math.PI * 2;
const STEP = 1 / 480; // Fixed simulation step, regardless of display refresh rate.
const SPEED = 4;
const BASE_FREQUENCY = 0.32;
const target = { ratio: 1.503, phase: Math.PI / 2, damping: 0.008 };
let oscillator;
let accumulator = 0;
let previous;
let artwork;

function createOscillator(parameters) {
  return { angleX: 0, angleY: 0, phase: parameters.phase,
    ratio: parameters.ratio, damping: parameters.damping, decay: 0 };
}

function advanceOscillator(state, parameters, dt) {
  // Smooth over ~0.8 simulation seconds, preserving position on abrupt input.
  const blend = 1 - Math.exp(-dt / 0.8);
  state.ratio += (parameters.ratio - state.ratio) * blend;
  state.phase += (parameters.phase - state.phase) * blend;
  state.damping += (parameters.damping - state.damping) * blend;
  state.angleX = (state.angleX + TAU * BASE_FREQUENCY * dt) % TAU;
  state.angleY = (state.angleY + TAU * BASE_FREQUENCY * state.ratio * dt) % TAU;
  state.decay += state.damping * dt;
}

function oscillatorPosition(state) {
  const amplitude = 350 * Math.exp(-state.decay);
  return { x: 400 + amplitude * Math.sin(state.angleX),
    y: 400 + amplitude * Math.sin(state.angleY + state.phase) };
}

function resetDrawing() {
  oscillator = createOscillator(target);
  previous = oscillatorPosition(oscillator);
  accumulator = 0;
  background('#0b0d0c');
}

function setup() {
  // A fixed bitmap preserves all marks on resize and exports at exactly 800².
  pixelDensity(1);
  artwork = createCanvas(800, 800);
  artwork.parent('canvas-host');
  artwork.elt.setAttribute('role', 'img');
  artwork.elt.setAttribute('aria-label', 'Traiettoria armonografica in evoluzione');
  stroke(239, 235, 220, 150);
  strokeWeight(0.55);
  noFill();
  resetDrawing();
  const controls = [
    ['ratio', value => value.toFixed(3), value => value],
    ['phase', value => `${value}°`, value => value * Math.PI / 180],
    ['damping', value => value.toFixed(3), value => value]
  ];
  controls.forEach(([name, format, convert]) => {
    const input = document.getElementById(name);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      target[name] = convert(value);
      document.getElementById(`${name}-value`).value = format(value);
    });
  });
  document.getElementById('reset').addEventListener('click', resetDrawing);
  document.getElementById('export').addEventListener('click', () => {
    saveCanvas(artwork, 'memoria-oscillante', 'png');
  });
  // Do not catch up time spent in background tabs.
  document.addEventListener('visibilitychange', () => { accumulator = 0; });
}

function draw() {
  if (document.hidden) return;
  // Cap only long interruptions; ordinary 30/60/120 Hz frames cover equal time.
  accumulator += Math.min(deltaTime / 1000, 0.1) * SPEED;
  while (accumulator >= STEP) {
    advanceOscillator(oscillator, target, STEP);
    const next = oscillatorPosition(oscillator);
    line(previous.x, previous.y, next.x, next.y);
    previous = next;
    accumulator -= STEP;
  }
  // No background clear or redraw of historical segments here.
}
