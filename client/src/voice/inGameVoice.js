import { createProximityVoice } from './proximityVoice.js';
import { mountVoiceControls } from './voiceControls.js';

// Mounted inside .world so the existing modal also makes the voice HUD inert.
export function createInGameVoice(world) {
  const container = document.createElement('aside');
  container.setAttribute('aria-label', 'Voice controls');
  container.style.cssText = `position:fixed;top:max(16px,env(safe-area-inset-top));
    right:max(16px,env(safe-area-inset-right));z-index:10;max-width:calc(100vw - 32px);`;
  container.hidden = true;
  world.append(container);
  let voice, hud;
  let active = false;

  function stop() {
    hud?.dispose();
    hud = null;
    // dispose stops tracks synchronously before closing the audio context.
    void voice?.dispose();
    voice = null;
    container.hidden = true;
  }

  function enterRoom() {
    stop();
    active = true;
    voice = createProximityVoice();
    hud = mountVoiceControls(container, voice, { hint: 'Local mic · no listeners connected' });
    container.hidden = false;
  }

  function onPageHide() { stop(); }
  function onPageShow(event) { if (event.persisted && active) enterRoom(); }
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  return {
    enterRoom,
    getVoice: () => voice,
    leaveRoom() { active = false; stop(); },
    dispose() {
      active = false;
      stop();
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      container.remove();
    },
  };
}
