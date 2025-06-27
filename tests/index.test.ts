import { describe, it, expect, vi } from 'vitest';
import { batch, createSignal, createResource, effect, untrack } from '../src/index.js';

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

describe('createResource', () => {
  it('should resolve synchronously', () => {
    const [resource] = createResource(() => true);
    expect(resource()).toBe(true);
    expect(resource.loading).toBe(false);
    expect(resource.state).toBe('ready');
    expect(resource.error).toBeUndefined();
  });

  it('should resolve asynchronously', async () => {
    let resolve: (v: number) => void;
    const promise = new Promise<number>((r) => {
      resolve = r;
    });
    const [resource, { refetch }] = createResource<number>(() => promise);

    expect(resource.loading).toBe(true);
    expect(resource.state).toBe('pending');

    resolve!(99);
    await promise;

    expect(resource()).toBe(99);
    expect(resource.loading).toBe(false);
    expect(resource.state).toBe('ready');

    // Refetch
    const refetchPromise = refetch();
    expect(resource.loading).toBe(true);
    expect(resource.state).toBe('refreshing');
    if (refetchPromise instanceof Promise) await refetchPromise;
    expect(resource.loading).toBe(false);
    expect(resource.state).toBe('ready');
  });

  it('should support mutate', () => {
    const [resource, { mutate }] = createResource<number>(() => 1);
    mutate(42);
    expect(resource()).toBe(42);
  });

  it('should clear resource when source is falsy', async () => {
    const [enabled, setEnabled] = createSignal<boolean>(true);
    const [resource] = createResource<number, boolean>(enabled, () => 5);
    expect(resource()).toBe(5);
    expect(resource.state).toBe('ready');

    setEnabled(false);
    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resource()).toBe(5); // data is preserved
    expect(resource.state).toBe('ready'); // state remains 'ready' because resolved=true
  });

  it('should create resource with single parameter (no source)', () => {
    const [resource] = createResource(() => 'no-source');
    expect(resource()).toBe('no-source');
    expect(resource.state).toBe('ready');
  });

  it('should access latest property correctly', () => {
    const [resource] = createResource(() => 'test-data');
    expect(resource.latest).toBe('test-data');
  });

  it('should handle async errors correctly', async () => {
    const error = new Error('async error');
    let reject: (err: Error) => void;
    const promise = new Promise<string>((_, r) => {
      reject = r;
    });

    const [resource] = createResource(() => promise);

    expect(resource.loading).toBe(true);
    expect(resource.state).toBe('pending');

    reject!(error);

    try {
      await promise;
    } catch {
      // Expected to throw
    }

    // Wait for the promise rejection to be handled
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resource.state).toBe('errored');
    expect(resource.error).toBe(error);
    expect(() => resource()).toThrow(error);
  });

  it('should throw error when accessing latest on errored resource', async () => {
    const error = new Error('latest error');
    let reject: (err: Error) => void;
    const promise = new Promise<string>((_, r) => {
      reject = r;
    });

    const [resource] = createResource(() => promise);

    reject!(error);

    try {
      await promise;
    } catch {
      // Expected to throw
    }

    // Wait for the promise rejection to be handled
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(() => resource.latest).toThrow(error);
  });

  it('should handle concurrent promises correctly', async () => {
    let resolve1: (v: string) => void;
    let resolve2: (v: string) => void;

    const promise1 = new Promise<string>((r) => {
      resolve1 = r;
    });
    const promise2 = new Promise<string>((r) => {
      resolve2 = r;
    });

    let callCount = 0;
    const [resource, { refetch }] = createResource<string>(() => {
      callCount++;
      return callCount === 1 ? promise1 : promise2;
    });

    expect(callCount).toBe(1);
    expect(resource.state).toBe('pending');

    // Resolve first promise
    resolve1!('first');
    await promise1;

    expect(resource()).toBe('first');
    expect(resource.state).toBe('ready');

    // Now refetch with second promise
    refetch();
    expect(resource.state).toBe('refreshing');

    resolve2!('second');
    await promise2;

    expect(resource()).toBe('second');
    expect(callCount).toBe(2);
  });

  it('should create resource with initial value', () => {
    const [resource] = createResource(() => 'async-data', { initialValue: 'initial' });

    expect(resource()).toBe('async-data');
    expect(resource.state).toBe('ready');
  });

  it('should clear pending promise when source becomes falsy', async () => {
    const [enabled, setEnabled] = createSignal(true);
    let resolve: (v: string) => void;
    const promise = new Promise<string>((r) => {
      resolve = r;
    });

    const [resource] = createResource<string, boolean>(enabled, () => promise);

    expect(resource.state).toBe('pending');
    expect(resource.loading).toBe(true);

    // Disable source while promise is still pending
    setEnabled(false);

    // Wait for effect to run
    await new Promise((r) => setTimeout(r, 0));

    expect(resource.state).toBe('unresolved');
    expect(resource.loading).toBe(false);

    // Resolve the promise after source became falsy
    resolve!('should-not-matter');
    await promise;
    await new Promise((r) => setTimeout(r, 0));

    // Resource should still be unresolved
    expect(resource.state).toBe('unresolved');
  });

  it('should handle synchronous fetcher errors', () => {
    const error = new Error('sync fetcher error');
    const [resource] = createResource(() => {
      throw error;
    });

    expect(() => resource()).toThrow(error);
    expect(resource.state).toBe('errored');
    expect(resource.error).toBe(error);
    expect(resource.loading).toBe(false);
  });

  it('should handle non-Error thrown values', async () => {
    const errorString = 'string error';
    const [resource] = createResource(() => {
      throw errorString;
    });

    expect(() => resource()).toThrow();
    expect(resource.state).toBe('errored');
    expect(resource.error).toBeInstanceOf(Error);
    expect(resource.error.message).toBe(errorString);
    expect(resource.error.cause).toBe(errorString);
  });

  it('should handle non-Error rejected promises', async () => {
    const errorObj = { code: 'ERR001', message: 'Custom error' };
    const [resource] = createResource(() => Promise.reject(errorObj));

    await new Promise((r) => setTimeout(r, 0));

    expect(() => resource()).toThrow();
    expect(resource.state).toBe('errored');
    expect(resource.error).toBeInstanceOf(Error);
    expect(resource.error.message).toBe('Unknown error');
    expect(resource.error.cause).toBe(errorObj);
  });

  it('should prevent duplicate refetch while scheduled', async () => {
    let callCount = 0;
    let resolve1: (v: string) => void;
    let resolve2: (v: string) => void;

    const promise1 = new Promise<string>((r) => {
      resolve1 = r;
    });
    const promise2 = new Promise<string>((r) => {
      resolve2 = r;
    });

    const [resource, { refetch }] = createResource(() => {
      callCount++;
      return callCount === 1 ? promise1 : promise2;
    });

    expect(callCount).toBe(1);
    expect(resource.state).toBe('pending');

    // Try to refetch while first promise is still pending
    const result1 = refetch();
    const result2 = refetch(); // This should return early due to scheduling

    expect(result1).toBeUndefined(); // Returns undefined because already scheduled
    expect(result2).toBeUndefined(); // Should also return undefined
    expect(callCount).toBe(1); // Should not have called fetcher again yet

    // Resolve first promise
    resolve1!('first');
    await promise1;

    // Wait for microtask to clear scheduling flag
    await new Promise((r) => setTimeout(r, 0));

    // Now refetch should work
    const result3 = refetch();
    expect(result3).toBeInstanceOf(Promise);
    expect(callCount).toBe(2);

    resolve2!('second');
    await promise2;

    expect(resource()).toBe('second');
  });

  it('should access latest property during refresh without throwing', async () => {
    let resolve1: (v: string) => void;
    let reject2: (e: Error) => void;

    const promise1 = new Promise<string>((r) => {
      resolve1 = r;
    });
    const promise2 = new Promise<string>((_, r) => {
      reject2 = r;
    });

    let callCount = 0;
    const [resource, { refetch }] = createResource(() => {
      callCount++;
      return callCount === 1 ? promise1 : promise2;
    });

    // First load succeeds
    resolve1!('initial');
    await promise1;

    expect(resource()).toBe('initial');
    expect(resource.latest).toBe('initial');

    // Start refresh that will fail
    refetch();

    // Before the promise rejects, latest should still return the data (no error yet)
    expect(resource.latest).toBe('initial');
    expect(resource.state).toBe('refreshing');

    // Reject the second promise
    reject2!(new Error('refresh failed'));
    await new Promise((r) => setTimeout(r, 0));

    // After error, resource() should throw and latest should throw
    expect(() => resource()).toThrow('refresh failed');
    expect(() => resource.latest).toThrow('refresh failed'); // Throws because err exists and currentPromise is null
  });

  it('should throw on latest property when resolved resource has sync error', () => {
    // Create a resource with initial value so resolved=true
    let shouldThrow = false;
    const [resource, { refetch }] = createResource(
      () => {
        if (shouldThrow) {
          throw new Error('sync error');
        }
        return 'success';
      },
      { initialValue: 'default' }
    );

    // First call succeeds
    expect(resource()).toBe('success');
    expect(resource.latest).toBe('success');

    // Now make it throw synchronously
    shouldThrow = true;
    refetch();

    // After sync error with resolved=true and currentPromise=null, latest should throw
    expect(() => resource()).toThrow('sync error');
    expect(() => resource.latest).toThrow('sync error'); // Should throw because resolved=true, error exists, and currentPromise is null (sync error)
  });

  it('should return undefined from latest when unresolved', () => {
    // Create a resource that never resolves
    const [resource] = createResource<string>(() => new Promise(() => {}));

    // Resource is unresolved (no initial value, promise is pending)
    expect(resource.state).toBe('pending');
    expect(resource()).toBeUndefined();

    // Accessing latest on unresolved resource should call read() which returns undefined
    expect(resource.latest).toBeUndefined();
  });
});
