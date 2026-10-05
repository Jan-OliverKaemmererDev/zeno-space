import * as THREE from 'three';

/**
 * Custom GLSL Vertex Shader for flat 2D viewport rendering.
 */
export const MANDELBROT_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Custom GLSL Fragment Shader:
 * Implements high-performance, flicker-free, non-pixelating Perturbation Theory.
 *
 * - Mode 0 (Shallow zoom < 1000): Direct float32 iteration with cardioid optimization.
 * - Mode 1 (Deep zoom >= 1000, up to 10^30): High-speed perturbation iteration:
 *     delta_{n+1} = 2 * Z_n * delta_n + delta_n^2 + delta_c
 *   where Z_n is sampled from a stable CPU-computed reference orbit,
 *   and delta_c = uDeltaCenter + st * uScale provides full sub-pixel accuracy.
 *   If the reference orbit escapes at uRefEscapeIter < uMaxIterations,
 *   un-escaped pixels seamlessly continue direct iteration without artificial truncation.
 */
export const MANDELBROT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uMaxIterations;
  uniform float uScale;
  uniform vec2 uCenter;
  uniform vec2 uDeltaCenter;
  uniform int uMode; // 0 = Direct float32, 1 = Perturbation Theory
  uniform int uRefEscapeIter; // Iteration at which the reference orbit escaped (or 2048)

  // Perturbation uniform (Fixed 2048x1 texture)
  uniform sampler2D uRefOrbit;

  varying vec2 vUv;

  // ---------------------------------------------------------------------------
  // Warm Golden Palette: Deep espresso, bronze, terracotta, amber, champagne
  // ---------------------------------------------------------------------------
  vec3 getWarmGoldenColor(float t) {
    float cycle = mod(t * 0.11 + uTime * 0.012, 1.0);

    vec3 c0 = vec3(0.06, 0.038, 0.025); // Deep obsidian espresso
    vec3 c1 = vec3(0.24, 0.12, 0.06);   // Dark bronze
    vec3 c2 = vec3(0.55, 0.22, 0.08);   // Terracotta
    vec3 c3 = vec3(0.85, 0.48, 0.09);   // Amber gold
    vec3 c4 = vec3(0.98, 0.72, 0.20);   // Sunflower gold
    vec3 c5 = vec3(0.99, 0.94, 0.78);   // Warm ivory champagne

    if (cycle < 0.2) {
      return mix(c0, c1, cycle / 0.2);
    } else if (cycle < 0.4) {
      return mix(c1, c2, (cycle - 0.2) / 0.2);
    } else if (cycle < 0.65) {
      return mix(c2, c3, (cycle - 0.4) / 0.25);
    } else if (cycle < 0.85) {
      return mix(c3, c4, (cycle - 0.65) / 0.2);
    } else if (cycle < 0.95) {
      return mix(c4, c5, (cycle - 0.85) / 0.1);
    } else {
      return mix(c5, c0, (cycle - 0.95) / 0.05);
    }
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 st = vUv - 0.5;
    st.x *= aspect;

    float n = 0.0;
    float dotZ = 0.0;
    bool escaped = false;

    // -------------------------------------------------------------------------
    // Mode 0: Direct float32 iteration for overview (zoom < 1000)
    // -------------------------------------------------------------------------
    if (uMode == 0) {
      vec2 c = uCenter + st * uScale;

      // Cardioid & period-2 bulb check for overview performance
      if (uScale > 0.05) {
        float q = (c.x - 0.25) * (c.x - 0.25) + c.y * c.y;
        if (q * (q + (c.x - 0.25)) < 0.25 * c.y * c.y) {
          gl_FragColor = vec4(0.045, 0.028, 0.018, 1.0);
          return;
        }
        if ((c.x + 1.0) * (c.x + 1.0) + c.y * c.y < 0.0625) {
          gl_FragColor = vec4(0.045, 0.028, 0.018, 1.0);
          return;
        }
      }

      vec2 z = vec2(0.0);
      int maxIterInt = int(min(uMaxIterations, 1000.0));

      for (int i = 0; i < 1000; i++) {
        if (i >= maxIterInt) break;

        float zx2 = z.x * z.x;
        float zy2 = z.y * z.y;
        dotZ = zx2 + zy2;

        if (dotZ > 4.0) {
          n = float(i);
          escaped = true;
          break;
        }

        z = vec2(zx2 - zy2 + c.x, 2.0 * z.x * z.y + c.y);
      }
    }
    // -------------------------------------------------------------------------
    // Mode 1: Perturbation theory for deep zoom (zoom >= 1000, up to 10^30)
    // -------------------------------------------------------------------------
    else {
      // Exact relative coordinate from reference point:
      vec2 dc = uDeltaCenter + st * uScale;
      vec2 delta = vec2(0.0);
      vec2 z = vec2(0.0);

      int maxIterInt = int(min(uMaxIterations, 2048.0));
      int refLimit = min(maxIterInt, uRefEscapeIter);

      // Stage A: High-precision perturbation theory while reference orbit is valid
      for (int i = 0; i < 2048; i++) {
        if (i >= refLimit) break;

        // Fetch Z_i from reference orbit texture (Fixed 2048 width)
        vec2 Z = texture2D(uRefOrbit, vec2((float(i) + 0.5) / 2048.0, 0.5)).xy;

        z = Z + delta;
        float mag2 = dot(z, z);

        if (mag2 > 4.0) {
          escaped = true;
          n = float(i);
          dotZ = mag2;
          break;
        }

        // Perturbation recurrence:
        // delta_{n+1} = 2 * Z * delta + delta^2 + dc
        float twoZ_re = 2.0 * (Z.x * delta.x - Z.y * delta.y);
        float twoZ_im = 2.0 * (Z.x * delta.y + Z.y * delta.x);

        float d2_re = delta.x * delta.x - delta.y * delta.y;
        float d2_im = 2.0 * delta.x * delta.y;

        delta.x = twoZ_re + d2_re + dc.x;
        delta.y = twoZ_im + d2_im + dc.y;
      }

      // Stage B: Direct continuation if reference orbit escaped early and pixel is still unescaped
      if (!escaped && refLimit < maxIterInt) {
        vec2 c = uCenter + st * uScale;
        for (int i = 0; i < 2048; i++) {
          int iter = refLimit + i;
          if (iter >= maxIterInt) break;

          float zx2 = z.x * z.x;
          float zy2 = z.y * z.y;
          dotZ = zx2 + zy2;

          if (dotZ > 4.0) {
            escaped = true;
            n = float(iter);
            break;
          }

          z = vec2(zx2 - zy2 + c.x, 2.0 * z.x * z.y + c.y);
        }
      }
    }

    if (!escaped) {
      // Inside Mandelbrot set: obsidian velvet
      gl_FragColor = vec4(0.045, 0.028, 0.018, 1.0);
    } else {
      // Smooth continuous iteration calculation (removes color banding and protects against NaN)
      float safeDotZ = clamp(dotZ, 1.0001, 1.0e10);
      float logZn = log(safeDotZ) * 0.5;
      float nu = clamp(log(max(logZn * 1.442695, 0.0001)) * 1.442695, 0.0, 1.0);
      float smoothIter = n + 1.0 - nu;

      vec3 color = getWarmGoldenColor(smoothIter);

      // Subtle edge vignette
      float edgeDist = length(vUv - 0.5);
      float vignette = smoothstep(0.75, 0.35, edgeDist);
      color *= mix(0.88, 1.0, vignette);

      gl_FragColor = vec4(color, 1.0);
    }
  }
`;

/**
 * Creates a Three.js ShaderMaterial preconfigured for smooth Mandelbrot rendering
 * with Perturbation Theory and warm golden colors.
 */
export function createMandelbrotShaderMaterial(
  orbitTexture: THREE.DataTexture
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: MANDELBROT_VERTEX_SHADER,
    fragmentShader: MANDELBROT_FRAGMENT_SHADER,
    uniforms: {
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uTime: { value: 0.0 },
      uMaxIterations: { value: 120.0 },
      uScale: { value: 3.0 },
      uCenter: { value: new THREE.Vector2(-0.65, 0.0) },
      uDeltaCenter: { value: new THREE.Vector2(0.0, 0.0) },
      uMode: { value: 0 },
      uRefEscapeIter: { value: 2048 },
      uRefOrbit: { value: orbitTexture },
    },
    depthWrite: false,
    depthTest: false,
  });
}
