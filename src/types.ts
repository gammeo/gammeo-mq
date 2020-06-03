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
    remove(packedPacket: string): void | Promise<void>;
}

export interface Store {
    clear(): void | Promise<void>;
    close(): void | Promise<void>;
    find(status: Enveloppe['status']): Enveloppe[] | Promise<Enveloppe[]>;
    open(): void | Promise<void>;
    read(id: Enveloppe['id']): Enveloppe | Promise<Enveloppe> | never;
    remove(id: Enveloppe['id']): void | Promise<void>;
    write(enveloppe: Enveloppe): void | Promise<void>;
}

export interface PacketBag<Packet> {
    acknowledge(): void | Promise<void>;
    packet: Packet;
    reject(): void | Promise<void>;
}
