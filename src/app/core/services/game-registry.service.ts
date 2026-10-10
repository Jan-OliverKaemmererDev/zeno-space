import { Injectable, signal } from '@angular/core';
import { Minigame } from '../models/minigame.model';

/**
 * Service responsible for managing the registry of available minigames.
 * Provides the central list of games and manages category filtering state.
 */
@Injectable({
  providedIn: 'root',
})
export class GameRegistryService {
  /**
   * Signal containing the currently selected category ID for filtering games.
   * Null indicates no category is selected.
   */
  readonly selectedCategory = signal<string | null>(null);

  /**
   * Signal containing the minigame currently displayed in the instructions overlay.
   */
  readonly previewGame = signal<Minigame | null>(null);

  /**
   * Signal containing the static array of all registered minigames.
   */
  readonly games = signal<Minigame[]>([
    {
      id: 'cosmic-sculptor',
      title: 'Cosmic Zen Sculptor',
      subtitle: '3D Gravitations-Kosmos',
      description: 'Erschaffe leuchtende Himmelskörper in einem interaktiven 3D-Universum mit Three.js, sanften Umlaufbahnen und leuchtenden Sternenschweifen.',
      badge: '3D WebGL',
      category: 'astronomie',
      route: '/game/cosmic-sculptor',
      icon: 'cosmos',
      primaryColor: '#c4b5fd',
      glowColor: 'rgba(196, 181, 253, 0.28)',
      tags: ['Astronomie'],
      floatDelay: '0s',
      floatDuration: '9s',
      sizeClass: 'bubble--lg',
      controls: {
        keyboard: [
          {
            type: 'wasd',
            keys: ['W', 'A', 'S', 'D'],
            label: 'Kamera im 3D-Raum drehen',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          drag: true,
          wheel: true,
          label: 'Maus ziehen zum Rotieren & Mausrad zum Zoomen',
        },
        objective: 'Erschaffe leuchtende Himmelskörper und beobachte sanfte Gravitationsbahnen im All.',
      },
    },
    {
      id: 'bubble-harmony',
      title: 'Bubble Harmony',
      subtitle: 'Pentatonisches Seifenblasen-Popping',
      description: 'Puste schimmernde Seifenblasen in den Raum, lass sie sanft kollidieren und zum Klingen bringen mit harmonischen pentatonischen Akkorden.',
      badge: 'Zen Audio',
      category: 'relax',
      route: '/game/bubble-harmony',
      icon: 'bubble',
      primaryColor: '#93c5fd',
      glowColor: 'rgba(147, 197, 253, 0.28)',
      tags: ['Relax'],
      floatDelay: '1.4s',
      floatDuration: '10.5s',
      sizeClass: 'bubble--md',
      controls: {
        keyboard: [
          {
            type: 'space',
            keys: ['LEERTASTE'],
            label: 'Schwarm schillernder Blasen aufsteigen lassen',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          drag: true,
          label: 'Klicken zum Platzen & Halten zum Aufblasen',
        },
        objective: 'Bringe Seifenblasen mit harmonischen pentatonischen Tönen zum Klingen.',
      },
    },
    {
      id: 'pi-spiral',
      title: 'Pi Spiral Horizon',
      subtitle: 'Mathematische Mosaik-Meditation',
      description: 'Erwecke die unendlichen Ziffern der Kreiszahl Pi in einer schwebenden 3D-Mosaik-Spirale mit sanften Laola-Wellen und harmonischen Pastellklängen.',
      badge: '3D WebGL',
      category: 'mathematik',
      route: '/game/pi-spiral',
      icon: 'pi',
      primaryColor: '#fed7aa',
      glowColor: 'rgba(254, 215, 170, 0.28)',
      tags: ['Mathematik'],
      floatDelay: '0.8s',
      floatDuration: '8.5s',
      sizeClass: 'bubble--md',
      controls: {
        keyboard: [
          {
            type: 'space',
            keys: ['LEERTASTE'],
            label: '5 weitere Nachkommastellen hinzufügen',
          },
          {
            type: 'inline',
            keys: ['A', 'C'],
            label: 'A = Auto-Flow Modus, C = Kamera zentrieren',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          drag: true,
          wheel: true,
          label: 'Klicken für +5 Ziffern, Ziehen zum Neigen, Mausrad zum Zoomen',
        },
        objective: 'Entdecke die unendliche Spirale der Kreiszahl Pi mit tanzenden Mosaiksteinen und Laola-Wellen.',
      },
    },
    {
      id: 'goldener-schnitt',
      title: 'Goldener Schnitt',
      subtitle: 'Phyllotaxis-Meditation',
      description: 'Entfalte die göttliche Proportion in einer schwebenden 3D-Sonnenblumen-Phyllotaxis mit leuchtenden goldenen Ziffern und wachsenden Fibonacci-Spiralen.',
      badge: '3D WebGL',
      category: 'mathematik',
      route: '/game/goldener-schnitt',
      icon: 'phi',
      primaryColor: '#fcd34d',
      glowColor: 'rgba(252, 211, 77, 0.28)',
      tags: ['Mathematik'],
      floatDelay: '1.2s',
      floatDuration: '9.2s',
      sizeClass: 'bubble--md',
      controls: {
        keyboard: [
          {
            type: 'arrows',
            keys: ['↑', '←', '↓', '→'],
            label: 'Kamera im 3D-Raum bewegen',
          },
          {
            type: 'space',
            keys: ['LEERTASTE'],
            label: '5 weitere goldene Ziffern erzeugen',
          },
          {
            type: 'inline',
            keys: ['A', 'C'],
            label: 'A = Auto-Flow Modus, C = Kamera zentrieren',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          drag: true,
          wheel: true,
          label: 'Klicken für +5 Ziffern, Ziehen zum Neigen, Mausrad zum Zoomen',
        },
        objective: 'Erschaffe harmonische Sonnenblumen-Muster im goldenen Winkel (137,5°) und beobachte Fibonacci-Konvergenzen.',
      },
    },
    {
      id: 'mandelbrot-fraktal',
      title: 'Mandelbrot Fraktal',
      subtitle: '3D Tiefen-Meditation',
      description: 'Reise in die unendliche Tiefe der Mandelbrot-Menge mit flüssigen 3D-Zooms in warme, bernsteingoldene Spiralen und beruhigenden Sphärenklängen.',
      badge: '3D WebGL',
      category: 'mathematik',
      route: '/game/mandelbrot-fraktal',
      icon: 'mandelbrot',
      primaryColor: '#f59e0b',
      glowColor: 'rgba(245, 158, 11, 0.28)',
      tags: ['Mathematik'],
      floatDelay: '1.6s',
      floatDuration: '9.6s',
      sizeClass: 'bubble--md',
      controls: {
        keyboard: [
          {
            type: 'wasd',
            keys: ['W', 'A', 'S', 'D'],
            label: 'Starr nach oben, unten, links und rechts bewegen',
          },
          {
            type: 'arrows',
            keys: ['↑', '↓'],
            label: 'Hinein- und herauszoomen',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          wheel: true,
          label: 'Mausrad zum Zoomen dorthin wo die Maus zeigt',
        },
        objective: 'Tauche ein in unendliche fraktale Verästelungen und entdecke legendäre Orte wie das Seepferdchen- und Scepter-Tal.',
      },
    },
    {
      id: 'soundscape-mixer',
      title: 'Cozy Soundscape',
      subtitle: 'Binauraler Ambient-Raum',
      description: 'Kombiniere sanften Weltraumregen, Kaminfeuer, sanfte Synths und Sommernachtslüfte zu deinem persönlichen Einschlaf- und Fokus-Soundtrack.',
      badge: 'Creative',
      category: 'geraeusche',
      route: '/game/soundscape-mixer',
      icon: 'soundscape',
      primaryColor: '#fde68a',
      glowColor: 'rgba(253, 230, 138, 0.28)',
      tags: ['Geräusche'],
      floatDelay: '2.1s',
      floatDuration: '9.8s',
      sizeClass: 'bubble--sm',
      controls: {
        keyboard: [
          {
            type: 'inline',
            keys: ['1', '2', '3', '4'],
            label: 'Kanäle 1 bis 4 direkt umschalten',
          },
          {
            type: 'space',
            keys: ['LEERTASTE'],
            label: 'Audio stummschalten / fortsetzen',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          drag: true,
          label: 'Kanäle per Klick aktivieren & Lautstärke regeln',
        },
        objective: 'Mische Regen, Knisterfeuer und Sphärenklänge zu deiner persönlichen Traumkulisse.',
      },
    },
    {
      id: 'glueckskarte',
      title: 'Zen Glückskarte',
      subtitle: 'Tägliche Weisheits-Meditation',
      description: 'Ziehe täglich eine von 100 tiefsinnigen Karten aus Stoa, Buddhismus, Birkenbihl und Genies. Jede Weisheit genau einmal pro 100-Tage-Zyklus.',
      badge: 'Chill Sandbox',
      category: 'relax',
      route: '/game/glueckskarte',
      icon: 'clover',
      primaryColor: '#34d399',
      glowColor: 'rgba(52, 211, 153, 0.28)',
      tags: ['Relax'],
      floatDelay: '2.4s',
      floatDuration: '10.2s',
      sizeClass: 'bubble--md',
      controls: {
        keyboard: [
          {
            type: 'space',
            keys: ['LEERTASTE'],
            label: 'Tageskarte umdrehen & Weisheit enthüllen',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          label: 'Klicken zum Enthüllen der Tages-Glückskarte',
        },
        objective: 'Ziehe täglich genau eine Weisheit. Nach 100 Tagen startet ein neuer Zyklus.',
      },
    },
    {
      id: 'gras-harmonie',
      title: 'Gras-Harmonie',
      subtitle: 'Interaktive Wind- & Gras-Oase',
      description: 'Sei der Wind über einem endlosen saftigen Grasmeer. Bringe die Grashalme mit deinen Mausbewegungen zum Tanzen und lausche harmonischen Klängen unter majestätischen Kumulus-Wolken.',
      badge: '3D WebGL',
      category: 'natur',
      route: '/game/gras-harmonie',
      icon: 'grass',
      primaryColor: '#4ade80',
      glowColor: 'rgba(74, 222, 128, 0.35)',
      tags: ['Natur'],
      floatDelay: '1.5s',
      floatDuration: '9.6s',
      sizeClass: 'bubble--lg',
      controls: {
        keyboard: [
          {
            type: 'inline',
            keys: ['1', '2', '3'],
            label: 'Tageszeit wechseln (Mittag, Goldene Stunde, Nacht)',
          },
          {
            type: 'space',
            keys: ['LEERTASTE'],
            label: 'Weite Windböe über das gesamte Feld wehen lassen',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          drag: true,
          label: 'Maus bewegen = Wind streicht durchs Gras, Klicken = Wirbelwind',
        },
        objective: 'Streiche mit der Maus sanft oder schwungvoll durch das hohe Gras und lausche den beruhigenden Harmonien.',
      },
    },
    {
      id: 'origami',
      title: 'Zen Origami',
      subtitle: 'Traditionelle Papierfalt-Kunst',
      description: 'Blicke aus der Vogelperspektive auf einen warmen Holztisch und falte Schritt für Schritt Kranich, Eule oder Schildkröte mit sanften Papierklängen und Achtsamkeit.',
      badge: 'Chill Sandbox',
      category: 'relax',
      route: '/game/origami',
      icon: 'origami',
      primaryColor: '#f472b6',
      glowColor: 'rgba(244, 114, 182, 0.35)',
      tags: ['Relax', 'Kreativ'],
      floatDelay: '1.8s',
      floatDuration: '9.4s',
      sizeClass: 'bubble--md',
      controls: {
        keyboard: [
          {
            type: 'space',
            keys: ['LEERTASTE', '→'],
            label: 'Nächsten Faltschritt ausführen',
          },
          {
            type: 'inline',
            keys: ['←'],
            label: 'Einen Schritt zurück',
          },
          {
            type: 'inline',
            keys: ['1', '2', '3'],
            label: 'Motiv wählen (Kranich, Eule, Schildkröte)',
          },
          {
            type: 'inline',
            keys: ['ESC'],
            label: 'Zurück zur Übersicht',
          },
        ],
        mouse: {
          leftClick: true,
          label: 'Klicke auf das Papier oder die leuchtende Ecke zum Falten',
        },
        objective: 'Wähle dein Motiv und deine Papierfarbe und falte das Origami Schritt für Schritt originalgetreu nach.',
      },
    },
  ]);

  /**
   * Sets the currently active category for filtering the game list.
   *
   * @param categoryId - The unique identifier of the category to select, or null to clear the selection.
   */
  setSelectedCategory(categoryId: string | null): void {
    this.selectedCategory.set(categoryId);
  }

  /**
   * Retrieves a minigame configuration by its unique identifier.
   *
   * @param id - The unique identifier of the game to retrieve.
   * @returns The Minigame object if found, otherwise undefined.
   */
  getGameById(id: string): Minigame | undefined {
    return this.games().find((game) => game.id === id);
  }
}
