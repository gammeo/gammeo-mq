import { Enveloppe } from '../enveloppe';

describe('Enveloppe', () => {
    it('should throw an error if messages is not an array', () => {
        expect.assertions(2);

        expect(() => new Enveloppe('order', { table: 7 } as any)).toThrowError(
            'messages should be an array',
        );
        expect(() => new Enveloppe('order', [{ table: 7 }])).not.toThrowError(
            'messages should be an array',
        );
    });
});
