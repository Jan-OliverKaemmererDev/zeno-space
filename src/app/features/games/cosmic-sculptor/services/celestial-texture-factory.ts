import * as THREE from 'three';
import { PlanetSubtype } from '../models/cosmic-sculptor.types';

/**
 * Generates aesthetic, harmonious, and relaxing textures for celestial bodies in Zeno Space.
 * Replaces harsh plastic photorealism with soothing, velvety, meditative color harmonies.
 */
export class CelestialTextureFactory {
  private particleGlowTexture: THREE.CanvasTexture | null = null;

  private hasFullContext(ctx: CanvasRenderingContext2D | null): ctx is CanvasRenderingContext2D {
    return !!(
      ctx &&
      typeof ctx.createLinearGradient === 'function' &&
      typeof ctx.getImageData === 'function' &&
      typeof ctx.fillRect === 'function' &&
      typeof ctx.putImageData === 'function'
    );
  }

  /**
   * Reusable soft circular radial glow sprite for starfield and Milky Way particles.
   */
  getParticleGlowTexture(): THREE.CanvasTexture {
    if (this.particleGlowTexture) {
      return this.particleGlowTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.createRadialGradient === 'function') {
      const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)');
      gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.35)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 16, 16);
    }

    this.particleGlowTexture = new THREE.CanvasTexture(canvas);
    this.particleGlowTexture.generateMipmaps = false;
    this.particleGlowTexture.minFilter = THREE.LinearFilter;
    return this.particleGlowTexture;
  }

  /**
   * Generates a silky, ethereal cosmic nebula cloud texture for the smooth Milky Way galactic band.
   * Soft Gaussian core with delicate galactic lavender and deep indigo/cyan hues, completely seamless.
   */
  createMilkyWayNebulaTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.createRadialGradient !== 'function') return new THREE.CanvasTexture(canvas);

    if (typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, size, size);
    }

    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center * 0.95);
    grad.addColorStop(0.0, 'rgba(235, 245, 255, 0.42)');  // Soft luminous stardust center
    grad.addColorStop(0.20, 'rgba(165, 180, 252, 0.32)'); // Lavender / periwinkle
    grad.addColorStop(0.45, 'rgba(99, 102, 241, 0.20)');  // Deep serene indigo
    grad.addColorStop(0.72, 'rgba(56, 189, 248, 0.08)');  // Whispering sky cyan
    grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');      // Completely transparent border

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }

  /**
   * Warm, golden stardust cloud for the galactic bulge (Sagittarius core).
   */
  createGalacticCoreTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.createRadialGradient !== 'function') return new THREE.CanvasTexture(canvas);

    if (typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, size, size);
    }

    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center * 0.95);
    grad.addColorStop(0.0, 'rgba(254, 240, 138, 0.48)');  // Warm radiant gold
    grad.addColorStop(0.25, 'rgba(251, 191, 36, 0.35)');  // Warm amber
    grad.addColorStop(0.50, 'rgba(217, 119, 6, 0.18)');   // Golden twilight
    grad.addColorStop(0.75, 'rgba(129, 140, 248, 0.08)'); // Subtle lavender edge
    grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');      // Transparent border

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }

  /**
   * Warm, soothing golden star texture with luminous cream core and soft amber radiance.
   */
  createSunTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!this.hasFullContext(ctx)) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#fef08a'); // Warm sunny gold
    grad.addColorStop(0.3, '#f59e0b'); // Radiant amber
    grad.addColorStop(0.7, '#fbbf24'); // Luminous honey
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft swirling plasma waves
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const idx = (y * width + x) * 4;

        const wave = Math.sin(nx * 12.0 + Math.sin(ny * 16.0) * 1.5) * 18.0;
        data[idx] = Math.min(255, Math.max(0, data[idx] + wave));
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + wave * 0.75));
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + wave * 0.4));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Serene aquatic world: Tranquil sapphire oceans, emerald-mint islands, and turquoise lagoons.
   */
  createTerrestrialTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!this.hasFullContext(ctx)) return new THREE.CanvasTexture(canvas);

    // Velvety gradient of azure ocean
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#0369a1');
    oceanGrad.addColorStop(0.5, '#0284c7');
    oceanGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (v - 0.5) * Math.PI;
      const cosLat = Math.cos(lat);

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lon = u * Math.PI * 2;
        const idx = (y * width + x) * 4;

        const n1 = Math.sin(lon * 2.5 + Math.cos(lat * 2.8) * 1.4);
        const n2 = Math.cos(lon * 4.8 - lat * 3.6) * 0.5;
        const heightVal = (n1 + n2) * cosLat;

        if (Math.abs(lat) > 1.32) {
          // Soft frosted polar caps
          data[idx] = 230; data[idx + 1] = 248; data[idx + 2] = 255;
        } else if (heightVal > 0.22) {
          // Mint & Jade islands
          data[idx] = 16; data[idx + 1] = 185; data[idx + 2] = 129;
        } else if (heightVal > 0.12) {
          // Turquoise lagoon rim
          data[idx] = 56; data[idx + 1] = 189; data[idx + 2] = 248;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Ethereal wisps of white-aurora clouds for oceanic worlds.
   */
  createTerrestrialCloudsTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.createImageData !== 'function' || typeof ctx.putImageData !== 'function') {
      return new THREE.CanvasTexture(canvas);
    }

    if (typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, width, height);
    }
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = (v - 0.5) * Math.PI;

      for (let x = 0; x < width; x++) {
        const u = x / width;
        const lon = u * Math.PI * 2;
        const idx = (y * width + x) * 4;

        const swirl = Math.sin(lon * 3.8 + Math.sin(lat * 5.5) * 1.8);
        if (swirl > 0.35) {
          const alpha = Math.min(180, Math.floor((swirl - 0.35) * 260));
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = alpha;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Velvety Gas Giant with relaxing color palettes (Amber-Gold, Twilight-Amethyst, or Serene-Cyan).
   */
  createGasGiantTexture(variant = 0): THREE.CanvasTexture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!this.hasFullContext(ctx)) return new THREE.CanvasTexture(canvas);

    // Relaxing, aesthetic color harmonies
    const palettes = [
      ['#d97706', '#f59e0b', '#fde68a', '#fbbf24', '#b45309'], // Warm Honey & Amber
      ['#4f46e5', '#818cf8', '#c084fc', '#e0e7ff', '#6366f1'], // Twilight Indigo & Amethyst
      ['#0369a1', '#38bdf8', '#bae6fd', '#7dd3fc', '#0284c7'], // Serene Sky & Cyan
    ];
    const pal = palettes[variant % palettes.length];

    const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
    baseGrad.addColorStop(0, pal[0]);
    baseGrad.addColorStop(0.25, pal[1]);
    baseGrad.addColorStop(0.5, pal[2]);
    baseGrad.addColorStop(0.75, pal[3]);
    baseGrad.addColorStop(1, pal[4]);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Gentle fluid shear bands without harsh turbulence
    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const idx = (y * width + x) * 4;

        const gentleShear = Math.sin(u * 8.0 + Math.sin(v * 20.0) * 2.0) * 12.0;
        data[idx] = Math.min(255, Math.max(0, data[idx] + gentleShear));
        data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + gentleShear * 0.8));
        data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + gentleShear * 0.6));
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Translucent, luminous golden ring system.
   */
  createSaturnRingTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 32;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.fillRect !== 'function') return new THREE.CanvasTexture(canvas);

    if (typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, width, height);
    }

    for (let x = 0; x < width; x++) {
      const u = x / width;
      let opacity = 0;
      let r = 254, g = 240, b = 138; // Soft warm yellow

      if (u > 0.12 && u < 0.62) {
        opacity = 0.65 + Math.sin(u * 140.0) * 0.12;
      } else if (u > 0.70 && u < 0.94) {
        opacity = 0.50 + Math.sin(u * 90.0) * 0.10;
        r = 253; g = 230; b = 138;
      }

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
      ctx.fillRect(x, 0, 1, height);
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Serene Ice Giant: Soothing azure and periwinkle with luminous aurora ribbons.
   */
  createIceGiantTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!this.hasFullContext(ctx)) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1e40af'); // Deep royal sapphire
    grad.addColorStop(0.3, '#3b82f6'); // Sky sapphire
    grad.addColorStop(0.5, '#38bdf8'); // Calming cyan
    grad.addColorStop(0.7, '#60a5fa');
    grad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Gentle luminous ribbon streaks
    for (let i = 0; i < 14; i++) {
      const y = 40 + Math.random() * 176;
      const streakLen = 80 + Math.random() * 160;
      const x = Math.random() * width;
      const streakGrad = ctx.createLinearGradient(x, y, x + streakLen, y);
      streakGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      streakGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.45)');
      streakGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = streakGrad;
      ctx.fillRect(x, y, streakLen, 2 + Math.random() * 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Warm desert world: Velvety terracotta, soft apricot, and quartz rose.
   */
  createDesertTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!this.hasFullContext(ctx)) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#ea580c'); // Warm terracotta
    grad.addColorStop(0.4, '#fb923c'); // Apricot
    grad.addColorStop(0.6, '#f472b6'); // Quartz rose
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Mystical crystal / lotus world: Deep twilight indigo with glowing magenta-amber veins.
   */
  createVolcanicTexture(): THREE.CanvasTexture {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!this.hasFullContext(ctx)) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#312e81'); // Royal midnight indigo
    grad.addColorStop(0.5, '#4338ca');
    grad.addColorStop(1, '#312e81');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const idx = (y * width + x) * 4;

        // Soft glowing crystalline veins
        const vein = Math.abs(Math.sin(u * 16.0 + Math.cos(v * 12.0) * 2.0));
        if (vein < 0.08) {
          data[idx] = 244; // Rose-magenta glow
          data[idx + 1] = 63;
          data[idx + 2] = 94;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Mystical, soothing accretion disk with smooth amber-violet stardust gradient.
   */
  createAccretionDiskTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.fillRect !== 'function') return new THREE.CanvasTexture(canvas);

    if (typeof ctx.clearRect === 'function') {
      ctx.clearRect(0, 0, size, size);
    }
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const r = Math.sqrt(dx * dx + dy * dy);
        const innerR = 40;
        const outerR = 240;

        if (r >= innerR && r <= outerR) {
          const normR = (r - innerR) / (outerR - innerR);

          // Smooth relaxing colors: Golden amber core fading to soothing amethyst violet
          let rCol = Math.floor(250 * (1.0 - normR * 0.4));
          let gCol = Math.floor(190 * (1.0 - normR * 0.7));
          let bCol = Math.floor(240 * normR + 80);
          let alpha = Math.max(0, Math.min(1, (1.0 - normR) * 0.85));

          ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, ${alpha})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Returns a relaxing, aesthetic texture corresponding to the planet subtype.
   */
  getPlanetTexture(subtype: PlanetSubtype, variant = 0): THREE.CanvasTexture {
    switch (subtype) {
      case 'terrestrial':
        return this.createTerrestrialTexture();
      case 'gas-giant':
        return this.createGasGiantTexture(variant);
      case 'ice-giant':
        return this.createIceGiantTexture();
      case 'desert':
        return this.createDesertTexture();
      case 'volcanic':
        return this.createVolcanicTexture();
      default:
        return this.createTerrestrialTexture();
    }
  }

  dispose(): void {
    if (this.particleGlowTexture) {
      this.particleGlowTexture.dispose();
      this.particleGlowTexture = null;
    }
  }
}
