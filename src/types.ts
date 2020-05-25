import { Observable } from 'rxjs';

import { Enveloppe } from './core/enveloppe';

export type Message = Record<string, unknown> | string;
export type Consumer = (messages: readonly Message[]) => void | Promise<void>;

export interface ConsumerConfig {
    consumer: Consumer;
    channels: string[];
    routingId?: string;
}

export interface Transport extends Observable<string> {
    close(): void | Promise<void>;
    open(): void | Promise<void>;
    route(packedPacket: string): void | Promise<void>;
}

export interface Store {
    close(): void | Promise<void>;
    open(): void | Promise<void>;
    read(id: Enveloppe['id']): Enveloppe | Promise<Enveloppe> | never;
    write(enveloppe: Enveloppe): void | Promise<void>;
}
