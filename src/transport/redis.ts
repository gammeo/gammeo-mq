import { Observable, Subscriber } from 'rxjs';
import redis from 'redis';
import { Transport } from '../types';

const REDIS_CHANNEL = 'gammeomq';

export class RedisTransport extends Observable<string> implements Transport {
    private observer!: Subscriber<string>;
    private options?: redis.ClientOpts;
    private publisher?: redis.RedisClient;
    private subscriber?: redis.RedisClient;

    constructor(options: redis.ClientOpts) {
        super((o) => (this.observer = o));
        this.options = options;
    }

    close() {
        if (!this.publisher && !this.subscriber) {
            throw new Error('Transport is closed');
        }

        if (this.publisher) {
            this.publisher.quit();
            this.publisher = undefined;
        }

        if (this.subscriber) {
            this.subscriber.quit();
            this.publisher = undefined;
        }
    }

    open() {
        this.publisher = redis.createClient(this.options);
        this.subscriber = redis.createClient(this.options);
        this.subscriber.subscribe(REDIS_CHANNEL);
        this.subscriber.on('message', this.onMessage);
    }

    route(packedPacket: string) {
        if (!this.publisher) {
            throw new Error('Transport is closed');
        }

        this.publisher.publish(REDIS_CHANNEL, packedPacket);
    }

    private onMessage = (channel: string, message: string) => {
        if (channel !== REDIS_CHANNEL) {
            return;
        }

        this.observer.next(message);
    };
}
