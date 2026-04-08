/**
 * turngl — WebGL 3D PDF Flipbook
 * https://github.com/ogi/turngl
 * MIT License
 */

import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const eio   = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

/* ══════════════════════════════════════════════════════════════
   Book3D — Three.js WebGL renderer
   Handles geometry, curl deformation, lighting, render loop
══════════════════════════════════════════════════════════════ */
export class Book3D {
  constructor(canvas, options = {}) {
    this.PW   = options.pageWidth  ?? 1.65;
    this.PH   = options.pageHeight ?? 2.33;
    this.SEGS = options.segments   ?? 32;
    this._dark = options.theme !== 'light';
    this._camT = { x: 0, y: 0 };
    this._camC = { x: 0, y: 0 };
    this._camZ = 6.0;

    this._initRenderer(canvas);
    this._initScene();
    this._initFlipGeom();
    this._loop();
  }

  /* ── Renderer ──────────────────────────────────────────── */
  _initRenderer(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true
    });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0, 0);
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    this.camera.position.set(0, 0, this._camZ);
  }

  /* ── Scene objects ─────────────────────────────────────── */
  _initScene() {
    const sc = this.scene;
    const { PW, PH } = this;

    this._amb = new THREE.AmbientLight(0xffffff, 0.5);
    sc.add(this._amb);

    const key = this._key = new THREE.DirectionalLight(0xfff8f0, 0.75);
    key.position.set(1.5, 3.5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top  =  5; key.shadow.camera.bottom = -5;
    key.shadow.radius = 4;
    sc.add(key);

    sc.add(Object.assign(new THREE.PointLight(0xe8f0ff, 0.25), {
      position: new THREE.Vector3(-3, 0, 4)
    }));

    // Static pages
    this.meshL = this._pageMesh();
    this.meshL.position.x = -PW / 2;
    sc.add(this.meshL);

    this.meshR = this._pageMesh();
    this.meshR.position.x = PW / 2;
    sc.add(this.meshR);

    // Spine
    sc.add(Object.assign(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.04, PH + 0.02, 0.015),
        new THREE.MeshLambertMaterial({ color: 0x030202 })
      ),
      { position: new THREE.Vector3(0, 0, 0.005) }
    ));

    // Shadow floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 8),
      new THREE.ShadowMaterial({ opacity: 0.18 })
    );
    floor.receiveShadow = true;
    floor.position.z = -0.06;
    sc.add(floor);
  }

  /* ── Flip geometry (subdivided for curl) ───────────────── */
  _initFlipGeom() {
    const { PW, PH, SEGS } = this;
    const g = this.flipGeom = new THREE.PlaneGeometry(PW, PH, SEGS, 1);
    const pos = g.attributes.position;
    this._nx = new Float32Array(pos.count);
    this._oy = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this._nx[i] = pos.getX(i) / PW;
      this._oy[i] = pos.getY(i);
    }
    this._mFF = this._mat(this._blankCanvas());
    this.flipF = new THREE.Mesh(g, this._mFF);
    this.flipF.castShadow = true;
    this.flipF.visible = false;
    this.scene.add(this.flipF);

    this._mFB = this._mat(this._blankCanvas(), true);
    this.flipB = new THREE.Mesh(g, this._mFB);
    this.flipB.visible = false;
    this.scene.add(this.flipB);
  }

  /* ── Helpers ───────────────────────────────────────────── */
  _pageMesh() {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(this.PW, this.PH),
      this._mat(this._blankCanvas())
    );
    m.receiveShadow = true;
    return m;
  }

  _mat(canvas, backSide = false) {
    const tex = new THREE.CanvasTexture(canvas);
    if (backSide) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1;
      tex.offset.x  = 1;
    }
    return new THREE.MeshLambertMaterial({
      map: tex,
      side: backSide ? THREE.BackSide : THREE.FrontSide
    });
  }

  _setTex(mat, canvas) {
    if (mat.map) mat.map.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    if (mat.side === THREE.BackSide) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1;
      tex.offset.x  = 1;
    }
    mat.map = tex;
    mat.needsUpdate = true;
  }

  _blankCanvas() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 4;
    cv.getContext('2d').fillStyle = this._dark ? '#0d0b08' : '#d6d3cc';
    cv.getContext('2d').fillRect(0, 0, 4, 4);
    return cv;
  }

  /* ── Public API ────────────────────────────────────────── */

  /** Render two page canvases as the open spread */
  showSpread(leftCanvas, rightCanvas) {
    this._setTex(this.meshL.material, leftCanvas ?? this._blankCanvas());
    this._setTex(this.meshR.material, rightCanvas ?? this._blankCanvas());
    this.meshL.visible = true;
    this.meshR.visible = true;
  }

  /** Prepare a flip: front/back canvas textures + direction */
  prepFlip(dir, frontCanvas, backCanvas) {
    this._setTex(this._mFF, frontCanvas ?? this._blankCanvas());
    this._setTex(this._mFB, backCanvas  ?? this._blankCanvas());
    this.curl(0, dir);
    this.flipF.visible = true;
    this.flipB.visible = true;
    if (dir === 'fwd') this.meshR.visible = false;
    else               this.meshL.visible = false;
  }

  /** Hide flip mesh, restore static pages */
  endFlip() {
    this.flipF.visible = false;
    this.flipB.visible = false;
    this.meshL.visible = true;
    this.meshR.visible = true;
  }

  /**
   * Deform flip geometry to simulate page curl
   * @param {number} progress 0–1
   * @param {'fwd'|'bwd'} dir
   */
  curl(progress, dir) {
    const { PW, flipGeom, _nx, _oy } = this;
    const pos = flipGeom.attributes.position;
    const LEAD = 0.25;
    for (let i = 0; i < pos.count; i++) {
      const nx = _nx[i];
      const t  = dir === 'fwd' ? nx + 0.5 : 0.5 - nx;
      const d  = t * PW;
      const vp = clamp(progress + (t - 0.5) * LEAD, 0, 1);
      const a  = vp * Math.PI;
      pos.setX(i, dir === 'fwd' ?  d * Math.cos(a) : -d * Math.cos(a));
      pos.setZ(i, d * Math.sin(a));
      pos.setY(i, _oy[i]);
    }
    pos.needsUpdate = true;
    flipGeom.computeVertexNormals();
  }

  /**
   * Animate a value with easeInOut
   * @param {number} from
   * @param {number} to
   * @param {number} duration ms
   * @param {Function} onTick
   * @param {Function} onDone
   */
  animate(from, to, duration, onTick, onDone) {
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / duration);
      onTick(from + (to - from) * eio(t));
      if (t < 1) requestAnimationFrame(tick);
      else onDone();
    };
    requestAnimationFrame(tick);
  }

  /** Subtle camera tilt on mouse move (pass normalized -0.5…0.5 coords) */
  mouseLook(nx, ny) {
    this._camT.x =  ny * 0.14;
    this._camT.y = -nx * 0.16;
  }

  /** Zoom: adjusts camera Z distance */
  setZoom(factor) {
    this._camZ = clamp(6.0 / factor, 3, 10);
  }

  setTheme(dark) {
    this._dark = dark;
    this._amb.intensity = dark ? 0.50 : 0.72;
    this._key.intensity = dark ? 0.75 : 0.55;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this._rafId);
    this.renderer.dispose();
  }

  /* ── Render loop ───────────────────────────────────────── */
  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    const { _camC, _camT } = this;
    _camC.x += (_camT.x - _camC.x) * 0.055;
    _camC.y += (_camT.y - _camC.y) * 0.055;
    this.camera.position.set(
      _camC.y * this._camZ * 0.12,
      _camC.x * this._camZ * 0.12,
      this._camZ
    );
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
}

/* ══════════════════════════════════════════════════════════════
   TurnGL Web Component — <turn-gl src="doc.pdf" theme="dark">
══════════════════════════════════════════════════════════════ */
export class TurnGLElement extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'theme'];
  }

  constructor() {
    super();
    this._spread  = 0;
    this._pages   = [];
    this._total   = 0;
    this._anim    = false;
    this._drag    = null;
    this._dragging = false;
  }

  connectedCallback() {
    this._build();
    const src = this.getAttribute('src');
    if (src) this.load(src);
  }

  disconnectedCallback() {
    this._book?.dispose();
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup',   this._onUp);
  }

  attributeChangedCallback(name, _, val) {
    if (name === 'theme' && this._book) this._book.setTheme(val !== 'light');
    if (name === 'src'   && this._book) this.load(val);
  }

  /* ── DOM setup ─────────────────────────────────────────── */
  _build() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { display:block; position:relative; overflow:hidden; }
        canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; cursor:default; }
        canvas.grabbing { cursor:grabbing; }
        #loader { position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:12px;
          background:rgba(0,0,0,.7); color:#eee; font-family:system-ui; font-size:13px; }
        #loader.hidden { display:none; }
        #bar { width:160px; height:2px; background:#333; border-radius:2px; overflow:hidden; }
        #fill { height:100%; background:#fff; width:0%; transition:width .1s; }
      </style>
      <canvas id="cv"></canvas>
      <div id="loader">
        <span id="msg">Loading…</span>
        <div id="bar"><div id="fill"></div></div>
      </div>
    `;
    const root = this.shadowRoot;
    const cv   = root.getElementById('cv');
    const dark = this.getAttribute('theme') !== 'light';

    this._book = new Book3D(cv, { theme: dark ? 'dark' : 'light' });
    this._ro = new ResizeObserver(() => {
      this._book.resize(this.clientWidth, this.clientHeight);
    });
    this._ro.observe(this);
    this._book.resize(this.clientWidth, this.clientHeight);

    this._bindDrag(cv);
  }

  /* ── PDF loading ───────────────────────────────────────── */
  async load(url) {
    if (!url) return;
    const root = this.shadowRoot;
    const msg  = root.getElementById('msg');
    const fill = root.getElementById('fill');
    root.getElementById('loader').classList.remove('hidden');

    try {
      if (!window.pdfjsLib) throw new Error('pdf.js not found. Add it as a script before turngl.');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      msg.textContent = 'Fetching…';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();

      msg.textContent = 'Parsing PDF…';
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      this._total = pdf.numPages;
      this._pages = new Array(this._total).fill(null);
      this._spread = 0;

      for (let i = 1; i <= this._total; i++) {
        const page = await pdf.getPage(i);
        const vp   = page.getViewport({ scale: 2.2 });
        const cv   = document.createElement('canvas');
        cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        this._pages[i - 1] = cv;
        fill.style.width = Math.round(i / this._total * 100) + '%';
        msg.textContent  = `${i} / ${this._total}`;
      }

      this._showSpread();
      this.dispatchEvent(new CustomEvent('load', { detail: { pages: this._total } }));
    } catch (e) {
      msg.textContent = 'Error: ' + e.message;
      this.dispatchEvent(new CustomEvent('error', { detail: e }));
      return;
    }

    root.getElementById('loader').classList.add('hidden');
  }

  /* ── Navigation ────────────────────────────────────────── */
  get totalSpreads() { return Math.ceil(this._total / 2); }
  get _li() { return this._spread * 2; }
  get _ri() { return this._spread * 2 + 1; }

  _showSpread() {
    const blank = null;
    this._book.showSpread(
      this._pages[this._li] ?? blank,
      this._pages[this._ri] ?? null
    );
  }

  next() {
    if (this._anim || this._spread >= this.totalSpreads - 1) return;
    this._anim = true;
    const f = this._pages[this._ri]    ?? null;
    const b = this._pages[this._li + 2] ?? null;
    this._book.prepFlip('fwd', f, b);
    this._book.animate(0, 1, 780, p => this._book.curl(p, 'fwd'), () => {
      this._spread++;
      this._book.endFlip();
      this._showSpread();
      this._anim = false;
      this.dispatchEvent(new CustomEvent('pagechange', {
        detail: { spread: this._spread, page: this._li + 1 }
      }));
    });
  }

  prev() {
    if (this._anim || this._spread <= 0) return;
    this._anim = true;
    const f = this._pages[this._li]    ?? null;
    const b = this._pages[this._ri - 2] ?? null;
    this._book.prepFlip('bwd', f, b);
    this._book.animate(0, 1, 780, p => this._book.curl(p, 'bwd'), () => {
      this._spread--;
      this._book.endFlip();
      this._showSpread();
      this._anim = false;
      this.dispatchEvent(new CustomEvent('pagechange', {
        detail: { spread: this._spread, page: this._li + 1 }
      }));
    });
  }

  goTo(pageIndex) {
    const s = clamp(Math.floor(pageIndex / 2), 0, this.totalSpreads - 1);
    if (s === this._spread || this._anim) return;
    if (Math.abs(s - this._spread) === 1) { s > this._spread ? this.next() : this.prev(); return; }
    this._spread = s;
    this._showSpread();
  }

  /* ── Drag to flip ──────────────────────────────────────── */
  _bindDrag(cv) {
    const nx = e => {
      const r = cv.getBoundingClientRect();
      return ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width - 0.5;
    };
    const ny = e => {
      const r = cv.getBoundingClientRect();
      return ((e.touches ? e.touches[0].clientY : e.clientY) - r.top) / r.height - 0.5;
    };

    cv.addEventListener('pointerdown', e => {
      if (this._anim || !this._total) return;
      const x   = nx(e);
      const dir = x > 0 ? 'fwd' : 'bwd';
      if (dir === 'fwd' && this._spread >= this.totalSpreads - 1) return;
      if (dir === 'bwd' && this._spread <= 0) return;

      let f, b;
      if (dir === 'fwd') { f = this._pages[this._ri]; b = this._pages[this._li + 2]; }
      else               { f = this._pages[this._li]; b = this._pages[this._ri - 2]; }

      this._dragging = true;
      this._drag = { dir, sx: x, prog: 0, lx: x, vel: 0 };
      this._book.prepFlip(dir, f ?? null, b ?? null);
      cv.classList.add('grabbing');
      cv.setPointerCapture(e.pointerId);
      e.preventDefault();
    }, { passive: false });

    this._onMove = e => {
      if (!this._dragging || !this._drag) {
        this._book.mouseLook(nx(e), ny(e));
        return;
      }
      const d = this._drag, x = nx(e);
      const raw = d.dir === 'fwd' ? (d.sx - x) * 2.2 : (x - d.sx) * 2.2;
      const p = clamp(raw, 0, 1);
      d.vel = p - d.prog; d.prog = p; d.lx = x;
      this._book.curl(p, d.dir);
    };

    this._onUp = () => {
      if (!this._dragging || !this._drag) return;
      this._dragging = false;
      cv.classList.remove('grabbing');
      const d = this._drag; this._drag = null;
      const thr = d.vel > 0.018 ? 0.12 : 0.38;
      if (d.prog > thr) {
        this._anim = true;
        this._book.animate(d.prog, 1, Math.max(100, (1 - d.prog) * 550),
          p => this._book.curl(p, d.dir),
          () => {
            if (d.dir === 'fwd') this._spread++;
            else this._spread--;
            this._book.endFlip();
            this._showSpread();
            this._anim = false;
          }
        );
      } else {
        this._book.animate(d.prog, 0, d.prog * 400 + 80,
          p => this._book.curl(p, d.dir),
          () => { this._book.endFlip(); this._showSpread(); }
        );
      }
    };

    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup',   this._onUp);
  }
}

/* Auto-register Web Component */
if (typeof customElements !== 'undefined' && !customElements.get('turn-gl')) {
  customElements.define('turn-gl', TurnGLElement);
}

export default { Book3D, TurnGLElement };
