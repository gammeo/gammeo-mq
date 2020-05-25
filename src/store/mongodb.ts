import { MongoClient, MongoClientOptions } from 'mongodb';

import { Store } from '../types';
import { Enveloppe } from '../core/enveloppe';

export class MongoDBStore implements Store {
    private client?: MongoClient;
    private uri: string;
    private options?: MongoClientOptions;

    constructor(uri: string, options?: MongoClientOptions) {
        this.uri = uri;
        this.options = options;
    }

    public async close() {
        if (this.client) {
            await this.client.close();
        }
    }

    public async open() {
        this.client = await new MongoClient(this.uri, this.options).connect();
    }

    private get collection() {
        if (!this.client) {
            throw new Error('The store is closed');
        }

        return this.client.db().collection('gammeomq');
    }

    public async write(enveloppe: Enveloppe) {
        await this.collection.updateOne(
            { _id: enveloppe.id },
            {
                $set: {
                    channel: enveloppe.channel,
                    error: enveloppe.error,
                    id: enveloppe.id,
                    messages: enveloppe.messages,
                    retryAttempts: enveloppe.retryAttempts,
                    status: enveloppe.status,
                },
            },
            { upsert: true },
        );
    }

    public async read(id: Enveloppe['id']) {
        const document = await this.collection.findOne({ _id: id });
        if (!document) {
            throw new Error(`Enveloppe ${id} not found`);
        }

        const enveloppe = new Enveloppe(
            document.channel,
            document.messages,
            document.error ? new Error(document.error) : undefined,
            document.status,
            document.retryAttempts,
            document.id,
        );

        return enveloppe;
    }
}
