import { ConsumerConfig } from '../types';

export class ConsumerConfigPool {
    private pool: Array<ConsumerConfig> = [];

    public push(consumerConfig: ConsumerConfig) {
        this.pool.push(consumerConfig);

        return () => this.pool.splice(this.pool.indexOf(consumerConfig), 1);
    }

    public filterByChannel(channel: string | null) {
        switch (channel) {
            case null:
                return this.pool;

            default:
                return this.pool.filter(
                    (consumerConfig) =>
                        consumerConfig.channels.filter((c) => c && channel.startsWith(c)).length >
                        0,
                );
        }
    }
}
