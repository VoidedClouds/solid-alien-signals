import { describe, it, expect, vi } from 'vitest';
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  createResource,
  effect,
  isEffect,
  isSignal,
  signal,
  untrack
} from '../src/index.js';

describe('createSignal', () => {
  it('should create a signal with initial value', () => {
    const [get, set] = createSignal(1);
    expect(get()).toBe(1);
    set(2);
    expect(get()).toBe(2);
  });

  it('should create a signal without initial value', () => {
    const [get, set] = createSignal<number>();
    expect(get()).toBeUndefined();
    set(5);
    expect(get()).toBe(5);
  });

  it('should return new value from setter', () => {
    const [get, set] = createSignal(10);
    const result = set(20);
    expect(result).toBe(20);
    expect(get()).toBe(20);
  });

  it('should accept a function to the setter', () => {
    const [get, set] = createSignal(10);

    // Test with a function that transforms the current value
    const result = set((current) => current + 5);
    expect(result).toBe(15);
    expect(get()).toBe(15);

    // Test with another function
    set((current) => current * 2);
    expect(get()).toBe(30);

    // Test with a function that ignores current value
    set(() => 100);
    expect(get()).toBe(100);
  });
});

describe('batch', () => {
  it('should batch multiple signal updates', () => {
    const [get, set] = createSignal(0);
    batch(() => {
      set(1);
      set(2);
      set(3);
    });
    expect(get()).toBe(3);
  });

  it('should handle exceptions in batch', () => {
    const [get, set] = createSignal(0);
    expect(() => {
      batch(() => {
        set(1);
        throw new Error('test error');
      });
    }).toThrow('test error');
    expect(get()).toBe(1);
  });
});

describe('untrack', () => {
  it('should prevent dependency tracking inside untrack', () => {
    const [get, set] = createSignal(1);
    let effectRunCount = 0;

    effect(() => {
      effectRunCount++;
      untrack(() => get()); // Access signal without tracking
    });

    expect(effectRunCount).toBe(1); // Initial run

    set(2); // Change signal

    expect(effectRunCount).toBe(1); // Effect should NOT re-run
  });

  it('should track dependencies outside untrack while preventing tracking inside', () => {
    const [count1, setCount1] = createSignal(0);
    const [count2, setCount2] = createSignal(0);
    let effectRunCount = 0;
    let trackedValue = 0;
    let untrackedValue = 0;

    effect(() => {
      effectRunCount++;
      trackedValue = count1(); // This should be tracked
      untrack(() => {
        untrackedValue = count2(); // This should NOT be tracked
      });
    });

    expect(effectRunCount).toBe(1);
    expect(trackedValue).toBe(0);
    expect(untrackedValue).toBe(0);

    // Change the untracked signal - effect should NOT re-run
    setCount2(10);
    expect(effectRunCount).toBe(1);
    expect(untrackedValue).toBe(0); // Still 0 because effect didn't re-run

    // Change the tracked signal - effect SHOULD re-run
    setCount1(5);
    expect(effectRunCount).toBe(2);
    expect(trackedValue).toBe(5);
    expect(untrackedValue).toBe(10); // Now updated because effect re-ran
  });
});

describe('isSignal', () => {
  it('should identify createSignal getter as signal', () => {
    const [getter] = createSignal(0);
    expect(isSignal(getter)).toBe(true);
  });

  it('should identify createSignal setter as signal', () => {
    const [, setter] = createSignal(0);
    expect(isSignal(setter)).toBe(true);
  });

  it('should identify raw signal from alien-signals as signal', () => {
    const s = signal(0);
    expect(isSignal(s)).toBe(true);
  });

  it('should identify createMemo as signal', () => {
    const memo = createMemo(() => 42);
    expect(isSignal(memo)).toBe(true);
  });

  it('should identify createResource as signal', () => {
    const resource = createResource(() => true);
    const [read, actions] = resource;

    expect(isSignal(read)).toBe(true);
    expect(isSignal(actions.mutate)).toBe(true);
  });

  it('should not identify regular functions as signals', () => {
    const regularFn = () => 42;
    expect(isSignal(regularFn)).toBe(false);
  });

  it('should not identify effects as signals', () => {
    const effectFn = createEffect(() => {});
    expect(isSignal(effectFn)).toBe(false);
  });

  it('should handle null and undefined', () => {
    expect(isSignal(null as any)).toBe(false);
    expect(isSignal(undefined as any)).toBe(false);
  });

  it('should handle non-function values', () => {
    expect(isSignal(42 as any)).toBe(false);
    expect(isSignal('string' as any)).toBe(false);
    expect(isSignal({} as any)).toBe(false);
  });
});

describe('isEffect', () => {
  it('should identify createEffect as effect', () => {
    const effectFn = createEffect(() => {});
    expect(isEffect(effectFn)).toBe(true);
  });

  it('should identify raw effect from alien-signals as effect', () => {
    const effectFn = effect(() => {});
    expect(isEffect(effectFn)).toBe(true);
  });

  it('should not identify signals as effects', () => {
    const [getter, setter] = createSignal(0);
    expect(isEffect(getter)).toBe(false);
    expect(isEffect(setter)).toBe(false);
  });

  it('should not identify memos as effects', () => {
    const memo = createMemo(() => 42);
    expect(isEffect(memo)).toBe(false);
  });

  it('should not identify regular functions as effects', () => {
    const regularFn = () => {};
    expect(isEffect(regularFn)).toBe(false);
  });

  it('should handle null and undefined', () => {
    expect(isEffect(null as any)).toBe(false);
    expect(isEffect(undefined as any)).toBe(false);
  });

  it('should handle non-function values', () => {
    expect(isEffect(42 as any)).toBe(false);
    expect(isEffect('string' as any)).toBe(false);
    expect(isEffect({} as any)).toBe(false);
  });
});
