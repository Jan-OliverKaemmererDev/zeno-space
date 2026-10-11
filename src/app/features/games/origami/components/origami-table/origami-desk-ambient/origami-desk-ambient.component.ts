import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Ambient background layer for the wooden desktop:
 * - Hinoki wood grain overlay
 * - Soft overhead lamp lighting
 * - Resting Sakura petals
 * - Drifting ambient Sakura breeze
 */
@Component({
  selector: 'app-origami-desk-ambient',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wood-grain-overlay" aria-hidden="true"></div>
    <div class="desk-ambient-light" aria-hidden="true"></div>

    <div class="desk-props" aria-hidden="true">
      <!-- Scattered Resting Sakura Petals -->
      <div class="prop-sakura petal-1"></div>
      <div class="prop-sakura petal-2"></div>
      <div class="prop-sakura petal-3"></div>
      <div class="prop-sakura petal-4"></div>
      <div class="prop-sakura petal-5"></div>
      <div class="prop-sakura petal-6"></div>
      <div class="prop-sakura petal-7"></div>
      <div class="prop-sakura petal-8"></div>
      <div class="prop-sakura petal-9"></div>

      <!-- Gentle Drifting Sakura Petals -->
      <div class="drifting-sakura drift-1"></div>
      <div class="drifting-sakura drift-2"></div>
      <div class="drifting-sakura drift-3"></div>
      <div class="drifting-sakura drift-4"></div>
      <div class="drifting-sakura drift-5"></div>
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      display: block;
    }

    .desk-ambient-light {
      position: absolute;
      top: 10%;
      left: 30%;
      width: 65vw;
      height: 65vh;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(254, 215, 170, 0.12) 0%, rgba(251, 146, 60, 0.03) 50%, transparent 75%);
      filter: blur(40px);
      pointer-events: none;
      z-index: 1;
    }

    .desk-props {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
    }

    .prop-sakura {
      position: absolute;
      width: 17px;
      height: 25px;
      background: linear-gradient(135deg, #fce7f3 0%, #f472b6 60%, #ec4899 100%);
      border-radius: 65% 35% 65% 35% / 70% 30% 70% 30%;
      box-shadow: 2px 5px 12px rgba(0, 0, 0, 0.42);
      opacity: 0.88;
      pointer-events: none;

      &.petal-1 { top: 75px; left: 80px; transform: rotate(28deg); }
      &.petal-2 { top: 110px; left: 135px; transform: rotate(-48deg) scale(0.9); }
      &.petal-3 { top: 155px; left: 65px; transform: rotate(82deg) scale(0.85); }
      &.petal-4 { bottom: 95px; left: 75px; transform: rotate(-65deg) scale(0.95); }
      &.petal-5 { bottom: 60px; left: 140px; transform: rotate(35deg) scale(0.88); }
      &.petal-6 { bottom: 150px; left: 110px; transform: rotate(115deg) scale(0.78); }
      &.petal-7 { top: 90px; right: 380px; transform: rotate(105deg) scale(0.92); }
      &.petal-8 { top: 145px; right: 430px; transform: rotate(-25deg) scale(0.82); }
      &.petal-9 { bottom: 85px; right: 390px; transform: rotate(-42deg) scale(0.86); }
    }

    .drifting-sakura {
      position: absolute;
      width: 18px;
      height: 26px;
      background: linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(244, 114, 182, 0.85) 65%, rgba(236, 72, 153, 0.75) 100%);
      border-radius: 65% 35% 65% 35% / 70% 30% 70% 30%;
      box-shadow: 2px 4px 10px rgba(0, 0, 0, 0.35);
      opacity: 0;
      pointer-events: none;

      &.drift-1 { top: -40px; left: 8%; animation: sakuraBreezeDiagonal 28s 0s infinite linear; }
      &.drift-2 { top: -40px; left: 28%; animation: sakuraBreezeWide 32s 6s infinite linear; }
      &.drift-3 { top: -40px; left: 55%; animation: sakuraBreezeDiagonal 30s 14s infinite linear; }
      &.drift-4 { top: -40px; left: 78%; animation: sakuraBreezeWide 34s 20s infinite linear; }
      &.drift-5 { top: -40px; left: 40%; animation: sakuraBreezeDiagonal 36s 26s infinite linear; }
    }

    @keyframes sakuraBreezeDiagonal {
      0% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(0.8); }
      10% { opacity: 0.85; }
      90% { opacity: 0.85; }
      100% { opacity: 0; transform: translate(320px, 980px) rotate(420deg) scale(1); }
    }

    @keyframes sakuraBreezeWide {
      0% { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(0.85); }
      10% { opacity: 0.9; }
      90% { opacity: 0.9; }
      100% { opacity: 0; transform: translate(440px, 1020px) rotate(-380deg) scale(0.95); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrigamiDeskAmbientComponent {}
