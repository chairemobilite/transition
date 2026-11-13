/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { jobNameToFileNamePart } from '../JobNameFilePart';

describe('jobNameToFileNamePart', () => {
    test.each([
        { description: 'letters and digits are kept, with their case', jobName: 'ScenarioA1', expected: 'ScenarioA1' },
        { description: 'spaces become one underscore', jobName: 'Scenario   A', expected: 'Scenario_A' },
        { description: 'accents are removed', jobName: 'Réseau été 2026 (v2)', expected: 'Reseau_ete_2026_v2' },
        { description: 'decomposed accents are removed', jobName: 'été', expected: 'ete' },
        { description: 'characters invalid in file names', jobName: 'a/b\\c:d*e?f"g<h>i|j', expected: 'a_b_c_d_e_f_g_h_i_j' },
        { description: 'control characters', jobName: 'a\tb\u0000c\u0001d', expected: 'a_b_c_d' },
        { description: 'dots and hyphens', jobName: '.hidden-name.csv', expected: 'hidden_name_csv' },
        { description: 'symbols and emojis', jobName: 'R&D 50% 🚌 bus', expected: 'R_D_50_bus' },
        { description: 'letters without an accent to remove', jobName: 'Œuvre straße', expected: 'uvre_stra_e' },
        { description: 'cut to 20 characters', jobName: 'abcdefghijklmnopqrstuvwxyz', expected: 'abcdefghijklmnopqrst' },
        { description: 'no underscore at the end after the cut', jobName: 'abcdefghijklmnopqrs tuv', expected: 'abcdefghijklmnopqrs' },
        { description: 'non-Latin alphabet', jobName: '東京 テスト', expected: '' },
        { description: 'only invalid characters', jobName: '/:*?', expected: '' },
        { description: 'empty name', jobName: '', expected: '' }
    ])('$description', ({ jobName, expected }) => {
        expect(jobNameToFileNamePart(jobName)).toEqual(expected);
    });
});
