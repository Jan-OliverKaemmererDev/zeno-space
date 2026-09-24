import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavbarComponent, CategoryItem } from './navbar.component';
import { AudioService } from '../../../core/services/audio.service';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let audioService: AudioService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([
          { path: '', component: class {} },
          { path: 'game/cosmic-sculptor', component: class {} },
        ]),
        AudioService,
        SmoothScrollService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    audioService = TestBed.inject(AudioService);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create the navbar component with 6 categories', () => {
    expect(component).toBeTruthy();
    expect(component.categories.length).toBe(6);
    const categoryTitles = component.categories.map((c) => c.title);
    expect(categoryTitles).toContain('Mathematik');
    expect(categoryTitles).toContain('Astronomie');
    expect(categoryTitles).toContain('Natur');
    expect(categoryTitles).toContain('Geräusche');
    expect(categoryTitles).toContain('Relax');
    expect(categoryTitles).toContain('Abenteuer');
  });

  it('should initialize flightState to flying and transition to landed', () => {
    expect(component.flightState()).toBe('flying');
  });

  it('should toggle dropdown and trigger crane folding sound', () => {
    const playSoundSpy = vi.spyOn(audioService, 'playCraneFolding');

    expect(component.isDropdownOpen()).toBe(false);

    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);
    expect(playSoundSpy).toHaveBeenCalledWith(1.0);

    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(false);
    expect(playSoundSpy).toHaveBeenCalledTimes(2);
  });

  it('should close dropdown and play sound when closeDropdown is called', () => {
    const playSoundSpy = vi.spyOn(audioService, 'playCraneFolding');

    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);
    playSoundSpy.mockClear();

    component.closeDropdown();
    expect(component.isDropdownOpen()).toBe(false);
    expect(playSoundSpy).toHaveBeenCalledWith(1.0);
  });

  it('should close dropdown on escape key', () => {
    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);

    component.onEscape();
    expect(component.isDropdownOpen()).toBe(false);
  });

  it('should navigate and close dropdown when selecting an active category', () => {
    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);

    const cosmicCat = component.categories.find((c) => c.id === 'astronomie') as CategoryItem;
    expect(cosmicCat).toBeDefined();

    component.onCategoryClick(cosmicCat);
    expect(component.isDropdownOpen()).toBe(false);
  });

  it('should close dropdown when clicking outside the navbar', () => {
    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    const pointerEvent = new PointerEvent('pointerdown', { bubbles: true });
    Object.defineProperty(pointerEvent, 'target', { value: outsideElement, writable: false });

    component.onDocumentPointerDown(pointerEvent);
    expect(component.isDropdownOpen()).toBe(false);

    document.body.removeChild(outsideElement);
  });

  it('should not close dropdown when clicking inside the navbar', () => {
    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);

    const insideElement = fixture.nativeElement.querySelector('.crane-trigger-btn');
    const pointerEvent = new PointerEvent('pointerdown', { bubbles: true });
    Object.defineProperty(pointerEvent, 'target', { value: insideElement, writable: false });

    component.onDocumentPointerDown(pointerEvent);
    expect(component.isDropdownOpen()).toBe(true);
  });

  it('should close dropdown on upward wheel scroll', () => {
    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);

    const wheelUpEvent = new WheelEvent('wheel', { deltaY: -15 });
    component.onWindowWheel(wheelUpEvent);
    expect(component.isDropdownOpen()).toBe(false);
    expect(component.isDropdownClosing()).toBe(true);
  });

  it('should close dropdown on programmatic scroll destination update', () => {
    const smoothScroll = TestBed.inject(SmoothScrollService);
    component.toggleDropdown();
    expect(component.isDropdownOpen()).toBe(true);

    smoothScroll.programmaticScroll$.next(0);
    expect(component.isDropdownOpen()).toBe(false);
    expect(component.isDropdownClosing()).toBe(true);
  });
});
