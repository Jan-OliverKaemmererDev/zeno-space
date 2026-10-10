/**
 * Supported origami animal patterns.
 */
export type OrigamiPatternId = 'crane' | 'owl' | 'turtle';

/**
 * Crease and fold type classifications for origami instructions.
 */
export type CreaseType =
  | 'valley'      // Talfalte: Papier nach vorn / zur Mitte falten
  | 'mountain'    // Bergfalte: Papier nach hinten falten
  | 'squash'      // Quetschfalte: Öffnen und flachdrücken
  | 'petal'       // Blütenblattfalte (Petal Fold)
  | 'reverse'     // Gegenfaltung nach innen (Inside Reverse Fold)
  | 'turnover'    // Modell umdrehen
  | 'final';      // Vollendete Form

/**
 * Paper surface styling configuration (solid colors or Japanese washi patterns).
 */
export interface OrigamiPaperStyle {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  patternType: 'solid' | 'sakura' | 'seigaiha' | 'asanoha' | 'chiyogami';
  isDark?: boolean;
}

/**
 * Individual polygon facet forming the paper structure in SVG space (0..500, 0..500).
 */
export interface PaperFacet {
  id?: string;
  /** SVG polygon points string or SVG path `d` attribute */
  d?: string;
  points?: string;
  /** True if this face is the white back side of the origami sheet */
  isReverseSide?: boolean;
  /** Opacity override for translucent folds */
  opacity?: number;
  /** Subtle lighting factor (0.85 = darker fold shadow, 1.15 = highlighted facet) */
  shadeFactor?: number;
  /** Custom fill override (e.g. eye dot or gold beak detail) */
  fillOverride?: string;
}

/**
 * Crease lines or folding fold guides.
 */
export interface CreaseLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type?: 'valley' | 'mountain' | 'guide';
}

/**
 * Fold instruction arrow showing the motion direction.
 */
export interface FoldArrow {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curveOffset?: number;
}

/**
 * Interactive hotspot that can be clicked to execute this specific fold step.
 */
export interface FoldHotspot {
  x: number;
  y: number;
  radius?: number;
  label: string;
}

/**
 * 3D paper folding animation specification for active step transitions.
 */
export interface FoldAnimation {
  /** Mode: 'flap' (corner/edge folds), 'turnover' (whole sheet flip), 'squash', 'reverse', 'unfold' | 'final' */
  type: 'flap' | 'turnover' | 'squash' | 'reverse' | 'unfold' | 'final';
  /** SVG polygon points of the moving flap */
  flapPoints?: string;
  /** Center of rotation e.g. { x: 250, y: 250 } */
  origin?: { x: number; y: number };
  /** Target 3D transform e.g. 'rotateX(-180deg)' */
  rotateTransform?: string;
  /** Specific CSS animation class to apply e.g. 'anim-fold-up-x' */
  animationClass?: string;
  /** Whether the flap shows the white back face when folded */
  showsReverseSide?: boolean;
}

/**
 * Complete definition for a single origami fold step.
 */
export interface OrigamiStep {
  stepNumber: number;
  name: string;
  instruction: string;
  creaseType: CreaseType;
  tip?: string;
  hotspot: FoldHotspot;
  arrow?: FoldArrow;
  facets: PaperFacet[];
  creaseLines?: CreaseLine[];
  /** 3D folding animation configuration */
  foldAnimation?: FoldAnimation;
  /** Optional completion message or badge */
  isComplete?: boolean;
}

/**
 * Complete definition of an origami animal motif.
 */
export interface OrigamiPattern {
  id: OrigamiPatternId;
  name: string;
  japaneseName: string;
  kanji: string;
  subtitle: string;
  difficulty: 'Leicht' | 'Mittel' | 'Anspruchsvoll';
  symbolism: string;
  durationEst: string;
  totalSteps: number;
  steps: OrigamiStep[];
  iconSvgPath: string;
}
