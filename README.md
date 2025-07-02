# solid-alien-signals

A [SolidJS](https://github.com/solidjs/solid)-like API for [alien-signals](https://github.com/stackblitz/alien-signals), providing familiar primitives such as `batch`, `createEffect`, `createMemo`, `createResource`, `createSignal`, and `untrack`.

> **Note:**  
> Some methods in this package are direct aliases for primitives from [`alien-signals`](https://github.com/stackblitz/alien-signals) (such as `createEffect` and `createMemo`). Others, like `batch`, `createResource`, `createSignal`, and `untrack`, are wrappers or adapted implementations to provide a SolidJS-compatible API and behavior.

## Features

- **SolidJS-compatible API:** Use `batch`, `createEffect`, `createMemo`, `createResource`, `createSignal`, and `untrack`, similar to SolidJS.
- **Resource primitives:** Use `createResource` for async data flows.
- **Type guards:** Use `isSignal` and `isEffect` to identify reactive primitives.
- **TypeScript support:** Fully typed API.

## Installation

```sh
npm install solid-alien-signals
```

## Usage

### Basic Signals

```ts
import { createSignal, createEffect, createMemo } from 'solid-alien-signals';

const [count, setCount] = createSignal(1);

const double = createMemo(() => count() * 2);

createEffect(() => {
  console.log('Count is', count());
});

setCount(2); // Console: Count is 2
console.log(double()); // 4

// Setters also accept functions for updates based on previous value
setCount(prev => prev + 1); // count is now 3
```

### Batching Updates

Batch multiple state updates into a single re-computation:

```ts
import { batch, createSignal, createEffect } from 'solid-alien-signals';

const [a, setA] = createSignal(1);
const [b, setB] = createSignal(2);

createEffect(() => {
  console.log('Sum:', a() + b());
});

batch(() => {
  setA(3);
  setB(4);
});
// Console: Sum: 7 (only runs once)
```

### Resources

Handle asynchronous data with `createResource`:

```ts
import { createResource } from 'solid-alien-signals';

const [user, { refetch }] = createResource(async () => fetch('/api/user').then((res) => res.json()));

console.log(user.loading); // true/false
console.log(user()); // user data or undefined
```

### Untrack

Prevent dependency tracking inside a function:

```ts
import { createSignal, untrack } from 'solid-alien-signals';

const [count, setCount] = createSignal(0);

const value = untrack(() => count());
// `value` is read without tracking as a dependency
```

### Type Guards

Check if a value is a signal or effect:

```ts
import { createSignal, createEffect, isSignal, isEffect } from 'solid-alien-signals';

const [count, setCount] = createSignal(0);
const effectFn = createEffect(() => console.log(count()));

console.log(isSignal(count)); // true
console.log(isSignal(setCount)); // true
console.log(isEffect(effectFn)); // true
console.log(isSignal(() => {})); // false
```

## API Reference

### `batch(fn: () => void): void`

Batches multiple updates into a single re-computation.

### `createEffect(fn: () => void): void`

Runs a function whenever its dependencies change.

### `createMemo<T>(fn: () => T): () => T`

Creates a memoized computation.

### `createResource<T, S, R>(source, fetcher, options?): [Resource<T>, ResourceActions<T, R>]`

Manages async data with loading/error states.

### `createSignal<T>(initialValue?: T): [() => T, (v: T | ((prev: T) => T)) => T]`

Creates a reactive signal. The setter accepts either a value or a function that receives the previous value.

### `untrack<T>(fn: () => T): T`

Runs a function without tracking dependencies.

### `isSignal(value: any): boolean`

Returns `true` if the value is a signal (including signal getters, setters, memos, and resources).

### `isEffect(value: any): boolean`

Returns `true` if the value is an effect function.

## License

Portions of this code are adapted from [alien-signals](https://github.com/stackblitz/alien-signals) and [SolidJS](https://github.com/solidjs/solid) both MIT licensed.
