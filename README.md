# Poster Room 3D

An interactive Three.js living room for previewing a tiled poster at its real size. Extracted from [Rasterbator Studio](https://rasterbator.online/), a browser tool for turning an image into a printable multi-page poster.

![The six-sheet sample poster above the living room sofa](docs/preview.jpg)

## Run the demo

Use Node.js 22.12 or later in the 22.x release line (or a newer supported LTS release).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To verify the production build, run `npm run build` and then `npm run preview`.

The default poster measures 570 × 452 mm and uses six A4 sheets. Drag to orbit the room and scroll or pinch to zoom. Use **Side** to see the paper seams and curled corners, or switch between unframed, oak and black display styles. **Choose image** previews a local image in the same layout. Your image stays in the browser.

![A side view of the unframed poster showing paper edges and curled corners](docs/paper-detail.jpg)

## Source

- `src/poster-room-scene.ts` builds the room, lighting, camera controls and frame options. Call `createRoomScene` with a sized host element, image URL, aspect ratio and layout. Call `dispose()` when removing the viewer.
- `src/poster-room-paper.ts` generates sheet surfaces, edges and lifted corners.
- `src/poster-room-geometry.ts` maps poster sheets and panels to room geometry. Layout dimensions are in millimeters.

## License

The code and original sample poster are available under the [MIT License](LICENSE). The [room texture maps](public/paper/room-materials/LICENSE.md) are from Poly Haven and available under CC0 1.0.
