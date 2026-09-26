import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrbCursorComponent } from './orb-cursor.component';

describe('OrbCursorComponent', () => {
  let component: OrbCursorComponent;
  let fixture: ComponentFixture<OrbCursorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrbCursorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OrbCursorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the orb cursor component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default states', () => {
    expect(component.isVisible()).toBe(false);
    expect(component.isHovering()).toBe(false);
    expect(component.isClicking()).toBe(false);
  });

  it('should render the glass orb container with card-cta glass body', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.orb-cursor-wrapper')).toBeTruthy();
    expect(compiled.querySelector('.orb-glass-body')).toBeTruthy();
    expect(compiled.querySelector('.orb-ambient-glow')).toBeTruthy();
  });

  it('should render the 2-orbit particle system with 12 particles and sparks canvas', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.cursor-orbit-system')).toBeTruthy();
    expect(compiled.querySelectorAll('.cursor-orbit-particle').length).toBe(12);
    expect(compiled.querySelector('.cursor-sparks-canvas')).toBeTruthy();
  });
});
