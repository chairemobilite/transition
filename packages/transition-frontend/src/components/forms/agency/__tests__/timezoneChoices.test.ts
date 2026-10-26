/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { timezoneChoices } from '../timezoneChoices';

const timezoneNames = timezoneChoices.map((choice) => choice.value);

describe('timezoneChoices', () => {
    test('should list the time zones of the IANA database', () => {
        expect(timezoneNames).toEqual(
            expect.arrayContaining([
                'America/Toronto',
                'America/Ciudad_Juarez',
                'America/Argentina/Buenos_Aires',
                'Europe/Kyiv',
                'Etc/UTC'
            ])
        );
        expect(timezoneChoices).toContainEqual({ label: 'America/Toronto', value: 'America/Toronto' });
    });

    test('should list aliases, labelled with the time zone they point to', () => {
        expect(timezoneChoices).toEqual(
            expect.arrayContaining([
                { label: 'America/Montreal (America/Toronto)', value: 'America/Montreal' },
                { label: 'UTC (Etc/UTC)', value: 'UTC' }
            ])
        );
    });

    test('should list each time zone once, sorted by name', () => {
        expect(new Set(timezoneNames).size).toEqual(timezoneNames.length);
        expect(timezoneNames).toEqual([...timezoneNames].sort((a, b) => a.localeCompare(b)));
    });
});
