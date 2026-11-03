/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { calculationNameToFileNamePart } from '../CalculationNameFilePart';

describe('calculationNameToFileNamePart', () => {
    test.each([
        { description: 'letters and digits are kept, with their case', calculationName: 'ScenarioA1', expected: 'ScenarioA1' },
        { description: 'spaces become one underscore', calculationName: 'Scenario   A', expected: 'Scenario_A' },
        { description: 'accents are removed', calculationName: 'Réseau été 2026 (v2)', expected: 'Reseau_ete_2026_v2' },
        { description: 'decomposed accents are removed', calculationName: 'été', expected: 'ete' },
        { description: 'characters invalid in file names', calculationName: 'a/b\\c:d*e?f"g<h>i|j', expected: 'a_b_c_d_e_f_g_h_i_j' },
        { description: 'control characters', calculationName: 'a\tb\u0000c\u0001d', expected: 'a_b_c_d' },
        { description: 'dots and hyphens', calculationName: '.hidden-name.csv', expected: 'hidden_name_csv' },
        { description: 'symbols and emojis', calculationName: 'R&D 50% 🚌 bus', expected: 'R_D_50_bus' },
        { description: 'letters without an accent to remove', calculationName: 'Œuvre straße', expected: 'uvre_stra_e' },
        { description: 'cut to 20 characters', calculationName: 'abcdefghijklmnopqrstuvwxyz', expected: 'abcdefghijklmnopqrst' },
        { description: 'no underscore at the end after the cut', calculationName: 'abcdefghijklmnopqrs tuv', expected: 'abcdefghijklmnopqrs' },
        { description: 'non-Latin alphabet', calculationName: '東京 テスト', expected: '' },
        { description: 'only invalid characters', calculationName: '/:*?', expected: '' },
        { description: 'empty name', calculationName: '', expected: '' }
    ])('$description', ({ calculationName, expected }) => {
        expect(calculationNameToFileNamePart(calculationName)).toEqual(expected);
    });
});
