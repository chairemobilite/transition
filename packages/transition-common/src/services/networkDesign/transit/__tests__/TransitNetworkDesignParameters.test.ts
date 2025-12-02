/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validateTransitNetworkDesignParameters, transitNetworkDesignDescriptor } from '../TransitNetworkDesignParameters';
import each from 'jest-each';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import AgencyCollection from '../../../agency/AgencyCollection';
import ServiceCollection from '../../../service/ServiceCollection';
import LineCollection from '../../../line/LineCollection';
import Agency from '../../../agency/Agency';
import Line from '../../../line/Line';
import Service from '../../../service/Service';

// Mock serviceLocator
const mockAgencyCollection = new AgencyCollection([], {});
const mockServiceCollection = new ServiceCollection([], {});
const mockLineCollection = new LineCollection([], {});
const collectionManager = new CollectionManager(null);
collectionManager.add('agencies', mockAgencyCollection);
collectionManager.add('services', mockServiceCollection);
collectionManager.add('lines', mockLineCollection);
serviceLocator.addService('collectionManager', collectionManager);

let msgErrors = {
    nbLinesMinNoNegative: 'transit:simulation:errors:NumberOfLinesMinNoNegative',
    nbLinesMaxNoNegative: 'transit:simulation:errors:NumberOfLinesMaxNoNegative',
    nbLinesMinHigherMax: 'transit:simulation:errors:NumberOfLinesMinHigherThanMax',
    nbVehiclesNoNegative: 'transit:simulation:errors:NumberOfVehiclesNoNegative',
    maxTimeBetweenPassagesTooHigh: 'transit:simulation:errors:MaxTimeBetweenPassagesTooHigh',
    maxTimeBetweenPassagesNoNegative: 'transit:simulation:errors:MaxTimeBetweenPassagesNoNegative',
    minTimeBetweenPassagesTooLow: 'transit:simulation:errors:MinTimeBetweenPassagesTooLow',
    minTimeBetweenPassagesTooHigh: 'transit:simulation:errors:MinTimeBetweenPassagesTooHigh',
    minTimeBetweenPassagesHigherThanMax: 'transit:simulation:errors:MinTimeHigherThanMax',
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

    const maxTimeTooHigh = {
        attributes: {
            maxTimeBetweenPassages: 100,
            simulatedAgencies: ['arbitrary'],
        },
        isValid: false,
        errors: [msgErrors.maxTimeBetweenPassagesTooHigh]
    }

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
        ['Minimum time between passages equal max', minMaxTimeEqual],
        ['Maximum time between passages too high', maxTimeTooHigh]
    ]).test('%s', (_nameTest, objTest) => {
        const allAttributes = Object.assign({}, objTest.attributes);
        const { valid, errors } = validateTransitNetworkDesignParameters(allAttributes);

        expect(errors).toEqual(objTest.errors);
        expect(valid).toEqual(objTest.isValid);
    })
});

describe('TransitNetworkDesignDescriptor', () => {
    describe('getTranslatableName', () => {
        test('should return correct i18n key', () => {
            expect(transitNetworkDesignDescriptor.getTranslatableName()).toBe('transit:networkDesign:TransitNetworkDesignParameters');
        });
    });

    describe('getOptions', () => {
        test('should return all required options', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            
            expect(options).toHaveProperty('numberOfLinesMin');
            expect(options).toHaveProperty('numberOfLinesMax');
            expect(options).toHaveProperty('maxTimeBetweenPassages');
            expect(options).toHaveProperty('minTimeBetweenPassages');
            expect(options).toHaveProperty('nbOfVehicles');
            expect(options).toHaveProperty('simulatedAgencies');
            expect(options).toHaveProperty('nonSimulatedServices');
            expect(options).toHaveProperty('linesToKeep');
        });

        test('numberOfLinesMin should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const numberOfLinesMin = options.numberOfLinesMin;
            
            expect(numberOfLinesMin.i18nName).toBe('transit:networkDesign:parameters:NumberOfLinesMin');
            expect(numberOfLinesMin.type).toBe('integer');
            expect(numberOfLinesMin.required).toBe(true);
            expect(numberOfLinesMin.validate).toBeDefined();
            expect(numberOfLinesMin.validate!(1)).toBe(true);
            expect(numberOfLinesMin.validate!(0)).toBe(false);
        });

        test('numberOfLinesMax should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const numberOfLinesMax = options.numberOfLinesMax;
            
            expect(numberOfLinesMax.i18nName).toBe('transit:networkDesign:parameters:NumberOfLinesMax');
            expect(numberOfLinesMax.type).toBe('integer');
            expect(numberOfLinesMax.required).toBe(true);
            expect(numberOfLinesMax.validate).toBeDefined();
            expect(numberOfLinesMax.validate!(1)).toBe(true);
            expect(numberOfLinesMax.validate!(0)).toBe(false);
        });

        test('maxTimeBetweenPassages should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const maxTimeBetweenPassages = options.maxTimeBetweenPassages;
            
            expect(maxTimeBetweenPassages.i18nName).toBe('transit:networkDesign:parameters:MaxIntervalMinutes');
            expect(maxTimeBetweenPassages.type).toBe('integer');
            expect(maxTimeBetweenPassages.required).toBe(true);
            expect(maxTimeBetweenPassages.default).toBe(30);
            expect(maxTimeBetweenPassages.validate).toBeDefined();
            expect(maxTimeBetweenPassages.validate!(3)).toBe(true);
            expect(maxTimeBetweenPassages.validate!(2)).toBe(false);
        });

        test('minTimeBetweenPassages should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const minTimeBetweenPassages = options.minTimeBetweenPassages;
            
            expect(minTimeBetweenPassages.i18nName).toBe('transit:networkDesign:parameters:MinIntervalMinutes');
            expect(minTimeBetweenPassages.type).toBe('integer');
            expect(minTimeBetweenPassages.required).toBe(true);
            expect(minTimeBetweenPassages.default).toBe(5);
            expect(minTimeBetweenPassages.validate).toBeDefined();
            expect(minTimeBetweenPassages.validate!(3)).toBe(true);
            expect(minTimeBetweenPassages.validate!(2)).toBe(false);
        });

        test('nbOfVehicles should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const nbOfVehicles = options.nbOfVehicles;
            
            expect(nbOfVehicles.i18nName).toBe('transit:networkDesign:parameters:VehiclesCount');
            expect(nbOfVehicles.type).toBe('integer');
            expect(nbOfVehicles.required).toBe(true);
            expect(nbOfVehicles.validate).toBeDefined();
            expect(nbOfVehicles.validate!(1)).toBe(true);
            expect(nbOfVehicles.validate!(0)).toBe(false);
        });

        test('simulatedAgencies should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const simulatedAgencies = options.simulatedAgencies;
            
            expect(simulatedAgencies.i18nName).toBe('transit:networkDesign:parameters:LineSetAgencies');
            expect(simulatedAgencies.type).toBe('multiselect');
            expect(simulatedAgencies.required).toBe(true);
            expect(simulatedAgencies.choices).toBeDefined();
            expect(typeof simulatedAgencies.choices).toBe('function');
        });

        test('nonSimulatedServices should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const nonSimulatedServices = options.nonSimulatedServices;
            
            expect(nonSimulatedServices.i18nName).toBe('transit:networkDesign:parameters:NonSimulatedServices');
            expect(nonSimulatedServices.type).toBe('multiselect');
            expect((nonSimulatedServices as any).required).toBeUndefined();
            expect(nonSimulatedServices.choices).toBeDefined();
            expect(typeof nonSimulatedServices.choices).toBe('function');
        });

        test('linesToKeep should have correct configuration', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const linesToKeep = options.linesToKeep;
            
            expect(linesToKeep.i18nName).toBe('transit:networkDesign:parameters:KeepLines');
            expect(linesToKeep.type).toBe('multiselect');
            expect((linesToKeep as any).required).toBeUndefined();
            expect(linesToKeep.choices).toBeDefined();
            expect(typeof linesToKeep.choices).toBe('function');
        });
    });

    describe('option choices', () => {
        beforeEach(() => {
            // Reset collections
            collectionManager.add('agencies', mockAgencyCollection);
            collectionManager.add('services', mockServiceCollection);
            collectionManager.add('lines', mockLineCollection);
        });

        test('should get choices for the simulated agencies option, no agencies', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const simulatedAgencies = options.simulatedAgencies;

            const choices = simulatedAgencies.choices!();
            expect(choices).toEqual([]);
        });

        test('should get choices for the simulated agencies option, with agencies', () => {
            // Create a mock agency collection
            const mockAgency1 = new Agency({ id: 'agency1', acronym: 'TEST', name: 'Test agency' }, false);
            const mockAgency2 = new Agency({ id: 'agency2', acronym: 'TEST2', name: 'Test agency 2' }, false);
            const agencyCollection = new AgencyCollection([mockAgency1, mockAgency2], {});
            collectionManager.add('agencies', agencyCollection);

            const options = transitNetworkDesignDescriptor.getOptions();
            const simulatedAgencies = options.simulatedAgencies;

            const choices = simulatedAgencies.choices!();
            expect(choices).toEqual([
                { value: 'agency1', label: 'TEST Test agency' },
                { value: 'agency2', label: 'TEST2 Test agency 2' }
            ]);
        });

        test('should get choices for the non simulated services option, no services', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const nonSimulatedServices = options.nonSimulatedServices;

            const choices = nonSimulatedServices.choices!();
            expect(choices).toEqual([]);
        });

        test('should get choices for the non simulated services option, with services', () => {
            // Create a mock service collection
            const mockService1 = new Service({ id: 'service1', name: 'Service 1' }, {});
            const mockService2 = new Service({ id: 'service2', name: 'Service 2' }, {});
            const serviceCollection = new ServiceCollection([mockService1, mockService2], {});
            collectionManager.add('services', serviceCollection);

            const options = transitNetworkDesignDescriptor.getOptions();
            const nonSimulatedServices = options.nonSimulatedServices;

            const choices = nonSimulatedServices.choices!();
            expect(choices).toEqual([
                { value: 'service1', label: 'Service 1' },
                { value: 'service2', label: 'Service 2' }
            ]);
        });

        test('should get choices for the lines to keep option, no agencies', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const linesToKeep = options.linesToKeep;

            const choices = linesToKeep.choices!({ simulatedAgencies: ['agency1'] });
            expect(choices).toEqual([]);
        });

        test('should get choices for the lines to keep option, agency not found', () => {
            const mockAgency1 = new Agency({ id: 'agency1', acronym: 'TEST', name: 'Test agency' }, false);
            const agencyCollection = new AgencyCollection([mockAgency1 as any], {});
            collectionManager.add('agencies', agencyCollection);

            const options = transitNetworkDesignDescriptor.getOptions();
            const linesToKeep = options.linesToKeep;

            const choices = linesToKeep.choices!({ simulatedAgencies: ['nonexistent'] });
            expect(choices).toEqual([]);
        });

        test('should get choices for the lines to keep option, with agencies and lines', () => {
            const mockAgency1 = new Agency({ id: 'agency1', acronym: 'TEST', name: 'Test agency' }, false);
            const mockAgency2 = new Agency({ id: 'agency2', acronym: 'TEST2', name: 'Test agency 2' }, false);
            const mockLine1 = new Line({ id: 'line1', shortname: 'T1', name: 'Test line 1', agencyId: 'agency1' }, false);
            const mockLine2 = new Line({ id: 'line2', shortname: 'T2', name: 'Test line 2', agencyId: 'agency1' }, false);
            jest.spyOn(mockAgency1, 'getLines').mockReturnValue([mockLine1, mockLine2]);
            
            const agencyCollection = new AgencyCollection([mockAgency1, mockAgency2], {});
            collectionManager.add('agencies', agencyCollection);

            const options = transitNetworkDesignDescriptor.getOptions();
            const linesToKeep = options.linesToKeep;

            const choices = linesToKeep.choices!({ simulatedAgencies: ['agency1'] });
            expect(choices).toEqual([
                { value: 'line1', label: 'T1' },
                { value: 'line2', label: 'T2' }
            ]);
        });

        test('should get choices for lines to keep from multiple agencies', () => {
            const mockAgency1 = new Agency({ id: 'agency1', acronym: 'TEST', name: 'Test agency' }, false);
            const mockAgency2 = new Agency({ id: 'agency2', acronym: 'TEST2', name: 'Test agency 2' }, false);
            const mockLine1 = new Line({ id: 'line1', shortname: 'T1', name: 'Test line 1', agencyId: 'agency1' }, false);
            const mockLine2 = new Line({ id: 'line2', shortname: 'T2', name: 'Test line 2', agencyId: 'agency1' }, false);
            const mockLine3 = new Line({ id: 'line3', shortname: 'T3', name: 'Test line 3', agencyId: 'agency2' }, false);
            
            jest.spyOn(mockAgency1, 'getLines').mockReturnValue([mockLine1, mockLine2]);
            jest.spyOn(mockAgency2, 'getLines').mockReturnValue([mockLine3]);
            
            const agencyCollection = new AgencyCollection([mockAgency1, mockAgency2], {});
            collectionManager.add('agencies', agencyCollection);

            const options = transitNetworkDesignDescriptor.getOptions();
            const linesToKeep = options.linesToKeep;

            const choices = linesToKeep.choices!({ simulatedAgencies: ['agency1', 'agency2'] });
            expect(choices).toEqual([
                { value: 'line1', label: 'T1' },
                { value: 'line2', label: 'T2' },
                { value: 'line3', label: 'T3' }
            ]);
        });

        test('should return empty array for lines to keep when simulatedAgencies is empty', () => {
            const options = transitNetworkDesignDescriptor.getOptions();
            const linesToKeep = options.linesToKeep;

            const choices = linesToKeep.choices!({ simulatedAgencies: [] });
            expect(choices).toEqual([]);
        });
    });

    describe('validateOptions', () => {
        test('should validate using the validation function', () => {
            const validParams = {
                numberOfLinesMin: 1,
                numberOfLinesMax: 10,
                maxTimeBetweenPassages: 30,
                minTimeBetweenPassages: 5,
                nbOfVehicles: 10,
                simulatedAgencies: ['agency1'],
                nonSimulatedServices: [],
                linesToKeep: []
            };
            
            const result = transitNetworkDesignDescriptor.validateOptions(validParams);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should return errors for invalid parameters', () => {
            const invalidParams = {
                numberOfLinesMin: -1,
                numberOfLinesMax: 10,
                maxTimeBetweenPassages: 30,
                minTimeBetweenPassages: 5,
                nbOfVehicles: 10,
                simulatedAgencies: ['agency1'],
                nonSimulatedServices: [],
                linesToKeep: []
            };
            
            const result = transitNetworkDesignDescriptor.validateOptions(invalidParams);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('transit:simulation:errors:NumberOfLinesMinNoNegative');
        });

        test('should return error when simulatedAgencies is empty', () => {
            const params = {
                numberOfLinesMin: 1,
                numberOfLinesMax: 10,
                maxTimeBetweenPassages: 30,
                minTimeBetweenPassages: 5,
                nbOfVehicles: 10,
                simulatedAgencies: [],
                nonSimulatedServices: [],
                linesToKeep: []
            };
            
            const result = transitNetworkDesignDescriptor.validateOptions(params);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('transit:simulation:errors:SimulatedAgenciesIsEmpty');
        });
    });
});
