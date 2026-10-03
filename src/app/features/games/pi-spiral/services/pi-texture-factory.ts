import * as THREE from 'three';
import { ORBITRON_REGULAR_BASE64 } from '../orbitron-font.data';

/**
 * Factory responsible for font loading, procedural 2D canvas texture generation,
 * glowing Orbitron glyph rendering, and material lifecycle for the Pi Spiral.
 */
export class PiTextureFactory {
  /**
   * Registers font data with multiple weight descriptors and family aliases
   * so Canvas 2D font matching succeeds whether 400, 700, bold, or normal is specified.
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
   * Pre-loads the Orbitron font from public/fonts/Orbitron/static/Orbitron-Regular.ttf
   * with multi-path resolution and embedded byte-for-byte binary fallback.
   * Guarantees 100% reliable font availability even when deployed on Netcup webhosting.
   */
  async loadOrbitronFont(): Promise<void> {
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
          // Decode embedded exact Orbitron-Regular.ttf binary data
          const binaryString = atob(ORBITRON_REGULAR_BASE64);
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
   * Generates crisp CanvasTexture for center "3,14" in Orbitron font (#2563eb with drop-shadows).
   */
  createCenterNumberTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
    const centerCanvas = document.createElement('canvas');
    centerCanvas.width = 1024;
    centerCanvas.height = 512;
    const centerCtx = centerCanvas.getContext('2d')!;

    // Clean transparent canvas
    centerCtx.clearRect(0, 0, 1024, 512);

    centerCtx.textAlign = 'center';
    centerCtx.textBaseline = 'middle';
    centerCtx.font = '700 280px "Orbitron", "Orbitron-Regular", sans-serif';

    // 1. Subtle dark depth drop-shadow to elevate the number from the background
    centerCtx.shadowColor = 'rgba(0, 0, 0, 0.80)';
    centerCtx.shadowOffsetX = 14;
    centerCtx.shadowOffsetY = 22;
    centerCtx.shadowBlur = 18;
    centerCtx.fillText('3,14', 512, 256);

    // 2. Light blue drop-shadow (#38bdf8)
    centerCtx.shadowColor = 'rgba(56, 189, 248, 0.75)';
    centerCtx.shadowOffsetX = 6;
    centerCtx.shadowOffsetY = 10;
    centerCtx.shadowBlur = 12;
    centerCtx.fillText('3,14', 512, 256);

    // 3. Solid distinct blue fill pass
    centerCtx.shadowColor = 'transparent';
    centerCtx.shadowBlur = 0;
    centerCtx.fillStyle = '#2563eb';
    centerCtx.fillText('3,14', 512, 256);

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
   * 1. A majestic pulsating Pi symbol ("π") in the background
   * 2. Free-floating, glowing "3,14" in Orbitron font in the foreground
   */
  createCenterHero(
    spiralGroup: THREE.Group,
    renderer?: THREE.WebGLRenderer
  ): { centerTileMesh: THREE.Mesh; centerPiSymbolMesh: THREE.Mesh } {
    // 1. Majestic Glowing Pi Symbol ("π") with direct dark blue border & hub-letter inner shadow
    const piCanvas = document.createElement('canvas');
    piCanvas.width = 1024;
    piCanvas.height = 1024;
    const piCtx = piCanvas.getContext('2d')!;

    // Clean transparent canvas
    piCtx.clearRect(0, 0, 1024, 1024);

    // Ethereal radial cyan/blue glow behind Pi
    const piHalo = piCtx.createRadialGradient(512, 512, 60, 512, 512, 480);
    piHalo.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    piHalo.addColorStop(0.55, 'rgba(59, 130, 246, 0.20)');
    piHalo.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    piCtx.fillStyle = piHalo;
    piCtx.beginPath();
    piCtx.arc(512, 512, 480, 0, Math.PI * 2);
    piCtx.fill();

    piCtx.textAlign = 'center';
    piCtx.textBaseline = 'middle';
    piCtx.font = 'bold 700px "Sniglet-ExtraBold", "Sniglet", serif, sans-serif';

    // Drop-shadow 1: Deep dark shadow (rgba(7, 20, 50, 0.90)) to elevate Pi from background
    piCtx.shadowColor = 'rgba(7, 20, 50, 0.90)';
    piCtx.shadowOffsetX = 12;
    piCtx.shadowOffsetY = 20;
    piCtx.shadowBlur = 24;
    piCtx.fillStyle = '#071432';
    piCtx.fillText('π', 512, 530);

    // Drop-shadow 2: Radiant sky-blue glow aura
    piCtx.shadowColor = 'rgba(56, 189, 248, 0.70)';
    piCtx.shadowOffsetX = 0;
    piCtx.shadowOffsetY = 0;
    piCtx.shadowBlur = 28;
    piCtx.fillStyle = '#071432';
    piCtx.fillText('π', 512, 530);

    // Luminous gradient body fill (hub-letter style: crisp white -> ice blue -> radiant cyan -> deep sky blue)
    piCtx.shadowColor = 'transparent';
    piCtx.shadowBlur = 0;
    const piGrad = piCtx.createLinearGradient(0, 180, 0, 860);
    piGrad.addColorStop(0, '#ffffff');
    piGrad.addColorStop(0.35, '#bae6fd');
    piGrad.addColorStop(0.68, '#38bdf8');
    piGrad.addColorStop(1, '#0284c7');
    piCtx.fillStyle = piGrad;
    piCtx.fillText('π', 512, 530);

    // Inset shadow / shadow to the inside
    piCtx.save();
    piCtx.globalCompositeOperation = 'source-atop';

    // Inset inner edge shadow around the contour
    piCtx.strokeStyle = 'rgba(7, 20, 50, 0.80)';
    piCtx.lineWidth = 18;
    piCtx.shadowColor = 'rgba(7, 20, 50, 0.90)';
    piCtx.shadowBlur = 16;
    piCtx.shadowOffsetX = 0;
    piCtx.shadowOffsetY = 6;
    piCtx.strokeText('π', 512, 530);

    // Inset bottom occlusion shading (bubble glass 3D depth)
    const innerDepthGrad = piCtx.createLinearGradient(0, 320, 0, 860);
    innerDepthGrad.addColorStop(0, 'rgba(7, 20, 50, 0.0)');
    innerDepthGrad.addColorStop(0.55, 'rgba(7, 20, 50, 0.18)');
    innerDepthGrad.addColorStop(1, 'rgba(7, 20, 50, 0.60)');
    piCtx.fillStyle = innerDepthGrad;
    piCtx.fillRect(0, 0, 1024, 1024);

    // Subtle top specular highlight gloss (hub-letter reflection)
    const topHighlightGrad = piCtx.createLinearGradient(0, 180, 0, 420);
    topHighlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.60)');
    topHighlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    piCtx.fillStyle = topHighlightGrad;
    piCtx.fillRect(0, 0, 1024, 440);

    piCtx.restore();

    const piTexture = new THREE.CanvasTexture(piCanvas);
    piTexture.generateMipmaps = true;
    piTexture.minFilter = THREE.LinearMipmapLinearFilter;
    piTexture.magFilter = THREE.LinearFilter;
    if (renderer) {
      piTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    const piGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const piMat = new THREE.MeshBasicMaterial({
      map: piTexture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const centerPiSymbolMesh = new THREE.Mesh(piGeo, piMat);
    centerPiSymbolMesh.position.set(0, 0, 0.38);
    spiralGroup.add(centerPiSymbolMesh);

    // 2. Crisp Free-Floating "3,14" in Orbitron font
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
    spiralGroup.add(centerTileMesh);

    return { centerTileMesh, centerPiSymbolMesh };
  }

  /**
   * Refreshes the center "3,14" texture when Orbitron font is ready.
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
   * Pre-renders crisp textures and materials for digits 0-9 in Orbitron font (#3b82f6)
   * with a clearly visible, bright luminous light-blue drop-shadow.
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

      // Clear transparent canvas
      ctx.clearRect(0, 0, 512, 512);

      // 1. Ethereal centered circular blue glow halo with wider diffusion/spread
      const radialGlow = ctx.createRadialGradient(256, 256, 25, 256, 256, 235);
      radialGlow.addColorStop(0, 'rgba(56, 189, 248, 0.46)');
      radialGlow.addColorStop(0.35, 'rgba(59, 130, 246, 0.28)');
      radialGlow.addColorStop(0.68, 'rgba(37, 99, 235, 0.12)');
      radialGlow.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(256, 256, 235, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '700 290px "Orbitron", "Orbitron-Regular", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 2. Centered vibrant blue neon glow directly on the digit with broader spread
      ctx.shadowColor = 'rgba(56, 189, 248, 0.95)';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 52;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(d.toString(), 256, 256);

      // 3. Drop-shadow placed slightly to the right behind the number with softer spread (+20px X, +8px Y)
      ctx.shadowColor = '#38bdf8';
      ctx.shadowOffsetX = 20;
      ctx.shadowOffsetY = 8;
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(125, 211, 252, 0.85)';
      ctx.fillText(d.toString(), 256, 256);

      // 4. Front sharp number in #3b82f6 (crisp, solid glyph)
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3b82f6';
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
   * Refreshes all Orbitron-based canvas textures (center 3,14 and digits 0-9)
   * once the Orbitron webfont is confirmed loaded into the document FontFaceSet.
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
