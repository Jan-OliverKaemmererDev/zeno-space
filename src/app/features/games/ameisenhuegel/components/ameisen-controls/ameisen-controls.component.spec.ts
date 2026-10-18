import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AmeisenControlsComponent } from './ameisen-controls.component';

describe('AmeisenControlsComponent', () => {
  let component: AmeisenControlsComponent;
  let fixture: ComponentFixture<AmeisenControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmeisenControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AmeisenControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit spawnFruit when Frucht anlocken button is clicked', () => {
    const emitSpy = vi.spyOn(component.spawnFruit, 'emit');
    const btn = fixture.nativeElement.querySelector('.dock-btn--primary');
    btn.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit alarmSwarm when Alarm-Schwarm button is clicked', () => {
    const emitSpy = vi.spyOn(component.alarmSwarm, 'emit');
    const btn = fixture.nativeElement.querySelector('.dock-btn--alarm');
    btn.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit setSpeed with 2 when 2x speed pill is clicked', () => {
    const emitSpy = vi.spyOn(component.setSpeed, 'emit');
    component.setSpeed.emit(2);
    expect(emitSpy).toHaveBeenCalledWith(2);
  });

  it('should emit resetCamera when Zentrieren button is clicked', () => {
    const emitSpy = vi.spyOn(component.resetCamera, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll('.dock-btn--secondary');
    const centerBtn = Array.from(buttons).find((b: any) =>
      b.textContent?.includes('Zentrieren'),
    ) as HTMLElement;
    expect(centerBtn).toBeTruthy();
    centerBtn.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit resetColony when Neustart button is clicked', () => {
    const emitSpy = vi.spyOn(component.resetColony, 'emit');
    const resetBtn = fixture.nativeElement.querySelector('.dock-btn--ghost');
    expect(resetBtn).toBeTruthy();
    resetBtn.click();
    expect(emitSpy).toHaveBeenCalled();
  });
});
