import * as THREE from 'three';

export type EnemyType = 'kaefer' | 'wespe' | 'spinne';

export interface EnemyItem {
  id: string;
  type: EnemyType;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  targetFruitId: string | null;
  meshGroup: THREE.Group;
  healthBarGroup?: THREE.Group;
  healthBarMesh?: THREE.Mesh;
  maxHp: number;
  currentHp: number;
  speed: number;
  rotationY: number;
  isEating: boolean;
  eatTimer: number;
  isDead: boolean;
  wingFlapPhase: number;
  walkPhase: number;
}
