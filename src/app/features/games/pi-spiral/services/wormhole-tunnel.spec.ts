import * as THREE from 'three';
import { WormholeTunnel } from './wormhole-tunnel';

describe('WormholeTunnel', () => {
  let tunnel: WormholeTunnel;
  let group: THREE.Group;

  beforeEach(() => {
    tunnel = new WormholeTunnel();
    group = new THREE.Group();
  });

  afterEach(() => {
    tunnel.dispose(group);
  });

  it('should initialize and add meshes to the parent group', () => {
    tunnel.init(group);
    // Group should contain the membrane mesh and particle points
    expect(group.children.length).toBe(2);
  });

  it('should update uniforms on time advance and dynamic targetZMin', () => {
    tunnel.init(group);
    expect(() => tunnel.update(1.234, -1500.0)).not.toThrow();
  });

  it('should cleanly dispose resources and remove meshes from parent group', () => {
    tunnel.init(group);
    expect(group.children.length).toBe(2);

    tunnel.dispose(group);
    expect(group.children.length).toBe(0);
  });
});
