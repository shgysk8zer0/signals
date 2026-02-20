# `@shgysk8zer0/signals`

A polyfill for the (currently stage 1) Signals API proposal

[![CodeQL](https://github.com/shgysk8zer0/signals/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/shgysk8zer0/signals/actions/workflows/codeql-analysis.yml)
![Node CI](https://github.com/shgysk8zer0/signals/workflows/Node%20CI/badge.svg)
![Lint Code Base](https://github.com/shgysk8zer0/signals/workflows/Lint%20Code%20Base/badge.svg)

[![GitHub license](https://img.shields.io/github/license/shgysk8zer0/signals.svg)](https://github.com/shgysk8zer0/signals/blob/master/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/shgysk8zer0/signals.svg)](https://github.com/shgysk8zer0/signals/commits/master)
[![GitHub release](https://img.shields.io/github/release/shgysk8zer0/signals?logo=github)](https://github.com/shgysk8zer0/signals/releases)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/shgysk8zer0?logo=github)](https://github.com/sponsors/shgysk8zer0)

[![npm](https://img.shields.io/npm/v/@shgysk8zer0/signals)](https://www.npmjs.com/package/@shgysk8zer0/signals)
![node-current](https://img.shields.io/node/v/@shgysk8zer0/signals)
![npm bundle size gzipped](https://img.shields.io/bundlephobia/minzip/@shgysk8zer0/signals)
[![npm](https://img.shields.io/npm/dw/@shgysk8zer0/signals?logo=npm)](https://www.npmjs.com/package/@shgysk8zer0/signals)

[![GitHub followers](https://img.shields.io/github/followers/shgysk8zer0.svg?style=social)](https://github.com/shgysk8zer0)
![GitHub forks](https://img.shields.io/github/forks/shgysk8zer0/signals.svg?style=social)
![GitHub stars](https://img.shields.io/github/stars/shgysk8zer0/signals.svg?style=social)
[![Twitter Follow](https://img.shields.io/twitter/follow/shgysk8zer0.svg?style=social)](https://twitter.com/shgysk8zer0)

[![Donate using Liberapay](https://img.shields.io/liberapay/receives/shgysk8zer0.svg?logo=liberapay)](https://liberapay.com/shgysk8zer0/donate "Donate using Liberapay")
- - -

- [Code of Conduct](./.github/CODE_OF_CONDUCT.md)
- [Contributing](./.github/CONTRIBUTING.md)
<!-- - [Security Policy](./.github/SECURITY.md) -->

> [!WARNING]  
> **Experimental / Unstable API**
> This polyfill implements the [TC39 Signals proposal](https://github.com/tc39/proposal-signals), which is currently under active development. The API surface, behavior, and semantics are highly unstable and subject to breaking changes. Do not use this in production environments.

```js
import { Signal } from '@shgysk8zer0/signals/signals.js';

// 1. Create a reactive state
const counter = new Signal.State(0);

// 2. Create a computed value derived from the state
const isEven = new Signal.Computed(() => counter.get() % 2 === 0);

console.log(isEven.get()); // true

// 3. Set up a watcher to observe changes
const watcher = new Signal.subtle.Watcher(() => {
    // This callback runs asynchronously (microtask) when watched signals change
    for (const signal of watcher.getPending()) {
        console.log('Signal updated to:', signal.get());
    }
});

// Start watching the computed signal
watcher.watch(isEven);

// 4. Update the state
counter.set(1); 
// watcher's notify callback will run, logging: "Signal updated to: false"

counter.set(2);
// watcher's notify callback will run, logging: "Signal updated to: true"
```
