import { Injectable, signal } from '@angular/core';
import { Minigame } from '../models/minigame.model';

@Injectable({
  providedIn: 'root',
})
export class GameRegistryService {
  readonly games = signal<Minigame[]>([
    {
      id: 'cosmic-sculptor',
      title: 'Cosmic Zen Sculptor',
      subtitle: '3D Gravitations-Kosmos',
      description: 'Erschaffe leuchtende Himmelskörper in einem interaktiven 3D-Universum mit Three.js, sanften Umlaufbahnen und leuchtenden Sternenschweifen.',
      badge: '3D WebGL',
      route: '/game/cosmic-sculptor',
      icon: 'cosmos',
      primaryColor: '#c4b5fd',
      glowColor: 'rgba(196, 181, 253, 0.28)',
      tags: ['3D', 'Space', 'Physik', 'Entspannung'],
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
      route: '/game/bubble-harmony',
      icon: 'bubble',
      primaryColor: '#93c5fd',
      glowColor: 'rgba(147, 197, 253, 0.28)',
      tags: ['Audio', 'Seifenblasen', 'Harmonie'],
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
      route: '/game/zen-sand',
      icon: 'zen',
      primaryColor: '#fed7aa',
      glowColor: 'rgba(254, 215, 170, 0.28)',
      tags: ['Meditation', 'Zeichnen', 'Muster', 'Achtsamkeit'],
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
      route: '/game/soundscape-mixer',
      icon: 'soundscape',
      primaryColor: '#fde68a',
      glowColor: 'rgba(253, 230, 138, 0.28)',
      tags: ['Klangkulisse', 'Fokus', 'Atmosphäre'],
      floatDelay: '2.1s',
      floatDuration: '9.8s',
      sizeClass: 'bubble--sm',
    },
  ]);

  getGameById(id: string): Minigame | undefined {
    return this.games().find((game) => game.id === id);
  }
}
