import { MongoClient, MongoClientOptions } from 'mongodb';

import { Store } from '../types';
import { Enveloppe } from '../core/enveloppe';

export interface MongoDBStoreOptions {
    collectionName: string;
}

const defaultOptions: MongoDBStoreOptions = {
    collectionName: 'gammeomq',
};

export class MongoDBStore implements Store {
    private client?: MongoClient;
    private uri: string;
    private clientOptions?: MongoClientOptions;
    private options: MongoDBStoreOptions;

    constructor(
        uri: string,
        clientOptions?: MongoClientOptions,
        options?: Partial<MongoDBStoreOptions>,
    ) {
        this.uri = uri;
        this.clientOptions = clientOptions;
        this.options = { ...defaultOptions, ...options };
    }

    public clear() {
        return this.collection.drop();
    }

    public async close() {
        if (this.client) {
            await this.client.close();
        }
    }

    public async find(status: Enveloppe['status']) {
        return (await this.collection.find({ status }).toArray()) as Enveloppe[];
    }

    public async open() {
        this.client = await new MongoClient(this.uri, this.clientOptions).connect();
    }

    private get collection() {
        if (!this.client) {
            throw new Error('The store is closed');
        }

        return this.client.db().collection(this.options.collectionName);
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

    public async remove(id: Enveloppe['id']) {
        await this.collection.remove({ _id: id });
    }
}
