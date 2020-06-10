import { concatMap, bufferTime } from 'rxjs/operators';
import { Subscription, Subject } from 'rxjs';

import { ConsumerConfigPool } from './consumer-config-pool';
import { Enveloppe } from './enveloppe';
import { Message, Store, Transport, ConsumerConfig, PacketBag } from '../types';
import { Router } from './router';

const consumerChannel = (
    messageQueueRoutingId: string,
    consumerRoutingId: ConsumerConfig['routingId'],
) => `__consumer(${messageQueueRoutingId}@${consumerRoutingId})`;

export interface MessageQueueOptions {
    maxRetryAttempts: number;
    retryInterval: number;
    pendingMessageMaxAge: number;
}

const defaultOptions: MessageQueueOptions = {
    maxRetryAttempts: 3,
    retryInterval: 5e3,
    pendingMessageMaxAge: 60 * 60 * 1e3, // 1h
};

// Packet used for routing an enveloppe.
// We don't actually routes the all enveloppe.
// Therefore store and transport must be compatible,
// if you use a distributed transport like redis for instance, do not use an InMemoryStore
// but a distributed one like MongoStore
type MessageQueuePacket = { id: Enveloppe['id'] };

/**
 * The MessageQueue exposes a pub/sub api to send messages to consumers.
 * It is a standalone component and therefore relies on a store and transport interface to
 * deals with storage and network.
 */
export class MessageQueue {
    private consumerConfigs = new ConsumerConfigPool();
    private routingId: string;
    private options: MessageQueueOptions;
    private retry$ = new Subject<Enveloppe>();
    private router$: Router<MessageQueuePacket>;
    private store: Store;

    private retrySubscription?: Subscription;
    private routerSubscription?: Subscription;

    constructor(
        routingId: string,
        store: Store,
        transport$: Transport,
        options: Partial<MessageQueueOptions> = {},
    ) {
        this.routingId = routingId;
        this.store = store;
        this.router$ = new Router(transport$);
        this.options = { ...defaultOptions, ...options };
    }

    public async publish(channel: string | null, messages: Message[]) {
        const enveloppe = new Enveloppe(channel, messages);
        await this.store.write(enveloppe);
        this.route(enveloppe);
    }

    /**
     *
     * @param channels Channels the consumer will be subscribed to.
     * @param consumer The actual consumer callback.
     * @param routingId Unique id used to route a message to a specific consumer in case of retry. Defaults to consumer function name.
     */
    public subscribe(
        channels: string[],
        consumer: ConsumerConfig['consumer'],
        routingId?: ConsumerConfig['routingId'],
    ) {
        const reconciledRoutingId = routingId || consumer.name || consumer.toString().slice(0, 20);
        return this.consumerConfigs.push({
            consumer,
            channels: [...channels, consumerChannel(this.routingId, reconciledRoutingId)],
            routingId: reconciledRoutingId,
        });
    }

    /**
     * Close the message queue.
     * It will close the transport and the store.
     */
    public async close() {
        if (this.routerSubscription) {
            this.routerSubscription.unsubscribe();
        }
        if (this.retrySubscription) {
            this.retrySubscription.unsubscribe();
        }

        await this.store.close();
    }

    /**
     * Open the message queue.
     * It will open the transport and the store.
     */
    public async open() {
        await this.store.open();
        // await this.warmUp();
        this.subscribeToRetry();
        this.subscribeToRouter();
    }

    private async deliver(packetBag: PacketBag<MessageQueuePacket>) {
        // A new packet was emitted by the router,
        // we get the enveloppe linked to this packet and look for consumers
        const enveloppe = await this.store.read(packetBag.packet.id);
        const consumerConfigs = this.consumerConfigs.filterByChannel(enveloppe.channel);
        let errorCount = 0;

        if (consumerConfigs.length === 0) {
            return await packetBag.reject();
        }

        for (const consumerConfig of consumerConfigs) {
            try {
                await consumerConfig.consumer(enveloppe.messages);
            } catch (error) {
                // The consumer failed to process the messages of the enveloppe,
                // we schedule a retry, which will try to republish theses messages but only for this consumer
                // using its routingId. If it has already been tried to much times we give up and do nothing.
                errorCount++;
                if (enveloppe.retryAttempts < this.options.maxRetryAttempts) {
                    await this.scheduleRetry(enveloppe, consumerConfig, error);
                }
            }
        }

        let status: Enveloppe['status'] = 'delivered';

        if (errorCount > 0) {
            status = consumerConfigs.length > 1 ? 'partially_delivered' : 'not_delivered';
        }

        await this.store.write(
            enveloppe.update(errorCount > 0 ? 'partially_delivered' : 'delivered'),
        );
    }

    private async route(enveloppe: Enveloppe) {
        // We're about to route an eveloppe with the router,
        // we create the packet which will be used to track the enveloppe over the transport
        const packet: MessageQueuePacket = { id: enveloppe.id };
        try {
            this.router$.route(packet);
            await this.store.write(enveloppe.update('in_flight'));
        } catch (error) {
            await this.store.write(enveloppe.update('not_routed', error));
        }
    }

    private async scheduleRetry(
        enveloppe: Enveloppe,
        consumerConfig: ConsumerConfig,
        error: Error,
    ) {
        const clone = enveloppe.clone(
            consumerChannel(this.routingId, consumerConfig.routingId),
            enveloppe.retryAttempts + 1,
        );

        await this.store.write(clone.update('pending', error));
        this.retry$.next(clone);
    }

    private subscribeToRouter() {
        this.routerSubscription = this.router$.pipe(concatMap(this.deliver.bind(this))).subscribe();
        this.routerSubscription.add(() => this.router$.close());
        this.router$.open();
    }

    private subscribeToRetry() {
        this.retrySubscription = this.retry$
            .pipe(bufferTime(this.options.retryInterval))
            .subscribe((enveloppes) => enveloppes.forEach((enveloppe) => this.route(enveloppe)));
    }

    private async warmUp() {
        const ref = new Date();
        ref.setTime(ref.getTime() - this.options.pendingMessageMaxAge);

        const pendingEnveloppes = (await this.store.find('pending')).filter(
            (enveloppe) => enveloppe.updatedAt < ref && enveloppe.status === 'pending',
        );

        for (const enveloppe of pendingEnveloppes) {
            await this.route(enveloppe);
        }
    }
}
