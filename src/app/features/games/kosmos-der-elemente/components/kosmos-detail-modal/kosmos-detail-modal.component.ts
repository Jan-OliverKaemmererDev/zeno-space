import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PeriodicElement, MoleculeDef, GenomeSpecies, CosmosViewMode } from '../../models/elemente.types';

@Component({
  selector: 'app-kosmos-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kosmos-detail-modal.component.html',
  styleUrl: './kosmos-detail-modal.component.scss',
})
export class KosmosDetailModalComponent {
  readonly activeMode = input.required<CosmosViewMode>();
  readonly selectedElement = input<PeriodicElement | null>(null);
  readonly selectedMolecule = input<MoleculeDef | null>(null);
  readonly selectedSpecies = input<GenomeSpecies | null>(null);
  readonly isBohrActive = input<boolean>(false);

  readonly close = output<void>();
  readonly toggleBohrAtom = output<void>();
  readonly prevSpecies = output<void>();
  readonly nextSpecies = output<void>();

  getHumanReadableShells(shells: number[]): string {
    const letters = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
    return shells.map((count, i) => `${letters[i] || i + 1}: ${count}`).join(' • ');
  }
}

