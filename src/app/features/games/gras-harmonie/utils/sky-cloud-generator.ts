import * as THREE from 'three';

export type TimeOfDay = 'day' | 'golden' | 'night';

export interface AtmosphereTheme {
  skyZenith: string;
  skyHorizon: string;
  skyHaze: string;
  mountainFar: string;
  mountainNear: string;
  cloudShadowDeep: string;
  cloudShadowMid: string;
  cloudBody: string;
  cloudHighlight: string;
  cloudRimLight: string;
  sunGlow: string;
  grassBase: THREE.Color;
  grassMid: THREE.Color;
  grassTip: THREE.Color;
  groundColor: THREE.Color;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
  sunDirection: THREE.Vector3;
}

const THEME_DATA = {
  day: {
    skyZenith: '#0e5ebd', // Radiant anime royal blue
    skyHorizon: '#3ba4f4',
    skyHaze: '#a6e1fc',
    mountainFar: '#4688b4',
    mountainNear: '#366e44',
    cloudShadowDeep: '#6582a8', // Rich Ghibli periwinkle-blue shadow
    cloudShadowMid: '#8faecc',
    cloudBody: '#edf5fd',
    cloudHighlight: '#ffffff',  // Pure crisp white sunlit crest
    cloudRimLight: '#fffdf6',
    sunGlow: 'rgba(255, 252, 235, 0.58)',
    grassBase: 0x227827, // Vibrant lush emerald green root (no blackening)
    grassMid: 0x38b82a,
    grassTip: 0xaaf038,
    groundColor: 0xffffff, // Bright natural sunlit moss turf (unattenuated)
    sunColor: 0xfff6dd,
    skyColor: 0x56aef0,
    sunDirection: [0.5, 0.8, 0.35] as const,
  },
  golden: {
    skyZenith: '#223058',
    skyHorizon: '#bd4c45',
    skyHaze: '#fca064',
    mountainFar: '#654157',
    mountainNear: '#583f2a',
    cloudShadowDeep: '#5e385a', // Deep violet-mauve shadows
    cloudShadowMid: '#93546e',
    cloudBody: '#f89e72',       // Warm amber peach body
    cloudHighlight: '#ffeed6',  // Golden sunlit crest
    cloudRimLight: '#fff6e8',
    sunGlow: 'rgba(255, 170, 75, 0.58)',
    grassBase: 0x42661f, // Warm golden-olive root
    grassMid: 0x6b9e28,
    grassTip: 0xf6bf3b,
    groundColor: 0x162008, // Significantly darker warm olive-bronze shaded earth
    sunColor: 0xffad54,
    skyColor: 0xdb684c,
    sunDirection: [-0.6, 0.45, 0.3] as const,
  },
  night: {
    skyZenith: '#020612',
    skyHorizon: '#08142a',
    skyHaze: '#122345',
    mountainFar: '#08101e',
    mountainNear: '#081816',
    cloudShadowDeep: '#060c18',
    cloudShadowMid: '#162238',
    cloudBody: '#283b58',
    cloudHighlight: '#5a759c',
    cloudRimLight: '#94b2da',
    sunGlow: 'rgba(199, 210, 254, 0.32)',
    grassBase: 0x114637, // Luminous teal-emerald night root
    grassMid: 0x186b53,
    grassTip: 0x34d399,
    groundColor: 0x071b14, // Deep moonlit shadowed nocturnal turf
    sunColor: 0xa5b4fc,
    skyColor: 0x0d1a33,
    sunDirection: [0.2, 0.7, 0.4] as const,
  },
};

export function createAtmosphereTheme(time: TimeOfDay): AtmosphereTheme {
  const d = THEME_DATA[time];
  return {
    skyZenith: d.skyZenith,
    skyHorizon: d.skyHorizon,
    skyHaze: d.skyHaze,
    mountainFar: d.mountainFar,
    mountainNear: d.mountainNear,
    cloudShadowDeep: d.cloudShadowDeep,
    cloudShadowMid: d.cloudShadowMid,
    cloudBody: d.cloudBody,
    cloudHighlight: d.cloudHighlight,
    cloudRimLight: d.cloudRimLight,
    sunGlow: d.sunGlow,
    grassBase: new THREE.Color(d.grassBase),
    grassMid: new THREE.Color(d.grassMid),
    grassTip: new THREE.Color(d.grassTip),
    groundColor: new THREE.Color(d.groundColor),
    sunColor: new THREE.Color(d.sunColor),
    skyColor: new THREE.Color(d.skyColor),
    sunDirection: new THREE.Vector3(...d.sunDirection).normalize(),
  };
}

export const THEMES: Record<TimeOfDay, AtmosphereTheme> = {
  get day() {
    return createAtmosphereTheme('day');
  },
  get golden() {
    return createAtmosphereTheme('golden');
  },
  get night() {
    return createAtmosphereTheme('night');
  },
};

/**
 * Procedural generator for painterly Studio Ghibli Anime Kumulus-Wolken ("Hubulus").
 * Creates a soaring Cumulonimbus cloud tower with authentic per-lobe volumetric shading.
 */
export class SkyCloudGenerator {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;

  constructor(width = 2048, height = 1536) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create 2D canvas context for sky texture');
    }
    this.ctx = context;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  /**
   * Renders the complete anime sky backdrop with towering fluffy Kumulus clouds.
   */
  render(timeOfDay: TimeOfDay): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const theme = THEMES[timeOfDay];

    ctx.clearRect(0, 0, width, height);

    // 1. Sky Gradient (Deep azure blue at zenith down to radiant horizon)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.9);
    skyGrad.addColorStop(0.0, theme.skyZenith);
    skyGrad.addColorStop(0.35, theme.skyZenith);
    skyGrad.addColorStop(0.70, theme.skyHorizon);
    skyGrad.addColorStop(0.92, theme.skyHaze);
    skyGrad.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Radiant Sun / Ambient Glow
    const sunX = timeOfDay === 'golden' ? width * 0.22 : width * 0.78;
    const sunY = timeOfDay === 'golden' ? height * 0.45 : height * 0.15;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, width * 0.48);
    sunGrad.addColorStop(0.0, theme.sunGlow);
    sunGrad.addColorStop(0.35, theme.sunGlow.replace(/[\d.]+\)$/, '0.14)'));
    sunGrad.addColorStop(1.0, 'transparent');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, width, height);

    // Night stars & Moon
    if (timeOfDay === 'night') {
      this.drawStars(ctx, width, height * 0.75);
      this.drawMoon(ctx, width * 0.78, height * 0.15, 38);
    }

    // 3. Towering Studio Ghibli Kumulus Cloud ("Hubulus") - Iconic Vertical Pillar (Image 2)
    this.drawPainterlyCumulus(ctx, width, height, theme, timeOfDay);

    // 4. Secondary Drifting Fluffy Clouds on the left horizon
    this.drawSecondaryClouds(ctx, width, height, theme, timeOfDay);

    // 5. Far Distant Rolling Green Foothills & Mountains
    this.drawHorizonLandscape(ctx, width, height, theme);

    this.texture.needsUpdate = true;
  }

  /**
   * Draws the majestic towering Kumulus cloud pillar using stacked organic billows.
   */
  private drawPainterlyCumulus(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: AtmosphereTheme,
    timeOfDay: TimeOfDay
  ): void {
    ctx.save();

    // Tower stands slightly right of center, flanked by radiant blue sky
    const towerX = width * 0.54;
    const towerBaseY = height * 0.78;

    // Ordered from back/bottom to front/top: [relX, relY, radius, zOrder]
    const billows: [number, number, number][] = [
      // Foundation (Back/Lower)
      [-0.18, 0.05, 230],
      [0.18, 0.04, 220],
      [-0.02, 0.06, 250],
      [-0.14, -0.05, 210],
      [0.14, -0.06, 210],
      [0.0, -0.04, 230],

      // Mid-lower flanks
      [-0.16, -0.16, 180],
      [0.16, -0.17, 185],
      [-0.02, -0.15, 205],
      [-0.12, -0.27, 165],
      [0.14, -0.28, 170],
      [0.02, -0.26, 190],

      // Upper mid tiers
      [-0.09, -0.38, 145],
      [0.11, -0.39, 150],
      [0.01, -0.37, 165],
      [-0.06, -0.48, 125],
      [0.07, -0.49, 130],
      [0.0, -0.47, 140],

      // Summit peak puffs (top of the majestic tower)
      [-0.03, -0.58, 95],
      [0.04, -0.57, 100],
      [0.0, -0.64, 80],
    ];

    // Light direction vector for volumetric shading
    const sunAngle = timeOfDay === 'golden' ? Math.PI * 0.75 : -Math.PI * 0.32;

    // Draw each billow with individual 3D spherical directional shading
    for (const [rx, ry, rad] of billows) {
      const px = towerX + rx * width;
      const py = towerBaseY + ry * height;
      this.drawShadedBillow(ctx, px, py, rad, theme, sunAngle);
    }

    ctx.restore();
  }

  /**
   * Draws a single organic cloud billow with rich directional lighting (sunlit top, deep shadow bottom).
   */
  private drawShadedBillow(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    theme: AtmosphereTheme,
    sunAngle: number
  ): void {
    ctx.save();

    // 1. Drop shadow behind the billow to create deep crevasses between overlapping lobes
    ctx.shadowColor = theme.cloudShadowDeep;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = -Math.cos(sunAngle) * 8;
    ctx.shadowOffsetY = -Math.sin(sunAngle) * 8;

    // 2. Base directional gradient: Sunlit crest to deep underside shadow
    const lx1 = cx + Math.cos(sunAngle) * (radius * 0.85);
    const ly1 = cy + Math.sin(sunAngle) * (radius * 0.85);
    const lx2 = cx - Math.cos(sunAngle) * (radius * 0.95);
    const ly2 = cy - Math.sin(sunAngle) * (radius * 0.95);

    const grad = ctx.createLinearGradient(lx1, ly1, lx2, ly2);
    grad.addColorStop(0.0, theme.cloudHighlight);
    grad.addColorStop(0.25, theme.cloudRimLight);
    grad.addColorStop(0.55, theme.cloudBody);
    grad.addColorStop(0.80, theme.cloudShadowMid);
    grad.addColorStop(1.0, theme.cloudShadowDeep);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow for sub-lobes
    ctx.shadowColor = 'transparent';

    // 3. Natural cauliflower sub-lobes on the edge
    const subPuffs = 6;
    for (let i = 0; i < subPuffs; i++) {
      const angle = (i / subPuffs) * Math.PI * 2 + (i % 2) * 0.22;
      const dist = radius * 0.58;
      const subR = radius * (0.38 + ((i % 3) * 0.08));
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;

      const slx1 = sx + Math.cos(sunAngle) * (subR * 0.85);
      const sly1 = sy + Math.sin(sunAngle) * (subR * 0.85);
      const slx2 = sx - Math.cos(sunAngle) * (subR * 0.95);
      const sly2 = sy - Math.sin(sunAngle) * (subR * 0.95);

      const subGrad = ctx.createLinearGradient(slx1, sly1, slx2, sly2);
      subGrad.addColorStop(0.0, theme.cloudHighlight);
      subGrad.addColorStop(0.3, theme.cloudRimLight);
      subGrad.addColorStop(0.6, theme.cloudBody);
      subGrad.addColorStop(0.85, theme.cloudShadowMid);
      subGrad.addColorStop(1.0, theme.cloudShadowDeep);

      ctx.fillStyle = subGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, subR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Subtle bright highlight touch on the sunlit crest
    const hx = cx + Math.cos(sunAngle) * (radius * 0.45);
    const hy = cy + Math.sin(sunAngle) * (radius * 0.45);
    const hGrad = ctx.createRadialGradient(hx, hy, radius * 0.05, hx, hy, radius * 0.45);
    hGrad.addColorStop(0.0, theme.cloudHighlight);
    hGrad.addColorStop(0.6, theme.cloudRimLight);
    hGrad.addColorStop(1.0, 'transparent');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(hx, hy, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draws secondary soft clouds drifting across the blue sky on the left.
   */
  private drawSecondaryClouds(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: AtmosphereTheme,
    timeOfDay: TimeOfDay
  ): void {
    const sunAngle = timeOfDay === 'golden' ? Math.PI * 0.75 : -Math.PI * 0.32;
    const leftClusters: [number, number, number][] = [
      [width * 0.12, height * 0.46, 85],
      [width * 0.20, height * 0.44, 105],
      [width * 0.26, height * 0.48, 80],
    ];

    for (const [x, y, r] of leftClusters) {
      this.drawShadedBillow(ctx, x, y, r, theme, sunAngle);
    }
  }

  /**
   * Draws distant rolling green hills, trees, and blue mountains on the horizon (matching Image 2).
   */
  private drawHorizonLandscape(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: AtmosphereTheme
  ): void {
    const horizonBase = height * 0.80;

    // 1. Far Blue Mountain Ridge
    ctx.save();
    ctx.fillStyle = theme.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, horizonBase);
    for (let x = 0; x <= width; x += 30) {
      const my = horizonBase - 34 +
        Math.sin(x * 0.0035) * 30 +
        Math.sin(x * 0.009) * 12;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Rolling Green Foothills (Rich Anime Meadows)
    ctx.save();
    ctx.fillStyle = theme.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, horizonBase + 38);
    for (let x = 0; x <= width; x += 25) {
      const hy = horizonBase + 22 +
        Math.sin(x * 0.0042 + 0.8) * 24 +
        Math.cos(x * 0.011) * 10;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Solitary anime trees on the distant hills
    const treePositions = [
      width * 0.14,
      width * 0.19,
      width * 0.42,
      width * 0.84,
    ];

    ctx.fillStyle = '#17421e';
    for (const tx of treePositions) {
      const ty = horizonBase + 26 + Math.sin(tx * 0.0042 + 0.8) * 24;
      ctx.beginPath();
      ctx.arc(tx, ty - 8, 9, 0, Math.PI * 2);
      ctx.arc(tx - 5, ty - 6, 7, 0, Math.PI * 2);
      ctx.arc(tx + 5, ty - 6, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draws stars for night atmosphere.
   */
  private drawStars(ctx: CanvasRenderingContext2D, width: number, maxHeight: number): void {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 220; i++) {
      const sx = (i * 139.7) % width;
      const sy = (i * 83.1) % maxHeight;
      const rad = (i % 6 === 0) ? 2.0 : 1.1;
      const alpha = 0.35 + ((i % 8) / 8) * 0.65;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Draws a glowing crescent moon for night atmosphere.
   */
  private drawMoon(ctx: CanvasRenderingContext2D, mx: number, my: number, rad: number): void {
    ctx.save();
    // Moon glow
    const mGlow = ctx.createRadialGradient(mx, my, rad * 0.5, mx, my, rad * 2.8);
    mGlow.addColorStop(0.0, 'rgba(216, 230, 255, 0.65)');
    mGlow.addColorStop(0.4, 'rgba(165, 180, 252, 0.2)');
    mGlow.addColorStop(1.0, 'transparent');
    ctx.fillStyle = mGlow;
    ctx.beginPath();
    ctx.arc(mx, my, rad * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Moon disc
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx, my, rad, 0, Math.PI * 2);
    ctx.fill();

    // Crescent shadow
    ctx.fillStyle = '#0a1630';
    ctx.beginPath();
    ctx.arc(mx + rad * 0.42, my - rad * 0.15, rad * 0.88, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
