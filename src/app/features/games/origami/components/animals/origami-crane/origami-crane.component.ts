import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrigamiPaperStyle } from '../../../models/origami.models';

/**
 * Component representing the Crane (Tsuru / 折鶴).
 * Contains the authentic 3D geometry definitions, masterwork mesh constructor,
 * and optimal 3/4 hero camera perspective parameters.
 */
@Component({
  selector: 'app-origami-crane',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animal-status-tag" aria-hidden="true">
      <span class="kanji-badge">折鶴</span>
      <span class="animal-title">Tsuru // Friedenskranich</span>
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
        color: #f472b6;
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
export class OrigamiCraneComponent {
  /** Optimal 3/4 perspective angles for the folded 3D Crane */
  static readonly DEFAULT_ROTATION = {
    rotX: 0.28,
    rotY: 0.65,
  };

  /**
   * Constructs the authentic masterwork 3D Origami Crane (Tsuru),
   * faithfully reproducing the exact proportions, faceted folds, sweeping wings,
   * slender neck with crimped downward beak, and tall pointed tail.
   */
  static build3DModel(
    paperStyle: OrigamiPaperStyle,
    patternTexture: THREE.CanvasTexture | null
  ): THREE.Group {
    // 1. Definition of canonical 3D vertices
    const V_BOTTOM = new THREE.Vector3(0, -0.92, 0);          // Base point resting on table
    const V_BACK = new THREE.Vector3(0, 0.44, -0.04);          // Top crest of the back saddle
    const V_CHEST = new THREE.Vector3(0, -0.12, 0.52);         // Front chest rim (neck root)
    const V_REAR = new THREE.Vector3(0, -0.12, -0.56);         // Rear saddle rim (tail root)

    // Wing roots
    const V_WROOT_FL = new THREE.Vector3(-0.28, 0.04, 0.34);
    const V_WROOT_ML = new THREE.Vector3(-0.32, 0.16, -0.02);
    const V_WROOT_RL = new THREE.Vector3(-0.28, 0.04, -0.36);

    const V_WROOT_FR = new THREE.Vector3(0.28, 0.04, 0.34);
    const V_WROOT_MR = new THREE.Vector3(0.32, 0.16, -0.02);
    const V_WROOT_RR = new THREE.Vector3(0.28, 0.04, -0.36);

    // Wings
    const V_WTIP_L = new THREE.Vector3(-2.18, 0.92, 0.06);     // Left wingtip
    const V_WLEAD_L = new THREE.Vector3(-1.24, 0.38, 0.54);    // Left leading edge
    const V_WTRAIL_L = new THREE.Vector3(-1.24, 0.38, -0.44);  // Left trailing edge

    const V_WTIP_R = new THREE.Vector3(2.18, 0.92, 0.06);      // Right wingtip
    const V_WLEAD_R = new THREE.Vector3(1.24, 0.38, 0.54);     // Right leading edge
    const V_WTRAIL_R = new THREE.Vector3(1.24, 0.38, -0.44);   // Right trailing edge

    // Neck & Head
    const V_NECK_BASE_L = new THREE.Vector3(-0.06, -0.22, 0.44);
    const V_NECK_BASE_R = new THREE.Vector3(0.06, -0.22, 0.44);
    const V_NECK_MID_L = new THREE.Vector3(-0.04, 0.36, 0.96);
    const V_NECK_MID_R = new THREE.Vector3(0.04, 0.36, 0.96);
    const V_NECK_CREST = new THREE.Vector3(0, 0.42, 0.94);
    const V_NECK_TOP_L = new THREE.Vector3(-0.03, 0.80, 1.44);
    const V_NECK_TOP_R = new THREE.Vector3(0.03, 0.80, 1.44);
    const V_HEAD_CROWN = new THREE.Vector3(0, 0.86, 1.46);
    const V_HEAD_THROAT = new THREE.Vector3(0, 0.60, 1.54);
    const V_BEAK_TIP = new THREE.Vector3(0, 0.36, 1.88);       // Crimped down beak

    // Tail
    const V_TAIL_BASE_L = new THREE.Vector3(-0.06, -0.22, -0.46);
    const V_TAIL_BASE_R = new THREE.Vector3(0.06, -0.22, -0.46);
    const V_TAIL_MID_L = new THREE.Vector3(-0.04, 0.46, -1.06);
    const V_TAIL_MID_R = new THREE.Vector3(0.04, 0.46, -1.06);
    const V_TAIL_CREST = new THREE.Vector3(0, 0.54, -1.04);
    const V_TAIL_TIP = new THREE.Vector3(0, 1.32, -1.66);      // Tall sharp needle tail

    // 2. Structured facet definitions
    const faces: { v: THREE.Vector3[]; shade: number }[] = [
      // 1. Torso Center & V-Base
      { v: [V_BOTTOM, V_CHEST, V_WROOT_FL], shade: 0.92 },
      { v: [V_BOTTOM, V_WROOT_FR, V_CHEST], shade: 1.05 },
      { v: [V_BOTTOM, V_WROOT_FL, V_WROOT_ML], shade: 0.88 },
      { v: [V_BOTTOM, V_WROOT_MR, V_WROOT_FR], shade: 1.08 },
      { v: [V_BOTTOM, V_WROOT_ML, V_WROOT_RL], shade: 0.85 },
      { v: [V_BOTTOM, V_WROOT_RR, V_WROOT_MR], shade: 1.02 },
      { v: [V_BOTTOM, V_WROOT_RL, V_REAR], shade: 0.90 },
      { v: [V_BOTTOM, V_REAR, V_WROOT_RR], shade: 0.98 },

      // 2. Torso Saddle
      { v: [V_BACK, V_WROOT_ML, V_WROOT_FL], shade: 1.04 },
      { v: [V_BACK, V_WROOT_FR, V_WROOT_MR], shade: 1.15 },
      { v: [V_BACK, V_WROOT_RL, V_WROOT_ML], shade: 0.96 },
      { v: [V_BACK, V_WROOT_MR, V_WROOT_RR], shade: 1.10 },
      { v: [V_BACK, V_WROOT_FL, V_CHEST], shade: 1.02 },
      { v: [V_BACK, V_CHEST, V_WROOT_FR], shade: 1.12 },
      { v: [V_BACK, V_REAR, V_WROOT_RL], shade: 0.94 },
      { v: [V_BACK, V_WROOT_RR, V_REAR], shade: 1.06 },

      // 3. Left Wing
      { v: [V_WROOT_ML, V_WTIP_L, V_WLEAD_L], shade: 0.95 },
      { v: [V_WROOT_ML, V_WTRAIL_L, V_WTIP_L], shade: 0.86 },
      { v: [V_WROOT_FL, V_WLEAD_L, V_WROOT_ML], shade: 0.98 },
      { v: [V_WROOT_ML, V_WTRAIL_L, V_WROOT_RL], shade: 0.88 },

      // 4. Right Wing
      { v: [V_WROOT_MR, V_WLEAD_R, V_WTIP_R], shade: 1.18 },
      { v: [V_WROOT_MR, V_WTIP_R, V_WTRAIL_R], shade: 1.06 },
      { v: [V_WROOT_FR, V_WROOT_MR, V_WLEAD_R], shade: 1.12 },
      { v: [V_WROOT_MR, V_WROOT_RR, V_WTRAIL_R], shade: 0.98 },

      // 5. Neck
      { v: [V_NECK_BASE_L, V_NECK_MID_L, V_NECK_CREST], shade: 1.04 },
      { v: [V_NECK_BASE_R, V_NECK_CREST, V_NECK_MID_R], shade: 1.12 },
      { v: [V_NECK_MID_L, V_NECK_TOP_L, V_HEAD_CROWN], shade: 1.06 },
      { v: [V_NECK_MID_R, V_HEAD_CROWN, V_NECK_TOP_R], shade: 1.14 },
      { v: [V_CHEST, V_HEAD_THROAT, V_NECK_TOP_L], shade: 0.96 },
      { v: [V_CHEST, V_NECK_TOP_R, V_HEAD_THROAT], shade: 1.02 },

      // 6. Head & Beak
      { v: [V_HEAD_CROWN, V_BEAK_TIP, V_HEAD_THROAT], shade: 1.10 },
      { v: [V_HEAD_CROWN, V_HEAD_THROAT, V_BEAK_TIP], shade: 0.92 },
      { v: [V_HEAD_CROWN, V_NECK_TOP_L, V_BEAK_TIP], shade: 1.18 },
      { v: [V_HEAD_CROWN, V_BEAK_TIP, V_NECK_TOP_R], shade: 1.15 },

      // 7. Tail
      { v: [V_TAIL_BASE_L, V_TAIL_MID_L, V_TAIL_CREST], shade: 0.98 },
      { v: [V_TAIL_BASE_R, V_TAIL_CREST, V_TAIL_MID_R], shade: 1.08 },
      { v: [V_TAIL_MID_L, V_TAIL_TIP, V_TAIL_CREST], shade: 1.02 },
      { v: [V_TAIL_MID_R, V_TAIL_CREST, V_TAIL_TIP], shade: 1.12 },
      { v: [V_REAR, V_TAIL_TIP, V_TAIL_BASE_L], shade: 0.92 },
      { v: [V_REAR, V_TAIL_BASE_R, V_TAIL_TIP], shade: 1.00 },
    ];

    const group = new THREE.Group();

    for (const face of faces) {
      const geom = new THREE.BufferGeometry().setFromPoints(face.v);
      geom.computeVertexNormals();

      const uvs = [
        (face.v[0].x + 2.5) / 5,
        (face.v[0].z + 2.5) / 5,
        (face.v[1].x + 2.5) / 5,
        (face.v[1].z + 2.5) / 5,
        (face.v[2].x + 2.5) / 5,
        (face.v[2].z + 2.5) / 5,
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
