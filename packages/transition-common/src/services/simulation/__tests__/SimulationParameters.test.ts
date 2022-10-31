/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validateSimulationParameters } from '../SimulationParameters';
import each from 'jest-each';

let msgErrors = {
    nbLinesMinNoNegative: 'transit:simulation:errors:NumberOfLinesMinNoNegative',
    nbLinesMaxNoNegative: 'transit:simulation:errors:NumberOfLinesMaxNoNegative',
    nbLinesMinHigherMax: 'transit:simulation:errors:NumberOfLinesMinHigherThanMax',
    nbVehiclesNoNegative: 'transit:simulation:errors:NumberOfVehiclesNoNegative',
    maxTimeBetweenPassagesTooHigh: 'transit:simulation:errors:MaxTimeBetweenPassagesTooHigh',
    maxTimeBetweenPassagesNoNegative: 'transit:simulation:errors:MaxTimeBetweenPassagesNoNegative',
    minTimeBetweenPassagesTooLow: 'transit:simulation:errors:MinTimeBetweenPassagesTooLow',
    minTimeBetweenPassagesTooHigh: 'transit:simulation:errors:MinTimeBetweenPassagesTooHigh',
    minTimeBetweenPassagesHigherThanMax: 'transit:simulation:errors:MinTimeHigherThanMax'
};

describe('Validate function for query attributes', () => {
    const empty = {
        attributes: {

        },
        isValid: false,
        errors: ['transit:simulation:errors:SimulatedAgenciesIsEmpty']
    };

    const allValid = {
        attributes: {
            maxTimeBetweenPassages: 24,
            minTimeBetweenPassages: 15,
            nbOfVehicles: 40,
            numberOfLinesMin: 10,
            numberOfLinesMax: 15,
            simulatedAgencies: ['arbitrary'],
            nonSimulatedServices: ['arbitraryService'],
            linesToKeep: ['arbitraryLine', 'arbitraryLine2']
        },
        isValid: true,
        errors: []
    };

    const negativeMinLines = {
        attributes: {
            numberOfLinesMin: -33,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.nbLinesMinNoNegative]
    };

    const negativeMaxLines = {
        attributes: {
            numberOfLinesMax: -33,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.nbLinesMaxNoNegative]
    };

    const negativeNbVehicles = {
        attributes: {
            nbOfVehicles: -33,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.nbVehiclesNoNegative]
    };

    const negativeMaxTime = {
        attributes: {
            maxTimeBetweenPassages: -33,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.maxTimeBetweenPassagesNoNegative]
    };

    const nbLinesMinGreaterThanMax = {
        attributes: {
            numberOfLinesMax: 10,
            numberOfLinesMin: 12,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.nbLinesMinHigherMax]
    };

    const nbLinesMinMaxEqual = {
        attributes: {
            numberOfLinesMax: 10,
            numberOfLinesMin: 10,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: true,
        errors: []
    };

    const moreThanOneError = {
        attributes: {
            maxTimeBetweenPassages: 24,
            nbOfVehicles: -40,
            numberOfLinesMin: 10,
            numberOfLinesMax: 9,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [ msgErrors.nbLinesMinHigherMax, msgErrors.nbVehiclesNoNegative ]
    };

    const onlySimulatedAgencies = {
        attributes: {
            simulatedAgencies: ['arbitrary'],
        },
        isValid: true,
        errors: []
    };

    const emptySimulatedAgencies = {
        attributes: {
            simulatedAgencies: [],
        },
        isValid: false,
        errors: ['transit:simulation:errors:SimulatedAgenciesIsEmpty']
    };

    const minTimeTooLow = {
        attributes: {
            minTimeBetweenPassages: 1,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.minTimeBetweenPassagesTooLow]
    };

    const minTimeTooHigh = {
        attributes: {
            minTimeBetweenPassages: 61,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.minTimeBetweenPassagesTooHigh]
    };

    const minTimeHigherThanMax = {
        attributes: {
            minTimeBetweenPassages: 15,
            maxTimeBetweenPassages: 10,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.minTimeBetweenPassagesHigherThanMax]
    };

    const minMaxTimeEqual = {
        attributes: {
            minTimeBetweenPassages: 15,
            maxTimeBetweenPassages: 15,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: true,
        errors: []
    };

    each([
        ['No values', empty],
        ['All valid values', allValid],
        ['Negative minimum number of lines', negativeMinLines],
        ['Negative maximum number of lines', negativeMaxLines],
        ['Negative number of vehicles', negativeNbVehicles],
        ['Negative max time', negativeMaxTime],
        ['Minimum number of lines greater than max', nbLinesMinGreaterThanMax],
        ['Minimum number of lines equal to max', nbLinesMinMaxEqual],
        ['More than one error', moreThanOneError],
        ['Only simulated agencies', onlySimulatedAgencies],
        ['Empty simulated agencies', emptySimulatedAgencies],
        ['Minimum time between passages too low', minTimeTooLow],
        ['Minimum time between passages too high', minTimeTooHigh],
        ['Minimum time between passages greater than max', minTimeHigherThanMax],
        ['Minimum time between passages equal max', minMaxTimeEqual]
    ]).test('%s', (_nameTest, objTest) => {
        const allAttributes = Object.assign({}, objTest.attributes);
        const { valid, errors } = validateSimulationParameters(allAttributes);

        expect(errors).toEqual(objTest.errors);
        expect(valid).toEqual(objTest.isValid);
    })
});
