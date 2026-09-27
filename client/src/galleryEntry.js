import { createGalleryRuntime } from './galleryRuntime.js';
import { localRooms, MAX_IMAGES, validateImage, isRoomCode } from './rooms/localRooms.js';
import { createInGameVoice } from './voice/inGameVoice.js';

const $ = selector => document.querySelector(selector);
const dialog = $('#entry-dialog');
const world = $('.world');
const gameVoice = createInGameVoice(world);
const username = $('#username');
const code = $('#room-code');
const picker = $('#image-files');
const error = $('#entry-error');
const state = { step: 'welcome', mode: null, images: [], room: null, busy: false };
let runtime;
let previewUrls = [];
let draftWrites = Promise.resolve();
let restoreDraft = Promise.resolve();
const copy = {
  welcome: ['Welcome to the gallery', 'Step inside.', "Bring your art, or explore someone else's. How would you like to begin?"],
  artwork: ['Create / 01', 'Bring your art.', 'Upload your images to hang in the gallery.'],
  room: ['Join / 01', 'Find your people.', 'Enter the six-digit code for a saved room.'],
  identity: ['Almost there / 02', 'Who’s visiting?', 'Your username will appear above your ghost.'],
  roomCode: ['Your gallery', 'Invite people in.', 'Your room code stays the same each time you open this panel. Online sharing is coming later.'],
};

function syncModal() {
  world.inert = dialog.open;
  if (runtime) runtime.controls.enabled = !dialog.open;
}
function showStep(step) {
  state.step = step;
  error.textContent = '';
  document.querySelectorAll('[data-step]').forEach(el => { el.hidden = el.dataset.step !== step; });
  const [label, title, description] = copy[step];
  $('#step-label').textContent = label;
  $('#dialog-title').textContent = title;
  $('#dialog-description').textContent = description;
  $('#back').hidden = step === 'welcome' || step === 'roomCode';
  $('#close-menu').hidden = !state.room;
  if (step === 'identity') {
    $('#room-summary').textContent = state.mode === 'create'
      ? `${state.images.length} image(s) ready to frame.` : `Room code: ${code.value}`;
    $('#submit-entry').textContent = state.mode === 'create' ? 'Create room' : 'Join room';
  }
  $('#dialog-title').focus();
}
function openMenu(step = 'welcome') {
  if (!dialog.open) dialog.showModal();
  syncModal();
  showStep(step);
}
function closeMenu() {
  if (!state.room || state.busy) return;
  dialog.close();
  syncModal();
  $('#reopen').focus();
}
function setBusy(busy) {
  state.busy = busy;
  dialog.setAttribute('aria-busy', String(busy));
  dialog.querySelectorAll('button, input').forEach(el => { el.disabled = busy; });
}
function saveDraft() {
  const draft = { images: [...state.images], username: username.value, updatedAt: Date.now() };
  draftWrites = draftWrites.then(() => localRooms.saveDraft(draft)).then(() => {
    $('#draft-status').textContent = 'Artist draft saved in this browser.';
  }).catch(() => {
    $('#draft-status').textContent = 'Draft could not be saved. Keep this tab open to retain your selection.';
  });
  return draftWrites;
}
function renderPreviews() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  $('#upload-previews').replaceChildren();
  state.images.forEach((file, index) => {
    const card = document.createElement('figure');
    card.className = 'upload-card';
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    previewUrls.push(image.src);
    image.alt = file.name;
    const caption = document.createElement('figcaption');
    caption.textContent = `${index + 1}. ${file.name}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', () => {
      if (state.busy) return;
      state.images.splice(index, 1);
      renderPreviews();
      saveDraft();
      picker.focus();
    });
    card.append(image, caption, remove);
    $('#upload-previews').append(card);
  });
  $('#upload-count').textContent = `${state.images.length} / ${MAX_IMAGES} images`;
}
async function checkImage(file) {
  const invalid = validateImage(file);
  if (invalid) throw new Error(invalid);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
  } catch {
    throw new Error(`${file.name}: this image could not be opened.`);
  } finally { URL.revokeObjectURL(url); }
}
picker.addEventListener('change', async () => {
  const files = [...picker.files];
  picker.value = '';
  $('#art-error').textContent = '';
  if (files.length + state.images.length > MAX_IMAGES) {
    $('#art-error').textContent = 'Choose up to 15 images in total. Remove an image before adding more.';
    return;
  }
  setBusy(true);
  try {
    const results = await Promise.allSettled(files.map(checkImage));
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
      $('#art-error').textContent = failures.map(result => result.reason.message).join('\n');
      return;
    }
    state.images.push(...files);
    renderPreviews();
    setBusy(true);
    await saveDraft();
  } finally { setBusy(false); }
});
$('#art-form').addEventListener('submit', event => {
  event.preventDefault();
  if (state.busy) return;
  if (!state.images.length) { $('#art-error').textContent = 'Choose at least one image.'; return; }
  showStep('identity');
});
$('#room-form').addEventListener('submit', event => {
  event.preventDefault();
  if (state.busy) return;
  code.value = code.value.trim();
  if (!isRoomCode(code.value)) { error.textContent = 'Enter exactly six digits.'; return; }
  showStep('identity');
});

async function displayRoom(room) {
  const urls = room.images.map(file => URL.createObjectURL(file));
  try {
    const result = await runtime.artworkManager.setImages(urls);
    if (result.errors.length) throw new Error('Some artwork could not be displayed. Please try again.');
  } finally { urls.forEach(url => URL.revokeObjectURL(url)); }
}
function setGhostName(name) {
  runtime.ghost.userData.username = name;
  runtime.ghost.traverse(object => {
    if (object.isCSS2DObject) object.element.textContent = name;
  });
}
$('#identity-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy) return;
  username.value = username.value.trim();
  if (!username.value) { error.textContent = 'Enter a username.'; username.focus(); return; }
  error.textContent = '';
  setBusy(true);
  const previous = state.room;
  try {
    await sceneReady;
    let room;
    if (state.mode === 'create') {
      await saveDraft();
      room = await localRooms.createRoom({ username: username.value, images: state.images });
    } else {
      room = await localRooms.getRoom(code.value);
      if (!room) throw new Error('Room not found in this browser. Create a local room first. Joining rooms on other devices needs the upcoming backend.');
    }
    await displayRoom(room);
    setGhostName(username.value);
    runtime.playerController.reset();
    state.room = room;
    gameVoice.enterRoom();
    $('#show-room-code').disabled = false;
    setBusy(false);
    closeMenu();
  } catch (failure) {
    error.textContent = failure.message || 'Could not open the room. Please try again.';
    if (previous && runtime) {
      try { await displayRoom(previous); } catch { error.textContent += ' Previous artwork could not be restored; reopen your saved room.'; }
    }
  } finally { setBusy(false); }
});

$('#choose-create').addEventListener('click', async () => {
  await restoreDraft;
  state.mode = 'create';
  showStep('artwork');
});
$('#choose-join').addEventListener('click', () => { state.mode = 'join'; showStep('room'); });
$('#back').addEventListener('click', () => {
  if (state.busy) return;
  showStep(state.step === 'identity' ? (state.mode === 'create' ? 'artwork' : 'room') : 'welcome');
});
username.addEventListener('input', () => { if (state.mode === 'create') saveDraft(); });
$('#close-menu').addEventListener('click', closeMenu);
dialog.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
dialog.addEventListener('close', syncModal);
$('#reopen').addEventListener('click', () => openMenu());
$('#reset-player').addEventListener('click', () => { if (!dialog.open) runtime?.playerController.reset(); });
$('#show-room-code').addEventListener('click', () => {
  if (!state.room) return;
  $('#room-code-display').textContent = state.room.code;
  $('#copy-status').textContent = '';
  openMenu('roomCode');
});
$('#copy-room-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.room.code);
    $('#copy-status').textContent = 'Room code copied.';
  } catch { $('#copy-status').textContent = `Copy this code: ${state.room.code}`; }
});

openMenu();
const sceneReady = createGalleryRuntime().then(result => {
  runtime = result;
  syncModal();
  $('#reset-player').disabled = false;
});
// The runtime displays a useful error; submitting a room can surface it again.
sceneReady.catch(() => {});
restoreDraft = localRooms.getDraft().then(draft => {
  if (!draft) return;
  state.images = (draft.images || []).filter(file => file instanceof Blob && !validateImage(file)).slice(0, MAX_IMAGES);
  if (!username.value) username.value = draft.username || '';
  renderPreviews();
  $('#draft-status').textContent = 'Your saved artist draft has been restored.';
}).catch(() => { $('#draft-status').textContent = 'Browser storage is unavailable. Enable site storage to save drafts and create local rooms.'; });
window.addEventListener('pagehide', () => previewUrls.forEach(url => URL.revokeObjectURL(url)));
