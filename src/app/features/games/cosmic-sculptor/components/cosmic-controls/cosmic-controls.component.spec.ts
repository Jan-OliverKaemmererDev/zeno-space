import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CosmicControlsComponent } from './cosmic-controls.component';

describe('CosmicControlsComponent', () => {
  let component: CosmicControlsComponent;
  let fixture: ComponentFixture<CosmicControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CosmicControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CosmicControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit spawnPlanet when Planet erschaffen button is clicked', () => {
    const emitSpy = vi.spyOn(component.spawnPlanet, 'emit');
    const btn = fixture.nativeElement.querySelector('.dock-btn--primary');
    btn.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit spawnBlackHole when Schwarzes Loch button is clicked', () => {
    const emitSpy = vi.spyOn(component.spawnBlackHole, 'emit');
    const btn = fixture.nativeElement.querySelector('.dock-btn--black-hole');
    btn.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit setSpeed with 2 when 2x speed pill is clicked', () => {
    const emitSpy = vi.spyOn(component.setSpeed, 'emit');
    component.setSpeed.emit(2);
    expect(emitSpy).toHaveBeenCalledWith(2);
  });
});
