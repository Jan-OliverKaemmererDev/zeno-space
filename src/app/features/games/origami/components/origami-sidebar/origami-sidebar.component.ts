import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrigamiStateService } from '../../services/origami-state.service';
import { OrigamiPatternId } from '../../models/origami.models';

/**
 * Right-side Origami Atelier Sidebar featuring:
 * - Animal motif selection: Kranich, Eule, Schildkröte
 * - Paper color & authentic Washi pattern picker
 * - Mobile slide drawer toggle
 */
@Component({
  selector: 'app-origami-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './origami-sidebar.component.html',
  styleUrl: './origami-sidebar.component.scss',
})
export class OrigamiSidebarComponent {
  readonly state = inject(OrigamiStateService);

  /** Whether the sidebar drawer is expanded on small screens */
  readonly isMobileOpen = signal<boolean>(false);

  toggleMobileDrawer(): void {
    this.isMobileOpen.update((v) => !v);
  }

  onSelectPattern(id: OrigamiPatternId): void {
    this.state.selectPattern(id);
    this.isMobileOpen.set(false);
  }

  onSelectColor(styleId: string): void {
    this.state.selectPaperStyle(styleId);
  }
}
