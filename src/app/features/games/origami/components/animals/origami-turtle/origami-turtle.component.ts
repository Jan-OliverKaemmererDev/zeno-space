import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrigamiPaperStyle } from '../../../models/origami.models';

/**
 * Component representing the Ancient Sea Turtle (Kame / 亀).
 * Contains the authentic 3D geometry definitions, masterwork mesh constructor,
 * and optimal 3/4 hero camera perspective parameters.
 */
@Component({
  selector: 'app-origami-turtle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animal-status-tag" aria-hidden="true">
      <span class="kanji-badge">亀</span>
      <span class="animal-title">Kame // Langlebige Schildkröte</span>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      pointer-events: none;
    }
    .animal-status-tag {
      position: absolute;
      top: 14px;
      left: 18px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(18, 10, 7, 0.55);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(254, 215, 170, 0.22);
      color: #fed7aa;
      font-size: 0.78rem;
      z-index: 6;
      animation: fadeIn 0.4s ease-out;

      .kanji-badge {
        font-size: 0.95rem;
        color: #4ade80;
        font-weight: 700;
      }
      .animal-title {
        font-weight: 600;
        letter-spacing: 0.02em;
      }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrigamiTurtleComponent {
  /** Optimal 3/4 perspective angles for the folded 3D Turtle */
  static readonly DEFAULT_ROTATION = {
    rotX: 0.52,
    rotY: 0.35,
  };

  /**
   * Constructs the authentic masterwork 3D Origami Turtle (Kame),
   * faithfully reproducing the elevated hexagonal Kikkō carapace,
   * sloping geometric perimeter scutes, extended diamond head with center ridge fold,
   * wide curved swimming flippers resting on the table, and rear rudder flippers.
   */
  static build3DModel(
    paperStyle: OrigamiPaperStyle,
    patternTexture: THREE.CanvasTexture | null
  ): THREE.Group {
    // 1. Definition of canonical 3D vertices for the Ancient Zen Turtle (Kame)
    // Hexagonal Domed Carapace (elevated Kikkō shell dome)
    const V_SHELL_APEX = new THREE.Vector3(0, 0.44, 0.04);
    const V_SCUTE_ANT = new THREE.Vector3(0, 0.36, 0.44);
    const V_SCUTE_POST = new THREE.Vector3(0, 0.34, -0.38);
    const V_SCUTE_MID_L = new THREE.Vector3(-0.48, 0.36, 0.04);
    const V_SCUTE_MID_R = new THREE.Vector3(0.48, 0.36, 0.04);
    const V_SCUTE_ANT_L = new THREE.Vector3(-0.38, 0.30, 0.42);
    const V_SCUTE_ANT_R = new THREE.Vector3(0.38, 0.30, 0.42);
    const V_SCUTE_POST_L = new THREE.Vector3(-0.38, 0.28, -0.36);
    const V_SCUTE_POST_R = new THREE.Vector3(0.38, 0.28, -0.36);

    // Carapace Rim (periphery sloping gracefully down towards the table)
    const V_RIM_NECK = new THREE.Vector3(0, 0.14, 0.82);
    const V_RIM_ANT_L = new THREE.Vector3(-0.52, 0.10, 0.72);
    const V_RIM_ANT_R = new THREE.Vector3(0.52, 0.10, 0.72);
    const V_RIM_MID_L = new THREE.Vector3(-0.96, 0.04, 0.04);
    const V_RIM_MID_R = new THREE.Vector3(0.96, 0.04, 0.04);
    const V_RIM_POST_L = new THREE.Vector3(-0.64, 0.02, -0.66);
    const V_RIM_POST_R = new THREE.Vector3(0.64, 0.02, -0.66);
    const V_RIM_TAIL = new THREE.Vector3(0, 0.04, -0.82);

    // Head & Neck (Folded origami diamond extending forward)
    const V_HEAD_CROWN = new THREE.Vector3(0, 0.26, 1.28);
    const V_SNOUT = new THREE.Vector3(0, 0.12, 1.62);          // Tip of turtle snout
    const V_HEAD_L = new THREE.Vector3(-0.20, 0.16, 1.22);
    const V_HEAD_R = new THREE.Vector3(0.20, 0.16, 1.22);
    const V_THROAT = new THREE.Vector3(0, 0.00, 1.24);

    // Front Left Swimming Flipper (wide sweeping paddle)
    const V_FLIP_L_LEAD = new THREE.Vector3(-0.50, 0.10, 0.74);
    const V_FLIP_L_TRAIL = new THREE.Vector3(-0.82, 0.06, 0.32);
    const V_FLIP_L_RIDGE = new THREE.Vector3(-1.42, 0.12, 0.62);
    const V_FLIP_L_TIP = new THREE.Vector3(-2.04, -0.06, 0.38); // Grazes the tabletop

    // Front Right Swimming Flipper
    const V_FLIP_R_LEAD = new THREE.Vector3(0.50, 0.10, 0.74);
    const V_FLIP_R_TRAIL = new THREE.Vector3(0.82, 0.06, 0.32);
    const V_FLIP_R_RIDGE = new THREE.Vector3(1.42, 0.12, 0.62);
    const V_FLIP_R_TIP = new THREE.Vector3(2.04, -0.06, 0.38);

    // Rear Flippers (Rudders)
    const V_RFLIP_L_ROOT = new THREE.Vector3(-0.56, 0.02, -0.62);
    const V_RFLIP_L_TIP = new THREE.Vector3(-1.18, -0.06, -0.96);
    const V_RFLIP_L_IN = new THREE.Vector3(-0.48, -0.06, -1.04);

    const V_RFLIP_R_ROOT = new THREE.Vector3(0.56, 0.02, -0.62);
    const V_RFLIP_R_TIP = new THREE.Vector3(1.18, -0.06, -0.96);
    const V_RFLIP_R_IN = new THREE.Vector3(0.48, -0.06, -1.04);

    // Needle Tail
    const V_TAIL_TIP = new THREE.Vector3(0, -0.04, -1.26);

    // Belly Plastron
    const V_BELLY_CENTER = new THREE.Vector3(0, -0.04, 0);

    // 2. Structured facet definitions
    const faces: { v: THREE.Vector3[]; shade: number }[] = [
      // Central Hexagonal Dome Carapace
      { v: [V_SHELL_APEX, V_SCUTE_ANT, V_SCUTE_ANT_L], shade: 1.14 },
      { v: [V_SHELL_APEX, V_SCUTE_ANT_R, V_SCUTE_ANT], shade: 1.22 },
      { v: [V_SHELL_APEX, V_SCUTE_ANT_L, V_SCUTE_MID_L], shade: 1.08 },
      { v: [V_SHELL_APEX, V_SCUTE_MID_R, V_SCUTE_ANT_R], shade: 1.20 },
      { v: [V_SHELL_APEX, V_SCUTE_MID_L, V_SCUTE_POST_L], shade: 1.02 },
      { v: [V_SHELL_APEX, V_SCUTE_POST_R, V_SCUTE_MID_R], shade: 1.16 },
      { v: [V_SHELL_APEX, V_SCUTE_POST_L, V_SCUTE_POST], shade: 0.96 },
      { v: [V_SHELL_APEX, V_SCUTE_POST, V_SCUTE_POST_R], shade: 1.10 },

      // Anterior Carapace Rim
      { v: [V_SCUTE_ANT, V_RIM_NECK, V_SCUTE_ANT_L], shade: 1.06 },
      { v: [V_SCUTE_ANT, V_SCUTE_ANT_R, V_RIM_NECK], shade: 1.18 },
      { v: [V_SCUTE_ANT_L, V_RIM_NECK, V_RIM_ANT_L], shade: 1.02 },
      { v: [V_SCUTE_ANT_R, V_RIM_ANT_R, V_RIM_NECK], shade: 1.15 },

      // Mid-Lateral Carapace Left
      { v: [V_SCUTE_ANT_L, V_RIM_ANT_L, V_RIM_MID_L], shade: 0.98 },
      { v: [V_SCUTE_ANT_L, V_RIM_MID_L, V_SCUTE_MID_L], shade: 1.04 },
      { v: [V_SCUTE_MID_L, V_RIM_MID_L, V_SCUTE_POST_L], shade: 0.94 },
      { v: [V_SCUTE_POST_L, V_RIM_MID_L, V_RIM_POST_L], shade: 0.90 },

      // Mid-Lateral Carapace Right
      { v: [V_SCUTE_ANT_R, V_RIM_MID_R, V_RIM_ANT_R], shade: 1.16 },
      { v: [V_SCUTE_ANT_R, V_SCUTE_MID_R, V_RIM_MID_R], shade: 1.12 },
      { v: [V_SCUTE_MID_R, V_SCUTE_POST_R, V_RIM_MID_R], shade: 1.08 },
      { v: [V_SCUTE_POST_R, V_RIM_POST_R, V_RIM_MID_R], shade: 1.02 },

      // Posterior Carapace Rim
      { v: [V_SCUTE_POST_L, V_RIM_POST_L, V_RIM_TAIL], shade: 0.88 },
      { v: [V_SCUTE_POST_L, V_RIM_TAIL, V_SCUTE_POST], shade: 0.92 },
      { v: [V_SCUTE_POST_R, V_RIM_TAIL, V_RIM_POST_R], shade: 1.00 },
      { v: [V_SCUTE_POST, V_RIM_TAIL, V_SCUTE_POST_R], shade: 0.96 },

      // Head & Snout
      { v: [V_HEAD_CROWN, V_HEAD_L, V_SNOUT], shade: 1.06 },
      { v: [V_HEAD_CROWN, V_SNOUT, V_HEAD_R], shade: 1.18 },
      { v: [V_RIM_NECK, V_HEAD_L, V_HEAD_CROWN], shade: 1.02 },
      { v: [V_RIM_NECK, V_HEAD_CROWN, V_HEAD_R], shade: 1.14 },
      { v: [V_THROAT, V_SNOUT, V_HEAD_L], shade: 0.94 },
      { v: [V_THROAT, V_HEAD_R, V_SNOUT], shade: 1.00 },

      // Front Left Swimming Flipper
      { v: [V_FLIP_L_LEAD, V_FLIP_L_TIP, V_FLIP_L_RIDGE], shade: 0.98 },
      { v: [V_FLIP_L_LEAD, V_FLIP_L_TRAIL, V_FLIP_L_TIP], shade: 0.88 },

      // Front Right Swimming Flipper
      { v: [V_FLIP_R_LEAD, V_FLIP_R_RIDGE, V_FLIP_R_TIP], shade: 1.15 },
      { v: [V_FLIP_R_LEAD, V_FLIP_R_TIP, V_FLIP_R_TRAIL], shade: 1.06 },

      // Rear Flippers
      { v: [V_RFLIP_L_ROOT, V_RFLIP_L_TIP, V_RFLIP_L_IN], shade: 0.86 },
      { v: [V_RFLIP_R_ROOT, V_RFLIP_R_IN, V_RFLIP_R_TIP], shade: 0.98 },

      // Needle Tail
      { v: [V_RIM_TAIL, V_TAIL_TIP, V_RIM_POST_L], shade: 0.88 },
      { v: [V_RIM_TAIL, V_RIM_POST_R, V_TAIL_TIP], shade: 0.96 },

      // Underside Plastron (Seals bottom & casts clean contact shadow)
      { v: [V_BELLY_CENTER, V_RIM_ANT_L, V_RIM_NECK], shade: 0.85 },
      { v: [V_BELLY_CENTER, V_RIM_NECK, V_RIM_ANT_R], shade: 0.85 },
      { v: [V_BELLY_CENTER, V_RIM_MID_L, V_RIM_ANT_L], shade: 0.80 },
      { v: [V_BELLY_CENTER, V_RIM_ANT_R, V_RIM_MID_R], shade: 0.85 },
      { v: [V_BELLY_CENTER, V_RIM_POST_L, V_RIM_MID_L], shade: 0.78 },
      { v: [V_BELLY_CENTER, V_RIM_MID_R, V_RIM_POST_R], shade: 0.82 },
      { v: [V_BELLY_CENTER, V_RIM_TAIL, V_RIM_POST_L], shade: 0.76 },
      { v: [V_BELLY_CENTER, V_RIM_POST_R, V_RIM_TAIL], shade: 0.80 },
    ];

    const group = new THREE.Group();

    for (const face of faces) {
      const geom = new THREE.BufferGeometry().setFromPoints(face.v);
      geom.computeVertexNormals();

      const uvs = [
        (face.v[0].x + 2.5) / 5,
        (face.v[0].y + 2.5) / 5,
        (face.v[1].x + 2.5) / 5,
        (face.v[1].y + 2.5) / 5,
        (face.v[2].x + 2.5) / 5,
        (face.v[2].y + 2.5) / 5,
      ];
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      const color = new THREE.Color(paperStyle.primaryColor).multiplyScalar(face.shade);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.03,
        flatShading: true,
        side: THREE.DoubleSide,
        map: patternTexture,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        face.v[0],
        face.v[1],
        face.v[1],
        face.v[2],
        face.v[2],
        face.v[0],
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x000000,
        opacity: 0.22,
        transparent: true,
      });
      const line = new THREE.LineSegments(lineGeom, lineMat);
      group.add(line);
    }

    return group;
  }
}
