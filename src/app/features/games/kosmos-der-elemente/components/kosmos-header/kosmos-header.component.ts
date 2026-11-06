import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CosmosViewMode } from '../../models/elemente.types';

@Component({
  selector: 'app-kosmos-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kosmos-header.component.html',
  styleUrl: './kosmos-header.component.scss',
})
export class KosmosHeaderComponent {
  readonly activeMode = input.required<CosmosViewMode>();
  readonly searchQuery = input<string>('');
  readonly isSoundEnabled = input<boolean>(true);
  readonly itemCountLabel = input<string>('');

  readonly searchChange = output<string>();
  readonly toggleSound = output<void>();
  readonly leaveGame = output<void>();

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchChange.emit(val);
  }

  clearSearch(): void {
    this.searchChange.emit('');
  }
}

