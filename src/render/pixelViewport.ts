import { FIELD_HEIGHT, FIELD_WIDTH } from '../core/math';

export const MAX_RENDER_DPR = 2;
export interface PixelViewport {
 width: number;
 height: number;
 /** Device pixels per half-world (640x270 scenery) pixel. */
 scale: number;
 x: number;
 y: number;
 /** Integer backing-pixel bound that is still <=2 physical pixels when DPR is capped. */
 maxShake: number;
}

/**
 * Preserve the 1280x540 world and the original width-fit, bottom-aligned camera:
 * crop excess sky, not the armies. On exceptionally wide/shallow displays, cap
 * the zoom so the complete castles (highest flag at scenery y=102) stay visible.
 */
export function pixelViewport(cssWidth: number, cssHeight: number, devicePixelRatio: number): PixelViewport {
 const physicalDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
 const dpr = Math.min(MAX_RENDER_DPR, physicalDpr);
 const width = Math.max(1, Math.round(Math.max(1, cssWidth) * dpr));
 const height = Math.max(1, Math.round(Math.max(1, cssHeight) * dpr));
 const scale = Math.min(width / (FIELD_WIDTH / 2), height / 172);
 return { width, height, scale, x: Math.max(0, Math.floor((width - 640 * scale) / 2 + 1e-9)),
  y: Math.floor(height - FIELD_HEIGHT / 2 * scale + 1e-9),
  maxShake: Math.floor(2 * dpr / physicalDpr + 1e-9) };
}

/**
 * Keep the original 36/48 nominal art size as an upper budget (except the 1x
 * minimum), instead of growing every soldier to a rounded-UP integer size.
 * Source pixels are only ever copied at 1x, 2x, ... device-pixel magnification.
 */
export function spritePixels(scale: number): { size: number; left: number; top: number } {
 const magnification = Math.max(1, Math.floor(36 * scale / 48 + 1e-9));
 return { size: 48 * magnification, left: -24 * magnification, top: -45 * magnification };
}

export function devicePoint(view: PixelViewport, worldX: number, worldY: number): { x: number; y: number } {
 return { x: Math.round(view.x + worldX / 2 * view.scale),
  y: Math.round(view.y + worldY / 2 * view.scale) };
}
