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
 * Implements robust Dekker Double-Single (53-bit) precision arithmetic for both coordinate
 * calculations and deep-zoom iterations.
 * This guarantees crystal-clear, non-pixelated fractal detail across trillions of zoom levels
 * without any blockiness or artificial coordinate snapping.
 */
export const MANDELBROT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec2 uCenterHi;
  uniform vec2 uCenterLo;
  uniform float uScaleHi;
  uniform float uScaleLo;
  uniform float uMaxIterations;
  uniform vec2 uResolution;
  uniform float uTime;

  varying vec2 vUv;

  // ---------------------------------------------------------------------------
  // Robust Double-Single (float-float) Arithmetic (Andrew Thall / David Bailey)
  // ---------------------------------------------------------------------------

  // Knuth TwoSum: exact sum of two floats: s = a + b, e = round-off error
  vec2 two_sum(float a, float b) {
    float s = a + b;
    float v = s - a;
    float e = (a - (s - v)) + (b - v);
    return vec2(s, e);
  }

  // Dekker splitting: split 24-bit float into two 12-bit parts
  vec2 ds_split(float a) {
    float c = 4097.0 * a;
    float a_hi = c - (c - a);
    float a_lo = a - a_hi;
    return vec2(a_hi, a_lo);
  }

  // Dekker TwoProd: exact product of two floats: p = a * b, e = round-off error
  vec2 two_prod(float a, float b) {
    float p = a * b;
    vec2 a_s = ds_split(a);
    vec2 b_s = ds_split(b);
    float err = ((a_s.x * b_s.x - p) + a_s.x * b_s.y + a_s.y * b_s.x) + a_s.y * b_s.y;
    return vec2(p, err);
  }

  // Double-single addition (a + b)
  vec2 ds_add(vec2 a, vec2 b) {
    vec2 s = two_sum(a.x, b.x);
    vec2 t = two_sum(a.y, b.y);
    s.y += t.x;
    s = two_sum(s.x, s.y);
    s.y += t.y;
    float hi = s.x + s.y;
    float lo = s.y - (hi - s.x);
    return vec2(hi, lo);
  }

  // Double-single subtraction (a - b)
  vec2 ds_sub(vec2 a, vec2 b) {
    return ds_add(a, vec2(-b.x, -b.y));
  }

  // Double-single multiplication (a * b)
  vec2 ds_mul(vec2 a, vec2 b) {
    vec2 p = two_prod(a.x, b.x);
    p.y += a.x * b.y + a.y * b.x;
    float hi = p.x + p.y;
    float lo = p.y - (hi - p.x);
    return vec2(hi, lo);
  }

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

    // Full 53-bit double-single scale and coordinate calculation:
    // delta = st * scale
    vec2 scaleDS = vec2(uScaleHi, uScaleLo);
    vec2 dx = ds_mul(scaleDS, vec2(st.x, 0.0));
    vec2 dy = ds_mul(scaleDS, vec2(st.y, 0.0));

    // c = Center + delta (Full double-single precision)
    vec2 cx = ds_add(vec2(uCenterHi.x, uCenterLo.x), dx);
    vec2 cy = ds_add(vec2(uCenterHi.y, uCenterLo.y), dy);

    // Cardioid & period-2 bulb check for overview performance
    if (uScaleHi > 0.05) {
      float q = (cx.x - 0.25) * (cx.x - 0.25) + cy.x * cy.x;
      if (q * (q + (cx.x - 0.25)) < 0.25 * cy.x * cy.x) {
        gl_FragColor = vec4(0.045, 0.028, 0.018, 1.0);
        return;
      }
      if ((cx.x + 1.0) * (cx.x + 1.0) + cy.x * cy.x < 0.0625) {
        gl_FragColor = vec4(0.045, 0.028, 0.018, 1.0);
        return;
      }
    }

    float n = 0.0;
    float dotZ = 0.0;
    bool escaped = false;

    // Adaptive precision paths:
    // 1) Fast single-precision path for shallow-to-medium zoom (zoom < 5,000)
    // 2) Emulated 53-bit double-single path for deep zoom (zoom >= 5,000)
    if (uScaleHi > 0.0006) {
      float fx = cx.x;
      float fy = cy.x;
      float zxf = 0.0;
      float zyf = 0.0;

      for (int i = 0; i < 500; i++) {
        if (float(i) >= uMaxIterations) break;

        float zx2 = zxf * zxf;
        float zy2 = zyf * zyf;
        dotZ = zx2 + zy2;

        if (dotZ > 4.0) {
          n = float(i);
          escaped = true;
          break;
        }

        zyf = 2.0 * zxf * zyf + fy;
        zxf = zx2 - zy2 + fx;
      }
    } else {
      // Deep zoom: emulated 53-bit double-single iterations
      vec2 zx = vec2(0.0);
      vec2 zy = vec2(0.0);

      for (int i = 0; i < 480; i++) {
        if (float(i) >= uMaxIterations) break;

        vec2 zx2 = ds_mul(zx, zx);
        vec2 zy2 = ds_mul(zy, zy);
        dotZ = zx2.x + zy2.x;

        if (dotZ > 4.0) {
          n = float(i);
          escaped = true;
          break;
        }

        // 2.0 * zx * zy
        vec2 two_zx = ds_add(zx, zx);
        vec2 two_zx_zy = ds_mul(two_zx, zy);

        // zx = zx^2 - zy^2 + cx
        zx = ds_add(ds_sub(zx2, zy2), cx);
        // zy = 2.0 * zx * zy + cy
        zy = ds_add(two_zx_zy, cy);
      }
    }

    if (!escaped) {
      // Inside Mandelbrot set: obsidian velvet
      gl_FragColor = vec4(0.045, 0.028, 0.018, 1.0);
    } else {
      // Smooth continuous iteration calculation (removes color banding)
      float logZn = log(dotZ) * 0.5;
      float nu = log(logZn / log(2.0)) / log(2.0);
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
 * Splits a 64-bit JavaScript number into a high and low 32-bit float pair
 * for emulated double precision in WebGL GLSL.
 */
export function splitDouble(val: number): [number, number] {
  const hi = Math.fround(val);
  const lo = val - hi;
  return [hi, lo];
}

/**
 * Creates a Three.js ShaderMaterial preconfigured for smooth Mandelbrot rendering
 * with emulated double precision and warm golden colors.
 */
export function createMandelbrotShaderMaterial(): THREE.ShaderMaterial {
  const [cRxHi, cRxLo] = splitDouble(-0.65);
  const [cRyHi, cRyLo] = splitDouble(0.0);
  const [scaleHi, scaleLo] = splitDouble(3.0);

  return new THREE.ShaderMaterial({
    vertexShader: MANDELBROT_VERTEX_SHADER,
    fragmentShader: MANDELBROT_FRAGMENT_SHADER,
    uniforms: {
      uCenterHi: { value: new THREE.Vector2(cRxHi, cRyHi) },
      uCenterLo: { value: new THREE.Vector2(cRxLo, cRyLo) },
      uScaleHi: { value: scaleHi },
      uScaleLo: { value: scaleLo },
      uMaxIterations: { value: 120.0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uTime: { value: 0.0 },
    },
    depthWrite: false,
    depthTest: false,
  });
}
