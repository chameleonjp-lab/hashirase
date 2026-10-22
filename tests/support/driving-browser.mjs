import { createFixedClock } from '/src/platform/clock.js';
import { createEventChannel } from '/src/contracts/events.js';
import { createInputFrame } from '/src/contracts/vehicle.js';
import { createRandom } from '/src/platform/random.js';

try {
  const mode = await import('/src/modes/driving/index.js');
  const { createRendererHost } = await import('/src/rendering/renderer-host.js');
  const { createAudioService } = await import('/src/platform/audio.js');
  const source = await (await fetch('/index.html')).text();
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  parsed.querySelectorAll('script').forEach(node => node.remove());
  const root = document.querySelector('#stage');
  const renderer = createRendererHost(root, { markup: parsed.body.innerHTML, pixelRatio: 1 });
  const abort = new AbortController();
  const input = { sample: () => createInputFrame(), clear() {}, dispose() {} };
  const audio = createAudioService({ createContext: () => new AudioContext(), random: createRandom(42).fork('audio').next });
  let session;
  window.harness = {
    available: true,
    async create(options = {}) {
      session = await mode.createMode({ sessionId: 'browser-driving', abortSignal: abort.signal,
        clock: createFixedClock(), input, audio, renderer,
        settings: { read: () => ({}), write() {} }, events: createEventChannel('browser-driving'),
        world: { step() {}, query: () => ({}), reset() {}, dispose() {} }
      }, options);
      return session.snapshot();
    },
    start() { session.start(); return session.snapshot(); },
    tick(frames = 1, frame) {
      for (let i = 0; i < frames; i++) session.step(1 / 120, frame && createInputFrame(frame));
      renderer.render(session.snapshot(), 0);
      return session.snapshot();
    },
    pause() { session.pause('test'); return session.snapshot(); },
    resume() { session.resume(); return session.snapshot(); },
    reset() { session.reset(); renderer.render(session.snapshot(), 0); return session.snapshot(); },
    snapshot() { return session.snapshot(); },
    dispose() { session.dispose(); session.dispose(); return renderer.diagnostics(); },
    diagnostics() { return renderer.diagnostics(); }
  };
} catch (error) { window.harness = { available: false, error: String(error) }; }
