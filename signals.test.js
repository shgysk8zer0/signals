import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Signal } from './signals.js';



/**
 * @type {typeof globalThis.reportError}
 */
globalThis.reportError = typeof globalThis.reportError === 'function'
	? globalThis.reportError
	: err => console.error(err);

/**
 * @type {typeof globalThis.queueMicrotask}
 */
globalThis.queueMicrotask = typeof globalThis.queueMicrotask === 'function'
	? globalThis.queueMicrotask
	: cb => {
		if (typeof cb !== 'function') {
			throw new TypeError('queueMicrotask: Argument 1 is not callable.');
		} else {
			// Complains about `Promise.try`
			// @ts-ignore
			Promise.resolve().then(() => void Promise.try(cb).catch(reportError));
		}
	};


// Helper for the polyfilled requestAnimationFrame (10ms delay)
const tick = () => new Promise(r => setTimeout(r, 10));

describe('Signal.State', () => {
	it('should initialize with a value', () => {
		const s = new Signal.State(10);
		assert.strictEqual(s.get(), 10);
	});

	it('should update value via set', () => {
		const s = new Signal.State(10);
		s.set(20);
		assert.strictEqual(s.get(), 20);
	});

	it('should not trigger updates if value is equal', () => {
		const s = new Signal.State(10);
		let count = 0;
		const c = new Signal.Computed(() => {
			count++;
			return s.get();
		});

		c.get(); // Initial read
		assert.strictEqual(count, 1);

		s.set(10); // Same value
		c.get();
		assert.strictEqual(count, 1, 'Should not have recomputed');
	});
});

describe('Signal.Computed', () => {
	it('should compute derived values', () => {
		const s = new Signal.State(2);
		const c = new Signal.Computed(() => s.get() * 3);
		assert.strictEqual(c.get(), 6);
	});

	it('should react to dependency changes', () => {
		const s = new Signal.State(2);
		const c = new Signal.Computed(() => s.get() * 3);

		assert.strictEqual(c.get(), 6);
		s.set(4);
		assert.strictEqual(c.get(), 12);
	});

	it('should be lazy (only compute on read)', () => {
		const s = new Signal.State(1);
		let calls = 0;
		const c = new Signal.Computed(() => {
			calls++;
			return s.get();
		});

		assert.strictEqual(calls, 0);
		s.set(2);
		assert.strictEqual(calls, 0); // Still 0
		c.get();
		assert.strictEqual(calls, 1);
	});

	it('should cache values until dependencies change', () => {
		const s = new Signal.State(1);
		let calls = 0;
		const c = new Signal.Computed(() => {
			calls++;
			console.log(`Called getter on c ${calls} times.`);
			return s.get();
		});

		c.get();
		c.get();
		c.get();
		assert.strictEqual(calls, 1);

		s.set(2);
		c.get();
		assert.strictEqual(calls, 2);
	});

	it('should handle the diamond problem (glitch-free pull)', () => {
		const root = new Signal.State(1); // 1
		const left = new Signal.Computed(() => root.get() * 2); // 2
		const right = new Signal.Computed(() => root.get() * 3); // 3
		const sum = new Signal.Computed(() => left.get() + right.get()); //5

		// 1*2 + 1*3 = 5
		assert.strictEqual(sum.get(), 5);

		root.set(2);
		// 2*2 + 2*3 = 10
		assert.strictEqual(sum.get(), 10);
	});
});

describe('Signal.subtle.Watcher', () => {
	it('should notify asynchronously when signals change', async () => {
		const s = new Signal.State(1);
		let pendingList = [];

		const w = new Signal.subtle.Watcher(function() {
			pendingList = this.getPending();
		});

		w.watch(s);
		s.set(2);

		assert.strictEqual(pendingList.length, 0, 'Should be async');

		await tick();

		assert.strictEqual(pendingList.length, 1);
		console.log({ pendingList, s });
		assert.ok(pendingList.includes(s));
	});

	it('should allow unwatching signals', async () => {
		const s = new Signal.State(1);
		let callCount = 0;

		const w = new Signal.subtle.Watcher(() => {
			callCount++;
		});

		w.watch(s);
		w.unwatch(s);
		s.set(2);

		await new Promise(resolve => setTimeout(resolve, 50));

		assert.strictEqual(callCount, 0);
	});

	it('should batch updates (deduplicate notifications)', async () => {
		const s = new Signal.State(1);
		let callCount = 0;

		const w = new Signal.subtle.Watcher(() => {
			callCount++;
		});

		w.watch(s);
		s.set(2);
		s.set(3);
		s.set(4);

		await tick();

		assert.strictEqual(callCount, 1, 'Should only notify once per frame');
	});
});

describe('Signal.subtle.untrack', () => {
	it('should read value without creating a dependency', () => {
		const s = new Signal.State(10);
		let computeCount = 0;

		const c = new Signal.Computed(() => {
			computeCount++;
			// If untrack is working, s.get() is read but not subscribed to
			return Signal.subtle.untrack(() => s.get());
		});

		assert.strictEqual(c.get(), 10);
		assert.strictEqual(computeCount, 1);

		s.set(20);

		// Reading c.get() again.
		// If 's' was tracked, c would be dirty and re-run -> computeCount 2.
		// If 's' was untracked, c is still clean (cached) -> computeCount 1.
		assert.strictEqual(c.get(), 10, 'Should return cached value because dependency was ignored');
		assert.strictEqual(computeCount, 1);
	});
});

describe('Signal.subtle Introspection', () => {
	it('should correctly identify sources and sinks for State and Computed', () => {
		const s1 = new Signal.State(1);
		const s2 = new Signal.State(2);
		const c = new Signal.Computed(() => s1.get() + s2.get());

		// Dependencies are not tracked until evaluated
		assert.strictEqual(Signal.subtle.hasSinks(s1), false);
		assert.strictEqual(Signal.subtle.hasSinks(s2), false);
		assert.strictEqual(Signal.subtle.hasSources(c), false);

		c.get(); // Trigger tracking

		assert.strictEqual(Signal.subtle.hasSinks(s1), true);
		assert.strictEqual(Signal.subtle.hasSinks(s2), true);
		assert.strictEqual(Signal.subtle.hasSources(c), true);

		const s1Sinks = Signal.subtle.introspectSinks(s1);
		const cSources = Signal.subtle.introspectSources(c);

		assert.strictEqual(s1Sinks.length, 1);
		assert.strictEqual(s1Sinks[0], c);

		assert.strictEqual(cSources.length, 2);
		assert.ok(cSources.includes(s1));
		assert.ok(cSources.includes(s2));
	});

	it('should correctly identify sources and sinks involving a Watcher', () => {
		const s = new Signal.State(10);
		const w = new Signal.subtle.Watcher(() => {});

		w.watch(s);

		assert.strictEqual(Signal.subtle.hasSinks(s), true);
		assert.strictEqual(Signal.subtle.hasSources(w), true);

		const sSinks = Signal.subtle.introspectSinks(s);
		const wSources = Signal.subtle.introspectSources(w);

		assert.strictEqual(sSinks.length, 1);
		assert.strictEqual(sSinks[0], w);

		assert.strictEqual(wSources.length, 1);
		assert.strictEqual(wSources[0], s);

		w.unwatch(s);

		assert.strictEqual(Signal.subtle.hasSinks(s), false);
		assert.strictEqual(Signal.subtle.hasSources(w), false);
	});
});
