/**
 * Custom GLSL Shaders for the "Gras-Harmonie" instanced grass rendering,
 * living sky backdrop with meditative breathing, and floating cloud sprites.
 * Designed to authentically reflect the painterly Studio Ghibli art style.
 */

export const GRASS_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute float aColorVariation;
attribute float aBladeSeed;
attribute float aIsFlower;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vColorVar;
varying float vHeightFactor;
varying float vIsFlower;

uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec3 uMousePos;

// Concurrent Directional & Circular Waves (24 concurrent waves rolling across the hills)
// uDirWaveA: xy = origin.xz, zw = dir.xz (if dir == 0: omnidirectional 360-degree wave)
// uDirWaveB: x = time, y = strength, z = speed, w = maxDist
uniform vec4 uDirWaveA[24];
uniform vec4 uDirWaveB[24];

// Multiple concurrent shockwaves (xy = pos.xz, z = time, w = strength)
uniform vec4 uShockwaves[5];

// Windhose / Whirlwind (xy = pos.xz, strength)
uniform vec2 uTornadoPos;
uniform float uTornadoStrength;

// Concurrent Monumental Windstoß Gust Waves (3 waves rolling across the entire prairie)
// uGustWaves: x = time, y = strength, z = speed, w = width
// uGustDirs: xy = dir.xz (normalized travel direction), zw = origin.xz (starting position)
uniform vec4 uGustWaves[3];
uniform vec4 uGustDirs[3];



// Fast procedural noise
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vUv = uv;
  vColorVar = aColorVariation;
  vIsFlower = aIsFlower;

  // Compute base instance origin in world space
  #ifdef USE_INSTANCING
    vec4 instanceOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mat4 instMat = instanceMatrix;
  #else
    vec4 instanceOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mat4 instMat = mat4(1.0);
  #endif

  // Height bending weight: butterweiche quadratische Krümmung
  float h = uv.y;
  float bendWeight = pow(h, 1.85);
  vHeightFactor = h;

  // -------------------------------------------------------------
  // 1. Ambient Rolling Wind Waves (Anime Prairie aesthetic)
  // -------------------------------------------------------------
  vec2 waveCoord = instanceOrigin.xz * 0.09 - uWindDir * (uTime * 1.6);
  float wave1 = noise2D(waveCoord) * 0.75;
  float wave2 = sin(waveCoord.x * 2.2 + waveCoord.y * 1.8 + uTime * 2.0) * 0.25;
  float combinedWave = wave1 + wave2;

  // Natural gust swells
  float gustSwell = sin(uTime * 0.7 + instanceOrigin.x * 0.04) * 0.35 + 0.65;
  vec2 ambientDisp = uWindDir * (combinedWave * gustSwell * uWindStrength * 0.48);

  // Micro-flutter per blade
  float flutter = sin(uTime * 9.0 + aBladeSeed * 30.0) * 0.035 * uWindStrength;
  ambientDisp += uWindDir * (flutter * 0.5);

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 2. Concurrent Directional Bow Waves (Wellen laufen ungestört durch)
  //    - Nahtloser, breiter Fächer (über ca. 240°):
  //      Bei Kreisbewegungen überlappen sich die Wellen nahtlos und fließen
  //      kontinuierlich in alle Richtungen, ohne abrupt abzubrechen.
  //    - Organisches asymmetrisches Wellenprofil:
  //      Rasches, dynamisches Absenken an der Wellenfront;
  //      weiches, elastisches und natürliches Wiederaufrichten des Grases!
  // -------------------------------------------------------------
  vec2 dirWaveDisp = vec2(0.0);
  for (int i = 0; i < 24; i++) {
    float strength = uDirWaveB[i].y;
    if (strength > 0.005) {
      vec2 origin = uDirWaveA[i].xy;
      vec2 dir = uDirWaveA[i].zw;
      float time = uDirWaveB[i].x;
      float speed = uDirWaveB[i].z;
      float maxDist = uDirWaveB[i].w;

      vec2 toBlade = instanceOrigin.xz - origin;
      float dist = length(toBlade);

      if (dist > 0.05) {
        float forwardProj = dot(toBlade, dir);
        float cosTheta = forwardProj / dist; // 1.0 = direkt geradeaus, 0.0 = 90° quer, -0.45 = 117°

        // Breiter, harmonischer Fächer (über ca. 240°):
        // Fließt bei Kreisbewegungen und Kurven nahtlos und weich in alle Richtungen,
        // ohne dass die Welle abrupt abbricht!
        float fanMask = smoothstep(-0.45, 0.25, cosTheta);

        if (fanMask > 0.001) {
          // Wellenfront wandert mit 'speed' durch das Gras über das gesamte Feld
          float currentRadius = time * speed;
          float delta = dist - currentRadius;

          // Asymmetrisches, geschmeidiges Wellenprofil:
          // - Vor dem Kamm (delta >= 0): Rasches, knackiges Absenken beim Eintreffen der Welle (3.4m)
          // - Hinter dem Kamm (delta < 0): Sanftes, elastisches und natürliches Wiederaufrichten (8.0m)
          //   (kein abruptes Zurückschnappen, aber auch kein träges Hängenbleiben)
          float frontThick = 3.4 + currentRadius * 0.02;
          float backThick = 8.0 + currentRadius * 0.04;

          float waveProfile = 0.0;
          if (delta >= 0.0 && delta < frontThick) {
            float normFront = delta / frontThick;
            float halfCos = 0.5 + 0.5 * cos(normFront * 3.14159265);
            waveProfile = halfCos * halfCos;
          } else if (delta < 0.0 && -delta < backThick) {
            float normBack = -delta / backThick;
            waveProfile = pow(1.0 - normBack, 1.85);
          }

          if (waveProfile > 0.001 && currentRadius < maxDist) {
            // Sanftes Ausblenden am Horizont & beim Wellenstart
            float distFade = smoothstep(maxDist, maxDist * 0.85, currentRadius);
            float startFade = smoothstep(0.12, 1.2, currentRadius);

            float waveAmp = strength * waveProfile * fanMask * distFade * startFade;

            // Biegungsrichtung: Fächert nach vorne und radial nach außen
            vec2 radialDir = toBlade / dist;
            vec2 pushDir = normalize(mix(dir, radialDir, 0.60));

            dirWaveDisp += pushDir * (waveAmp * 1.08);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Concurrent Click Shockwaves (Wellen laufen ungestört durch)
  // -------------------------------------------------------------
  vec2 shockwaveDisp = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    float swStrength = uShockwaves[i].w;
    if (swStrength > 0.01) {
      vec2 swPos = uShockwaves[i].xy;
      float swTime = uShockwaves[i].z;
      float distToCenter = distance(instanceOrigin.xz, swPos);
      float currentRadius = swTime * 18.0;
      float ringDelta = distToCenter - currentRadius;
      float frontThick = 2.8;
      float backThick = 8.5; // Sanftes, elastisches Wiederaufrichten des Rings
      float rippleShape = 0.0;
      if (ringDelta >= 0.0 && ringDelta < frontThick) {
        float fNorm = ringDelta / frontThick;
        rippleShape = 0.5 + 0.5 * cos(fNorm * 3.14159);
      } else if (ringDelta < 0.0 && -ringDelta < backThick) {
        float bNorm = -ringDelta / backThick;
        rippleShape = pow(1.0 - bNorm, 2.0);
      }
      if (rippleShape > 0.001 && distToCenter < 55.0) {
        vec2 ringDir = normalize(instanceOrigin.xz - swPos + vec2(0.0001, 0.0001));
        shockwaveDisp += ringDir * (rippleShape * swStrength * 1.15);
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Windhose (Wirbelnder Strudel bei gedrückter Maustaste!)
  // -------------------------------------------------------------
  vec2 tornadoDisp = vec2(0.0);
  if (uTornadoStrength > 0.01) {
    vec2 toTornado = instanceOrigin.xz - uTornadoPos;
    float tDist = length(toTornado);
    float tRadius = 6.8;

    if (tDist < tRadius) {
      float tFactor = 1.0 - (tDist / tRadius);
      float tSmooth = smoothstep(0.0, 1.0, tFactor) * uTornadoStrength;

      // Tangential spinning vortex (counter-clockwise swirl)
      vec2 spinDir = vec2(-toTornado.y, toTornado.x) / (tDist + 0.12);
      // Inward suction pulling blades toward the center
      vec2 inwardDir = -toTornado / (tDist + 0.12);

      // High-frequency spiral travel wave
      float spiralPhase = uTime * 24.0 - tDist * 4.5;
      float spiralRipple = sin(spiralPhase) * 0.35 + 0.65;

      vec2 vortexDir = normalize(spinDir * 0.90 + inwardDir * 0.32);
      tornadoDisp = vortexDir * (tSmooth * spiralRipple * 1.85);
    }
  }

  // -------------------------------------------------------------
  // 5. Sanfte Berührung des Grases direkt am Mauszeiger (Hand streicht durchs Gras)
  // -------------------------------------------------------------
  vec2 mouseBrushDisp = vec2(0.0);
  vec2 toMouse = instanceOrigin.xz - uMousePos.xz;
  float mouseDist = length(toMouse);
  float brushRadius = 2.2;
  if (mouseDist < brushRadius && mouseDist > 0.02) {
    float brushFactor = 1.0 - (mouseDist / brushRadius);
    float smoothBrush = brushFactor * brushFactor * (3.0 - 2.0 * brushFactor);
    vec2 brushDir = normalize(toMouse);
    mouseBrushDisp = brushDir * (smoothBrush * 0.32);
  }

  // -------------------------------------------------------------
  // 6. Mächtige Panorama-Windstoß-Welle über das gesamte Gras
  //    Rollt als gigantische Wellenfront vom Vordergrund über alle Hügel bis zum Horizont
  // -------------------------------------------------------------
  vec2 gustDisp = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    float gustStrength = uGustWaves[i].y;
    if (gustStrength > 0.005) {
      float gustTime = uGustWaves[i].x;
      float gustSpeed = uGustWaves[i].z;
      float gustWidth = uGustWaves[i].w;
      vec2 gustDir = uGustDirs[i].xy;
      vec2 gustOrigin = uGustDirs[i].zw;

      vec2 toBlade = instanceOrigin.xz - gustOrigin;
      float travelDist = dot(toBlade, gustDir);
      float waveFrontDist = gustTime * gustSpeed;

      // Organische Krümmung der Wellenfront entlang der Breite (keine starre Kante)
      vec2 perpDir = vec2(-gustDir.y, gustDir.x);
      float lateralDist = dot(toBlade, perpDir);
      float organicWarp = sin(lateralDist * 0.045 + gustTime * 1.6) * 2.8 + sin(lateralDist * 0.11 - gustTime * 2.2) * 1.2;

      float deltaDist = (travelDist + organicWarp) - waveFrontDist;

      if (abs(deltaDist) < gustWidth && waveFrontDist > 0.5) {
        float norm = deltaDist / gustWidth;
        float halfCos = 0.5 + 0.5 * cos(norm * 3.14159265);
        float mainCrest = pow(halfCos, 1.35);

        // Nachschwingen / Verwehung hinter dem Wellenkamm
        float trailingWake = sin(clamp(-norm, 0.0, 1.0) * 3.14159) * 0.35;

        // Butterweicher Einstieg im Vordergrund und sanftes Ausfaden an den fernen Horizontbergen
        float startFade = smoothstep(0.0, 12.0, waveFrontDist);
        float horizonFade = smoothstep(125.0, 95.0, waveFrontDist);

        float amp = gustStrength * (mainCrest + trailingWake) * startFade * horizonFade;

        // Biegungsrichtung mit sanftem seitlichen Wogen
        vec2 billow = perpDir * (sin(lateralDist * 0.05 + gustTime * 1.4) * 0.18);
        vec2 pushDir = normalize(gustDir + billow);

        gustDisp += pushDir * (amp * 2.5);
      }
    }
  }

  // Total wind vector in world space
  vec2 totalWind = ambientDisp + dirWaveDisp + shockwaveDisp + tornadoDisp + mouseBrushDisp + gustDisp;

  // Transform blade base vertex from local geometry to world space
  #ifdef USE_INSTANCING
    vec4 worldPos = modelMatrix * (instanceMatrix * vec4(position, 1.0));
    vec3 baseNormal = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * normal));
  #else
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec3 baseNormal = normalize(mat3(modelMatrix) * normal);
  #endif

  // Bounded, organic horizontal deformation (Anime / Studio Ghibli Physik)
  float bladeHeightAboveRoot = vHeightFactor * 1.18;
  float rawDisp = length(totalWind) * bendWeight;

  // Halm kann sich maximal um ca. 75% seiner Höhe zur Seite biegen (überdehnt niemals!)
  float maxHorizDisp = bladeHeightAboveRoot * 0.75;
  float actualHorizDisp = maxHorizDisp * (rawDisp / (maxHorizDisp + rawDisp * 0.72));
  vec2 bendDir = (rawDisp > 0.0001) ? normalize(totalWind) : vec2(0.0);

  worldPos.x += bendDir.x * actualHorizDisp;
  worldPos.z += bendDir.y * actualHorizDisp;

  // Sanftes, natürliches Absenken des Grashalms:
  // Bogenlängenerhaltung: Halmspitze senkt sich sanft ab, ABER NIEMALS unter den Boden!
  // Maximale Absenkung ist streng auf 18% der Halmhöhe über der Wurzel begrenzt.
  float bendRatio = clamp(actualHorizDisp / max(bladeHeightAboveRoot, 0.001), 0.0, 0.85);
  float maxDrop = bladeHeightAboveRoot * 0.18;
  float drop = maxDrop * (bendRatio * bendRatio);
  worldPos.y -= drop;

  // Model-view and projection
  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;

  // Butterweich deformierte Welt-Normalen für flüssige Cel-Shading-Reflexionen
  vec3 deformedNormal = baseNormal;
  deformedNormal.x += bendDir.x * bendRatio * 0.65;
  deformedNormal.z += bendDir.y * bendRatio * 0.65;
  deformedNormal.y -= bendRatio * 0.25;
  vNormal = normalize(deformedNormal);
  vWorldPos = worldPos.xyz;
}
`;

export const GRASS_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vColorVar;
varying float vHeightFactor;
varying float vIsFlower;

uniform vec3 uBaseColor;      // Deep emerald root
uniform vec3 uMidColor;       // Vibrant fresh leaf green
uniform vec3 uTipColor;       // Sunlit golden chartreuse
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform float uTimeOfDay;     // 0 = Day, 1 = Golden Hour, 2 = Night

void main() {
  // 1. Height-based painterly color gradient
  vec3 rootCol = mix(uBaseColor, uBaseColor * 1.10, vColorVar);
  vec3 midCol  = mix(uMidColor, uMidColor * 1.14, vColorVar);
  vec3 tipCol  = mix(uTipColor, uTipColor * 1.18, vColorVar);

  vec3 bladeColor;
  if (vHeightFactor < 0.45) {
    bladeColor = mix(rootCol, midCol, vHeightFactor / 0.45);
  } else {
    bladeColor = mix(midCol, tipCol, (vHeightFactor - 0.45) / 0.55);
  }

  // Zarte rosa/korallene Wildblumen-Akzente wie im Referenzbild
  if (vIsFlower > 0.5 && vHeightFactor > 0.70) {
    vec3 flowerColor = mix(vec3(0.96, 0.48, 0.56), vec3(0.98, 0.64, 0.70), vColorVar);
    float flowerBlend = smoothstep(0.70, 0.94, vHeightFactor);
    bladeColor = mix(bladeColor, flowerColor, flowerBlend);
  }

  // 2. Künstlerische Beleuchtung (Ghibli Toon & Backlight-Transmission)
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunDirection);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdotL = dot(N, L);

  // Weiche zweiseitige Grundbeleuchtung
  float lightIntensity = max(abs(NdotL), 0.46);

  // Sanfte Cel-Shading-Bänderung mit warmem Grundlicht
  float toonShade = smoothstep(0.15, 0.40, lightIntensity) * 0.32 +
                    smoothstep(0.55, 0.80, lightIntensity) * 0.35 + 0.48;

  // Durchlicht-Glimmen (Sonnenstrahlen scheinen durch das saftige Gras)
  float backlight = max(0.0, dot(V, -L));
  float transmission = pow(backlight, 2.0) * smoothstep(0.25, 0.95, vHeightFactor) * 0.42;

  // Sanftes Randlicht (Silhouette im Gegenlicht)
  float rim = pow(1.0 - max(0.0, dot(V, N)), 2.6) * 0.32;

  // Samtiger, künstlerischer Seidenglanz (kein harter Plastik-Specular!)
  vec3 H = normalize(L + V);
  float hairSheen = pow(max(0.0, dot(N, H)), 6.0) * smoothstep(0.40, 0.95, vHeightFactor) * 0.25;

  // Wurzeln bleiben voll durchgefärbt und saftig grün (keine Schwärzung!)
  float rootLight = mix(0.90, 1.0, smoothstep(0.0, 0.30, vHeightFactor));

  vec3 litGrass = bladeColor * (toonShade + transmission) * uSunColor * rootLight;
  vec3 finalColor = litGrass + (rim + hairSheen) * uTipColor;

  // Atmosphärischer Horizont-Dunst
  float dist = length(vWorldPos - cameraPosition);
  float fogFactor = smoothstep(25.0, 68.0, dist);
  finalColor = mix(finalColor, uSkyColor, fogFactor * 0.42);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

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
  // 1. Panoramic aspect matching:
  // Visible width at z = -84: H_vis ~ 96.52.
  // wTex ensures the backdrop covers the full view frustum horizontally
  // without being cut off on widescreen (21:9, 32:9) while preserving the exact
  // original framing on standard 16:9 displays (aspect <= 1.79).
  float wTex = max(215.0, 113.9 * uAspect);
  float hTex = 120.0;

  // Center-anchored UV coordinates
  vec2 baseUv = vec2(
    0.5 + vPlanePos.x / wTex,
    clamp(0.5 + vPlanePos.y / hTex, 0.001, 0.999)
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
