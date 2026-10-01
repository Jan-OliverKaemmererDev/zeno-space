/**
 * Configuration for keyboard control representation.
 */
export interface KeyboardControlDef {
  /** Layout type for rendering the keys ('wasd' grid, 'arrows' grid, 'inline' row, or 'space' bar) */
  type: 'wasd' | 'arrows' | 'inline' | 'space';
  /** List of key labels to display, e.g. ['W', 'A', 'S', 'D'] or ['SPACE'] */
  keys: string[];
  /** Description of what these keys do in the game */
  label: string;
}

/**
 * Configuration for mouse control representation.
 */
export interface MouseControlDef {
  /** Whether left click is used */
  leftClick?: boolean;
  /** Whether right click is used */
  rightClick?: boolean;
  /** Whether mouse drag or movement is used */
  drag?: boolean;
  /** Whether mouse wheel scroll is used */
  wheel?: boolean;
  /** Description of mouse controls */
  label: string;
}

/**
 * Combined controls specification for a minigame.
 */
export interface GameControls {
  /** Optional keyboard controls */
  keyboard?: KeyboardControlDef[];
  /** Optional mouse controls */
  mouse?: MouseControlDef;
  /** Helpful tip or objective */
  objective?: string;
}

/**
 * Defines the structure for a minigame object used throughout the application.
 */
export interface Minigame {
  /** Unique identifier for the minigame. */
  id: string;
  /** Primary display title. */
  title: string;
  /** Secondary display subtitle. */
  subtitle: string;
  /** Detailed description of the minigame's experience. */
  description: string;
  /** Visual badge category indicating the type of game. */
  badge: '3D WebGL' | 'Zen Audio' | 'Chill Sandbox' | 'Creative';
  /** Optional category ID used for filtering. */
  category?: string;
  /** Routing path for navigating to the minigame. */
  route: string;
  /** Icon identifier or name associated with the game. */
  icon: string;
  /** Primary brand color hex code for the game. */
  primaryColor: string;
  /** Glow color (usually RGBA) associated with the game's theme. */
  glowColor: string;
  /** List of tag strings used for filtering and search. */
  tags: string[];
  /** CSS animation delay for floating effects. */
  floatDelay: string;
  /** CSS animation duration for floating effects. */
  floatDuration: string;
  /** CSS class determining the size of the bubble representation. */
  sizeClass: 'bubble--lg' | 'bubble--md' | 'bubble--sm';
  /** Optional input controls configuration for the tutorial/start overlay. */
  controls?: GameControls;
}

