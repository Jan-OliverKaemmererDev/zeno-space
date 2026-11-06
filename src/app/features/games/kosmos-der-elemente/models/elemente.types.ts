/**
 * Type definitions for the 'Kosmos der Elemente & des Lebens' 3D minigame.
 * Covers the 3D periodic table, ball-and-stick molecules, and species genomes.
 */

export type ElementCategory =
  | 'alkali'
  | 'alkaline-earth'
  | 'transition'
  | 'post-transition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'
  | 'unknown';

export type ElementState = 'solid' | 'liquid' | 'gas' | 'unknown';

export interface PeriodicElement {
  number: number;
  symbol: string;
  name: string;
  nameEn: string;
  atomicMass: string;
  period: number;
  group: number;
  category: ElementCategory;
  categoryName: string;
  color: string;
  state: ElementState;
  discoveryYear: string;
  discoveredBy?: string;
  electronConfig: string;
  electronsPerShell: number[];
  description: string;
  trivia: string;
  density?: string;
  meltingPoint?: string;
  boilingPoint?: string;
}

export interface AtomNode {
  id: string;
  symbol: string;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
  radius: number;
}

export interface BondDef {
  atomA: number;
  atomB: number;
  order: 1 | 2 | 3;
}

export interface MoleculeDef {
  id: string;
  name: string;
  formula: string;
  category: 'basic' | 'organic' | 'medicine' | 'life';
  categoryLabel: string;
  description: string;
  molarMass: string;
  trivia: string;
  atoms: AtomNode[];
  bonds: BondDef[];
}

export interface GenomeSpecies {
  id: string;
  commonName: string;
  scientificName: string;
  kingdom: 'animal' | 'plant' | 'microbe';
  group: 'mammal' | 'bird' | 'reptile-amphibian' | 'fish-marine' | 'arthropod' | 'plant-tree';
  groupLabel: string;
  genomeSizeBp: number;
  genomeSizeDisplay: string;
  chromosomes: string;
  estimatedGenes: string;
  description: string;
  funFact: string;
  color: string;
  dnaSequenceSample: string;
  icon: string;
}

export type CosmosViewMode = 'periodic' | 'molecules' | 'genomes';

