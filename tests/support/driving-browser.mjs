import { createFixedClock } from '/src/platform/clock.js';
import { createEventChannel } from '/src/contracts/events.js';
import { createInputFrame } from '/src/contracts/vehicle.js';
import { createRandom } from '/src/platform/random.js';

try {
  const manifest=await (await fetch('/dist/build-manifest.json')).json();
  const mode = await import('/'+manifest.entryPoints['src/modes/driving/index.js']);
  const { createRendererHost } = await import('/src/rendering/renderer-host.js');
  const { createAudioService } = await import('/src/platform/audio.js');
  const { screenURL } = await mode.loadScreenAssets();
  const source = await (await fetch(screenURL)).text();
  const root = document.querySelector('#stage');
  const renderer = createRendererHost(root, { markup: source, pixelRatio: 1 });
  const abort = new AbortController();
  const input = { sample: () => createInputFrame(), clear() {}, dispose() {} };
  const audio = createAudioService({ createContext: () => new AudioContext(), random: createRandom(42).fork('audio').next });
  let session;
  const impacts=[];
  window.harness = {
    available: true,
    async create(options = {}) {
      session = await mode.createMode({ sessionId: 'browser-driving', abortSignal: abort.signal,
        clock: createFixedClock(), input, audio, renderer,
        settings: { read: () => ({}), write() {} }, events: createEventChannel('browser-driving'),
        world: { step() {}, query: () => ({impacts:impacts.splice(0)}), reset() {impacts.length=0;}, dispose() {} }
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
    reset(initial) { session.reset(initial); renderer.render(session.snapshot(), 0); return session.snapshot(); },
    snapshot() { return session.snapshot(); },
    dispose() { session.dispose(); session.dispose(); return renderer.diagnostics(); },
    diagnostics() { return renderer.diagnostics(); }
    ,collision(impact) { impacts.push(impact); }
    ,audioDiagnostics() { return audio.diagnostics(); }
  };
} catch (error) { window.harness = { available: false, error: String(error) }; }
