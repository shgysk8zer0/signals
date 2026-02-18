// @ts-check
/**
 * @type {unique symbol}
 */
const watchers = Symbol('signal:watchers');

/**
 * @type {unique symbol}
 */
const notify = Symbol('signal:watcher:notify');

/**
 * @type {unique symbol}
 */
const dirty = Symbol('signal:dirty');

/**
 * @type {unique symbol}
 */
const currentComputed = Symbol('signal:currentComputed');

/**
 * @type {unique symbol}
 */
const watched = Symbol('Signal:watched');

/**
 * @type {unique symbol}
 */
const unwatched = Symbol('Signal:unwatched');

/**
 * @type {unique symbol}
 */
const initial = Symbol('signal:initial'); // For equality checks in Computed, it must be a unique value

/**
 * @type {unique symbol}
 */
const isWatched = Symbol('Signal:isWatched');

/**
 * @type {unique symbol}
 */
const onWatch = Symbol('Signal:onWatch');

/**
 * @type {unique symbol}
 */
const onUnwatch = Symbol('Signal:onUnwatch');

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
			void Promise.resolve().then(() => cb()).catch(reportError);
		}
	};
/**
 * @typedef {(t: any, t2: any) => boolean} EqualityCheck
 */

/**
 * @type {EqualityCheck}
 */
const equals = Object.is;

/**
 * @template T
 * @typedef {object} SignalOptions
 * @property {EqualityCheck} [equals] - Custom equality function.
 * @property {(this: Signal<T>) => void} [Signal.subtle.watched]
 * @property {(this: Signal<T>) => void} [Signal.subtle.unwatched]
 */

/**
 * @template T
 * @type {SignalOptions<T>}
 */
const opts = Object.freeze({ equals });

/**
 * @template T
 * @typedef {State<T> | Computed<T>} AnySignal<T>
 */

/**
 * A writable signal that holds a value.
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
	 * @type {Set<Watcher>}
	 */
	[watchers] = new Set();

	/**
	 * @type {VoidFunction|null}
	 */
	[watched] = null;

	/**
	 * @type {boolean}
	 */
	[isWatched] = false;

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
	 * @type {Set<Computed<T>>}
	 */
	#computers = new Set();

	/**
	 * @param {T} value - The initial value.
	 * @param {SignalOptions<T>} [options]
	 */
	constructor(value, options = opts) {
		if (typeof options !== 'object') {
			throw new TypeError('Invalid options.');
		} else {
			this.#equals = options.equals ?? equals;
			this.#value = value;
		}
	}

	/**
	 * Returns the current value and registers a dependency if called within a reactive context.
	 * @returns {T}
	 */
	get() {
		const currentComputed = Signal.subtle.currentComputed();

		if (currentComputed instanceof Computed) {
			this.#computers.add(currentComputed);
		}

		return this.#value;
	}

	/**
	 * Updates the value and notifies dependents.
	 * @param {T} newValue
	 */
	set(newValue) {
		if (! this.#equals(this.#value, newValue)) {
			this.#value = newValue;

			for (const computed of this.#computers) {
				computed[dirty] = true;
			}

			for (const watcher of this[watchers]) {
				watcher[notify](this);
			}
		}
	}
}

/**
 * A read-only signal that derives its value from other signals.
 * @template T
 */
class Computed {
	/**
	 * @type {Set<Watcher>}
	 */
	[watchers] = new Set();

	/**
	 * @type {Set<Computed<any>>}
	 */
	#computed = new Set();

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
	 * @param {() => T} computation - The function to calculate the value.
	 * @param {SignalOptions<T>} [options]
	 */
	constructor(computation, options = opts) {
		if (typeof computation !== 'function') {
			throw new TypeError('Computation must be a function.');
		}  else if (typeof options !== 'object') {
			throw new TypeError('Invalid options.');
		} else {
			this.#equals = options.equals ?? equals;
			this.#computation = computation;
		}
	}

	/**
	 * Returns the current derived value, re-computing if dependencies changed.
	 * @this {Computed<T>}
	 * @returns {T|initial}
	 */
	get() {
		const oldComputed = Signal.subtle.currentComputed();

		try {
			if (oldComputed !== this && oldComputed !== null) {
				this.#computed.add(oldComputed);
			}

			Signal[currentComputed] = this;

			if (this.#dirty) {
				const val = this.#computation();

				if (! this.#equals(val, this.#value)) {
					this.#value = val;

					for (const computed of this.#computed) {
						computed[dirty] = true;
					}

					for (const watcher of this[watchers]) {
						watcher[notify](this);
					}
				}

				this[dirty] = false;
				return val;
			} else {
				return this.#value;
			}
		} finally {
			Signal[currentComputed] = oldComputed;
		}
	}

	/**
	 * @returns {boolean}
	 */
	get [dirty]() {
		return this.#dirty;
	}

	/**
	 * @param {boolean} val
	 */
	set [dirty](val) {
		if (! val) {
			this.#dirty = false;
		} else if (! this.#dirty || this.#value === initial) {
			this.#dirty = true;

			for (const computed of this.#computed) {
				computed[dirty] = true;
			}

			for (const watcher of this[watchers]) {
				watcher[notify](this);
			}
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
	#watched = new Set();

	/**
	 * @type {Set<AnySignal<any>>}
	 */
	#pending = new Set();

	/**
	 * @type {(this: Watcher) => void}
	 */
	#notify;


	/**
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
	 * Start watching one or more signals.
	 * @param {...AnySignal<any>} signals
	 */
	watch(...signals) {
		for (const signal of signals) {
			if (! (signal instanceof State || signal instanceof Computed)) {
				throw new TypeError('Signal must be an instance of `Signal.State` or `Signal.Computed`.');
			} else {
				if (typeof signal[watched] === 'function') {
					signal[watched].call(signal);
				}

				this.#watched.add(signal);
				signal[watchers].add(this);
			}
		}
	}

	/**
	 * Stop watching one or more signals.
	 * @template T
	 * @param {...AnySignal<T>} signals
	 */
	unwatch(...signals) {
		for (const signal of signals) {
			if (! (signal instanceof State || signal instanceof Computed)) {
				throw new TypeError('Signal must be an instance of `Signal.State` or `Signal.Computed`.');
			} else {
				if (typeof signal[unwatched] === 'function') {
					signal[unwatched].call(signal);
				}

				this.#watched.delete(signal);
				signal[watchers].delete(this);

				if (this.#pending.has(signal)) {
					this.#pending.delete(signal);
				}
			}
		}
	}

	/**
	 * Returns the list of dirty signals.
	 * @returns {Array<AnySignal<any>>}
	 */
	getPending() {
		return Array.from(this.#pending);
	}

	/**
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
 * Utilities for framework authors and advanced use cases.
 */
const subtle = {
	Watcher,
	watched,
	unwatched,

	/**
	 * Runs a function without tracking any signal dependencies.
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
	 *
	 * @param {Computed<any>|Watcher} s
	 * @returns {(State<any>|Computed<any>)[]}
	 */
	introspectSources(s) {
		if (! (s instanceof Computed || s instanceof Watcher)) {
			throw new TypeError('Expected a `Signal.Watcher` or `Signal.Computed`.');
		} else {
			return [];
		}
	},

	/**
	 *
	 * @param {State<any>|Computed<any>} s
	 * @returns {(Computed<any>|Watcher)[]}
	 */
	introspectSinks(s) {
		if (! (s instanceof State || s instanceof Computed)) {
			throw new TypeError('Expected a `Signal.State` or `Signal.Computed`.');
		} else {
			return [];
		}
	},

	/**
	 *
	 * @param {State<any>|Computed<any>} s
	 * @return {boolean}
	 */
	hasSinks(s) {
		if (! (s instanceof State || s instanceof Computed)) {
			throw new TypeError('Expected a `Signal.State` or `Signal.Computed`.');
		} else {
			return true;
		}
	},

	/**
	 *
	 * @param {Computed<any>|Watcher} s
	 * @returns {boolean}
	 */
	hasSources(s) {
		if (! (s instanceof Computed || s instanceof Watcher)) {
			throw new TypeError('Expected a `Signal.Watcher` or `Signal.Computed`.');
		} else {
			return true;
		}
	},

	/**
	 * Returns the currently executing Computed signal, if any.
	 * @returns {Computed<any>|null}
	 */
	currentComputed() {
		return Signal[currentComputed];
	}
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
