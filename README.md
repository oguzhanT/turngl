# turngl

**WebGL-powered 3D PDF flipbook with real page curl.**

Drag to flip. Mouse-look camera tilt. Dark/light mode. Zero UI framework dependency.

> Built on [Three.js](https://threejs.org) + [PDF.js](https://mozilla.github.io/pdf.js/).  
> Inspired by [Real3DFlipBook](https://real3dflipbook.com) — rebuilt from scratch, open source.

---

## Demo

[Live demo →](https://github.com/oguzhanT/turngl) <!-- replace with real URL -->

---

## Install

```bash
npm install turngl three
```

PDF.js must be available globally (add via CDN or import separately):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
```

---

## Usage

### Web Component (zero framework)

```html
<script type="module">
  import 'turngl';
</script>

<turn-gl
  src="/annual-report.pdf"
  theme="dark"
  style="width:100%;height:600px"
></turn-gl>
```

Listen for events:

```js
const book = document.querySelector('turn-gl');

book.addEventListener('load',       e => console.log(`Loaded ${e.detail.pages} pages`));
book.addEventListener('pagechange', e => console.log(`Spread ${e.detail.spread}`));
book.addEventListener('error',      e => console.error(e.detail));

// Programmatic control
book.next();
book.prev();
book.goTo(4); // 0-based page index
```

---

### Vanilla JS (Book3D)

Full control over the rendering pipeline:

```js
import { Book3D } from 'turngl';

const canvas = document.getElementById('myCanvas');
const book   = new Book3D(canvas, { theme: 'dark', segments: 32 });

// Resize when container changes
window.addEventListener('resize', () => {
  book.resize(canvas.clientWidth, canvas.clientHeight);
});

// Show a spread (HTMLCanvasElement pages from PDF.js or your own renderer)
book.showSpread(leftPageCanvas, rightPageCanvas);

// Flip programmatically
book.prepFlip('fwd', currentRightCanvas, nextLeftCanvas);
book.animate(0, 1, 780,
  progress => book.curl(progress, 'fwd'),
  () => { book.endFlip(); book.showSpread(newLeft, newRight); }
);

// Mouse look (call on mousemove, pass -0.5…0.5 normalized coords)
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  book.mouseLook(
    (e.clientX - r.left) / r.width  - 0.5,
    (e.clientY - r.top)  / r.height - 0.5
  );
});
```

---

### React

```jsx
import { useEffect, useRef } from 'react';
import { TurnGLElement } from 'turngl';

// Register once
if (!customElements.get('turn-gl')) customElements.define('turn-gl', TurnGLElement);

export function Flipbook({ src }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const onLoad = e => console.log('pages:', e.detail.pages);
    el.addEventListener('load', onLoad);
    return () => el.removeEventListener('load', onLoad);
  }, []);

  return <turn-gl ref={ref} src={src} theme="dark" style={{ width: '100%', height: '600px' }} />;
}
```

---

## API

### `<turn-gl>` attributes

| Attribute | Type               | Default  | Description            |
|-----------|--------------------|----------|------------------------|
| `src`     | `string`           | —        | PDF URL to load        |
| `theme`   | `"dark" \| "light"` | `"dark"` | Color scheme           |

### `<turn-gl>` methods

| Method            | Description                         |
|-------------------|-------------------------------------|
| `load(url)`       | Load a new PDF from URL             |
| `next()`          | Flip to next spread                 |
| `prev()`          | Flip to previous spread             |
| `goTo(pageIndex)` | Jump to page (0-based)              |

### `<turn-gl>` events

| Event          | `detail`                           |
|----------------|------------------------------------|
| `load`         | `{ pages: number }`                |
| `pagechange`   | `{ spread: number, page: number }` |
| `error`        | `Error`                            |

### `Book3D` constructor options

| Option       | Type     | Default | Description                        |
|--------------|----------|---------|------------------------------------|
| `pageWidth`  | `number` | `1.65`  | Page width in 3D units             |
| `pageHeight` | `number` | `2.33`  | Page height in 3D units            |
| `segments`   | `number` | `32`    | Horizontal geometry segments (curl quality) |
| `theme`      | `string` | `'dark'`| `'dark'` or `'light'`             |

---

## How it works

Pages are rendered to `HTMLCanvasElement` by PDF.js, then used as `THREE.CanvasTexture` on subdivided `PlaneGeometry` meshes. During a flip, each vertex is deformed along a cylindrical path — outer edge leading the inner edge by `LEAD` factor — creating the characteristic page curl.

```
vertex[i].x = dist * cos(angle)   // cylindrical rotation around spine
vertex[i].z = dist * sin(angle)   // z-depth peaks at 90° (toward viewer)
```

---

## License

MIT © Oguzhan Togay
