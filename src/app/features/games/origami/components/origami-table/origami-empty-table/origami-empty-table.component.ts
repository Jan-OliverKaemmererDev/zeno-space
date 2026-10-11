import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Placeholder component shown on the empty wooden desktop before an animal motif is selected.
 */
@Component({
  selector: 'app-origami-empty-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-table-placeholder" role="region" aria-label="Leerer Schreibtisch">
      <div class="placeholder-paper-ghost">
        <svg width="120" height="120" viewBox="0 0 100 100" class="ghost-svg" aria-hidden="true">
          <rect x="15" y="15" width="70" height="70" rx="4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="5,5" />
          <line x1="15" y1="15" x2="85" y2="85" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3,3" />
          <polygon points="15,85 85,85 50,50" fill="currentColor" opacity="0.12" />
        </svg>
        <div class="ghost-shimmer"></div>
      </div>

      <h2 class="placeholder-title">Dein Faltpapier wartet</h2>
      <p class="placeholder-desc">
        Wähle rechts am Rand dein gewünschtes Motiv (<strong>Kranich</strong>, <strong>Eule</strong> oder <strong>Schildkröte</strong>)
        sowie deine Papierfarbe, um das Blatt auf den Tisch zu legen.
      </p>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      width: 100%;
    }

    .empty-table-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 460px;
      padding: 36px 32px;
      border-radius: 28px;
      background: rgba(18, 10, 7, 0.45);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1.5px dashed rgba(254, 215, 170, 0.28);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      animation: fadeIn 0.6s ease-out;

      .placeholder-paper-ghost {
        position: relative;
        width: 130px;
        height: 130px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        color: #fed7aa;
        filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.35));

        .ghost-svg {
          display: block;
        }
      }

      .placeholder-title {
        font-size: 1.35rem;
        font-weight: 700;
        color: #fff7ed;
        margin: 0 0 10px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
      }

      .placeholder-desc {
        font-size: 0.92rem;
        line-height: 1.55;
        color: #fed7aa;
        opacity: 0.9;
        margin: 0;

        strong {
          color: #ffffff;
          font-weight: 700;
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrigamiEmptyTableComponent {}
