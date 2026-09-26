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
}
