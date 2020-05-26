import { InMemoryStore } from '../store/in-memory';
import { InMemoryTransport } from '../transport/in-memory';
import { MessageQueue } from '../core/message-queue';
import { waitForNextTick, waitFor } from './test-utils';
import { MongoDBStore } from '../store/mongodb';
import { RedisTransport } from '../transport/redis';

function createMessageQueue(name: string) {
    return new MessageQueue(
        name,
        new MongoDBStore('mongodb://root:password@mongo:27017', {
            useUnifiedTopology: true,
        }),
        new RedisTransport({
            host: 'redis',
        }),
    );
}
describe('Distributed MessageQueue', () => {
    let queue1: MessageQueue;
    let queue2: MessageQueue;

    beforeEach(async () => {
        queue1 = createMessageQueue('queue1');
        queue2 = createMessageQueue('queue2');
        await queue1.open();
        await queue2.open();

        jest.setTimeout(10e3);
    });

    afterEach(async () => {
        await queue1.close();
        await queue2.close();
    });

    it('should route messages to the right consumers', async () => {
        expect.assertions(1);

        const consumer1 = jest.fn();
        const consumer2 = jest.fn();

        const unsubscribe1 = queue1.subscribe(['orders'], consumer1, 'consumer1');
        const unsubscribe2 = queue2.subscribe(['orders'], consumer2, 'consumer2');

        await queue1.publish('orders', [
            {
                table: 3,
                meal: 'risotto',
            },
        ]);

        await waitFor(100); // network latency
        await waitForNextTick();

        expect(consumer1.mock.calls.length + consumer2.mock.calls.length).toBe(1);

        unsubscribe1();
        unsubscribe2();
    });

    it('should route messages to the right consumers', async () => {
        expect.assertions(2);

        const consumer1 = jest.fn();
        const consumer2 = jest.fn();

        const unsubscribe1 = queue1.subscribe(['orders'], consumer1, 'consumer1');
        const unsubscribe2 = queue2.subscribe(['other'], consumer2, 'consumer2');

        await queue1.publish('orders', [
            {
                table: 3,
                meal: 'risotto',
            },
        ]);

        await waitFor(100); // network latency
        await waitForNextTick();

        expect(consumer1).toHaveBeenCalledTimes(1);
        expect(consumer2).toHaveBeenCalledTimes(0);

        unsubscribe1();
        unsubscribe2();
    });
});
