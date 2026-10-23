// Tone and noise playback using the browser's Web Audio API.
// This is real, not mocked: all sound is generated in the browser.

export const MIN_FREQ = 63;
export const MAX_FREQ = 8000;

const TONE_VOLUME = 0.3;
const NOISE_VOLUME = 0.5;
const FADE_SECONDS = 0.02;

let audioCtx = null;
let noiseBuffer = null;
let current = null;

// Browsers block audio until the user interacts with the page, so the
// context is created (or resumed) the first time a tone is played from a click.
function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Two seconds of pink noise, generated once and looped. Pink noise has equal
// energy per octave, which is what live sound engineers use to tune systems.
// Uses Paul Kellet's filter to turn random white noise into pink noise.
function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;

  const length = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, peak = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = b0 + b1 + b2 + white * 0.1848;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < length; i++) {
    data[i] /= peak;
  }
  return noiseBuffer;
}

// A gain node that fades in, holds, and fades out, so tones don't click.
function createEnvelope(ctx, volume, start, end) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + FADE_SECONDS);
  gain.gain.setValueAtTime(volume, end - FADE_SECONDS);
  gain.gain.linearRampToValueAtTime(0, end);
  gain.connect(ctx.destination);
  return gain;
}

// Random frequency on a smooth log scale, so each octave is equally likely.
export function randomFrequency() {
  return Math.round(MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, Math.random()));
}

// Plays a sine tone, optionally with pink noise underneath.
// Returns a Promise that resolves when the tone finishes or is stopped.
export function playTone(freq, durationMs = 1500, { withNoise = false } = {}) {
  stopTone();

  const ctx = getContext();
  const start = ctx.currentTime;
  const end = start + durationMs / 1000;

  const gains = [createEnvelope(ctx, TONE_VOLUME, start, end)];
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gains[0]);
  const sources = [osc];

  if (withNoise) {
    const noiseGain = createEnvelope(ctx, NOISE_VOLUME, start, end);
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;
    noise.connect(noiseGain);
    gains.push(noiseGain);
    sources.push(noise);
  }

  sources.forEach((source) => {
    source.start(start);
    source.stop(end);
  });

  return new Promise((resolve) => {
    const playing = { sources, gains };
    current = playing;
    osc.onended = () => {
      if (current === playing) current = null;
      resolve();
    };
  });
}

// Stops whatever is playing, with a quick fade so it doesn't click.
export function stopTone() {
  if (!current) return;

  const now = audioCtx.currentTime;
  current.gains.forEach((gain) => {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
  });
  current.sources.forEach((source) => source.stop(now + FADE_SECONDS));
  current = null;
}
