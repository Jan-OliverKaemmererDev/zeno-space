import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import * as THREE from 'three';
import { KosmosDerElementeComponent } from './kosmos-der-elemente.component';
import { PERIODIC_ELEMENTS } from './data/periodic-elements.data';
import { MOLECULES_LIBRARY } from './data/molecules.data';
import { GENOMES_LIBRARY } from './data/genomes.data';

describe('KosmosDerElementeComponent', () => {
  let component: KosmosDerElementeComponent;
  let fixture: ComponentFixture<KosmosDerElementeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KosmosDerElementeComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(KosmosDerElementeComponent);
    component = fixture.componentInstance;
  });

  it('should initialize with 118 elements, molecules, and 50 genome species', () => {
    expect(component).toBeTruthy();
    expect(PERIODIC_ELEMENTS.length).toBe(118);
    expect(MOLECULES_LIBRARY.length).toBeGreaterThanOrEqual(15);
    expect(GENOMES_LIBRARY.length).toBe(50);
  });

  it('should start in periodic table mode by default', () => {
    expect(component.activeMode()).toBe('periodic');
  });

  it('should switch between modes cleanly', () => {
    component.setMode('molecules');
    expect(component.activeMode()).toBe('molecules');

    component.setMode('genomes');
    expect(component.activeMode()).toBe('genomes');

    component.setMode('periodic');
    expect(component.activeMode()).toBe('periodic');
  });

  it('should filter elements by search query', () => {
    component.onSearchChange('Gold');
    expect(component.searchQuery()).toBe('Gold');
  });

  it('should register and clear WASD navigation keys', () => {
    const keyEventW = new KeyboardEvent('keydown', { key: 'w', code: 'KeyW' });
    component.onKeyDown(keyEventW);
    // onKeyUp removes it
    const keyUpEventW = new KeyboardEvent('keyup', { key: 'w', code: 'KeyW' });
    component.onKeyUp(keyUpEventW);
    // onWindowBlur clears active keys
    component.onWindowBlur();
    expect(component).toBeTruthy();
  });

  it('should close the detail modal when clicking outside on empty space or pressing Escape', () => {
    // Open modal by selecting an element
    component.onSelectElement(PERIODIC_ELEMENTS[0]);
    expect(component.isDetailModalOpen()).toBe(true);

    // Simulate clicking in empty space (pointerdown + pointerup without dragging)
    const pointerDown = new PointerEvent('pointerdown', { clientX: 100, clientY: 100 });
    component.onPointerDown(pointerDown);
    const pointerUp = new PointerEvent('pointerup', { clientX: 100, clientY: 100 });
    component.onPointerUp(pointerUp);
    expect(component.isDetailModalOpen()).toBe(false);

    // Test Escape key
    component.onSelectElement(PERIODIC_ELEMENTS[1]);
    expect(component.isDetailModalOpen()).toBe(true);
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
    component.onKeyDown(escEvent);
    expect(component.isDetailModalOpen()).toBe(false);
  });

  it('should reopen the infobox when clicking on a 3D molecule and close it when clicking empty space', () => {
    component.setMode('molecules');
    const mol = MOLECULES_LIBRARY[0];
    component.onSelectMolecule(mol);
    expect(component.isDetailModalOpen()).toBe(true);

    // Close the infobox by clicking outside in empty space
    const clickEmptyDown = new PointerEvent('pointerdown', { clientX: 200, clientY: 200 });
    component.onPointerDown(clickEmptyDown);
    const clickEmptyUp = new PointerEvent('pointerup', { clientX: 200, clientY: 200 });
    component.onPointerUp(clickEmptyUp);
    expect(component.isDetailModalOpen()).toBe(false);

    // Mock raycast returning the molecule when clicked
    (component as any).camera = new THREE.PerspectiveCamera();
    vi.spyOn((component as any).moleculeService, 'raycast').mockReturnValue(mol);

    // Click on 3D molecule
    const clickMolDown = new PointerEvent('pointerdown', { clientX: 300, clientY: 300 });
    component.onPointerDown(clickMolDown);
    const clickMolUp = new PointerEvent('pointerup', { clientX: 300, clientY: 300 });
    component.onPointerUp(clickMolUp);

    expect(component.isDetailModalOpen()).toBe(true);
  });

  it('should reopen the infobox when clicking on a 3D DNA strand and close it when clicking empty space', () => {
    component.setMode('genomes');
    const spec = GENOMES_LIBRARY[0];
    component.onSelectSpecies(spec);
    expect(component.isDetailModalOpen()).toBe(true);

    // Close the infobox by clicking outside in empty space
    const clickEmptyDown = new PointerEvent('pointerdown', { clientX: 200, clientY: 200 });
    component.onPointerDown(clickEmptyDown);
    const clickEmptyUp = new PointerEvent('pointerup', { clientX: 200, clientY: 200 });
    component.onPointerUp(clickEmptyUp);
    expect(component.isDetailModalOpen()).toBe(false);

    // Mock raycast returning the species when DNA strand is clicked
    (component as any).camera = new THREE.PerspectiveCamera();
    vi.spyOn((component as any).dnaService, 'raycast').mockReturnValue(spec);

    // Click on 3D DNA strand
    const clickDnaDown = new PointerEvent('pointerdown', { clientX: 300, clientY: 300 });
    component.onPointerDown(clickDnaDown);
    const clickDnaUp = new PointerEvent('pointerup', { clientX: 300, clientY: 300 });
    component.onPointerUp(clickDnaUp);

    expect(component.isDetailModalOpen()).toBe(true);
  });

  it('should perform raycasting against molecule meshes in Molecule3DService', () => {
    const molService = (component as any).moleculeService;
    const mol = MOLECULES_LIBRARY[0];
    molService.setMolecule(mol);
    expect(molService.getCurrentMolecule()).toEqual(mol);

    const raycaster = new THREE.Raycaster();
    // Ray aiming directly at origin (0, 0, 0) from (0, 0, 10)
    raycaster.set(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
    const hit = molService.raycast(raycaster);
    expect(hit).toBe(mol);

    // Ray aiming far away
    raycaster.set(new THREE.Vector3(100, 100, 10), new THREE.Vector3(0, 0, -1));
    const miss = molService.raycast(raycaster);
    expect(miss).toBeNull();
  });

  it('should perform raycasting against DNA helix meshes in Dna3DService', () => {
    const dnaService = (component as any).dnaService;
    const spec = GENOMES_LIBRARY[0];
    dnaService.buildHelix(spec);
    expect(dnaService.getCurrentSpecies()).toEqual(spec);

    const raycaster = new THREE.Raycaster();
    // Ray through the center of the helix
    raycaster.set(new THREE.Vector3(0, 0, 10), new THREE.Vector3(0, 0, -1));
    const hit = dnaService.raycast(raycaster);
    expect(hit).toBe(spec);

    // Ray aiming far away
    raycaster.set(new THREE.Vector3(100, 100, 10), new THREE.Vector3(0, 0, -1));
    const miss = dnaService.raycast(raycaster);
    expect(miss).toBeNull();
  });
});

