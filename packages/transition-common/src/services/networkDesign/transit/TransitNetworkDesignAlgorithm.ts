/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import AgencyCollection from '../../agency/AgencyCollection';
import LineCollection from '../../line/LineCollection';
import ServiceCollection from '../../service/ServiceCollection';
import { CsvFieldMappingDescriptor } from '../../csv';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

/**
 * Simulation algorithm class. This will actually run the algorithm
 *
 * @export
 * @interface TransitNetworkDesignAlgorithm
 */
// This interface used to have a type variable <T> that was documented as "The type of options".
// This was completely unused so it was removed, but a comment is left here in case we ever want to implement it again.
export interface TransitNetworkDesignAlgorithm {
    run: (
        socket: EventEmitter,
        collections: { lines: LineCollection; agencies: AgencyCollection; services: ServiceCollection }
    ) => Promise<boolean>;
}

export type SimulationAlgorithmOptionBase = {
    i18nName: string;
    i18nHelp?: string;
};

type DescriptorFactory<T extends Record<string, unknown>> = () => SimulationAlgorithmDescriptor<T>;

interface NestedOptionDescriptor<T extends Record<string, unknown>> {
    type: 'nested';
    descriptor: DescriptorFactory<T>;
}

/**
 * Type of this option
 *
 * FIXME Rename the options and descriptors to something more generic than
 * "SimulationAlgorithm" since they are used in other contexts now and move to
 * appropriate place (see
 * https://github.com/chairemobilite/transition/issues/1580)
 *
 * @type {('integer' | 'number' | 'string' | 'boolean' | 'nested' | 'custom')}
 * integer is an integer number while number also supports float, nested is a
 * nested object with its own descriptor. 'custom' is a custom type that will
 * not be validated nor have a proper UI generated form for it.
 * @memberof SimulationAlgorithmOptionDescriptor
 */
export type SimulationAlgorithmOptionByType =
    | {
          type: 'integer' | 'number';
          default?: number;
          validate?: (value: number) => boolean;
      }
    | {
          type: 'string';
          default?: string;
          validate?: (value: string) => boolean;
      }
    | {
          type: 'boolean';
          default?: boolean;
      }
    | {
          type: 'select';
          choices: () => Promise<{ value: string; label?: string }[]>;
          default?: string;
      }
    | {
          type: 'csvFile';
          mappingDescriptors: CsvFieldMappingDescriptor[];
          importFileName: string;
      }
    | {
          type: 'custom';
      };

export type SimulationAlgorithmOptionDescriptor = SimulationAlgorithmOptionBase &
    (SimulationAlgorithmOptionByType | NestedOptionDescriptor<any>);

/**
 * Simulation algorithm descriptor. This class describes the name and options
 * required by the algorithm.
 *
 * FIXME Rename the options and descriptors to something more generic than
 * "SimulationAlgorithm" since they are used in other contexts now and move to
 * appropriate place (see
 * https://github.com/chairemobilite/transition/issues/1580)
 *
 * @export
 * @interface SimulationAlgorithmDescriptor
 * @template T The type of options
 */
export interface SimulationAlgorithmDescriptor<T extends Record<string, unknown>> {
    /** Get the name string of the algorithm that can be translated */
    getTranslatableName: () => string;
    /** Get the options and their types */
    getOptions: () => { [K in keyof T]: SimulationAlgorithmOptionDescriptor };
    /** Validate an options object. This function is in addition to the
     * options's individual validator and allows to validate the whole object,
     * not just individual values. */
    validateOptions: (options: Partial<T>) => { valid: boolean; errors: ErrorMessage[] };
}
