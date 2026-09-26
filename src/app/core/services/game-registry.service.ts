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
    },
    {
      id: 'zen-sand',
      title: 'Zen Sand & Ripple',
      subtitle: 'Taktiles Meditations-Muster',
      description: 'Ziehe beruhigende Linien und Wellenmuster in feinen kosmischen Sand, platziere glatte Kieselsteine und beobachte schwebende Sternenblüten.',
      badge: 'Chill Sandbox',
      category: 'natur',
      route: '/game/zen-sand',
      icon: 'zen',
      primaryColor: '#fed7aa',
      glowColor: 'rgba(254, 215, 170, 0.28)',
      tags: ['Natur'],
      floatDelay: '0.8s',
      floatDuration: '8.5s',
      sizeClass: 'bubble--md',
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
