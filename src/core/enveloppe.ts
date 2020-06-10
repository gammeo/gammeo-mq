import { nanoid } from 'nanoid';
import * as messagepack from 'msgpack-lite';

import { Message } from '../types';

export class Enveloppe {
    public readonly channel: string | null;
    public readonly id: string;
    public readonly messages: readonly Message[];
    public readonly retryAttempts: number = 0;
    public error?: Error;

    private _updatedAt: Date;
    private _status:
        | 'pending'
        | 'not_routed'
        | 'in_flight'
        | 'delivered'
        | 'not_delivered'
        | 'partially_delivered' = 'pending';

    constructor(
        channel: string | null,
        messages: Message[],
        error?: Error,
        status: Enveloppe['status'] = 'pending',
        retryAttempts: number = 0,
        id?: string,
    ) {
        this.channel = channel;
        this.messages = Object.freeze(messages);
        this.retryAttempts = retryAttempts;
        this.error = error;
        this._status = status;

        this.id = id || nanoid();
        this._updatedAt = new Date();
    }

    get status() {
        return this._status;
    }

    get updatedAt() {
        return this._updatedAt;
    }

    pack() {
        return new Enveloppe(
            this.channel,
            this.messages.map((message) => messagepack.encode(message).toString('hex')),
        );
    }

    unpack() {
        return new Enveloppe(
            this.channel,
            this.messages.map((message) =>
                messagepack.decode(Buffer.from(message as string, 'hex')),
            ),
        );
    }

    update(status: Enveloppe['status'], error?: Error) {
        this._status = status;
        this.error = Object.freeze(error);
        this._updatedAt = new Date();
        return this;
    }

    clone(channel: string | null, retryAttempts: number = 0) {
        return new Enveloppe(
            channel,
            this.messages as Message[],
            this.error,
            this.status,
            retryAttempts,
        );
    }
}
