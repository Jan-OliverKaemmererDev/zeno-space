import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { OrigamiPaperStyle } from '../models/origami.models';

/**
 * Procedural texture generation and caching service for authentic Japanese Washi paper patterns.
 */
@Injectable({
  providedIn: 'root',
})
export class OrigamiTextureService {
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();

  /**
   * Retrieves an existing texture from cache or generates a new one.
   */
  getPaperTexture(paperStyle: OrigamiPaperStyle): THREE.CanvasTexture | null {
    if (paperStyle.patternType === 'solid') {
      return null;
    }

    const cacheKey = `${paperStyle.id}_${paperStyle.primaryColor}_${paperStyle.secondaryColor}_${paperStyle.accentColor}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = paperStyle.primaryColor;
    ctx.fillRect(0, 0, 512, 512);

    this.drawPatternOnCanvas(ctx, paperStyle);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Draws traditional Japanese geometric Washi motifs (Seigaiha waves, Asanoha stars).
   */
  private drawPatternOnCanvas(
    ctx: CanvasRenderingContext2D,
    paperStyle: OrigamiPaperStyle
  ): void {
    const sec = paperStyle.secondaryColor || '#ffffff';
    const acc = paperStyle.accentColor || '#ffffff';

    if (paperStyle.patternType === 'seigaiha') {
      ctx.strokeStyle = sec;
      ctx.lineWidth = 3;
      const r = 36;
      for (let y = -r; y <= 512 + r; y += r) {
        const row = Math.round(y / r);
        const offsetX = (row % 2) * (r * 1.5);
        for (let x = -r * 2 + offsetX; x <= 512 + r * 2; x += r * 3) {
          for (let arcR = r; arcR >= 8; arcR -= 7) {
            ctx.beginPath();
            ctx.arc(x, y, arcR, Math.PI, 0, false);
            ctx.stroke();
          }
        }
      }
    } else if (paperStyle.patternType === 'asanoha') {
      ctx.strokeStyle = acc;
      ctx.lineWidth = 1.5;
      const size = 64;
      for (let y = 0; y < 512; y += size) {
        for (let x = 0; x < 512; x += size) {
          const cx = x + size / 2;
          const cy = y + size / 2;
          ctx.beginPath();
          ctx.moveTo(cx, y);
          ctx.lineTo(cx, y + size);
          ctx.moveTo(x, cy);
          ctx.lineTo(x + size, cy);
          ctx.moveTo(x, y);
          ctx.lineTo(x + size, y + size);
          ctx.moveTo(x + size, y);
          ctx.lineTo(x, y + size);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Cleans up and disposes all cached WebGL textures.
   */
  dispose(): void {
    this.textureCache.forEach((tex) => tex.dispose());
    this.textureCache.clear();
  }
}
