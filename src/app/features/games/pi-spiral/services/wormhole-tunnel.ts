import * as THREE from 'three';

/**
 * Encapsulates the 3D pixel wormhole tunnel and holographic wall membrane.
 * Handles GPU shader materials, buffer geometries, vertex animation, and resource disposal.
 */
export class WormholeTunnel {
  private wormholePointsMesh: THREE.Points | null = null;
  private wormholeGeometry: THREE.BufferGeometry | null = null;
  private wormholeMaterial: THREE.ShaderMaterial | null = null;
  private readonly wormholeParticleCount = 16000;

  private wormholeMembraneMesh: THREE.Mesh | null = null;
  private wormholeMembraneGeometry: THREE.BufferGeometry | null = null;
  private wormholeMembraneMaterial: THREE.ShaderMaterial | null = null;

  /**
   * Initializes both the holographic membrane and the particle pixel wormhole tunnel,
   * adding them to the specified parent 3D group.
   */
  init(parentGroup: THREE.Group): void {
    this.createWormholeMembrane(parentGroup);
    this.createWormholeParticleTunnel(parentGroup);
  }

  /**
   * Advances time uniforms for both GPU shaders.
   */
  update(time: number): void {
    if (this.wormholeMaterial) {
      this.wormholeMaterial.uniforms['uTime'].value = time;
    }
    if (this.wormholeMembraneMaterial) {
      this.wormholeMembraneMaterial.uniforms['uTime'].value = time;
    }
  }

  /**
   * Constructs the holographic 3D wormhole membrane mesh with Fresnel glow.
   * A translucent, additive curved cylinder skin that sways synchronously along the wormhole spine.
   * Glows vividly at the silhouette edges (cyan & violet), highlighting the inner walls
   * while remaining crystal clear down the center so the decimal digits and particles shine through.
   */
  private createWormholeMembrane(parentGroup: THREE.Group): void {
    const ringCount = 160; // Rings along depth Z
    const segsPerRing = 60; // Circumference segments (cleanly divides by 10 energy ribs)
    const zMin = -360.0;
    const zMax = 80.0; // Extends well past camera to completely envelope viewport
    const zSpan = zMax - zMin;

    const vertexCount = (ringCount + 1) * (segsPerRing + 1);
    const indexCount = ringCount * segsPerRing * 6;

    const positions = new Float32Array(vertexCount * 3);
    const aZ = new Float32Array(vertexCount);
    const aTheta = new Float32Array(vertexCount);
    const indices = new Uint32Array(indexCount);

    let vIdx = 0;
    for (let r = 0; r <= ringCount; r++) {
      const v = r / ringCount;
      const z = zMin + v * zSpan;
      for (let s = 0; s <= segsPerRing; s++) {
        const u = s / segsPerRing;
        const th = u * Math.PI * 2;

        const i = vIdx++;
        aZ[i] = z;
        aTheta[i] = th;
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;
      }
    }

    let iIdx = 0;
    const stride = segsPerRing + 1;
    for (let r = 0; r < ringCount; r++) {
      for (let s = 0; s < segsPerRing; s++) {
        const i1 = r * stride + s;
        const i2 = (r + 1) * stride + s;
        const i3 = (r + 1) * stride + (s + 1);
        const i4 = r * stride + (s + 1);

        indices[iIdx++] = i1;
        indices[iIdx++] = i2;
        indices[iIdx++] = i3;

        indices[iIdx++] = i1;
        indices[iIdx++] = i3;
        indices[iIdx++] = i4;
      }
    }

    this.wormholeMembraneGeometry = new THREE.BufferGeometry();
    this.wormholeMembraneGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.wormholeMembraneGeometry.setAttribute('aZ', new THREE.BufferAttribute(aZ, 1));
    this.wormholeMembraneGeometry.setAttribute('aTheta', new THREE.BufferAttribute(aTheta, 1));
    this.wormholeMembraneGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.wormholeMembraneGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -140), 350);

    this.wormholeMembraneMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        attribute float aZ;
        attribute float aTheta;

        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying float vZ;
        varying float vTheta;
        varying float vDistToCam;

        vec2 getWormholeSpine(float z, float time) {
          if (z >= 0.0) {
            return vec2(0.0, 0.0);
          }
          if (z >= -2.60) {
            float t = -z / 2.60;
            return vec2(3.20 * t, 0.0);
          }
          float d = -2.60 - z;
          float ramp = 1.0 - exp(-0.045 * d);
          float slowTime = time * 0.60;
          float swayX = 10.5 * sin(0.024 * d - slowTime * 0.80) + 4.2 * sin(0.048 * d + slowTime * 0.50 + 0.9);
          float swayY = 7.2 * cos(0.020 * d - slowTime * 0.65) + 3.0 * sin(0.038 * d - slowTime * 0.45 + 1.3);
          float throatDecay = exp(-0.06 * d);
          float x = 3.20 * throatDecay + (1.0 - throatDecay) * (ramp * swayX);
          float y = 0.0 * throatDecay + (1.0 - throatDecay) * (ramp * swayY);
          return vec2(x, y);
        }

        void main() {
          vec2 spine = getWormholeSpine(aZ, uTime);

          float d = max(0.0, -2.60 - aZ);
          float tunnelR = 8.0 + 24.0 * exp(-0.016 * d);
          if (aZ > -2.60) {
            // Expand gently outward behind camera so tube completely encloses viewer
            tunnelR += (aZ - (-2.60)) * 0.35;
          }

          vec3 worldPos = vec3(
            spine.x + tunnelR * cos(aTheta),
            spine.y + tunnelR * sin(aTheta),
            aZ
          );

          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Inward-pointing normal for looking at inner tube wall
          vec3 normalInward = vec3(-cos(aTheta), -sin(aTheta), 0.0);
          vNormal = normalize(normalMatrix * normalInward);
          vViewDir = normalize(-mvPosition.xyz);
          vZ = aZ;
          vTheta = aTheta;
          vDistToCam = -mvPosition.z;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying float vZ;
        varying float vTheta;
        varying float vDistToCam;

        void main() {
          // Fresnel factor: maximum glow at grazing angles along the tube wall boundary
          float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
          fresnel = clamp(fresnel, 0.0, 1.0);
          float edgeGlow = pow(fresnel, 2.0);

          // 10 Longitudinal holographic energy ribs along theta
          float streamWave = sin(vTheta * 10.0 + uTime * 0.45 + vZ * 0.025);
          float streamer = smoothstep(0.62, 0.98, streamWave);

          // Balanced middle-ground animated rings traveling along the wall
          float zFlow = vZ + uTime * 6.0;
          float ringWave = sin(zFlow * 0.125); // Middle ground: wavelength ~50 units
          float ringPulse = smoothstep(0.65, 0.98, ringWave); // Balanced & visible

          // Radiant celestial color palette (Cyan & Violet)
          vec3 colorCyan = vec3(0.22, 0.74, 0.98);   // #38bdf8
          vec3 colorViolet = vec3(0.58, 0.40, 0.96); // #a855f7
          vec3 colorDeep = vec3(0.12, 0.35, 0.88);   // rich electric blue
          vec3 colorCore = vec3(0.85, 0.94, 1.00);   // crystalline ice highlight

          // Color gradient: mystic violet in deep wormhole, celestial cyan near foreground
          float depthMix = smoothstep(-280.0, -15.0, vZ);
          vec3 wallBaseColor = mix(colorViolet, colorCyan, depthMix);
          wallBaseColor = mix(wallBaseColor, colorDeep, (1.0 - edgeGlow) * 0.4);

          vec3 finalColor = mix(wallBaseColor, colorCore, ringPulse * 0.28 + streamer * 0.38);

          // Alpha: crystal clear down the center (0.025), glowing visibly along the cylindrical rim (0.40)
          float centerAlpha = 0.025;
          float rimAlpha = 0.40;
          float pulseAlpha = ringPulse * 0.06 + streamer * 0.07;
          float rawAlpha = centerAlpha + rimAlpha * edgeGlow + pulseAlpha;

          // Depth fade into cosmic infinity and near camera fade
          float depthFade = smoothstep(-360.0, -35.0, vZ);
          // Soft fade at front edge so opening is never cut off
          float frontFade = smoothstep(80.0, 48.0, vZ);
          float nearCamFade = smoothstep(1.5, 6.0, vDistToCam);

          float alpha = rawAlpha * depthFade * nearCamFade * frontFade;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.wormholeMembraneMesh = new THREE.Mesh(this.wormholeMembraneGeometry, this.wormholeMembraneMaterial);
    this.wormholeMembraneMesh.frustumCulled = false;
    this.wormholeMembraneMesh.renderOrder = 0;
    parentGroup.add(this.wormholeMembraneMesh);
  }

  /**
   * Constructs the 3D particle pixel wormhole tunnel spanning the entire background.
   * Uses square pixel shader points (matching orb-nav aesthetics) that form:
   * 1. Concentric illuminated rings / ribs that delineate the cylindrical tube
   * 2. Flowing streamlines / filaments drifting forward along the tube walls
   * 3. Ambient cosmic micro-dust covering the entire background viewport
   * All positions and undulations are computed on the GPU for maximum 120+ FPS smoothness.
   */
  private createWormholeParticleTunnel(parentGroup: THREE.Group): void {
    const count = this.wormholeParticleCount;
    this.wormholeGeometry = new THREE.BufferGeometry();

    const dummyPositions = new Float32Array(count * 3);
    const baseZ = new Float32Array(count);
    const basePos = new Float32Array(count * 3);
    const theta = new Float32Array(count);
    const radiusRatio = new Float32Array(count);
    const speed = new Float32Array(count);
    const rotSpeed = new Float32Array(count);
    const type = new Float32Array(count);
    const sizes = new Float32Array(count);
    const twinklePhases = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    // Warm pastel & cosmic wormhole palette (harmonious with pastel tiles & orb-nav)
    const colorPalette = [
      { r: 1.00, g: 1.00, b: 1.00 }, // Pure sparkling white stars
      { r: 1.00, g: 1.00, b: 1.00 },
      { r: 0.38, g: 0.82, b: 0.99 }, // Radiant celestial cyan
      { r: 0.38, g: 0.82, b: 0.99 },
      { r: 0.76, g: 0.52, b: 0.99 }, // Mystic lavender / violet
      { r: 1.00, g: 0.84, b: 0.60 }, // Warm golden peach
      { r: 0.98, g: 0.46, b: 0.72 }, // Cosmic rose
    ];

    let pIdx = 0;
    const zMin = -360.0;
    const zSpan = 440.0; // from -360.0 to +80.0

    // Layer 1: Concentric Rings & Ribs (balanced middle ground: 36 rings, 100 particles each)
    const ringCount = 36;
    const particlesPerRing = 100;
    const ringSpacing = zSpan / ringCount;

    for (let r = 0; r < ringCount; r++) {
      const ringZ = zMin + r * ringSpacing;
      for (let p = 0; p < particlesPerRing; p++) {
        if (pIdx >= count) break;
        const i = pIdx++;

        baseZ[i] = ringZ + (Math.random() - 0.5) * 0.40;
        theta[i] = (p / particlesPerRing) * Math.PI * 2 + (Math.random() - 0.5) * 0.035;
        radiusRatio[i] = 0.97 + (Math.random() - 0.5) * 0.07;
        speed[i] = 7.5; // Constant uniform forward speed for coherent rings
        rotSpeed[i] = 0.038;
        type[i] = 0.0; // Tunnel ring rib

        sizes[i] = 0.68 + Math.random() * 0.70;
        twinklePhases[i] = Math.random() * Math.PI * 2;
        twinkleSpeeds[i] = 0.5 + Math.random() * 0.9;

        const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;

        dummyPositions[i * 3] = 0;
        dummyPositions[i * 3 + 1] = 0;
        dummyPositions[i * 3 + 2] = ringZ;
      }
    }

    // Layer 2: Longitudinal Filaments & Streamlines (6500 particles for clean, sleek tube flow)
    const filamentCount = 6500;
    for (let f = 0; f < filamentCount; f++) {
      if (pIdx >= count) break;
      const i = pIdx++;

      baseZ[i] = zMin + Math.random() * zSpan;
      theta[i] = Math.random() * Math.PI * 2;
      radiusRatio[i] = 0.88 + Math.random() * 0.26;
      speed[i] = 9.5 + Math.random() * 8.0; // Rapid flowing streamers
      rotSpeed[i] = (Math.random() - 0.5) * 0.15;
      type[i] = 1.0; // Streamline filament

      sizes[i] = 0.65 + Math.random() * 0.75;
      twinklePhases[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.6 + Math.random() * 1.1;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      dummyPositions[i * 3] = 0;
      dummyPositions[i * 3 + 1] = 0;
      dummyPositions[i * 3 + 2] = baseZ[i];
    }

    // Layer 3: Full-Field Ambient Cosmic Dust across entire background (remaining ~5900 particles)
    while (pIdx < count) {
      const i = pIdx++;

      baseZ[i] = zMin + Math.random() * zSpan;
      const ax = (Math.random() - 0.5) * 120.0; // -60 to +60
      const ay = (Math.random() - 0.5) * 84.0;  // -42 to +42
      basePos[i * 3] = ax;
      basePos[i * 3 + 1] = ay;
      basePos[i * 3 + 2] = baseZ[i];

      theta[i] = 0;
      radiusRatio[i] = 1.0;
      speed[i] = 3.8 + Math.random() * 4.2; // Brisk ambient drift
      rotSpeed[i] = 0;
      type[i] = 2.0; // Ambient space dust

      sizes[i] = 0.60 + Math.random() * 0.70;
      twinklePhases[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.4 + Math.random() * 0.8;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      dummyPositions[i * 3] = ax;
      dummyPositions[i * 3 + 1] = ay;
      dummyPositions[i * 3 + 2] = baseZ[i];
    }

    this.wormholeGeometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));
    this.wormholeGeometry.setAttribute('aBaseZ', new THREE.BufferAttribute(baseZ, 1));
    this.wormholeGeometry.setAttribute('aBasePos', new THREE.BufferAttribute(basePos, 3));
    this.wormholeGeometry.setAttribute('aTheta', new THREE.BufferAttribute(theta, 1));
    this.wormholeGeometry.setAttribute('aRadiusRatio', new THREE.BufferAttribute(radiusRatio, 1));
    this.wormholeGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    this.wormholeGeometry.setAttribute('aRotSpeed', new THREE.BufferAttribute(rotSpeed, 1));
    this.wormholeGeometry.setAttribute('aType', new THREE.BufferAttribute(type, 1));
    this.wormholeGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.wormholeGeometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(twinklePhases, 1));
    this.wormholeGeometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    this.wormholeGeometry.setAttribute('aBaseColor', new THREE.BufferAttribute(colors, 3));

    this.wormholeGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -140), 350);

    // Custom ShaderMaterial featuring fine square pixel points of orb-nav & GPU tunnel dynamics
    this.wormholeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;

        attribute float aBaseZ;
        attribute vec3 aBasePos;
        attribute float aTheta;
        attribute float aRadiusRatio;
        attribute float aSpeed;
        attribute float aRotSpeed;
        attribute float aType;
        attribute float aSize;
        attribute float aTwinklePhase;
        attribute float aTwinkleSpeed;
        attribute vec3 aBaseColor;

        varying vec3 vColor;
        varying float vSparkle;
        varying float vDepth;
        varying float vDistToCam;
        varying float vType;

        // Dynamic 3D wormhole spine with pronounced curves and faster motion
        vec2 getWormholeSpine(float z, float time) {
          if (z >= 0.0) {
            return vec2(0.0, 0.0);
          }
          if (z >= -2.60) {
            float t = -z / 2.60;
            return vec2(3.20 * t, 0.0);
          }
          float d = -2.60 - z;
          float ramp = 1.0 - exp(-0.045 * d);
          float slowTime = time * 0.60;
          float swayX = 10.5 * sin(0.024 * d - slowTime * 0.80) + 4.2 * sin(0.048 * d + slowTime * 0.50 + 0.9);
          float swayY = 7.2 * cos(0.020 * d - slowTime * 0.65) + 3.0 * sin(0.038 * d - slowTime * 0.45 + 1.3);
          float throatDecay = exp(-0.06 * d);
          float x = 3.20 * throatDecay + (1.0 - throatDecay) * (ramp * swayX);
          float y = 0.0 * throatDecay + (1.0 - throatDecay) * (ramp * swayY);
          return vec2(x, y);
        }

        void main() {
          vType = aType;

          // Seamless loop through space spanning from -360.0 to +80.0
          float zSpan = 440.0;
          float zOffset = aBaseZ + uTime * aSpeed;
          float z = -360.0 + mod(zOffset - (-360.0), zSpan);

          vec2 spine = getWormholeSpine(z, uTime);

          // Tunnel radius: flares out gently towards entrance, tapers to 8.0 in deep cosmic depth
          float d = max(0.0, -2.60 - z);
          float tunnelR = 8.0 + 24.0 * exp(-0.016 * d);
          if (z > -2.60) {
            tunnelR += (z - (-2.60)) * 0.35;
          }

          vec3 worldPos;
          if (aType > 1.5) {
            // Ambient cosmic starfield across full viewport background
            float ambSwayX = sin(uTime * 0.25 + aBasePos.z * 0.02) * 2.2;
            float ambSwayY = cos(uTime * 0.20 + aBasePos.z * 0.02) * 1.8;
            worldPos = vec3(aBasePos.x + ambSwayX, aBasePos.y + ambSwayY, z);
          } else {
            // Wormhole tunnel tube (rings and streamlines)
            float th = aTheta + uTime * aRotSpeed + z * 0.007;
            float r = tunnelR * aRadiusRatio;
            worldPos = vec3(spine.x + r * cos(th), spine.y + r * sin(th), z);
          }

          vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
          float distToCam = -mvPosition.z;
          vDistToCam = distToCam;
          vDepth = -z;

          // Twinkle & Sparkle (orb-nav signature)
          float twWave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
          float sparkle = smoothstep(0.86, 0.995, twWave);
          vSparkle = sparkle;
          vColor = mix(aBaseColor, vec3(1.0), sparkle * 0.70);

          // Fine micro-pixel point size (crisp, delicate pixel dots matching orb-nav)
          float pointPx = (aSize * 42.0) / max(1.0, distToCam);
          if (aType < 0.5) {
            pointPx *= 0.95;
          }
          pointPx *= (1.0 + sparkle * 0.35);
          gl_PointSize = clamp(pointPx, 1.0, 2.6);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vColor;
        varying float vSparkle;
        varying float vDepth;
        varying float vDistToCam;
        varying float vType;

        void main() {
          // Square pixel particle shape (exact signature of orb-nav)
          vec2 coord = abs(gl_PointCoord - 0.5) * 2.0;
          float maxCoord = max(coord.x, coord.y);
          if (maxCoord > 0.90) discard;

          // Soft depth fade into the cosmic background
          float depthFade = smoothstep(380.0, 30.0, vDepth);
          // Soft fade near camera to prevent abrupt popping
          float nearCamFade = smoothstep(1.5, 6.0, vDistToCam);

          // Ring particles have balanced visibility (0.62), filaments and starfield remain crisp (0.78)
          float baseAlpha = (vType < 0.5) ? 0.62 : 0.78;
          float alpha = (baseAlpha + vSparkle * 0.22) * depthFade * nearCamFade;

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.wormholePointsMesh = new THREE.Points(this.wormholeGeometry, this.wormholeMaterial);
    this.wormholePointsMesh.frustumCulled = false;
    parentGroup.add(this.wormholePointsMesh);
  }

  /**
   * Disposes all Three.js geometries, materials, and removes meshes from parent group.
   */
  dispose(parentGroup?: THREE.Group): void {
    if (this.wormholeMembraneMesh) {
      parentGroup?.remove(this.wormholeMembraneMesh);
      this.wormholeMembraneMesh = null;
    }
    if (this.wormholeMembraneGeometry) {
      this.wormholeMembraneGeometry.dispose();
      this.wormholeMembraneGeometry = null;
    }
    if (this.wormholeMembraneMaterial) {
      this.wormholeMembraneMaterial.dispose();
      this.wormholeMembraneMaterial = null;
    }

    if (this.wormholePointsMesh) {
      parentGroup?.remove(this.wormholePointsMesh);
      this.wormholePointsMesh = null;
    }
    if (this.wormholeGeometry) {
      this.wormholeGeometry.dispose();
      this.wormholeGeometry = null;
    }
    if (this.wormholeMaterial) {
      this.wormholeMaterial.dispose();
      this.wormholeMaterial = null;
    }
  }
}
