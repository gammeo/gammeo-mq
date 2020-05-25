import { Observable, Subscriber, Subject, Subscription } from 'rxjs';

import { Transport } from '../types';

export class InMemoryTransport extends Observable<string> implements Transport {
    private observer!: Subscriber<string>;
    private network$ = new Subject<string>();
    private subscription?: Subscription;

    constructor() {
        super((o) => (this.observer = o));
    }

    close() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    open() {
        this.subscription = this.network$.subscribe((packedPacket) =>
            this.observer.next(packedPacket),
        );
    }

    route(packedPacket: string) {
        this.network$.next(packedPacket);
    }
}
