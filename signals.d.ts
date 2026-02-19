interface Signal<T> {
    // Get the value of the signal
    get(): T;
}

export declare namespace SignalX {
    // A read-write Signal
    class State<T> implements Signal<T> {
        // Create a state Signal starting with the value t
        constructor(t: T, options?: SignalOptions<T>);

        // Get the value of the signal
        get(): T;

        // Set the state Signal value to t
        set(t: T): void;
    }

    // A Signal which is a formula based on other Signals
    class Computed<T = unknown> implements Signal<T> {
        // Create a Signal which evaluates to the value returned by the callback.
        // Callback is called with this signal as the this value.
        constructor(cb: (this: Computed<T>) => T, options?: SignalOptions<T>);

        // Get the value of the signal
        get(): T;
    }

    // This namespace includes "advanced" features that are better to
    // leave for framework authors rather than application developers.
    // Analogous to `crypto.subtle`
    namespace subtle {
        // Run a callback with all tracking disabled
        function untrack<T>(cb: () => T): T;

        // Get the current computed signal which is tracking any signal reads, if any
        function currentComputed(): Computed | null;

        // Returns ordered list of all signals which this one referenced
        // during the last time it was evaluated.
        // For a Watcher, lists the set of signals which it is watching.
        function introspectSources(s: Computed | Watcher): (State<any> | Computed)[];

        // Returns the Watchers that this signal is contained in, plus any
        // Computed signals which read this signal last time they were evaluated,
        // if that computed signal is (recursively) watched.
        function introspectSinks(s: State<any> | Computed): (Computed | Watcher)[];

        // True if this signal is "live", in that it is watched by a Watcher,
        // or it is read by a Computed signal which is (recursively) live.
        function hasSinks(s: State<any> | Computed): boolean;

        // True if this element is "reactive", in that it depends
        // on some other signal. A Computed where hasSources is false
        // will always return the same constant.
        function hasSources(s: Computed | Watcher): boolean;

        class Watcher {
            // When a (recursive) source of Watcher is written to, call this callback,
            // if it hasn't already been called since the last `watch` call.
            // No signals may be read or written during the notify.
            constructor(notify: (this: Watcher) => void);

            // Add these signals to the Watcher's set, and set the watcher to run its
            // notify callback next time any signal in the set (or one of its dependencies) changes.
            // Can be called with no arguments just to reset the "notified" state, so that
            // the notify callback will be invoked again.
            watch(...s: Signal<any>[]): void;

            // Remove these signals from the watched set (e.g., for an effect which is disposed)
            unwatch(...s: Signal<any>[]): void;

            // Returns the set of sources in the Watcher's set which are still dirty, or is a computed signal
            // with a source which is dirty or pending and hasn't yet been re-evaluated
            getPending(): Signal<any>[];
        }

        // Hooks to observe being watched or no longer watched
        const watched: unique symbol;
        const unwatched: unique symbol;
    }

    interface SignalOptions<T> {
        // Custom comparison function between old and new value. Default: Object.is.
        // The signal is passed in as the this value for context.
        equals?: (this: Signal<T>, t: T, t2: T) => boolean;

        // Callback called when isWatched becomes true, if it was previously false
        [Signal.subtle.watched]?: (this: Signal<T>) => void;

        // Callback called whenever isWatched becomes false, if it was previously true
        [Signal.subtle.unwatched]?: (this: Signal<T>) => void;
    }
}
