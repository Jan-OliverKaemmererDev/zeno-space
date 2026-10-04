import * as THREE from 'three';
import { ORBITRON_REGULAR_BASE64 } from '../orbitron-font.data';

/**
 * Factory responsible for font loading, procedural 2D canvas texture generation,
 * glowing Orbitron glyph rendering, and material lifecycle for the Goldener Schnitt minigame.
 */
export class PhiTextureFactory {
  /**
   * Registers font data with multiple weight descriptors and family aliases
   * so Canvas 2D font matching succeeds consistently.
   */
  async registerOrbitronFontFaces(fontData: ArrayBuffer): Promise<void> {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;

    const weights = ['400', '700', 'normal', 'bold', '100 900'];
    const families = ['Orbitron', 'Orbitron-Regular'];

    for (const family of families) {
      for (const weight of weights) {
        try {
          const fontFace = new FontFace(family, fontData.slice(0), {
            weight,
            style: 'normal',
            display: 'swap',
          });
          await fontFace.load();
          document.fonts.add(fontFace);
        } catch {
          // Ignore individual duplicate weight registration issues
        }
      }
    }

    try {
      await document.fonts.ready;
    } catch {
      // Ignore ready error
    }
  }

  /**
   * Pre-loads the Orbitron font with multi-path resolution and embedded binary fallback.
   */
  async loadOrbitronFont(): Promise<void> {
    // If the font is already active in the document (from CSS @font-face), try loading it
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await Promise.all([
          document.fonts.load('700 240px Orbitron'),
          document.fonts.load('700 290px Orbitron'),
        ]);
        if (document.fonts.check('700 240px Orbitron')) {
          return;
        }
      } catch {
        // Fall back to buffer fetch / embedded binary
      }
    }

    let buffer: ArrayBuffer | null = null;

    if (typeof window !== 'undefined') {
      const candidates: string[] = [];
      try {
        if (typeof document !== 'undefined' && document.baseURI) {
          candidates.push(new URL('fonts/Orbitron/static/Orbitron-Regular.ttf', document.baseURI).href);
        }
      } catch {}
      candidates.push('fonts/Orbitron/static/Orbitron-Regular.ttf');
      candidates.push('/fonts/Orbitron/static/Orbitron-Regular.ttf');

      for (const url of candidates) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const ab = await response.arrayBuffer();
            if (ab && ab.byteLength > 1000) {
              buffer = ab;
              break;
            }
          }
        } catch {
          // Try next candidate URL
        }
      }

      if (!buffer) {
        try {
          const binaryString = atob(ORBITRON_REGULAR_BASE64.replace(/\s+/g, ''));
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          buffer = bytes.buffer;
        } catch (err) {
          console.warn('Fallback base64 font decode error:', err);
        }
      }

      if (buffer) {
        await this.registerOrbitronFontFaces(buffer);
      }
    }
  }

  /**
   * Generates crisp CanvasTexture for center "1,618" in Orbitron font with warm golden drop-shadows.
   */
  createCenterNumberTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
    const centerCanvas = document.createElement('canvas');
    centerCanvas.width = 1024;
    centerCanvas.height = 512;
    const centerCtx = centerCanvas.getContext('2d')!;

    centerCtx.clearRect(0, 0, 1024, 512);
    centerCtx.textAlign = 'center';
    centerCtx.textBaseline = 'middle';
    centerCtx.font = '700 280px "Orbitron", "Orbitron-Regular", sans-serif';

    // 1. Dark depth drop-shadow to elevate number from background
    centerCtx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    centerCtx.shadowOffsetX = 14;
    centerCtx.shadowOffsetY = 22;
    centerCtx.shadowBlur = 18;
    centerCtx.fillText('1,618', 512, 256);

    // 2. Warm golden glow drop-shadow (#fbbf24 / #f59e0b)
    centerCtx.shadowColor = 'rgba(251, 191, 36, 0.78)';
    centerCtx.shadowOffsetX = 6;
    centerCtx.shadowOffsetY = 10;
    centerCtx.shadowBlur = 14;
    centerCtx.fillText('1,618', 512, 256);

    // 3. Radiant solid gold text fill pass
    centerCtx.shadowColor = 'transparent';
    centerCtx.shadowBlur = 0;
    centerCtx.fillStyle = '#f59e0b';
    centerCtx.fillText('1,618', 512, 256);

    const centerTexture = new THREE.CanvasTexture(centerCanvas);
    centerTexture.generateMipmaps = true;
    centerTexture.minFilter = THREE.LinearMipmapLinearFilter;
    centerTexture.magFilter = THREE.LinearFilter;
    if (renderer) {
      centerTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
    return centerTexture;
  }

  /**
   * Creates the center hero display meshes:
   * 1. A majestic pulsating Phi symbol ("φ") in warm glowing gold
   * 2. Free-floating, glowing "1,618" in Orbitron font in the foreground
   */
  createCenterHero(
    parentGroup: THREE.Group,
    renderer?: THREE.WebGLRenderer
  ): { centerTileMesh: THREE.Mesh; centerPhiSymbolMesh: THREE.Mesh } {
    // 1. Majestic Glowing Phi Symbol ("φ")
    const phiCanvas = document.createElement('canvas');
    phiCanvas.width = 1024;
    phiCanvas.height = 1024;
    const phiCtx = phiCanvas.getContext('2d')!;

    phiCtx.clearRect(0, 0, 1024, 1024);

    // Ethereal radial warm amber/gold halo
    const phiHalo = phiCtx.createRadialGradient(512, 512, 60, 512, 512, 480);
    phiHalo.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
    phiHalo.addColorStop(0.55, 'rgba(245, 158, 11, 0.22)');
    phiHalo.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
    phiCtx.fillStyle = phiHalo;
    phiCtx.beginPath();
    phiCtx.arc(512, 512, 480, 0, Math.PI * 2);
    phiCtx.fill();

    phiCtx.textAlign = 'center';
    phiCtx.textBaseline = 'middle';
    phiCtx.font = 'bold 700px "Sniglet-ExtraBold", "Sniglet", serif, sans-serif';

    // Drop-shadow 1: Deep dark shadow
    phiCtx.shadowColor = 'rgba(20, 14, 5, 0.90)';
    phiCtx.shadowOffsetX = 12;
    phiCtx.shadowOffsetY = 20;
    phiCtx.shadowBlur = 24;
    phiCtx.fillStyle = '#1e1405';
    phiCtx.fillText('φ', 512, 530);

    // Drop-shadow 2: Radiant golden aura glow
    phiCtx.shadowColor = 'rgba(251, 191, 36, 0.75)';
    phiCtx.shadowOffsetX = 0;
    phiCtx.shadowOffsetY = 0;
    phiCtx.shadowBlur = 30;
    phiCtx.fillStyle = '#1e1405';
    phiCtx.fillText('φ', 512, 530);

    // Luminous gold gradient body
    phiCtx.shadowColor = 'transparent';
    phiCtx.shadowBlur = 0;
    const phiGrad = phiCtx.createLinearGradient(0, 180, 0, 860);
    phiGrad.addColorStop(0, '#ffffff');
    phiGrad.addColorStop(0.32, '#fef08a');
    phiGrad.addColorStop(0.65, '#f59e0b');
    phiGrad.addColorStop(1, '#b45309');
    phiCtx.fillStyle = phiGrad;
    phiCtx.fillText('φ', 512, 530);

    // Inset depth shading
    phiCtx.save();
    phiCtx.globalCompositeOperation = 'source-atop';

    phiCtx.strokeStyle = 'rgba(20, 14, 5, 0.80)';
    phiCtx.lineWidth = 18;
    phiCtx.shadowColor = 'rgba(20, 14, 5, 0.90)';
    phiCtx.shadowBlur = 16;
    phiCtx.shadowOffsetX = 0;
    phiCtx.shadowOffsetY = 6;
    phiCtx.strokeText('φ', 512, 530);

    const innerDepthGrad = phiCtx.createLinearGradient(0, 320, 0, 860);
    innerDepthGrad.addColorStop(0, 'rgba(20, 14, 5, 0.0)');
    innerDepthGrad.addColorStop(0.55, 'rgba(20, 14, 5, 0.20)');
    innerDepthGrad.addColorStop(1, 'rgba(20, 14, 5, 0.65)');
    phiCtx.fillStyle = innerDepthGrad;
    phiCtx.fillRect(0, 0, 1024, 1024);

    const topHighlightGrad = phiCtx.createLinearGradient(0, 180, 0, 420);
    topHighlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    topHighlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    phiCtx.fillStyle = topHighlightGrad;
    phiCtx.fillRect(0, 0, 1024, 440);

    phiCtx.restore();

    const phiTexture = new THREE.CanvasTexture(phiCanvas);
    phiTexture.generateMipmaps = true;
    phiTexture.minFilter = THREE.LinearMipmapLinearFilter;
    phiTexture.magFilter = THREE.LinearFilter;
    if (renderer) {
      phiTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    const phiGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const phiMat = new THREE.MeshBasicMaterial({
      map: phiTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const centerPhiSymbolMesh = new THREE.Mesh(phiGeo, phiMat);
    centerPhiSymbolMesh.position.set(0, 0, 0.38);
    centerPhiSymbolMesh.frustumCulled = false;
    parentGroup.add(centerPhiSymbolMesh);

    // 2. Center "1,618" in Orbitron font
    const centerTexture = this.createCenterNumberTexture(renderer);
    const centerGeo = new THREE.PlaneGeometry(3.0, 1.5);
    const centerMat = new THREE.MeshBasicMaterial({
      map: centerTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const centerTileMesh = new THREE.Mesh(centerGeo, centerMat);
    centerTileMesh.position.set(0, 0, 0.60);
    centerTileMesh.frustumCulled = false;
    parentGroup.add(centerTileMesh);

    return { centerTileMesh, centerPhiSymbolMesh };
  }

  /**
   * Refreshes the center "1,618" texture when font is loaded.
   */
  updateCenterHeroNumberTexture(centerTileMesh?: THREE.Mesh, renderer?: THREE.WebGLRenderer): void {
    if (!centerTileMesh) return;
    const mat = centerTileMesh.material as THREE.MeshBasicMaterial;
    if (mat) {
      const oldMap = mat.map;
      mat.map = this.createCenterNumberTexture(renderer);
      mat.needsUpdate = true;
      oldMap?.dispose();
    }
  }

  /**
   * Pre-renders crisp textures and materials for digits 0-9 in golden Orbitron font
   * with bright luminous gold aura drop-shadows.
   */
  initDigitMaterials(
    existingMaterials: THREE.MeshBasicMaterial[] = [],
    renderer?: THREE.WebGLRenderer
  ): THREE.MeshBasicMaterial[] {
    const maxAnisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 16;
    const isUpdating = existingMaterials.length === 10;
    const materials: THREE.MeshBasicMaterial[] = isUpdating ? existingMaterials : [];

    for (let d = 0; d < 10; d++) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      ctx.clearRect(0, 0, 512, 512);

      // 1. Ethereal centered circular gold glow halo
      const radialGlow = ctx.createRadialGradient(256, 256, 25, 256, 256, 235);
      radialGlow.addColorStop(0, 'rgba(251, 191, 36, 0.48)');
      radialGlow.addColorStop(0.35, 'rgba(245, 158, 11, 0.28)');
      radialGlow.addColorStop(0.68, 'rgba(180, 83, 9, 0.12)');
      radialGlow.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(256, 256, 235, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 290px "Orbitron", "Orbitron-Regular", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 2. Centered vibrant golden neon glow
      ctx.shadowColor = 'rgba(251, 191, 36, 0.95)';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 52;
      ctx.fillStyle = '#fde047';
      ctx.fillText(d.toString(), 256, 256);

      // 3. Drop-shadow placed slightly to the right behind number
      ctx.shadowColor = '#f59e0b';
      ctx.shadowOffsetX = 20;
      ctx.shadowOffsetY = 8;
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
      ctx.fillText(d.toString(), 256, 256);

      // 4. Front sharp number in #f59e0b (crisp golden glyph)
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(d.toString(), 256, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = maxAnisotropy;

      if (isUpdating && materials[d]) {
        materials[d].map?.dispose();
        materials[d].map = texture;
        materials[d].needsUpdate = true;
      } else {
        const mat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        materials.push(mat);
      }
    }

    return materials;
  }

  /**
   * Refreshes all Orbitron-based canvas textures once the webfont is loaded.
   */
  refreshAllOrbitronTextures(
    centerTileMesh?: THREE.Mesh,
    digitMaterials: THREE.MeshBasicMaterial[] = [],
    renderer?: THREE.WebGLRenderer
  ): void {
    this.initDigitMaterials(digitMaterials, renderer);
    this.updateCenterHeroNumberTexture(centerTileMesh, renderer);
  }
}
