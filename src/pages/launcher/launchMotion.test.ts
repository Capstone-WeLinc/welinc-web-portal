import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAST_LAUNCH_KEY, arrivalDone, arrivalSettled, nextLaunch, pickLaunch, readLastLaunch, tileAt } from './launchMotion';

// covers: suite spec 0019 AC-8 (the arrival timing), AC-10 (the random launch and its stored id)

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('launch pick', () => {
  it('never picks the last one', () => {
    for (const r of [0, 0.4, 0.99]) {
      expect(pickLaunch(2, () => r)).not.toBe(2);
      expect(pickLaunch(3, () => r)).not.toBe(3);
      expect(pickLaunch(4, () => r)).not.toBe(4);
    }
  });

  it('picks among all three with no last one, and stays in range at the edge', () => {
    expect([0, 0.5, 0.999].map((r) => pickLaunch(null, () => r))).toEqual([2, 3, 4]);
    expect(pickLaunch(null, () => 1)).toBe(4);
  });

  it('remembers the last launch in sessionStorage, ten in a row never repeating', () => {
    let previous = readLastLaunch();
    for (let i = 0; i < 10; i++) {
      const scene = nextLaunch();
      expect(scene).not.toBe(previous);
      expect(window.sessionStorage.getItem(LAST_LAUNCH_KEY)).toBe(String(scene));
      previous = scene;
    }
  });

  it('ignores a stored value that is not a scene', () => {
    window.sessionStorage.setItem(LAST_LAUNCH_KEY, 'boom');
    expect([2, 3, 4]).toContain(nextLaunch(() => 0));
  });

  it('still picks when storage is refused', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const first = nextLaunch(() => 0);
    expect(nextLaunch(() => 0)).not.toBe(first);
  });
});

describe('arrival timing', () => {
  it('deals the tiles 90ms apart from 550ms and waits for the last one and the footer', () => {
    expect([0, 1, 2].map(tileAt)).toEqual([550, 640, 730]);
    expect(arrivalDone(3)).toBe(1180);
    expect(arrivalDone(4)).toBe(1270);
    expect(arrivalSettled(3)).toBe(1300);
  });
});
