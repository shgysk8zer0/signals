// @ts-check
const watchers = Symbol('signal:watchers');
const notify = Symbol('signal:watcher:notify');
const dirty = Symbol('signal:dirty');
const currentComputed = Symbol('signal:currentComputed');
const watched = Symbol('Signal:watched');
const unwatched = Symbol('Signal:unwatched');
const initial = Symbol('signal:initial'); // For equality checks in Computed, it must be a unique value

const queueMicrotask = typeof globalThis.queueMicrotask === 'function'
	? globalThis.queueMicrotask
	: cb => setTimeout(cb, 0);

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
 * @typedef {State<T> | Computed<T>} AnySignal
 */

/**
 * A writable signal that holds a value.
 * @template T
 */

/**
 * @type {SignalOptions}
 */
const opts = Object.freeze({ equals });

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
	 * @type {Set<Computed>}
	 */
	#computers = new Set();

	/**
	 * @param {T} value - The initial value.
	 * @param {SignalOptions} [options]
	 */
	constructor(value, options = opts) {
		if (typeof options !== 'object') {
			throw new TypeError('Invalid options.');
		} else {
			this.#value = value;
			this.#equals = options.equals ?? equals;
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
	 * @type {Set<Computed>}
	 */
	#computed = new Set();

	/**
	 * @type {EqualityCheck}
	 */
	#equals;

	/**
	 * @type {(() => T)}
	 */
	#computation;

	/**
	 * @type {boolean}
	 */
	#dirty = true;

	/**
	 * @type {T}
	 */
	#value = initial;

	/**
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
		}
	}

	/**
	 * Returns the current derived value, re-computing if dependencies changed.
	 * @returns {T}
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

	get [dirty]() {
		return this.#dirty;
	}

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
	 * @type {Set<AnySignal>}
	 */
	#watched = new Set();

	/**
	 * @type {Set<AnySignal>}
	 */
	#pending = new Set();

	/**
	 * @type {(thi: Watcher) => void}
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
	 * @param {...AnySignal} signals
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
	 * @param {...AnySignal} signals
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
	 * @returns {Array<AnySignal>}
	 */
	getPending() {
		return Array.from(this.#pending);
	}

	[notify](signal) {
		this.#pending.add(signal);

		if (! this.#scheduled) {
			this.#scheduled = true;

			queueMicrotask(() => {
				this.#scheduled = false;

				if (this.#pending.size !== 0) {
					this.#notify.call(this, this);
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
	 * Returns the currently executing Computed signal, if any.
	 * @returns {Computed|null}
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
	 * @type {Computed|null}
	 */
	[currentComputed]: null,
};
