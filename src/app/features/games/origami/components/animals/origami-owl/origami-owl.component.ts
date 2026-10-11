import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrigamiPaperStyle } from '../../../models/origami.models';

/**
 * Component representing the Wise Owl (Fukuro / 梟).
 * Contains the authentic 3D geometry definitions, masterwork mesh constructor,
 * and optimal 3/4 hero camera perspective parameters.
 */
@Component({
  selector: 'app-origami-owl',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animal-status-tag" aria-hidden="true">
      <span class="kanji-badge">梟</span>
      <span class="animal-title">Fukuro // Weise Eule</span>
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
        color: #fbbf24;
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
export class OrigamiOwlComponent {
  /** Optimal 3/4 perspective angles for the folded 3D Owl */
  static readonly DEFAULT_ROTATION = {
    rotX: 0.25,
    rotY: 0.25,
  };

  /**
   * Constructs the authentic masterwork 3D Origami Owl (Fukuro),
   * faithfully reproducing the upright body, prominent folded ear tufts,
   * puffed breast shield with reverse paper contrast, folded amber beak,
   * high-contrast origami eyes, wrap-around wings, talons, and desk perch.
   */
  static build3DModel(
    paperStyle: OrigamiPaperStyle,
    patternTexture: THREE.CanvasTexture | null
  ): THREE.Group {
    // 1. Definition of canonical 3D vertices for the Wise Zen Owl (Fukuro)
    // Ear tufts & Brow
    const V_EAR_TIP_L = new THREE.Vector3(-0.64, 1.25, 0.12);
    const V_EAR_TIP_R = new THREE.Vector3(0.64, 1.25, 0.12);
    const V_BROW_CENTER = new THREE.Vector3(0, 0.90, 0.22);
    const V_BROW_L = new THREE.Vector3(-0.36, 0.82, 0.26);
    const V_BROW_R = new THREE.Vector3(0.36, 0.82, 0.26);
    const V_HEAD_TEMPLE_L = new THREE.Vector3(-0.75, 0.68, 0.06);
    const V_HEAD_TEMPLE_R = new THREE.Vector3(0.75, 0.68, 0.06);
    const V_HEAD_BACK = new THREE.Vector3(0, 0.98, -0.22);

    // Facial Disk & Beak
    const V_BEAK_ROOT = new THREE.Vector3(0, 0.48, 0.52);
    const V_BEAK_TIP = new THREE.Vector3(0, 0.22, 0.78);       // Protrudes proudly forward
    const V_BEAK_BASE_L = new THREE.Vector3(-0.10, 0.38, 0.46);
    const V_BEAK_BASE_R = new THREE.Vector3(0.10, 0.38, 0.46);
    const V_BEAK_THROAT = new THREE.Vector3(0, 0.28, 0.44);

    // Eyes (Faceted origami eyes disks)
    const V_EYE_TOP_L = new THREE.Vector3(-0.24, 0.66, 0.38);
    const V_EYE_OUT_L = new THREE.Vector3(-0.46, 0.52, 0.32);
    const V_EYE_BOT_L = new THREE.Vector3(-0.24, 0.40, 0.36);
    const V_EYE_IN_L = new THREE.Vector3(-0.10, 0.54, 0.42);

    const V_EYE_TOP_R = new THREE.Vector3(0.24, 0.66, 0.38);
    const V_EYE_OUT_R = new THREE.Vector3(0.46, 0.52, 0.32);
    const V_EYE_BOT_R = new THREE.Vector3(0.24, 0.40, 0.36);
    const V_EYE_IN_R = new THREE.Vector3(0.10, 0.54, 0.42);

    // Puffed Breast (white/accent reverse fold shield)
    const V_CHEST_PEAK = new THREE.Vector3(0, 0.05, 0.64);     // Puffed forward
    const V_CHEST_MID_L = new THREE.Vector3(-0.42, 0.02, 0.40);
    const V_CHEST_MID_R = new THREE.Vector3(0.42, 0.02, 0.40);
    const V_BELLY_APEX = new THREE.Vector3(0, -0.62, 0.42);
    const V_BELLY_LOW_L = new THREE.Vector3(-0.35, -0.60, 0.32);
    const V_BELLY_LOW_R = new THREE.Vector3(0.35, -0.60, 0.32);

    // Wings (tucked folded wings along the flanks)
    const V_WING_SHOULDER_L = new THREE.Vector3(-0.72, 0.45, 0.16);
    const V_WING_ELBOW_L = new THREE.Vector3(-0.96, -0.10, 0.02);
    const V_WING_TIP_L = new THREE.Vector3(-0.52, -0.78, -0.18);

    const V_WING_SHOULDER_R = new THREE.Vector3(0.72, 0.45, 0.16);
    const V_WING_ELBOW_R = new THREE.Vector3(0.96, -0.10, 0.02);
    const V_WING_TIP_R = new THREE.Vector3(0.52, -0.78, -0.18);

    // Back & Tail
    const V_BACK_UPPER = new THREE.Vector3(0, 0.40, -0.32);
    const V_BACK_LOWER = new THREE.Vector3(0, -0.35, -0.35);
    const V_TAIL_TIP = new THREE.Vector3(0, -0.92, -0.26);

    // Claws / Talons (Folded golden paper feet resting on desk)
    const V_TALON_L1 = new THREE.Vector3(-0.32, -0.94, 0.36);
    const V_TALON_L2 = new THREE.Vector3(-0.20, -0.94, 0.40);
    const V_TALON_L3 = new THREE.Vector3(-0.10, -0.94, 0.36);
    const V_FOOT_BASE_L = new THREE.Vector3(-0.20, -0.72, 0.28);

    const V_TALON_R1 = new THREE.Vector3(0.10, -0.94, 0.36);
    const V_TALON_R2 = new THREE.Vector3(0.20, -0.94, 0.40);
    const V_TALON_R3 = new THREE.Vector3(0.32, -0.94, 0.36);
    const V_FOOT_BASE_R = new THREE.Vector3(0.20, -0.72, 0.28);

    // Perch Bar on desk
    const V_PERCH_L = new THREE.Vector3(-0.85, -0.95, 0.22);
    const V_PERCH_R = new THREE.Vector3(0.85, -0.95, 0.22);
    const V_PERCH_BOT_L = new THREE.Vector3(-0.85, -1.02, 0.22);
    const V_PERCH_BOT_R = new THREE.Vector3(0.85, -1.02, 0.22);

    // 2. Structured facet definitions
    const faces: {
      v: THREE.Vector3[];
      shade: number;
      colorOverride?: string;
      isReverse?: boolean;
    }[] = [
      // Ear tufts
      { v: [V_EAR_TIP_L, V_BROW_CENTER, V_BROW_L], shade: 1.08 },
      { v: [V_EAR_TIP_L, V_BROW_L, V_HEAD_TEMPLE_L], shade: 0.94 },
      { v: [V_EAR_TIP_L, V_HEAD_TEMPLE_L, V_HEAD_BACK], shade: 0.90 },
      { v: [V_EAR_TIP_R, V_BROW_R, V_BROW_CENTER], shade: 1.15 },
      { v: [V_EAR_TIP_R, V_HEAD_TEMPLE_R, V_BROW_R], shade: 1.02 },
      { v: [V_EAR_TIP_R, V_HEAD_BACK, V_HEAD_TEMPLE_R], shade: 0.92 },
      { v: [V_BROW_CENTER, V_BROW_L, V_BROW_R], shade: 1.05 },

      // Forehead & Face Root
      { v: [V_BROW_CENTER, V_BROW_R, V_BEAK_ROOT], shade: 1.06 },
      { v: [V_BROW_CENTER, V_BEAK_ROOT, V_BROW_L], shade: 0.98 },
      { v: [V_BROW_L, V_EYE_IN_L, V_BEAK_ROOT], shade: 0.94 },
      { v: [V_BROW_L, V_HEAD_TEMPLE_L, V_EYE_OUT_L], shade: 0.92 },
      { v: [V_BROW_L, V_EYE_OUT_L, V_EYE_TOP_L], shade: 0.96 },
      { v: [V_BROW_L, V_EYE_TOP_L, V_EYE_IN_L], shade: 1.00 },
      { v: [V_BROW_R, V_BEAK_ROOT, V_EYE_IN_R], shade: 1.08 },
      { v: [V_BROW_R, V_EYE_OUT_R, V_HEAD_TEMPLE_R], shade: 1.02 },
      { v: [V_BROW_R, V_EYE_TOP_R, V_EYE_OUT_R], shade: 1.10 },
      { v: [V_BROW_R, V_EYE_IN_R, V_EYE_TOP_R], shade: 1.06 },

      // Protruding Folded Golden Beak
      { v: [V_BEAK_ROOT, V_BEAK_BASE_L, V_BEAK_TIP], shade: 1.12, colorOverride: '#f59e0b' },
      { v: [V_BEAK_ROOT, V_BEAK_TIP, V_BEAK_BASE_R], shade: 1.20, colorOverride: '#fbbf24' },
      { v: [V_BEAK_TIP, V_BEAK_BASE_L, V_BEAK_THROAT], shade: 0.94, colorOverride: '#d97706' },
      { v: [V_BEAK_TIP, V_BEAK_THROAT, V_BEAK_BASE_R], shade: 1.02, colorOverride: '#d97706' },

      // Origami Eyes: Light Iris + Obsidian Pupils
      { v: [V_EYE_TOP_L, V_EYE_OUT_L, V_EYE_BOT_L], shade: 1.08, isReverse: true },
      { v: [V_EYE_TOP_L, V_EYE_BOT_L, V_EYE_IN_L], shade: 1.12, isReverse: true },
      { v: [V_EYE_TOP_R, V_EYE_BOT_R, V_EYE_OUT_R], shade: 1.15, isReverse: true },
      { v: [V_EYE_TOP_R, V_EYE_IN_R, V_EYE_BOT_R], shade: 1.18, isReverse: true },
      // Pupils
      {
        v: [
          new THREE.Vector3(-0.25, 0.58, 0.40),
          new THREE.Vector3(-0.31, 0.52, 0.38),
          new THREE.Vector3(-0.23, 0.46, 0.39),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },
      {
        v: [
          new THREE.Vector3(-0.25, 0.58, 0.40),
          new THREE.Vector3(-0.23, 0.46, 0.39),
          new THREE.Vector3(-0.17, 0.52, 0.41),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },
      {
        v: [
          new THREE.Vector3(0.25, 0.58, 0.40),
          new THREE.Vector3(0.23, 0.46, 0.39),
          new THREE.Vector3(0.31, 0.52, 0.38),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },
      {
        v: [
          new THREE.Vector3(0.25, 0.58, 0.40),
          new THREE.Vector3(0.17, 0.52, 0.41),
          new THREE.Vector3(0.23, 0.46, 0.39),
        ],
        shade: 1.0,
        colorOverride: '#18181b',
      },

      // Puffed Breast Shield (Reverse Paper / Light Washi contrast)
      { v: [V_BEAK_THROAT, V_CHEST_MID_L, V_CHEST_PEAK], shade: 1.14, isReverse: true },
      { v: [V_BEAK_THROAT, V_CHEST_PEAK, V_CHEST_MID_R], shade: 1.22, isReverse: true },
      { v: [V_CHEST_PEAK, V_CHEST_MID_L, V_BELLY_APEX], shade: 1.08, isReverse: true },
      { v: [V_CHEST_PEAK, V_BELLY_APEX, V_CHEST_MID_R], shade: 1.16, isReverse: true },

      // Torso Flanks (Connecting breast to wings)
      { v: [V_EYE_BOT_L, V_WING_SHOULDER_L, V_CHEST_MID_L], shade: 0.94 },
      { v: [V_CHEST_MID_L, V_WING_ELBOW_L, V_BELLY_LOW_L], shade: 0.92 },
      { v: [V_CHEST_MID_L, V_BELLY_LOW_L, V_BELLY_APEX], shade: 0.98 },
      { v: [V_BELLY_LOW_L, V_WING_ELBOW_L, V_WING_TIP_L], shade: 0.88 },
      { v: [V_EYE_BOT_R, V_CHEST_MID_R, V_WING_SHOULDER_R], shade: 1.06 },
      { v: [V_CHEST_MID_R, V_BELLY_LOW_R, V_WING_ELBOW_R], shade: 1.02 },
      { v: [V_CHEST_MID_R, V_BELLY_APEX, V_BELLY_LOW_R], shade: 1.04 },
      { v: [V_BELLY_LOW_R, V_WING_TIP_R, V_WING_ELBOW_R], shade: 1.00 },

      // Folded Wings (Hugging the sides)
      { v: [V_HEAD_TEMPLE_L, V_WING_ELBOW_L, V_WING_SHOULDER_L], shade: 0.92 },
      { v: [V_WING_SHOULDER_L, V_WING_ELBOW_L, V_WING_TIP_L], shade: 0.88 },
      { v: [V_HEAD_TEMPLE_L, V_BACK_UPPER, V_WING_ELBOW_L], shade: 0.90 },
      { v: [V_WING_ELBOW_L, V_BACK_UPPER, V_BACK_LOWER], shade: 0.88 },
      { v: [V_WING_ELBOW_L, V_BACK_LOWER, V_WING_TIP_L], shade: 0.86 },

      { v: [V_HEAD_TEMPLE_R, V_WING_SHOULDER_R, V_WING_ELBOW_R], shade: 1.10 },
      { v: [V_WING_SHOULDER_R, V_WING_TIP_R, V_WING_ELBOW_R], shade: 1.06 },
      { v: [V_HEAD_TEMPLE_R, V_WING_ELBOW_R, V_BACK_UPPER], shade: 1.02 },
      { v: [V_WING_ELBOW_R, V_BACK_LOWER, V_BACK_UPPER], shade: 1.00 },
      { v: [V_WING_ELBOW_R, V_WING_TIP_R, V_BACK_LOWER], shade: 0.96 },

      // Back & Tail
      { v: [V_HEAD_BACK, V_HEAD_TEMPLE_L, V_BACK_UPPER], shade: 0.92 },
      { v: [V_HEAD_BACK, V_BACK_UPPER, V_HEAD_TEMPLE_R], shade: 0.96 },
      { v: [V_BACK_LOWER, V_WING_TIP_L, V_TAIL_TIP], shade: 0.88 },
      { v: [V_BACK_LOWER, V_TAIL_TIP, V_WING_TIP_R], shade: 0.94 },

      // Torso to Feet Base
      { v: [V_BELLY_LOW_L, V_FOOT_BASE_L, V_BELLY_APEX], shade: 0.95 },
      { v: [V_BELLY_LOW_R, V_BELLY_APEX, V_FOOT_BASE_R], shade: 1.03 },

      // Claws / Talons (Golden paper feet)
      { v: [V_FOOT_BASE_L, V_TALON_L1, V_TALON_L2], shade: 1.05, colorOverride: '#d97706' },
      { v: [V_FOOT_BASE_L, V_TALON_L2, V_TALON_L3], shade: 1.10, colorOverride: '#f59e0b' },
      { v: [V_FOOT_BASE_R, V_TALON_R1, V_TALON_R2], shade: 1.08, colorOverride: '#f59e0b' },
      { v: [V_FOOT_BASE_R, V_TALON_R2, V_TALON_R3], shade: 1.12, colorOverride: '#d97706' },

      // Perch Bar on desk
      { v: [V_PERCH_L, V_PERCH_BOT_L, V_PERCH_BOT_R], shade: 0.85, colorOverride: '#78350f' },
      { v: [V_PERCH_L, V_PERCH_BOT_R, V_PERCH_R], shade: 0.90, colorOverride: '#78350f' },
      { v: [V_FOOT_BASE_L, V_PERCH_L, V_TALON_L2], shade: 0.92, colorOverride: '#d97706' },
      { v: [V_FOOT_BASE_R, V_TALON_R2, V_PERCH_R], shade: 1.06, colorOverride: '#d97706' },
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

      let baseHex = paperStyle.primaryColor;
      if (face.colorOverride) {
        baseHex = face.colorOverride;
      } else if (face.isReverse) {
        baseHex = paperStyle.secondaryColor || '#ffffff';
      }

      const color = new THREE.Color(baseHex).multiplyScalar(face.shade);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.03,
        flatShading: true,
        side: THREE.DoubleSide,
        map: face.colorOverride || face.isReverse ? null : patternTexture,
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
