import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CosmosViewMode, MoleculeDef, GenomeSpecies } from '../../models/elemente.types';

@Component({
  selector: 'app-kosmos-dock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kosmos-dock.component.html',
  styleUrl: './kosmos-dock.component.scss',
})
export class KosmosDockComponent {
  readonly activeMode = input.required<CosmosViewMode>();
  readonly activeCategory = input<string | null>(null);
  readonly activeState = input<string | null>(null);

  // Molecule mode inputs
  readonly moleculesList = input<MoleculeDef[]>([]);
  readonly selectedMolecule = input<MoleculeDef | null>(null);

  // Genome mode inputs
  readonly speciesList = input<GenomeSpecies[]>([]);
  readonly selectedSpecies = input<GenomeSpecies | null>(null);
  readonly activeSpeciesGroup = input<string | null>(null);

  // Outputs
  readonly changeMode = output<CosmosViewMode>();
  readonly filterCategory = output<string | null>();
  readonly filterState = output<string | null>();
  readonly filterSpeciesGroup = output<string | null>();
  readonly selectMolecule = output<MoleculeDef>();
  readonly selectSpecies = output<GenomeSpecies>();

  // Drag-to-scroll support for scrollable strips
  private isStripDragging = false;
  hasStripDragged = false;
  private stripDragStartX = 0;
  private stripScrollStartX = 0;
  private activeScrollEl: HTMLElement | null = null;

  onStripPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.isStripDragging = true;
    this.hasStripDragged = false;
    this.stripDragStartX = event.clientX;
    const el = event.currentTarget as HTMLElement;
    this.activeScrollEl = el;
    this.stripScrollStartX = el ? el.scrollLeft : 0;
  }

  onStripPointerMove(event: PointerEvent): void {
    if (!this.isStripDragging || !this.activeScrollEl) return;
    const dx = event.clientX - this.stripDragStartX;
    if (Math.abs(dx) > 5) {
      this.hasStripDragged = true;
    }
    if (this.hasStripDragged) {
      this.activeScrollEl.scrollLeft = this.stripScrollStartX - dx;
    }
  }

  onStripPointerUp(): void {
    if (!this.isStripDragging) return;
    this.isStripDragging = false;
    this.activeScrollEl = null;
    setTimeout(() => {
      this.hasStripDragged = false;
    }, 120);
  }

  onStripWheel(event: WheelEvent): void {
    const el = event.currentTarget as HTMLElement;
    if (el) {
      el.scrollLeft += event.deltaY || event.deltaX;
    }
  }

  onMoleculeClick(mol: MoleculeDef): void {
    if (this.hasStripDragged) return;
    this.selectMolecule.emit(mol);
  }

  onSpeciesClick(spec: GenomeSpecies): void {
    if (this.hasStripDragged) return;
    this.selectSpecies.emit(spec);
  }
}
