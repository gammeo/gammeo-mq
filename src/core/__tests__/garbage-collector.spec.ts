import { GarbageCollector } from '../garbage-collector';
import { InMemoryStore } from '../../store/in-memory';
import { MongoDBStore } from '../../store/mongodb';
import { Enveloppe } from '../enveloppe';

describe('GarbageCollector', () => {
    let gb: GarbageCollector;

    [
        new InMemoryStore(),
        new MongoDBStore('mongodb://root:password@mongo:27017', {
            useUnifiedTopology: true,
        }),
    ].forEach((store) => {
        describe(`${store.constructor.name}`, () => {
            beforeEach(async () => {
                await store.open();
                await store.clear();
                gb = new GarbageCollector(store);
            });

            afterEach(async () => {
                await store.close();
            });

            it('should delete partially_delivered and not_delivered enveloppes when collect() is called', async () => {
                expect.assertions(12);

                const notDelivered = new Enveloppe(
                    'order',
                    [{ table: 7 }],
                    undefined,
                    'not_delivered',
                );
                const partiallyDelivered = new Enveloppe(
                    'order',
                    [{ table: 7 }],
                    undefined,
                    'partially_delivered',
                );
                const notRouted = new Enveloppe('order', [{ table: 7 }], undefined, 'not_routed');
                const inFlight = new Enveloppe('order', [{ table: 7 }], undefined, 'in_flight');
                const delivered = new Enveloppe('order', [{ table: 7 }], undefined, 'delivered');
                const pending = new Enveloppe('order', [{ table: 7 }], undefined, 'pending');

                await Promise.all([
                    store.write(notDelivered),
                    store.write(partiallyDelivered),
                    store.write(notRouted),
                    store.write(inFlight),
                    store.write(delivered),
                    store.write(pending),
                ]);

                expect(await store.find('not_delivered')).toMatchObject([{ id: notDelivered.id }]);
                expect(await store.find('partially_delivered')).toMatchObject([
                    { id: partiallyDelivered.id },
                ]);
                expect(await store.find('not_routed')).toMatchObject([{ id: notRouted.id }]);
                expect(await store.find('in_flight')).toMatchObject([{ id: inFlight.id }]);
                expect(await store.find('delivered')).toMatchObject([{ id: delivered.id }]);
                expect(await store.find('pending')).toMatchObject([{ id: pending.id }]);

                await gb.collect();

                expect(await store.find('not_delivered')).toMatchObject([]);
                expect(await store.find('partially_delivered')).toMatchObject([]);
                expect(await store.find('not_routed')).toMatchObject([]);
                expect(await store.find('in_flight')).toMatchObject([{ id: inFlight.id }]);
                expect(await store.find('delivered')).toMatchObject([]);
                expect(await store.find('pending')).toMatchObject([{ id: pending.id }]);
            });
        });
    });
});
