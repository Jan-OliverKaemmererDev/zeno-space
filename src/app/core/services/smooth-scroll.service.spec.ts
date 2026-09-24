import { TestBed } from '@angular/core/testing';
import { SmoothScrollService } from './smooth-scroll.service';

describe('SmoothScrollService', () => {
  let service: SmoothScrollService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SmoothScrollService],
    });
    service = TestBed.inject(SmoothScrollService);
  });

  it('should be created with initial neutral overscroll', () => {
    expect(service).toBeTruthy();
    expect(service.overscrollOffset()).toBe(0);
    expect(service.isOverscrolling()).toBe(false);
  });

  it('should register and configure a container element', () => {
    const dummyElement = document.createElement('div');
    service.registerContainer(dummyElement);

    expect(dummyElement.style.willChange).toBe('transform');
    expect(dummyElement.style.transformOrigin).toBe('center top');

    service.registerContainer(null);
  });

  it('should reset overscroll when synced with current scroll', () => {
    service.syncWithCurrentScroll();
    expect(service.overscrollOffset()).toBe(0);
    expect(service.isOverscrolling()).toBe(false);
  });

  it('should disable and stop physics loop when setEnabled(false) is called', () => {
    service.setEnabled(false);
    expect(service.overscrollOffset()).toBe(0);
    expect(service.isScrolling()).toBe(false);
  });
});
