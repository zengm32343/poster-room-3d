import { makeLayout } from './poster-geometry';
import { createRoomScene, type RoomFrame } from './poster-room-scene';
import './style.css';

const room = document.querySelector<HTMLDivElement>('#room')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const zoom = document.querySelector<HTMLInputElement>('#zoom')!;
const evening = document.querySelector<HTMLInputElement>('#evening')!;
const fileInput = document.querySelector<HTMLInputElement>('#image')!;
const views = document.querySelectorAll<HTMLButtonElement>('[data-view]');
const frames = document.querySelectorAll<HTMLButtonElement>('[data-frame]');
const layout = makeLayout(570, 452, 210, 297, 10, 5, false, {
  overlapInMargins: true,
  fit: 'cover',
});
let current: Awaited<ReturnType<typeof createRoomScene>> | undefined;
let frame: RoomFrame = 'none';
let generation = 0;

function selectButton(buttons: NodeListOf<HTMLButtonElement>, value: string) {
  for (const button of buttons) {
    const selected = (button.dataset.view ?? button.dataset.frame) === value;
    button.setAttribute('aria-pressed', String(selected));
  }
}

async function loadRoom(url: string) {
  const request = ++generation;
  status.hidden = false;
  status.textContent = 'Loading room…';
  try {
    const next = await createRoomScene(
      room, url, layout.width / layout.height, layout,
      () => {
        if (request !== generation) return;
        status.hidden = false;
        status.textContent = 'The 3D view was interrupted. Reload to reopen it.';
      },
      (value) => { zoom.value = String(Math.round(value)); },
    );
    if (request !== generation) {
      next.dispose();
      return;
    }
    current?.dispose();
    current = next;
    current.frame(frame);
    current.lighting(evening.checked);
    selectButton(views, 'room');
    status.hidden = true;
  } catch {
    if (request !== generation) return;
    status.textContent = current
      ? 'Could not open that image. Choose a different local image.'
      : 'Could not open the 3D view. This demo requires WebGL 2.';
  }
}

for (const button of views) {
  button.addEventListener('click', () => {
    if (!current) return;
    const view = button.dataset.view!;
    selectButton(views, view);
    if (view === 'room') current.roomView();
    else current.focusPoster(view === 'side');
  });
}
for (const button of frames) {
  button.addEventListener('click', () => {
    frame = button.dataset.frame as RoomFrame;
    current?.frame(frame);
    selectButton(frames, frame);
  });
}
zoom.addEventListener('input', () => {
  selectButton(views, '');
  current?.zoomTo(zoom.valueAsNumber);
});
room.addEventListener('pointerdown', () => selectButton(views, ''));
room.addEventListener('wheel', () => selectButton(views, ''), { passive: true });
evening.addEventListener('change', () => current?.lighting(evening.checked));
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  fileInput.value = '';
  const url = URL.createObjectURL(file);
  try { await loadRoom(url); }
  finally { URL.revokeObjectURL(url); }
});

void loadRoom(`${import.meta.env.BASE_URL}sample-poster.svg`);
