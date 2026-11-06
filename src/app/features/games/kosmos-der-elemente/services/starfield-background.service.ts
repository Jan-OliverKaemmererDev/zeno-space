import * as THREE from 'three';

/**
 * Service providing a deep background starry sky with 3,500 fine, delicate points of light.
 * All particles are situated exclusively in the deep distant cosmic background (behind all 3D content).
 * Fog is explicitly disabled on the star material so scene fog does not extinguish the stars.
 */
export class StarfieldBackgroundService {
  private starfieldPoints: THREE.Points | null = null;
  private starfieldMaterial: THREE.PointsMaterial | null = null;
  private particleGlowTexture: THREE.CanvasTexture | null = null;
  private backgroundGroup = new THREE.Group();

  /**
   * Initializes and attaches the distant starfield to the scene.
   */
  init(scene: THREE.Scene): THREE.Group {
    this.createDistantStarfield();
    scene.add(this.backgroundGroup);
    return this.backgroundGroup;
  }

  /**
   * Generates a soft, circular radial glow texture for realistic star discs.
   */
  private createParticleGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.85)');
      gradient.addColorStop(0.65, 'rgba(255,255,255,0.3)');
      gradient.addColorStop(1, 'rgba(255,255,255,0.0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 16, 16);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  /**
   * Creates 3,500 fine, delicate starlight pinpricks strictly located in the distant background.
   */
  private createDistantStarfield(): void {
    if (!this.particleGlowTexture) {
      this.particleGlowTexture = this.createParticleGlowTexture();
    }

    const starCount = 3500;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const baseStarColor = new THREE.Color(0xffffff);

    for (let i = 0; i < starCount; i++) {
      // Broad deep cosmic volume strictly behind the scene (Z between -25.0 and -140.0)
      positions[i * 3] = (Math.random() - 0.5) * 440;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 2] = -25.0 - Math.random() * 115.0;

      // Natural stellar magnitude brightness variation (like Stellaris background stars)
      const brightness = 0.35 + Math.random() * 0.65;
      const tint = (Math.random() - 0.5) * 0.14;
      colors[i * 3] = Math.min(1, Math.max(0, (baseStarColor.r + tint) * brightness));
      colors[i * 3 + 1] = Math.min(1, Math.max(0, baseStarColor.g * brightness));
      colors[i * 3 + 2] = Math.min(1, Math.max(0, (baseStarColor.b - tint) * brightness));
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Fine, delicate glowing points of light
    this.starfieldMaterial = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      map: this.particleGlowTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      fog: false, // Critical: prevent scene fog from extinguishing distant stars!
    });

    this.starfieldPoints = new THREE.Points(starGeo, this.starfieldMaterial);
    this.starfieldPoints.frustumCulled = false;
    this.backgroundGroup.add(this.starfieldPoints);
  }

  /**
   * Updates subtle background celestial rotation on every frame.
   *
   * @param elapsed - Total elapsed time in seconds.
   */
  update(elapsed: number): void {
    if (this.starfieldPoints) {
      this.starfieldPoints.rotation.y = elapsed * 0.0015;
    }
  }

  /**
   * Cleanly disposes Three.js geometries and materials.
   */
  destroy(scene?: THREE.Scene): void {
    if (this.starfieldPoints) {
      this.starfieldPoints.geometry.dispose();
      this.starfieldMaterial?.dispose();
      this.backgroundGroup.remove(this.starfieldPoints);
      this.starfieldPoints = null;
    }
    if (this.particleGlowTexture) {
      this.particleGlowTexture.dispose();
      this.particleGlowTexture = null;
    }
    if (scene) {
      scene.remove(this.backgroundGroup);
    }
  }
}
