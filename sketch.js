'use strict';

// Math is independent of p5. Angles and the decay integral remain continuous
// when controls change, unlike recomputing frequency * total elapsed time.
const TAU = Math.PI * 2;
const STEP = 1 / 480; // Fixed simulation step, regardless of display refresh rate.
const SPEED = 4;
const DEFAULTS = Object.freeze({ frequencyX: 0.32, frequencyY: 0.481,
  amplitudeX: 1, amplitudeY: 1, phaseX: 0, phaseY: 90,
  dampingX: 0.008, dampingY: 0.008 });
const target = { ...DEFAULTS };
const parameterNames = Object.keys(DEFAULTS);
let oscillator;
let accumulator = 0;
let previous;
let artwork;

function createOscillator(parameters) {
  return { ...parameters, angleX: 0, angleY: 0, decayX: 0, decayY: 0 };
}

function advanceOscillator(state, parameters, dt) {
  // Integrate phase and decay; changing frequency never jumps the position.
  const blend = 1 - Math.exp(-dt / 1.2);
  for (const name of parameterNames) {
    state[name] += (parameters[name] - state[name]) * blend;
  }
  for (const axis of ['X', 'Y']) {
    state['angle' + axis] = (state['angle' + axis] +
      TAU * state['frequency' + axis] * dt) % TAU;
    state['decay' + axis] += state['damping' + axis] * dt;
  }
}

function oscillatorPosition(state) {
  const coordinate = axis => 400 + 350 * state['amplitude' + axis] *
    Math.exp(-state['decay' + axis]) *
    Math.sin(state['angle' + axis] + state['phase' + axis] * Math.PI / 180);
  return { x: coordinate('X'), y: coordinate('Y') };
}

// Each Unicode character contributes to every parameter. Position changes the
// weight: anagrams differ too. No randomness, network, or generated AI content.
function parametersFromText(text) {
  const letters = Array.from(text.normalize('NFC'));
  if (!letters.length) return { ...DEFAULTS };
  const result = {};
  parameterNames.forEach((name, channel) => {
    let balance = 0;
    letters.forEach((letter, index) => {
      balance += Math.sin(letter.codePointAt(0) * (channel + 1) * 0.173 +
        (index + 1) * (channel + 2) * 0.619);
    });
    const normalized = 0.5 + 0.5 * Math.tanh(balance / Math.sqrt(letters.length));
    const input = document.getElementById(name);
    const min = Number(input.min);
    const step = Number(input.step);
    result[name] = Math.max(min, Math.min(Number(input.max),
      min + Math.round(normalized * (Number(input.max) - min) / step) * step));
  });
  return result;
}

function updateControls() {
  for (const name of parameterNames) {
    document.getElementById(name).value = target[name];
    const value = target[name];
    document.getElementById(name + '-value').value = name.startsWith('phase')
      ? `${Math.round(value)}°` : value.toFixed(3) + (name.startsWith('frequency') ? ' Hz' : '');
  }
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
  parameterNames.forEach(name => {
    document.getElementById(name).addEventListener('input', event => {
      target[name] = Number(event.target.value);
      updateControls();
      document.getElementById('phrase-status').textContent = 'Bilanciamento regolato a mano.';
    });
  });
  document.getElementById('phrase').addEventListener('input', event => {
    Object.assign(target, parametersFromText(event.target.value));
    updateControls();
    document.getElementById('phrase-status').textContent = event.target.value
      ? 'Ogni lettera modifica il bilanciamento. La traccia rimane.'
      : 'Parametri iniziali ripristinati. La traccia rimane.';
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
