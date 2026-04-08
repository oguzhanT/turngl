import * as THREE from 'three';

export interface Book3DOptions {
  pageWidth?: number;
  pageHeight?: number;
  segments?: number;
  theme?: 'dark' | 'light';
}

export declare class Book3D {
  PW: number;
  PH: number;
  SEGS: number;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement, options?: Book3DOptions);

  /** Render two page canvases as the open spread */
  showSpread(leftCanvas: HTMLCanvasElement | null, rightCanvas: HTMLCanvasElement | null): void;

  /** Prepare a page flip animation */
  prepFlip(dir: 'fwd' | 'bwd', frontCanvas: HTMLCanvasElement | null, backCanvas: HTMLCanvasElement | null): void;

  /** End flip, restore static pages */
  endFlip(): void;

  /** Deform geometry to simulate page curl (progress 0–1) */
  curl(progress: number, dir: 'fwd' | 'bwd'): void;

  /** Animate a value with easeInOut */
  animate(from: number, to: number, duration: number, onTick: (v: number) => void, onDone: () => void): void;

  /** Subtle camera tilt (pass normalized -0.5 to 0.5 coords) */
  mouseLook(nx: number, ny: number): void;

  /** Set zoom factor (1 = default) */
  setZoom(factor: number): void;

  /** Switch dark/light lighting preset */
  setTheme(dark: boolean): void;

  /** Update renderer + camera on container resize */
  resize(width: number, height: number): void;

  /** Clean up Three.js resources */
  dispose(): void;
}

export interface TurnGLEventMap {
  load:       CustomEvent<{ pages: number }>;
  error:      CustomEvent<Error>;
  pagechange: CustomEvent<{ spread: number; page: number }>;
}

export declare class TurnGLElement extends HTMLElement {
  /** Load a PDF from URL */
  load(url: string): Promise<void>;

  /** Go to next spread */
  next(): void;

  /** Go to previous spread */
  prev(): void;

  /** Jump to 0-based page index */
  goTo(pageIndex: number): void;

  readonly totalSpreads: number;

  addEventListener<K extends keyof TurnGLEventMap>(
    type: K,
    listener: (ev: TurnGLEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'turn-gl': TurnGLElement;
  }
}

export default { Book3D, TurnGLElement };
