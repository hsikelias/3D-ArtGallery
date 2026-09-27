// A shadow root keeps this HUD's styles separate from the gallery and room UI.
export function mountVoiceControls(container, voice) {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { display: block; font: 14px/1.4 system-ui, sans-serif; color: #f2f5f0; }
      * { box-sizing: border-box; }
      .hud { display: flex; align-items: center; gap: 14px; width: fit-content; padding: 14px 20px 14px 14px; border-radius: 22px; border: 1px solid #ffffff26; background: #17251feb; box-shadow: 0 12px 36px #0003; }
      button { display: grid; place-items: center; width: 54px; height: 54px; padding: 0; border: 1px solid #ffffff38; border-radius: 16px; background: #ffffff12; color: #e5e9e1; cursor: pointer; }
      button[aria-pressed="true"] { background: #98e7a3; color: #15351f; border-color: #98e7a3; }
      button:focus-visible { outline: 3px solid #98e7a3; outline-offset: 4px; }
      button:disabled { opacity: .6; cursor: wait; }
      svg { width: 27px; height: 27px; }
      .meter { width: 8px; height: 44px; border-radius: 6px; background: #ffffff1f; overflow: hidden; }
      .fill { width: 100%; height: 100%; transform: scaleY(0); transform-origin: bottom; background: #83ed97; border-radius: inherit; }
      strong { display: block; font-size: 14px; font-weight: 600; }
      .hint { color: #b7c4b6; font-size: 12px; }
      .error { max-width: 300px; font-size: 13px; color: #ffb3a7; margin: 10px 0 0; }
      .error:empty { display: none; }
    </style>
    <div class="hud">
      <button type="button" aria-label="Unmute microphone" aria-pressed="false" title="Unmute microphone">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
          <path class="slash" d="M3 3l18 18" />
        </svg>
      </button>
      <div class="meter" role="meter" aria-label="Microphone level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="fill"></div></div>
      <div><strong role="status">Mic muted</strong><span class="hint">Only nearby visitors hear you</span></div>
    </div>
    <p class="error" role="alert"></p>`;
  container.append(host);
  const button = root.querySelector('button');
  const meter = root.querySelector('.meter');
  const fill = root.querySelector('.fill');
  const unsubscribe = voice.subscribe(state => {
    const active = !state.muted;
    button.disabled = state.starting;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? 'Mute microphone' : 'Unmute microphone');
    button.title = active ? 'Mute microphone' : 'Unmute microphone';
    root.querySelector('.slash').style.display = active ? 'none' : '';
    root.querySelector('strong').textContent = state.starting ? 'Waiting for microphone…' : active ? 'Mic on' : 'Mic muted';
    root.querySelector('.error').textContent = state.error;
  });
  button.addEventListener('click', () => { void voice.setMuted(!voice.getState().muted); });
  let frame;
  let displayed = 0;
  function draw() {
    const level = voice.getLevel();
    displayed = voice.getState().muted ? 0 : Math.max(level, displayed * 0.85);
    fill.style.transform = `scaleY(${displayed})`;
    meter.setAttribute('aria-valuenow', String(Math.round(displayed * 100)));
    frame = requestAnimationFrame(draw);
  }
  draw();
  return { element: host, dispose() { cancelAnimationFrame(frame); unsubscribe(); host.remove(); } };
}
