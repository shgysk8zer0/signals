// @ts-check
/**
 * Internal slot for the callback to call to nnotify of changes
 * @type {unique symbol}
 */
const notify = Symbol('signal:watcher:notify');

/**
 * @type {unique symbol}
 */
const currentComputed = Symbol('signal:currentComputed');

/**
 * Callback called when isWatched becomes true, if it was previously false (`Signal.subtle.watched`)
 *
 * @type {unique symbol}
 */
const watched = Symbol('Signal:subtle:watched');

/**
 * Callback called whenever isWatched becomes false, if it was previously true  (`Signal.subtle.unwatched`)
 *
 * @type {unique symbol}
 */
const unwatched = Symbol('Signal:subtle:unwatched');

/**
 * For equality checks in Computed, it must be a unique value
 * @type {unique symbol}
 */
const initial = Symbol('signal:initial');

/**
 * Internal slot for determining calling `Signal.subtle.watched` and `Signal.subtle.unwatched` callbacks
 * @type {unique symbol}
 */
const isWatched = Symbol('Signal:isWatched');

/**
 * Internal slot for State|Computed to store the `Signal.subtle.watched` callback
 * @type {unique symbol}
 */
const onWatch = Symbol('Signal:onWatch');

/**
 * Internal slot for State|Computed to store the `Signal.subtle.unwatched` callback
 * @type {unique symbol}
 */
const onUnwatch = Symbol('Signal:onUnwatch');

/**
 * @type {unique symbol}
 */
const sources = Symbol('Signal:sources');

/**
 * @type {unique symbol}
 */
const sinks = Symbol('Signal:sinks');

/**
 * @type {typeof globalThis.reportError}
 */
const reportError = typeof globalThis.reportError === 'function'
	? globalThis.reportError
	: err => console.error(err);

/**
 * @type {typeof globalThis.queueMicrotask}
 */
const queueMicrotask = typeof globalThis.queueMicrotask === 'function'
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
/**
 * @typedef {(t: any, t2: any) => boolean} EqualityCheck
 */

/**
 * Custom comparison function between old and new value. Default: Object.is.
 * The signal is passed in as the this value for context.
 *
 * @type {EqualityCheck}
 */
const equals = Object.is;

/**
 * @typedef {{
 * 	equals?: EqualityCheck,
 * 	[watched]?: (this: AnySignal<any>) => void,
 *  [unwatched]?: (this: AnySignal<any>) => void,
 * }} SignalOptions
 */

/**
 * @type {SignalOptions}
 */
const opts = Object.freeze({ equals });

/**
 * @template T
 * @typedef {State<T> | Computed<T>} AnySignal<T>
 */

/**
 * A read-write Signal
 * @template T
 */
class State {
	/**
	 * @type {T}
	 */
	#value;

	/**
	 * @type {EqualityCheck}
	 */
	#equals;

	/**
	 * @type {VoidFunction|null}
	 */
	[unwatched] = null;

	/**
	 * @type {VoidFunction|null}
	 */
	[onWatch] = null;

	/**
	 * @type {VoidFunction|null}
	 */
	[onUnwatch] = null;

	/**
	 * @type {boolean}
	 */
	[isWatched] = false;

	/**
	 * @type {Set<Computed<any>|Watcher>}
	 */
	[sinks] = new Set();

	/**
	 * @type {Set<Set<any>|Computed<any>>}
	 */
	[sources] = new Set();

	/**
	 * Create a state Signal starting with the value T
	 * @param {T} value - The initial value.
	 * @param {SignalOptions} options
	 */
	constructor(value, options = opts) {
		if (typeof options !== 'object') {
			throw new TypeError('Invalid options.');
		} else {
			this.#equals = options.equals ?? equals;
			this.#value = value;

			if (typeof options?.[watched] === 'function') {
				this[onWatch] = options[watched].bind(this);
			}

			if (typeof options?.[unwatched] === 'function') {
				this[onUnwatch] = options[unwatched].bind(this);
			}
		}
	}

	/**
	 * Get the value of the signal
	 *
	 * @returns {T}
	 */
	get() {
		const currentComputed = Signal.subtle.currentComputed();

		if (currentComputed instanceof Computed && ! currentComputed[sources].has(this)) {
			currentComputed[sources].add(this);
			this[sinks].add(currentComputed);
		}

		return this.#value;
	}

	/**
	 * Set the state Signal value to T
	 *
	 * @param {T} newValue
	 */
	set(newValue) {
		if (! this.#equals(this.#value, newValue)) {
			this.#value = newValue;

			for (const sink of Signal.subtle.introspectSinks(this)) {
				sink[notify](this);
			}
		}
	}
}

/**
 * A Signal which is a formula based on other Signals
 *
 * @template T
 */
class Computed {
	/**
	 * @type {EqualityCheck}
	 */
	#equals;

	/**
	 * @type {() => T}
	 */
	#computation;

	/**
	 * @type {boolean}
	 */
	#dirty = true;

	/**
	 * @type {T|initial}
	 */
	#value = initial;

	/**
	 * @type {VoidFunction|null}
	 */
	[watched] = null;

	/**
	 * @type {VoidFunction|null}
	 */
	[unwatched] = null;

	/**
	 * @type {VoidFunction|null}
	 */
	[onWatch] = null;

	/**
	 * @type {VoidFunction|null}
	 */
	[onUnwatch] = null;

	/**
	 * @type {boolean}
	 */
	[isWatched] = false;

	/**
	 * @type {Set<Computed<any>|Watcher>}
	 */
	[sinks] = new Set();

	/**
	 * @type {Set<State<any>|Computed<any>>}
	 */
	[sources] = new Set();

	/**
	 * Create a Signal which evaluates to the value returned by the callback.
	 * Callback is called with this signal as the this value.
	 *
	 * @param {() => T} computation - The function to calculate the value.
	 * @param {SignalOptions} [options]
	 */
	constructor(computation, options = opts) {
		if (typeof computation !== 'function') {
			throw new TypeError('Computation must be a function.');
		}  else if (typeof options !== 'object') {
			throw new TypeError('Invalid options.');
		} else {
			this.#equals = options.equals ?? equals;
			this.#computation = computation;

			if (typeof options[watched] === 'function') {
				this[onWatch] = options[watched].bind(this);
			}

			if (typeof options[unwatched] === 'function') {
				this[onUnwatch] = options[unwatched].bind(this);
			}
		}
	}

	/**
	 * Get the value of the signal
	 *
	 * @this {Computed<T>}
	 * @returns {T|initial}
	 */
	get() {
		const oldComputed = Signal.subtle.currentComputed();

		try {
			if (oldComputed !== this && oldComputed !== null) {
				this[sources].add(oldComputed);
			}

			Signal[currentComputed] = this;

			if (this.#dirty) {
				const val = this.#computation();

				this[sources].clear();
				for (const source of Signal.subtle.introspectSources(this)) {
					source[sinks].delete(this);
				}

				if (! this.#equals(val, this.#value)) {
					this.#value = val;

					for (const sink of Signal.subtle.introspectSinks(this)) {
						sink[notify](this);
					}
				}

				this.#dirty = false;
				return val;
			} else {
				return this.#value;
			}
		} finally {
			Signal[currentComputed] = oldComputed;
		}
	}

	/**
	 * Notifiies a `Signal.Computed` when a source has changed
	 *
	 * @param {State<any>|Computed<any>} source
	 */
	[notify](source) {
		this.#dirty = true;
		this[sources].add(source);
		source[sinks].add(this);

		for (const sink of Signal.subtle.introspectSinks(this)) {
			sink[notify](this);
		}
	}
}

/**
 * Watches for changes to specific signals.
 * @memberof Signal.subtle
 */
class Watcher {
	/**
	 * @type {boolean}
	 */
	#scheduled = false;

	/**
	 * @type {Set<AnySignal<any>>}
	 */
	#pending = new Set();

	/**
	 * @type {(this: Watcher) => void}
	 */
	#notify;

	/**
	 * @type {Set<AnySignal<any>}
	 */
	[sources] = new Set();


	/**
	 * When a (recursive) source of Watcher is written to, call this callback,
	 * if it hasn't already been called since the last `watch` call.
	 * No signals may be read or written during the notify.
	 *
	 * @param {(this: Watcher) => void} notify - Called synchronously when a watched signal becomes dirty.
	 */
	constructor(notify) {
		if (typeof notify !== 'function') {
			throw new TypeError(`Notify must be a function but got a ${typeof notify}.`);
		} else {
			this.#notify = notify;
		}
	}

	/**
	 * Add these signals to the Watcher's set, and set the watcher to run its
	 * notify callback next time any signal in the set (or one of its dependencies) changes.
	 * Can be called with no arguments just to reset the "notified" state, so that
	 * the notify callback will be invoked again.
	 *
	 * @param {...AnySignal<any>} signals
	 */
	watch(...signals) {
		for (const signal of signals) {
			if (! (signal instanceof State || signal instanceof Computed)) {
				throw new TypeError('Signal must be an instance of `Signal.State` or `Signal.Computed`.');
			} else {
				if (typeof signal[onWatch] === 'function' && ! signal[isWatched]) {
					signal[onWatch].call(signal);
				}

				this[sources].add(signal);
				signal[sinks].add(this);
			}
		}
	}

	/**
	 * Remove these signals from the watched set (e.g., for an effect which is disposed)
	 * @template T
	 * @param {...AnySignal<T>} signals
	 */
	unwatch(...signals) {
		for (const signal of signals) {
			if (! (signal instanceof State || signal instanceof Computed)) {
				throw new TypeError('Signal must be an instance of `Signal.State` or `Signal.Computed`.');
			} else {
				if (typeof signal[onUnwatch] === 'function' && signal[isWatched]) {
					signal[onUnwatch].call(signal);
				}

				signal[sinks].delete(this);
				this[sources].delete(signal);
			}
		}
	}

	/**
	 * Returns the set of sources in the Watcher's set which are still dirty, or is a computed signal
	 * with a source which is dirty or pending and hasn't yet been re-evaluated
	 *
	 * @returns {Array<AnySignal<any>>}
	 */
	getPending() {
		return Array.from(this.#pending);
	}

	/**
	 * Notify a `Signal.subtle.Watcher` when a source has changed
	 *
	 * @template T
	 * @param {AnySignal<T>} signal
	 */
	[notify](signal) {
		this.#pending.add(signal);

		if (! this.#scheduled) {
			this.#scheduled = true;

			queueMicrotask(() => {
				this.#scheduled = false;

				if (this.#pending.size !== 0) {
					this.#notify.call(this);
					this.#pending.clear();
				}
			});
		}
	}
}

/**
 * This namespace includes "advanced" features that are better to
 * leave for framework authors rather than application developers.
 * Analogous to `crypto.subtle`
 *
 * @namespace subtle
 */
const subtle = {
	Watcher,
	/**
	 * Hook to observe being watched
	 * @type {unique symbol}
	 */
	watched,

	/**
	 * Hook to observe no longer watched
	 * @type {unique s}
	 */
	unwatched,

	/**
	 * Run a callback with all tracking disabled
	 *
	 * @template T
	 * @param {() => T} cb
	 * @returns {T}
	 */
	untrack(cb) {
		if (typeof cb !== 'function') {
			throw new TypeError('Callback must be a function.');
		} else {
			const prev = Signal.subtle.currentComputed();
			Signal[currentComputed] = null;

			try {
				return cb();
			} finally {
				Signal[currentComputed] = prev;
			}
		}
	},

	/**
	 * Get the current computed signal which is tracking any signal reads, if any
	 *
	 * @returns {Computed<any>|null}
	 */
	currentComputed() {
		return Signal[currentComputed];
	},

	/**
	 * Returns ordered list of all signals which this one referenced
	 * during the last time it was evaluated.
	 * For a Watcher, lists the set of signals which it is watching.
	 *
	 * @param {Computed<any>|Watcher} s
	 * @returns {(State<any>|Computed<any>)[]}
	 */
	introspectSources(s) {
		if (! (s instanceof Computed || s instanceof Watcher)) {
			throw new TypeError('Expected a `Signal.Watcher` or `Signal.Computed`.');
		} else {
			return Array.from(s[sources]);
		}
	},

	/**
	 * Returns the Watchers that this signal is contained in, plus any
	 * Computed signals which read this signal last time they were evaluated,
	 * if that computed signal is (recursively) watched.
	 *
	 * @param {State<any>|Computed<any>} s
	 * @returns {(Computed<any>|Watcher)[]}
	 */
	introspectSinks(s) {
		if (! (s instanceof State || s instanceof Computed)) {
			throw new TypeError('Expected a `Signal.State` or `Signal.Computed`.');
		} else {
			return Array.from(s[sinks]);
		}
	},

	/**
	 * True if this signal is "live", in that it is watched by a Watcher,
	 * or it is read by a Computed signal which is (recursively) live.
	 *
	 * @param {State<any>|Computed<any>} s
	 * @return {boolean}
	 */
	hasSinks(s) {
		if (! (s instanceof State || s instanceof Computed)) {
			throw new TypeError('Expected a `Signal.State` or `Signal.Computed`.');
		} else {
			return s[sinks].size !== 0;
		}
	},

	/**
	 * True if this element is "reactive", in that it depends
	 * on some other signal. A Computed where hasSources is false
	 * will always return the same constant.
	 *
	 * @param {Computed<any>|Watcher} s
	 * @returns {boolean}
	 */
	hasSources(s) {
		if (! (s instanceof Computed || s instanceof Watcher)) {
			throw new TypeError('Expected a `Signal.Watcher` or `Signal.Computed`.');
		} else {
			return s[sources].size !== 0;
		}
	},
};

/**
 * The core Signals namespace.
 * @namespace Signal
 */
export const Signal = {
	State,
	Computed,
	subtle,

	/**
	 * @type {Computed<any>|null}
	 */
	[currentComputed]: null,
};

const a = new Signal.State(1);
const b = new Signal.State(2);
const sum = new Signal.Computed(() => a.get() + b.get());
const watcher = new Signal.subtle.Watcher(() => console.log('Watcher fired'));
watcher.watch(sum);
b.set(4);

console.log({
	sum: sum.get(),
	sinks: Signal.subtle.introspectSinks(sum),
	sources: Signal.subtle.introspectSources(watcher),
	pending: watcher.getPending(),
});
