import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RopePhysicsComponent } from './rope-physics.component';
import { VerletRopeSimulatorService } from './services/verlet-rope-simulator.service';
import { RopeDomSynchronizerService } from './services/rope-dom-synchronizer.service';

describe('RopePhysicsComponent', () => {
  let component: RopePhysicsComponent;
  let fixture: ComponentFixture<RopePhysicsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RopePhysicsComponent],
      providers: [VerletRopeSimulatorService, RopeDomSynchronizerService],
    }).compileComponents();

    fixture = TestBed.createComponent(RopePhysicsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize active state to false', () => {
    expect(component.active).toBe(false);
  });

  it('should update active property correctly', () => {
    component.active = true;
    expect(component.active).toBe(true);
    component.active = false;
    expect(component.active).toBe(false);
  });

  it('should handle onPointerLeave safely without errors', () => {
    expect(() => component.onPointerLeave()).not.toThrow();
  });

  it('should handle onPointerMove safely when rect is missing or 0', () => {
    expect(() => component.onPointerMove(100, 200)).not.toThrow();
  });
});
