import { MandelbrotWaypoint } from '../models/mandelbrot.types';

/**
 * Curated list of iconic coordinates within the Mandelbrot set.
 * The primary preset is derived from the renowned Wikipedia deep zoom animation:
 * https://en.wikipedia.org/wiki/File:Mandelbrot_sequence_new.gif
 */
export const MANDELBROT_WAYPOINTS: MandelbrotWaypoint[] = [
  {
    id: 'wikipedia-sequence',
    name: 'Scepter-Tal (Wikipedia)',
    subtitle: 'Tiefer Zoom in die Spiral-Filamente',
    center: {
      re: -0.7436438870371587,
      im: 0.131825904205312,
    },
    zoom: 25000.0,
    maxIterations: 360,
    description:
      'Die berühmte Wikipedia-Animationssequenz. An der Schnittstelle von Hauptkardioide und Period-3-Knospe entfalten sich endlose, ineinandergreifende goldene Spiralen.',
  },
  {
    id: 'seahorse-valley',
    name: 'Seepferdchen-Tal',
    subtitle: 'Doppelspiralen & filigrane Fäden',
    center: {
      re: -0.7485,
      im: 0.095,
    },
    zoom: 280.0,
    maxIterations: 180,
    description:
      'Das wohl bekannteste Tal der Mandelbrot-Menge. Zwischen der Hauptkardioide und dem linken Kreis bilden sich charakteristische Doppelspiralen, die Seepferdchen-Schwänzen ähneln.',
  },
  {
    id: 'mini-mandelbrot',
    name: 'Mini-Mandelbrot Satellit',
    subtitle: 'Verblüffende Selbstähnlichkeit',
    center: {
      re: -1.768778833,
      im: -0.001738994,
    },
    zoom: 1400.0,
    maxIterations: 260,
    description:
      'Auf der Hauptantenne verborgen: Eine miniaturisierte, perfekte Kopie der gesamten Mandelbrot-Menge, eingehüllt in ein Gespinst aus goldenen Filamenten.',
  },
  {
    id: 'elephant-valley',
    name: 'Elefanten-Tal',
    subtitle: 'Sanft gewundene Rüssel & Bögen',
    center: {
      re: 0.281718,
      im: 0.01773,
    },
    zoom: 450.0,
    maxIterations: 200,
    description:
      'Am östlichen Rand der Hauptkardioide wachsen weiche, gebogene Bögen empor, die an stilisierte Elefantenrüssel und schwebende Bögen erinnern.',
  },
  {
    id: 'overview',
    name: 'Kosmische Gesamtansicht',
    subtitle: 'Hauptkardioide & primäre Knospen',
    center: {
      re: -0.65,
      im: 0.0,
    },
    zoom: 1.0,
    maxIterations: 100,
    description:
      'Die vollständige Mandelbrot-Menge in all ihrer Erhabenheit: Die zentrale Herzkurve (Kardioide) und die unendliche Kette kreisförmiger Satellitenknospen.',
  },
];

export const DEFAULT_WAYPOINT = MANDELBROT_WAYPOINTS[0];
