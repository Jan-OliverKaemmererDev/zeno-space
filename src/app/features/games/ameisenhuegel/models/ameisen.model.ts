import * as THREE from 'three';

export type AntRole = 'worker' | 'soldier';

export type AntState =
  | 'idle_in_hill'
  | 'patrol'
  | 'moving_to_target'
  | 'harvesting'
  | 'carrying_food'
  | 'attacking_enemy';

export interface AntData {
  id: number;
  role: AntRole;
  state: AntState;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  rotationY: number;
  targetRotationY: number;
  speed: number;
  carryingFoodType: string | null;
  carryingMesh?: THREE.Mesh | null;
  harvestTimer: number;
  attackTimer: number;
  targetFruitId: string | null;
  targetEnemyId: string | null;
  legPhase: number;
  patrolAngle: number;
  patrolDistance: number;
  trailProgress: number;
  trailLane: number;
  trailDepartureDelay: number;
}
