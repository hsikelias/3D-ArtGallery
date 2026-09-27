import { Group, TextureLoader } from 'three';
import { createArtworkPlane, disposeArtwork } from './imagePlacement.js';
import { slotConfig } from './slotConfig.js';

export function createArtworkManager({ scene, artSlots }) {
  const slots = [...artSlots].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const group = new Group();
  group.name = 'Gallery artwork';
  scene.add(group);
  const loader = new TextureLoader();
  let revision = 0;
  let disposed = false;

  function clearPlanes() {
    [...group.children].forEach(disposeArtwork);
  }

  return {
    // Popup integration: call this with the selected URLs in display order.
    // No dependency on forms, file pickers, player controls, or image storage.
    async setImages(imageUrls) {
      if (disposed) throw new Error('Artwork manager has been disposed.');
      if (!Array.isArray(imageUrls) || imageUrls.some((url) => typeof url !== 'string' || !url.trim())) {
        throw new Error('Artwork must be an array of nonempty image URLs.');
      }
      if (imageUrls.length > slots.length) throw new Error(`Choose up to ${slots.length} images.`);
      const request = ++revision;
      clearPlanes();
      const results = await Promise.all(imageUrls.map(async (url, index) => {
        const anchor = slots[index];
        let texture;
        try {
          const settings = slotConfig[anchor.name];
          if (!settings) throw new Error(`No placement settings for ${anchor.name}.`);
          texture = await loader.loadAsync(url);
          // A newer selection may have arrived while this image was loading.
          if (disposed || request !== revision) {
            texture.dispose();
            return null;
          }
          group.add(createArtworkPlane(texture, anchor, settings));
          return null;
        } catch (error) {
          texture?.dispose();
          return { slot: anchor.name, url, message: error.message };
        }
      }));
      if (disposed || request !== revision) return { loadedCount: 0, errors: [], superseded: true };
      return { loadedCount: group.children.length, errors: results.filter(Boolean), superseded: false };
    },
    clear() {
      revision += 1;
      clearPlanes();
    },
    dispose() {
      disposed = true;
      this.clear();
      group.removeFromParent();
    },
  };
}
