export async function createGalleryRuntime() {
  const status = document.querySelector('#world-status');
  try {
    // Plain static servers do not map Vite's public directory to the root.
    if (!import.meta.env) {
      const { DefaultLoadingManager } = await import('three');
      DefaultLoadingManager.setURLModifier(url => url === '/models/gallery.glb'
        ? new URL('./public/models/gallery.glb', document.baseURI).href
        : url);
    }
    const [{ createScene }, { loadGallery }, { createPlayerController }, { createGhost }, { Box3, Vector3, Group }] = await Promise.all([
      import('./scene/createScene.js'),
      import('./scene/loadGallery.js'),
      import('./player/createPlayerController.js'),
      import('./player/ghost_mesh.js'),
      import('three'),
    ]);
    const { scene, camera, controls, canvas, setUpdate, inspectionLighting } = createScene(document.querySelector('#viewport'));
    controls.enabled = !document.querySelector("dialog[open]");
    const { spawn, artSlots } = await loadGallery(scene, inspectionLighting);
    const placeholder = scene.getObjectByName('Player');
    if (!placeholder || !spawn) throw new Error('The gallery needs Player and PlayerSpawn for ghost placement.');
    // Use the authored reference character's feet as the requested spawn point.
    // Update only the loaded scene; preserve the Blender file and anchor name.
    const bounds = new Box3().setFromObject(placeholder);
    const spawnPosition = bounds.getCenter(new Vector3());
    spawnPosition.y = bounds.min.y;
    spawn.position.copy(spawn.parent.worldToLocal(spawnPosition.clone()));
    spawn.updateMatrixWorld(true);
    const ghost = createGhost({ username: 'Guest' });
    const ghostHeight = new Box3().setFromObject(ghost).getSize(new Vector3()).y;
    ghost.scale.setScalar(bounds.getSize(new Vector3()).y / ghostHeight);
    placeholder.removeFromParent();
    scene.add(ghost);
    const playerController = createPlayerController({ scene, camera, controls, canvas,
      player: ghost, spawn });
    const restHeight = ghost.position.y;
    const remotePlayers = new Map();
    function removeRemote(id) {
      const remote = remotePlayers.get(id);
      if (!remote) return;
      remote.pivot.removeFromParent();
      remote.visual.traverse(object => {
        if (object.isCSS2DObject) object.element.remove();
        if (object.name === 'Ghost body') object.material.dispose();
      });
      remotePlayers.delete(id);
    }
    function addRemote(player) {
      removeRemote(player.id);
      const visual = createGhost(player);
      visual.scale.copy(ghost.scale);
      visual.position.copy(ghost.position);
      const pivot = new Group();
      pivot.add(visual);
      pivot.position.set(player.x, player.y, player.z);
      pivot.rotation.y = player.rotationY;
      scene.add(pivot);
      remotePlayers.set(player.id, { pivot, visual, target: pivot.position.clone(), rotationY: player.rotationY });
    }
    let networkUpdate = () => {};
    let elapsed = 0;
    setUpdate((delta) => {
      playerController.update(delta);
      elapsed += delta;
      // Bob only the visual child so the movement pivot and camera stay level.
      ghost.position.y = restHeight + 0.4 + Math.sin(elapsed * 1.8) * 0.18;
      for (const remote of remotePlayers.values()) {
        const amount = 1 - Math.exp(-14 * delta);
        remote.pivot.position.lerp(remote.target, amount);
        const angle = Math.atan2(Math.sin(remote.rotationY - remote.pivot.rotation.y), Math.cos(remote.rotationY - remote.pivot.rotation.y));
        remote.pivot.rotation.y += angle * amount;
        remote.visual.position.y = ghost.position.y;
      }
      networkUpdate(delta);
    });

    const { createArtworkManager } = await import('./artwork/artworkManager.js');
    const artworkManager = createArtworkManager({ scene, artSlots });
    status.hidden = true;
    return {
      controls, playerController, artworkManager, ghost,
      setNetworkUpdate(callback) { networkUpdate = callback; },
      removeRemote, addRemote,
      clearRemote() { [...remotePlayers.keys()].forEach(removeRemote); },
      moveRemote(player) {
        const remote = remotePlayers.get(player.id);
        if (!remote) return;
        remote.target.set(player.x, player.y, player.z);
        remote.rotationY = player.rotationY;
      },
      setIdentity(player) {
        ghost.userData.username = player.username;
        ghost.userData.color = player.color;
        ghost.traverse(object => {
          if (object.isCSS2DObject) { object.element.textContent = player.username; object.element.style.color = player.color; }
          if (object.name === 'Ghost body') object.material.color.set(player.color);
        });
      },
    };
  } catch (error) {
    console.error('Gallery preview failed:', error);
    status.hidden = false;
    status.textContent = `Unable to load the 3D gallery: ${error.message || String(error)}`;
    throw error;
  }
}
