import * as THREE from 'three';

export type FruitType = 'apfel' | 'birne' | 'erdbeere' | 'orange';

export interface FruitChunk {
  mesh: THREE.Mesh;
  localOffset: THREE.Vector3;
  isHarvested: boolean;
}

export interface FruitItem {
  id: string;
  type: FruitType;
  position: THREE.Vector3;
  meshGroup: THREE.Group;
  chunks: FruitChunk[];
  totalChunks: number;
  remainingChunks: number;
  isDepleted: boolean;
  spawnTime: number;
  bounceOffset: number;
}
