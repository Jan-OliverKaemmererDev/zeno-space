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

  it('should not set isHovering when mouse enters .orb-3d-container or its children', () => {
    window.matchMedia = ((query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as any;

    const testFixture = TestBed.createComponent(OrbCursorComponent);
    const testComp = testFixture.componentInstance;
    testFixture.detectChanges();

    const container = document.createElement('div');
    container.className = 'orb-3d-container';
    const btn = document.createElement('button');
    btn.className = 'orb-target-btn';
    container.appendChild(btn);
    document.body.appendChild(container);

    btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(testComp.isHovering()).toBe(false);

    container.remove();
    testFixture.destroy();
  });
});
