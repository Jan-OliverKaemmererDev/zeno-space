import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Displays user progression across the 100-card cycle and a countdown
 * until the next day's card is unlockable.
 */
@Component({
  selector: 'app-lucky-progress',
  standalone: true,
  templateUrl: './lucky-progress.component.html',
  styleUrls: ['./lucky-progress.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LuckyProgressComponent {
  @Input() seenCount = 0;
  @Input() totalCount = 100;
  @Input() cycleCount = 1;
  @Input() percentage = 0;
  @Input() canDrawToday = true;
  @Input() countdownFormatted = '';
}
