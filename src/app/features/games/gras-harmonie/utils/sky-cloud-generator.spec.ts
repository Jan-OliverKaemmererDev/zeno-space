import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { THEMES, createAtmosphereTheme } from './sky-cloud-generator';

describe('Gras-Harmonie Theme Definitions', () => {
  it('should return fresh copies and prevent mutation between themes', () => {
    const dayInitial = THEMES['day'];
    const golden = THEMES['golden'];

    // Verify initial values
    expect(dayInitial.grassBase.getHex()).toBe(0x227827);
    expect(golden.grassBase.getHex()).toBe(0x42661f);

    // Simulate the bug where someone calls .copy(golden) on the day uniform reference
    dayInitial.grassBase.copy(golden.grassBase);

    // The mutated object has golden color
    expect(dayInitial.grassBase.getHex()).toBe(0x42661f);

    // BUT requesting THEMES['day'] again must return the pristine original day color!
    const dayAfter = THEMES['day'];
    expect(dayAfter.grassBase.getHex()).toBe(0x227827);
    expect(dayAfter.grassMid.getHex()).toBe(0x38b82a);
    expect(dayAfter.grassTip.getHex()).toBe(0xaaf038);
    expect(dayAfter.groundColor.getHex()).toBe(0xffffff);
    expect(dayAfter.skyColor.getHex()).toBe(0x56aef0);
  });

  it('createAtmosphereTheme creates separate instances every time and golden ground is darker than day', () => {
    const tDay = createAtmosphereTheme('day');
    const tGolden = createAtmosphereTheme('golden');

    expect(tDay.grassBase).not.toBe(tGolden.grassBase);
    expect(tDay.groundColor).not.toBe(tGolden.groundColor);

    // Verify golden ground is darker than day ground
    const dayLuma = 0.299 * tDay.groundColor.r + 0.587 * tDay.groundColor.g + 0.114 * tDay.groundColor.b;
    const goldenLuma = 0.299 * tGolden.groundColor.r + 0.587 * tGolden.groundColor.g + 0.114 * tGolden.groundColor.b;
    expect(goldenLuma).toBeLessThan(dayLuma * 0.5);
  });
});
