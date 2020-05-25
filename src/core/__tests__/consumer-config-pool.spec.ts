import { ConsumerConfigPool } from '../consumer-config-pool';

describe('ConsumerConfigPool', () => {
    it('should return the consumers matching the channel when filterByChannel is called()', () => {
        expect.assertions(6);

        const pool = new ConsumerConfigPool();

        const consumerConfig1 = {
            consumer: jest.fn(),
            channels: ['orders'],
        };
        pool.push(consumerConfig1);

        const consumerConfig2 = {
            consumer: jest.fn(),
            channels: ['bills'],
        };
        pool.push(consumerConfig2);

        const consumerConfig3 = {
            consumer: jest.fn(),
            channels: ['ord'],
        };
        pool.push(consumerConfig3);

        expect(pool.filterByChannel('orders')).toEqual([consumerConfig1, consumerConfig3]);
        expect(pool.filterByChannel('orders:1')).toEqual([consumerConfig1, consumerConfig3]);
        expect(pool.filterByChannel('ord')).toEqual([consumerConfig3]);
        expect(pool.filterByChannel('o')).toEqual([]);
        expect(pool.filterByChannel('bills')).toEqual([consumerConfig2]);
        expect(pool.filterByChannel(null)).toEqual([
            consumerConfig1,
            consumerConfig2,
            consumerConfig3,
        ]);
    });
});
