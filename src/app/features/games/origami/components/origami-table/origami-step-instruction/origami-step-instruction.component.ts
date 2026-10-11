import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrigamiStateService } from '../../../services/origami-state.service';

/**
 * Component presenting the folding instructions, crease type badge, and zen tips
 * beneath the floating 3D paper model.
 */
@Component({
  selector: 'app-origami-step-instruction',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (state.currentStep(); as step) {
      <div class="paper-instruction-box" role="region" aria-label="Faltanweisung">
        <div class="instruction-header">
          <span class="fold-type-tag" [class]="'tag--' + step.creaseType">
            {{
              step.creaseType === 'valley'
                ? 'Talfalte'
                : step.creaseType === 'mountain'
                ? 'Bergfalte'
                : step.creaseType === 'squash'
                ? 'Quetschfalte'
                : step.creaseType === 'petal'
                ? 'Blütenblattfalte'
                : step.creaseType === 'turnover'
                ? 'Wenden'
                : 'Formvollendung'
            }}
          </span>
          <p class="instruction-text">{{ step.instruction }}</p>
        </div>

        @if (step.tip) {
          <div class="tip-row">
            <span class="tip-icon">💡</span>
            <span class="tip-text">{{ step.tip }}</span>
          </div>
        }

        <div class="step-cta-hint">
          <span>👉 Weiter geht es über den Button <strong>„Falten“</strong> in der unteren Steuerleiste</span>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 480px;
    }

    .paper-instruction-box {
      margin-top: 14px;
      width: 100%;
      padding: 12px 20px;
      border-radius: 18px;
      background: rgba(18, 10, 7, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(254, 215, 170, 0.25);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);

      .instruction-header {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .fold-type-tag {
        display: inline-block;
        padding: 3px 9px;
        border-radius: 6px;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        background: rgba(244, 114, 182, 0.25);
        color: #fbcfe8;
        border: 1px solid rgba(244, 114, 182, 0.4);

        &.tag--mountain {
          background: rgba(249, 115, 22, 0.25);
          color: #fed7aa;
          border-color: rgba(249, 115, 22, 0.45);
        }

        &.tag--squash {
          background: rgba(168, 85, 247, 0.25);
          color: #e9d5ff;
          border-color: rgba(168, 85, 247, 0.4);
        }

        &.tag--petal {
          background: rgba(236, 72, 153, 0.25);
          color: #fbcfe8;
          border-color: rgba(236, 72, 153, 0.45);
        }

        &.tag--turnover {
          background: rgba(56, 189, 248, 0.25);
          color: #bae6fd;
          border-color: rgba(56, 189, 248, 0.4);
        }

        &.tag--final {
          background: rgba(251, 191, 36, 0.3);
          color: #fef08a;
          border-color: rgba(251, 191, 36, 0.5);
        }
      }

      .instruction-text {
        margin: 0;
        font-size: 0.88rem;
        font-weight: 600;
        line-height: 1.45;
        color: #fff7ed;
        flex: 1;
        min-width: 220px;
      }

      .tip-row {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        color: #fed7aa;
        opacity: 0.9;
      }

      .step-cta-hint {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 0.78rem;
        color: #fde68a;
        opacity: 0.95;

        strong {
          color: #ffffff;
          font-weight: 700;
        }
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrigamiStepInstructionComponent {
  readonly state = inject(OrigamiStateService);
}
