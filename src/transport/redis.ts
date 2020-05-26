import { Observable, Subscriber } from 'rxjs';
import redis from 'redis';

import { Transport } from '../types';

const NEW_PACKET_NOTIFICATION = 'NEW_PACKET';

export interface RedisTransportOptions {
    notificationChannel: string;
    queueKey: string;
}

const defaultOptions: RedisTransportOptions = {
    notificationChannel: 'gammeomq',
    queueKey: 'gammeomq',
};

export class RedisTransport extends Observable<string> implements Transport {
    private observer!: Subscriber<string>;
    private clientOptions?: redis.ClientOpts;
    private options: RedisTransportOptions;
    private publisher?: redis.RedisClient;
    private subscriber?: redis.RedisClient;
    private timeoutIds: NodeJS.Timeout[] = [];

    constructor(clientOptions: redis.ClientOpts, options?: Partial<RedisTransportOptions>) {
        super((o) => (this.observer = o));
        this.clientOptions = clientOptions;
        this.options = { ...defaultOptions, ...options };
    }

    close() {
        for (const timeoutId of this.timeoutIds) {
            clearTimeout(timeoutId);
        }

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
        this.publisher = redis.createClient(this.clientOptions);
        this.subscriber = redis.createClient(this.clientOptions);
        this.subscriber.subscribe(this.options.notificationChannel);
        this.subscriber.on('message', this.onMessage);
    }

    route(packedPacket: string) {
        if (!this.publisher) {
            throw new Error('Transport is closed');
        }

        this.publisher.rpush(this.options.queueKey, packedPacket);
        this.publisher.publish(this.options.notificationChannel, NEW_PACKET_NOTIFICATION);
    }

    remove(_: string) {
        //do nothing
    }

    private onMessage = (channel: string, notification: string) => {
        if (
            channel !== this.options.notificationChannel ||
            notification !== NEW_PACKET_NOTIFICATION
        ) {
            return;
        }

        // random delay to avoid having always the same consumer getting over and over the same packet in case of a reject
        const timeoutId = setTimeout(() => {
            if (!this.publisher) {
                throw new Error('Transport is closed');
            }
            this.publisher.rpop(this.options.queueKey, (_, packet) => {
                if (packet) {
                    this.observer.next(packet);
                }
            });
            this.timeoutIds.splice(this.timeoutIds.indexOf(timeoutId), 1);
        }, Math.random() * 10);

        this.timeoutIds.push(timeoutId);
    };
}
