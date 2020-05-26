import { Subject, Observable, Subscriber, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import * as messagepack from 'msgpack-lite';

import { Transport, PacketBag } from '../types';

/**
 * The Router routes a packet on the transport.
 * It handles the packing and unpacking of packets.
 */
export class Router<Packet> extends Observable<PacketBag<Packet>> {
    private queueIn$ = new Subject<string>();
    private observer!: Subscriber<PacketBag<Packet>>;
    private transport$: Transport;

    private queueSubscription?: Subscription;
    private transportSubscription?: Subscription;

    public static unpack<Packet>(inflatedPacked: string): Packet {
        return messagepack.decode(Buffer.from(inflatedPacked, 'hex'));
    }

    public static pack<Packet>(packet: Packet): string {
        return messagepack.encode(packet).toString('hex');
    }

    constructor(transport$: Transport) {
        super((o) => (this.observer = o));

        this.transport$ = transport$;
    }

    public route(packet: Packet) {
        // We don't send right away the packet and push it into an observable.
        // Doing it this way it allows us to apply some rxjs operators on it and add some smart behavior like deduplication
        this.schedule(packet);
    }

    public open() {
        this.subscribeToQueue();
        this.subscribeToTransport();
    }

    public close() {
        if (this.queueSubscription) {
            this.queueSubscription.unsubscribe();
        }
        if (this.transportSubscription) {
            this.transportSubscription.unsubscribe();
        }
    }

    private schedule(packet: Packet) {
        // We pack the packet as an encoded string,
        // this makes it easier to send it and to apply heuristics on it like deduplication
        this.queueIn$.next(Router.pack<Packet>(packet));
    }

    private subscribeToTransport() {
        this.transportSubscription = this.transport$
            // We randomize delay to ensure that in case of multiple message queue using the same store/transport,
            // their consumers won't receive at the same time the messsage.
            // We do this to be able to handle concurrent access of the same data inside consumers
            .subscribe((packedPacket) => {
                const packetBag: PacketBag<Packet> = {
                    packet: Router.unpack<Packet>(packedPacket),
                    acknowledge: () => this.transport$.remove(packedPacket),
                    reject: () => this.transport$.route(packedPacket),
                };
                this.observer.next(packetBag);
            });
        // When the transport subscription will be canceled we want to close the transport
        this.transportSubscription.add(() => this.transport$.close());

        this.transport$.open();
    }

    private subscribeToQueue() {
        this.queueSubscription = this.queueIn$
            .pipe(distinctUntilChanged())
            .subscribe((inflatedPacked) => this.transport$.route(inflatedPacked));
    }
}
