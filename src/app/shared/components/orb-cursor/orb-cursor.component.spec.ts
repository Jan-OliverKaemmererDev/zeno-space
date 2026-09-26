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
    expect(component.isTrembling()).toBe(false);
  });

  it('should apply is-trembling class when isTrembling signal is true', () => {
    component.isTrembling.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.orb-cursor-host')?.classList.contains('is-trembling')).toBe(true);
  });

  it('should apply in-sanctuary class when isSanctuary signal is true', () => {
    component.isSanctuary.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.orb-cursor-host')?.classList.contains('in-sanctuary')).toBe(true);
  });

  it('should apply is-hovering class when isHovering signal is true', () => {
    component.isHovering.set(true);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.orb-cursor-host')?.classList.contains('is-hovering')).toBe(true);
  });

  it('should render the glass orb container with card-cta glass body', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.orb-cursor-wrapper')).toBeTruthy();
    expect(compiled.querySelector('.orb-glass-body')).toBeTruthy();
    expect(compiled.querySelector('.orb-ambient-glow')).toBeTruthy();
  });

  it('should render the single orbit particle system with 8 particles and sparks canvas', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.cursor-orbit-system')).toBeTruthy();
    expect(compiled.querySelectorAll('.cursor-orbit-particle').length).toBe(8);
    expect(compiled.querySelector('.cursor-sparks-canvas')).toBeTruthy();
  });
});
