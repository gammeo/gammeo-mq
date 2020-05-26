import { InMemoryStore } from '../store/in-memory';
import { InMemoryTransport } from '../transport/in-memory';
import { MessageQueue } from '../core/message-queue';
import { waitForNextTick, waitFor } from './test-utils';
import { MongoDBStore } from '../store/mongodb';
import { RedisTransport } from '../transport/redis';

describe('MessageQueue', () => {
    let queue: MessageQueue;

    [
        { store: new InMemoryStore(), transport: new InMemoryTransport() },
        {
            store: new MongoDBStore('mongodb://root:password@mongo:27017', {
                useUnifiedTopology: true,
            }),
            transport: new RedisTransport({
                host: 'redis',
            }),
        },
    ].forEach(({ store, transport }) => {
        describe(`${store.constructor.name} + ${transport.constructor.name}`, () => {
            beforeEach(async () => {
                queue = new MessageQueue('DinerMessageQueue', store, transport, {
                    // this must be higher than the network latency timeouts,
                    // otherwise it will break tests as the retry queue will be flushed by the network latency timeout
                    retryInterval: 300,
                    maxRetryAttempts: 2,
                });
                await queue.open();

                jest.setTimeout(10e3);
            });

            afterEach(async () => {
                await queue.close();
            });

            it('should route messages to the right consumers', async () => {
                expect.assertions(8);

                const consumer1 = jest.fn();
                const consumer2 = jest.fn();

                const unsubscribe1 = queue.subscribe(['orders'], consumer1, 'consumer1');
                const unsubscribe2 = queue.subscribe(['bills'], consumer2, 'consumer2');

                await queue.publish('orders', [
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                    {
                        table: 5,
                        meal: 'pasta',
                    },
                ]);
                await queue.publish('orders:urgent', [
                    {
                        table: 4,
                        meal: 'tiramisu',
                    },
                ]);
                await queue.publish('orders', [
                    {
                        table: 6,
                        meal: 'cake',
                    },
                ]);
                await queue.publish('bills', [
                    {
                        table: 6,
                        amount: 24,
                    },
                ]);
                await queue.publish(null, [
                    {
                        broadcast: true,
                    },
                ]);

                await waitFor(100); // network latency
                await waitForNextTick();

                expect(consumer1).toHaveBeenCalledTimes(4);
                expect(consumer1).toHaveBeenCalledWith([
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                    {
                        table: 5,
                        meal: 'pasta',
                    },
                ]);
                expect(consumer1).toHaveBeenCalledWith([
                    {
                        table: 4,
                        meal: 'tiramisu',
                    },
                ]);
                expect(consumer1).toHaveBeenCalledWith([
                    {
                        table: 6,
                        meal: 'cake',
                    },
                ]);
                expect(consumer1).toHaveBeenCalledWith([
                    {
                        broadcast: true,
                    },
                ]);
                expect(consumer2).toHaveBeenCalledTimes(2);
                expect(consumer2).toHaveBeenCalledWith([
                    {
                        table: 6,
                        amount: 24,
                    },
                ]);
                expect(consumer2).toHaveBeenCalledWith([
                    {
                        broadcast: true,
                    },
                ]);

                unsubscribe1();
                unsubscribe2();
            });

            it('should republish a message when a consumer fails to process it using the consumer routingId', async () => {
                expect.assertions(6);

                const consumer1 = jest.fn();
                const consumer2 = jest
                    .fn()
                    .mockImplementationOnce(() => Promise.reject(new Error('Oops!')));
                const unsubscribe1 = queue.subscribe(['orders'], consumer1, 'consumer1');
                const unsubscribe2 = queue.subscribe(['orders'], consumer2, 'consumer2');

                await queue.publish('orders', [
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);

                await waitFor(100); // network latency
                await waitForNextTick();

                expect(consumer1).toHaveBeenCalledTimes(1);
                expect(consumer1).toHaveBeenCalledWith([
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);
                expect(consumer2).toHaveBeenCalledTimes(1);
                expect(consumer2).toHaveBeenCalledWith([
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);

                await waitFor(300); // waiting for retry
                await waitFor(100); // network latency
                await waitForNextTick();
                expect(consumer2).toHaveBeenCalledTimes(2);
                expect(consumer2).toHaveBeenLastCalledWith([
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);
                unsubscribe1();
                unsubscribe2();
            });

            it('should not retry more than maxRetryAttempts options', async () => {
                expect.assertions(7);

                const consumer = jest
                    .fn()
                    .mockImplementationOnce(() => Promise.reject(new Error('Oops!')))
                    .mockImplementationOnce(() => Promise.reject(new Error('Oops!')))
                    .mockImplementationOnce(() => Promise.reject(new Error('Oops!')));
                const unsubscribe = queue.subscribe(['orders'], consumer, 'consumer');

                await queue.publish('orders', [
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);

                await waitFor(100); // network latency
                await waitForNextTick();

                expect(consumer).toHaveBeenCalledTimes(1);
                expect(consumer).toHaveBeenCalledWith([
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);

                await waitFor(300); // waiting for first retry
                await waitFor(100); // network latency
                await waitForNextTick();
                expect(consumer).toHaveBeenCalledTimes(2);
                expect(consumer).toHaveBeenCalledWith([
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);

                await waitFor(100); // waiting for last retry
                await waitFor(100); // network latency
                await waitForNextTick();
                expect(consumer).toHaveBeenCalledTimes(3);
                expect(consumer).toHaveBeenCalledWith([
                    {
                        table: 3,
                        meal: 'risotto',
                    },
                ]);

                await waitFor(300); // waiting for retry interval
                await waitFor(100); // network latency
                await waitForNextTick();
                expect(consumer).toHaveBeenCalledTimes(3);

                unsubscribe();
            });
        });
    });
});
