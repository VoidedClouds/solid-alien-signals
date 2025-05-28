import { computed as createMemo, effect as createEffect, endBatch, setCurrentSub, signal, startBatch } from 'alien-signals';
export * from 'alien-signals';
export { createEffect, createMemo };

export function batch(fnToBatch: () => void) {
  startBatch();
  try {
    fnToBatch();
  } finally {
    endBatch();
  }
}

export function untrack<T>(fn: () => T): T {
  const prevSub = setCurrentSub(undefined);
  try {
    return fn();
  } finally {
    setCurrentSub(prevSub);
  }
}

/**
 * MIT License
 *
 * Copyright (c) 2016-2025 Ryan Carniato
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Source: https://github.com/solidjs/solid
 */

//#region SolidJS/solid - solid/src/reactive/signal.ts
export type Accessor<T> = () => T;

export type Setter<T> = (value: T) => T;

export type Signal<T> = [get: Accessor<T>, set: Setter<T>];

export function createSignal<T>(): Signal<T | undefined>;
export function createSignal<T>(value: T): Signal<T>;
export function createSignal<T>(value?: T): Signal<T | undefined> {
  const internalSignal = signal(value);
  const getter: Accessor<T | undefined> = () => internalSignal();
  const setter: Setter<T | undefined> = (value: T | undefined) => {
    internalSignal(value);
    return untrack(() => internalSignal());
  };

  return [getter, setter];
}

// Magic type that when used at sites where generic types are inferred from, will prevent those sites from being involved in the inference.
// https://github.com/microsoft/TypeScript/issues/14829
// TypeScript Discord conversation: https://discord.com/channels/508357248330760243/508357248330760249/911266491024949328
export type NoInfer<T extends any> = [T][T extends any ? 0 : never];

interface Unresolved {
  state: 'unresolved';
  loading: false;
  error: undefined;
  latest: undefined;
  (): undefined;
}

interface Pending {
  state: 'pending';
  loading: true;
  error: undefined;
  latest: undefined;
  (): undefined;
}

interface Ready<T> {
  state: 'ready';
  loading: false;
  error: undefined;
  latest: T;
  (): T;
}

interface Refreshing<T> {
  state: 'refreshing';
  loading: true;
  error: undefined;
  latest: T;
  (): T;
}

interface Errored {
  state: 'errored';
  loading: false;
  error: any;
  latest: never;
  (): never;
}

export type Resource<T> = Unresolved | Pending | Ready<T> | Refreshing<T> | Errored;

export type InitializedResource<T> = Ready<T> | Refreshing<T> | Errored;

export type ResourceActions<T, R = unknown> = {
  mutate: Setter<T>;
  refetch: (info?: R) => T | Promise<T> | undefined | null;
};

export type ResourceSource<S> = S | false | null | undefined | (() => S | false | null | undefined);

export type ResourceFetcher<S, T, R = unknown> = (k: S, info: ResourceFetcherInfo<T, R>) => T | Promise<T>;

export type ResourceFetcherInfo<T, R = unknown> = {
  value: T | undefined;
  refetching: R | boolean;
};

export type ResourceOptions<T> = {
  initialValue?: T;
  storage?: (init: T | undefined) => [Accessor<T | undefined>, Setter<T | undefined>];
};

export type InitializedResourceOptions<T> = ResourceOptions<T> & {
  initialValue: T;
};

export type ResourceReturn<T, R = unknown> = [Resource<T>, ResourceActions<T | undefined, R>];

export type InitializedResourceReturn<T, R = unknown> = [InitializedResource<T>, ResourceActions<T, R>];

function isPromise(v: any): v is Promise<any> {
  return v && typeof v === 'object' && 'then' in v;
}

export function createResource<T, R = unknown>(
  fetcher: ResourceFetcher<true, T, R>,
  options: InitializedResourceOptions<NoInfer<T>>
): InitializedResourceReturn<T, R>;
export function createResource<T, R = unknown>(
  fetcher: ResourceFetcher<true, T, R>,
  options?: ResourceOptions<NoInfer<T>>
): ResourceReturn<T, R>;
export function createResource<T, S, R = unknown>(
  source: ResourceSource<S>,
  fetcher: ResourceFetcher<S, T, R>,
  options: InitializedResourceOptions<NoInfer<T>>
): InitializedResourceReturn<T, R>;
export function createResource<T, S, R = unknown>(
  source: ResourceSource<S>,
  fetcher: ResourceFetcher<S, T, R>,
  options?: ResourceOptions<NoInfer<T>>
): ResourceReturn<T, R>;
export function createResource<T, S = true, R = unknown>(
  pSource: (() => S | false | null | undefined) | ResourceFetcher<true, T, R>,
  pFetcher?: ResourceFetcher<S, T, R> | ResourceOptions<T>,
  pOptions?: ResourceOptions<T>
): ResourceReturn<T, R> {
  let source: (() => S | false | null | undefined) | true;
  let fetcher: ResourceFetcher<S, T, R>;
  let options: ResourceOptions<T> | undefined;

  if (typeof pFetcher === 'function') {
    source = pSource as () => S | false | null | undefined;
    fetcher = pFetcher as ResourceFetcher<S, T, R>;
    options = pOptions;
  } else {
    source = true;
    fetcher = pSource as ResourceFetcher<S, T, R>;
    options = pFetcher as ResourceOptions<T> | undefined;
  }

  const [data, setData] = (options?.storage || createSignal)<T | undefined>(options?.initialValue);
  const [error, setError] = createSignal<any>(undefined);
  const [state, setState] = createSignal<'unresolved' | 'pending' | 'ready' | 'refreshing' | 'errored'>(
    options?.initialValue !== undefined ? 'ready' : 'unresolved'
  );

  let currentPromise: Promise<T> | null = null;
  let resolved = options?.initialValue !== undefined;
  let scheduled = false;

  const dynamic = typeof source === 'function' ? createMemo(source) : undefined;

  function loadEnd(p: Promise<T> | null, v: T | undefined, err?: any, key?: S) {
    if (currentPromise === p) {
      currentPromise = null;
      if (key !== undefined) {
        resolved = true;
      }
      completeLoad(v, err);
    }
    return v;
  }

  function completeLoad(v: T | undefined, err: any) {
    batch(() => {
      if (err === undefined) {
        setData(v);
      }
      setState(err !== undefined ? 'errored' : resolved ? 'ready' : 'unresolved');
      setError(err);
    });
  }

  function read(): T | undefined {
    const err = error();
    const currentState = state();
    if (err !== undefined && currentState === 'errored') throw err;
    return data();
  }

  function load(refetching: R | boolean = true): Promise<T | undefined> | T | undefined {
    if (refetching !== false && scheduled) return;
    scheduled = false;

    const lookup = dynamic ? dynamic() : (true as S);

    if (lookup == null || lookup === false) {
      loadEnd(
        currentPromise,
        untrack(() => data())
      );
      return;
    }

    let fetchError: any;
    const result = untrack(() => {
      try {
        return fetcher(lookup, {
          value: data(),
          refetching: refetching
        });
      } catch (err) {
        fetchError = err;
        return undefined;
      }
    });

    if (fetchError !== undefined) {
      loadEnd(currentPromise, undefined, castError(fetchError), lookup);
      return;
    }

    if (!isPromise(result)) {
      loadEnd(currentPromise, result, undefined, lookup);
      return result;
    }

    currentPromise = result;
    scheduled = true;
    queueMicrotask(() => (scheduled = false));

    batch(() => {
      setState(resolved ? 'refreshing' : 'pending');
      setError(undefined);
    });

    return result.then(
      (value) => loadEnd(result, value, undefined, lookup),
      (err) => loadEnd(result, undefined, castError(err), lookup)
    );
  }

  Object.defineProperties(read, {
    loading: {
      get: () => {
        const s = state();
        return s === 'pending' || s === 'refreshing';
      }
    },
    error: {
      get: () => error()
    },
    state: {
      get: () => state()
    },
    latest: {
      get: () => {
        if (!resolved) return read();
        const err = error();
        if (err && !currentPromise) throw err;
        return data();
      }
    }
  });

  const actions: ResourceActions<T | undefined, R> = {
    mutate: setData,
    refetch: (info) => load(info)
  };

  if (dynamic) {
    createEffect(() => {
      load(false);
    });
  } else {
    load(false);
  }

  return [read as Resource<T>, actions];
}

function castError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : 'Unknown error', { cause: err });
}
//#endregion
