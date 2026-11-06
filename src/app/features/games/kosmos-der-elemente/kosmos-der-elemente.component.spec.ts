import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});

