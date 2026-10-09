import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GrasCelestialTrayComponent } from './gras-celestial-tray.component';

describe('GrasCelestialTrayComponent', () => {
  let component: GrasCelestialTrayComponent;
  let fixture: ComponentFixture<GrasCelestialTrayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrasCelestialTrayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GrasCelestialTrayComponent);
    component = fixture.componentInstance;
    component.timeOfDay = 'day';
    fixture.detectChanges();
  });

  it('should create the celestial tray component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit timeOfDayChange when a new time is selected', () => {
    const changeSpy = vi.fn();
    component.timeOfDayChange.subscribe(changeSpy);

    component.setTime('golden');
    expect(changeSpy).toHaveBeenCalledWith('golden');
  });

  it('should not emit timeOfDayChange if same time is selected', () => {
    const changeSpy = vi.fn();
    component.timeOfDayChange.subscribe(changeSpy);

    component.setTime('day');
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('should apply active class on active orb', () => {
    fixture.componentRef.setInput('timeOfDay', 'night');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const moonBtn = compiled.querySelector('.orb-moon');
    expect(moonBtn?.classList.contains('active')).toBe(true);
  });
});
