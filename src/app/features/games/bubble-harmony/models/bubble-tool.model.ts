/**
 * Identifiers for interactive tools available in the Bubble Harmony minigame.
 */
export type BubbleToolId = 'fan' | 'magnet' | 'prism' | 'chime';

/**
 * Definition of a selectable tool with descriptions and metadata.
 */
export interface BubbleTool {
  /** Unique tool identifier. */
  id: BubbleToolId;
  /** Primary human-readable name. */
  label: string;
  /** Short descriptive tagline. */
  tagline: string;
  /** Detailed behavior explanation. */
  description: string;
  /** Icon identifier for template rendering. */
  iconName: string;
}

/**
 * Available tool palette for the Bubble Harmony minigame.
 */
export const BUBBLE_TOOLS: BubbleTool[] = [
  {
    id: 'fan',
    label: 'Ventilator',
    tagline: 'Dynamischer Luftstrom',
    description: 'Pustet schwebende Seifenblasen durch sanften Wind beiseite, wenn du ihnen mit der Maus nah kommst.',
    iconName: 'fan',
  },
  {
    id: 'magnet',
    label: 'Magnet',
    tagline: 'Schwerkraft-Orbit',
    description: 'Zieht Seifenblasen magisch an und lässt sie in einer harmonischen Spiralbahn um den Zeiger kreisen.',
    iconName: 'magnet',
  },
  {
    id: 'prism',
    label: 'Regenbogen-Prisma',
    tagline: 'Farb-Zauber & Regenbogen-Funken',
    description: 'Lässt berührte Seifenblasen beim Hovern lebhafte Partikel-Funken in allen Farben des Regenbogens versprühen.',
    iconName: 'prism',
  },
  {
    id: 'chime',
    label: 'Klang-Resonator',
    tagline: 'Harmonische Theremin-Schwingung',
    description: 'Bringt Seifenblasen bei Berührung sanft zum Schwingen und Klingen, ohne dass sie platzen.',
    iconName: 'chime',
  },
];
