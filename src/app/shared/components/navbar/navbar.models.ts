import { SafeHtml } from '@angular/platform-browser';

/**
 * Character data with right-aligned stagger index for wave tooltips.
 */
export interface TooltipLetter {
  /** Character to display. */
  char: string;
  /** Distance index counted from the right edge. */
  fromRight: number;
}

/**
 * Visual spark particle emitted from the sound toggle button burst animation.
 */
export interface SoundBurstSpark {
  /** Unique identifier for the spark. */
  id: number;
  /** Starting X coordinate. */
  startX: number;
  /** Starting Y coordinate. */
  startY: number;
  /** Destination X coordinate. */
  endX: number;
  /** Destination Y coordinate. */
  endY: number;
  /** CSS color hex code. */
  color: string;
  /** Particle size in pixels. */
  size: number;
  /** Stagger delay in milliseconds. */
  delayMs: number;
}

/**
 * Represents a categorized minigame group with metadata and presentation assets.
 */
export interface CategoryItem {
  /** Unique category identifier string. */
  id: string;
  /** Display title for the category. */
  title: string;
  /** Short descriptive subtitle. */
  subtitle: string;
  /** In-depth description of the category theme. */
  description: string;
  /** Optional badge label. */
  badge?: string;
  /** Optional navigation target route. */
  route?: string;
  /** Sanitized SVG icon markup. */
  iconSvg: SafeHtml;
  /** Optional tags associated with this category. */
  tags?: string[];
}

/**
 * Flight state of the origami crane.
 */
export type CraneFlightState = 'flying' | 'landed';
