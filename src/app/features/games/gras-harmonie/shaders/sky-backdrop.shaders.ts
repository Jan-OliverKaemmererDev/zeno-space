/**
 * Shaders for the monumental Ghibli cumulus backdrop plane
 * with meditative breathing and living wind animation (wie Landing Page).
 */
export const SKY_BACKDROP_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec2 vPlanePos;

void main() {
  vUv = uv;
  vPlanePos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_BACKDROP_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vPlanePos;

uniform sampler2D uSkyTexture;
uniform float uTime;
uniform float uTimeOfDay; // 0 = day, 1 = golden, 2 = night
uniform float uGoldenWeight;
uniform float uNightWeight;
uniform vec3 uTint;
uniform float uAspect;
uniform vec3 uSkyColor;

// Fast 2D Hash (wie auf der Landing-Page)
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

// Distance from point p to line segment between a and b (für Sternschnuppen)
float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.00001), 0.0, 1.0);
  return length(pa - ba * h);
}

// Zarte, hauchdünne Sternschnuppen (fein & messerscharf wie am echten Nachthimmel)
float shootingStar(vec2 uv, float time, float seed, float cycleTime, float aspect) {
  float t = time + seed * 19.41;
  float cycleId = floor(t / cycleTime);
  float progress = fract(t / cycleTime);

  vec2 r = hash2(vec2(cycleId, seed * 7.13));

  // Aktives Zeitfenster (~14% des Zyklus fliegen, dann friedliche Pause)
  float activeDuration = 0.14;
  if (progress > activeDuration) return 0.0;

  float flight = progress / activeDuration; // 0.0 -> 1.0 Flugphase

  // Flugbahn in seitenverhältnis-korrigierten Koordinaten
  float startX = (0.10 + 0.80 * r.x) * aspect;
  float startY = 0.68 + 0.28 * r.y;
  vec2 startPos = vec2(startX, startY);

  // Sanfter diagonaler Schweif nach unten-links (~-150 bis -165 Grad)
  float angle = -2.62 - 0.35 * (r.y - 0.5);
  vec2 dir = vec2(cos(angle), sin(angle));

  // Reisedistanz
  float speedDist = (0.30 + 0.15 * r.x) * aspect;
  vec2 head = startPos + dir * (speedDist * flight);

  // Schweiflänge
  float tailLength = 0.14 + 0.08 * r.y;
  vec2 tail = head - dir * tailLength;

  vec2 p = vec2(uv.x * aspect, uv.y);

  float h;
  float dist = segDist(p, head, tail, h);

  // Hauchfeiner, zarter Schweif (fein und filigran statt dicker Balken)
  float width = mix(0.00065, 0.00010, h);
  float trailFade = pow(1.0 - h, 2.8);

  float streak = smoothstep(width, 0.0, dist) * trailFade;
  float halo = smoothstep(width * 2.2, 0.0, dist) * trailFade * 0.16;

  float headDist = length(p - head);
  float headGlow = smoothstep(0.0014, 0.0002, headDist) * 0.95;

  float life = sin(flight * 3.14159265);
  float skyMask = smoothstep(0.20, 0.45, head.y);

  return (streak + halo + headGlow) * life * skyMask;
}

void main() {
  // 1. Panoramic aspect matching & zero distortion:
  // Strictly enforce the exact 1376/768 (1.79167) aspect ratio so the clouds
  // are 100% natural and completely undistorted (no stretching, no squashing).
  float imgAspect = 1376.0 / 768.0; // 1.7916667
  float wTex = max(185.0, 98.0 * uAspect);
  float hTex = wTex / imgAspect;
  float yHorizonOffset = 0.04;

  // Undistorted UV coordinates
  float rawUvY = yHorizonOffset + (vPlanePos.y / hTex);
  vec2 baseUv = vec2(
    0.5 + vPlanePos.x / wTex,
    clamp(rawUvY, 0.001, 0.999)
  );

  // 2. Sanftes meditatives Atmen (wie auf der Landing-Page)
  float breath = sin(uTime * 0.25);
  float breatheZoom = 1.018 + breath * 0.013;
  vec2 texUv = (baseUv - 0.5) / breatheZoom + 0.5;

  // 3. Lebendiger Himmels-Wind (subtile organische Wellenbewegung in den Wolken)
  vec2 wind = vec2(
    sin(texUv.y * 3.2 + uTime * 0.15) * 0.0028 + cos(texUv.x * 2.5 + uTime * 0.11) * 0.0018,
    cos(texUv.x * 2.9 + uTime * 0.13) * 0.0022
  );
  vec2 sampledUv = texUv + wind;

  vec4 texColor = texture2D(uSkyTexture, sampledUv);

  // 4. Sonnen-Pulsieren auf den sonnenbeschienenen Wolkenkämmen
  float luma = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
  float sunPulse = (sin(uTime * 0.65 + texUv.x * 2.2) * 0.5 + 0.5) * 0.08;
  vec3 baseColor = texColor.rgb + vec3(0.14, 0.09, 0.04) * sunPulse * smoothstep(0.55, 0.95, luma);

  // Sanfte Himmels-Verschmelzung am oberen Rand ins unendliche Zen-Blau
  float topSkyFade = smoothstep(0.92, 1.02, rawUvY);
  baseColor = mix(baseColor, uSkyColor, topSkyFade);

  // 5. Atmosphären-Tönung für Goldene Stunde und Nacht (weicher Übergang)
  float goldenW = uGoldenWeight;
  float nightW = uNightWeight;
  if (goldenW <= 0.0001 && nightW <= 0.0001) {
    if (uTimeOfDay > 0.5 && uTimeOfDay < 1.5) goldenW = 1.0;
    else if (uTimeOfDay >= 1.5) nightW = 1.0;
  }

  if (goldenW > 0.001) {
    // Golden Hour: Warme Bernstein- und Pfirsichtöne
    vec3 goldenTint = vec3(1.15, 0.88, 0.65);
    vec3 goldenColor = mix(baseColor * goldenTint, vec3(0.95, 0.55, 0.35) * luma, 0.32);
    baseColor = mix(baseColor, goldenColor, goldenW);
  }

  if (nightW > 0.001) {
    // 1. Wolken faden sanft vollständig aus in einen tiefen, samtigen Mitternachtshimmel
    vec3 deepNightSky = mix(vec3(0.012, 0.024, 0.052), vec3(0.002, 0.006, 0.016), smoothstep(0.15, 0.95, vUv.y));
    baseColor = mix(baseColor, deepNightSky, nightW);

    // 2. Sternenhimmel wie auf der Landing-Page (Feinstaub, Kristallsterne & Sternschnuppen)
    float starSkyVis = smoothstep(0.12, 0.40, vUv.y);
    float starAspect = max(1.2, uAspect * 1.8);

    // Ebene 1: Zarter Hintergrund-Sternenstaub
    vec2 starCoord1 = vUv * vec2(starAspect * 42.0, 42.0);
    vec2 cell1 = floor(starCoord1);
    vec2 frac1 = fract(starCoord1);
    vec2 rnd1 = hash2(cell1);
    float microStars = 0.0;
    if (rnd1.x > 0.28) {
      vec2 pos1 = 0.15 + 0.70 * hash2(cell1 + 3.17);
      float d1 = length(frac1 - pos1);
      float tw1 = sin(uTime * (1.1 + rnd1.y * 1.8) + rnd1.x * 6.28) * 0.35 + 0.65;
      microStars = smoothstep(0.018, 0.001, d1) * tw1 * (0.40 + 0.60 * rnd1.y);
    }

    // Ebene 2: Funkelnde Kristallsterne mit sanftem Glanz-Halo
    vec2 starCoord2 = vUv * vec2(starAspect * 16.0, 16.0);
    vec2 cell2 = floor(starCoord2);
    vec2 frac2 = fract(starCoord2);
    vec2 rnd2 = hash2(cell2);
    float crystalStars = 0.0;
    vec3 starColor = vec3(0.90, 0.96, 1.0);
    if (rnd2.x > 0.52) {
      vec2 pos2 = 0.20 + 0.60 * hash2(cell2 + 8.91);
      float d2 = length(frac2 - pos2);
      float tw2 = pow(sin(uTime * (1.4 + rnd2.y * 2.1) + rnd2.x * 6.28) * 0.5 + 0.5, 1.6);
      float core = smoothstep(0.020, 0.002, d2);
      float halo = smoothstep(0.055, 0.005, d2) * 0.32;
      crystalStars = (core + halo) * tw2 * (0.55 + 0.45 * rnd2.y);
      starColor = mix(vec3(0.85, 0.94, 1.00), vec3(1.00, 0.96, 0.88), rnd2.y);
    }

    // Ebene 3: Elegante Sternschnuppen (diagonal gleitend wie Landing-Page)
    float shoot1 = shootingStar(vUv, uTime, 1.0, 7.2, starAspect);
    float shoot2 = shootingStar(vUv, uTime, 2.7, 11.8, starAspect);
    float shoot3 = shootingStar(vUv, uTime, 5.4, 16.5, starAspect);
    vec3 colShoot = vec3(0.94, 0.97, 1.00);

    vec3 starsComposite = vec3(0.86, 0.93, 1.00) * microStars * 0.65 +
                          starColor * crystalStars * 0.85 +
                          colShoot * (shoot1 + shoot2 + shoot3) * 0.85;

    baseColor += starsComposite * starSkyVis * nightW;
  }

  // 6. Weiche atmosphärische Himmelsüberblendung an den extremen Flanken (Sicherheit bei >48:9)
  float edgeAtmosphere = smoothstep(270.0, 315.0, abs(vPlanePos.x));
  baseColor = mix(baseColor, uSkyColor, edgeAtmosphere);

  gl_FragColor = vec4(baseColor * uTint, 1.0);
}
`;
