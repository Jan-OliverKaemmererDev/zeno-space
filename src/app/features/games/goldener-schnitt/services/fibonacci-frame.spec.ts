import * as THREE from 'three';
import { FibonacciFrame } from './fibonacci-frame';

describe('FibonacciFrame', () => {
  let frame: FibonacciFrame;
  let group: THREE.Group;

  beforeEach(() => {
    frame = new FibonacciFrame();
    group = new THREE.Group();
  });

  afterEach(() => {
    frame.dispose(group);
  });

  it('should initialize and add frame to the parent group with starfield and galaxies', () => {
    frame.init(group);
    expect(group.children.length).toBe(1);
    const frameGroup = group.children[0] as THREE.Group;
    // Frame group contains: goldenElementsGroup, starfieldPoints, galaxyTopRight, galaxyBottomLeft
    expect(frameGroup.children.length).toBe(4);

    const goldenGroup = frameGroup.children[0] as THREE.Group;
    expect(goldenGroup.children.length).toBe(3); // squares, spiral, pollen

    const starfield = frameGroup.children[1] as THREE.Points;
    expect(starfield).toBeInstanceOf(THREE.Points);
    const starfieldMat = starfield.material as THREE.PointsMaterial;
    expect(starfieldMat.size).toBe(0.16);

    const galaxyTopRight = frameGroup.children[2] as THREE.Group;
    expect(galaxyTopRight).toBeInstanceOf(THREE.Group);
    expect(galaxyTopRight.position.x).toBeGreaterThan(0);
    expect(galaxyTopRight.position.y).toBeGreaterThan(0);

    const galaxyBottomLeft = frameGroup.children[3] as THREE.Group;
    expect(galaxyBottomLeft).toBeInstanceOf(THREE.Group);
    expect(galaxyBottomLeft.position.x).toBeLessThan(0);
    expect(galaxyBottomLeft.position.y).toBeLessThan(0);
  });

  it('should update on animation tick without throwing', () => {
    frame.init(group);
    expect(() => frame.update(1.234, 45, 0.5)).not.toThrow();
  });

  it('should expand lines draw range when seed count increases and rotate elements', () => {
    frame.init(group);
    const frameGroup = group.children[0] as THREE.Group;
    const goldenGroup = frameGroup.children[0] as THREE.Group;
    const squareLines = goldenGroup.children[0] as THREE.LineSegments;
    const spiralLine = goldenGroup.children[1] as THREE.Line;
    const galaxyTopRight = frameGroup.children[2] as THREE.Group;

    // Small seed count
    frame.update(0.1, 5, 0.1);
    const smallSpiralRange = spiralLine.geometry.drawRange.count;
    const smallSquareRange = squareLines.geometry.drawRange.count;
    const galaxyRotation1 = galaxyTopRight.rotation.z;

    // Simulate multiple frames at high seed count
    for (let i = 0; i < 30; i++) {
      frame.update(0.1 * i + 1, 1000, 0.25);
    }
    const largeSpiralRange = spiralLine.geometry.drawRange.count;
    const largeSquareRange = squareLines.geometry.drawRange.count;
    const galaxyRotation2 = galaxyTopRight.rotation.z;

    expect(largeSpiralRange).toBeGreaterThan(smallSpiralRange);
    expect(largeSquareRange).toBeGreaterThanOrEqual(smallSquareRange);
    expect(goldenGroup.rotation.z).toBeCloseTo(0.25, 5);
    expect(galaxyRotation2).not.toEqual(galaxyRotation1);
  });

  it('should cleanly dispose resources and remove meshes from parent group', () => {
    frame.init(group);
    expect(group.children.length).toBe(1);

    frame.dispose(group);
    expect(group.children.length).toBe(0);
  });
});
