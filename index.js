import { Signal } from './signals.js';
globalThis.Signal = Signal;

const items = ['foo', 'bar', 'bazz'];

class HTMLListElement extends HTMLElement {
	#controller;
	#shadow = this.attachShadow({ mode: 'closed' });
	#list = new Signal.State(['hello', 'world']);
	#computed = new Signal.Computed(() => {
		const frag = document.createElement('frag');
		const items = this.#list.get();

		for (const item of items) {
			const li = document.createElement('li');
			li.textContent = item;
			li.part.add('item');
			frag.append(li);
		}

		return frag;
	});

	#watcher = new Signal.subtle.Watcher(() => {
		this.#shadow.getElementById('list').replaceChildren(this.#computed.get());
	});

	connectedCallback() {
		if (this.#controller instanceof AbortController && ! this.#controller.signal.aborted) {
			this.#controller.abort();
		}

		this.#controller = new AbortController();
		const list = document.createElement('ol');
		list.part.add('list');
		list.id = 'list';

		this.#shadow.replaceChildren(list);
		this.addEventListener('command', (event) => {
			const [command, item] = event.command.split(':');

			if (typeof item === 'string' && item.length !== 0) {
				switch(command) {
					case '--add':
						this.#list.set(this.#list.get().concat(item));
						break;

					case '--remove':
						if (this.#list.get().includes(item)) {
							this.#list.set(this.#list.get().filter(cur => cur !== item));
						}
						break;
				}
			}

		}, { signal: this.#controller.signal });

		this.#watcher.watch(this.#computed);
		list.append(this.#computed.get());
	}

	disconnectedCallback() {
		this.#controller.abort();
		this.#watcher.unwatch(this.#computed);
	}
}

customElements.define('custom-list', HTMLListElement);

const list = new HTMLListElement();
const frag = items.reduce((frag, item) => {
	const add = document.createElement('button');
	const del = document.createElement('button');

	add.type = 'button';
	add.command = `--add:${item}`;
	add.commandForElement = list;
	add.textContent = `Add ${item}`;

	del.type = 'button';
	del.command = `--remove:${item}`;
	del.commandForElement = list;
	del.textContent = `Remove ${item}`;
	frag.append(add, del);
	return frag;
}, document.createDocumentFragment());

document.getElementById('main').append(list, frag);
