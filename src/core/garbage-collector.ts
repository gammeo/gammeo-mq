import { Store } from '../types';
import { Enveloppe } from './enveloppe';

const flat = <T = any>(d: Array<T[]>) => d.reduce((p, n) => [...p, ...n], []);

export class GarbageCollector {
    private static statusToCollect: Enveloppe['status'][] = [
        'delivered',
        'not_delivered',
        'not_routed',
        'partially_delivered',
    ];
    private store: Store;

    constructor(store: Store) {
        this.store = store;
    }

    async collect() {
        const enveloppes = flat<Enveloppe>(
            await Promise.all(
                GarbageCollector.statusToCollect.map((status) => this.store.find(status)),
            ),
        );

        for (const enveloppe of enveloppes) {
            await this.store.remove(enveloppe.id);
        }
    }
}
