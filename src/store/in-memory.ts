import { Store } from '../types';
import { Enveloppe } from '../core/enveloppe';

export class InMemoryStore implements Store {
    private storage?: Map<Enveloppe['id'], Enveloppe>;

    public close() {
        this.storage = undefined;
    }

    public open() {
        this.storage = new Map<Enveloppe['id'], Enveloppe>();
    }

    public write(enveloppe: Enveloppe) {
        if (!this.storage) {
            throw new Error('The store is closed');
        }

        this.storage.set(enveloppe.id, enveloppe);
    }

    public read(id: Enveloppe['id']) {
        if (!this.storage) {
            throw new Error('The store is closed');
        }

        if (!this.storage.has(id)) {
            throw new Error(`Enveloppe ${id} not found`);
        }

        return this.storage.get(id) as Enveloppe;
    }
}
