/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
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
    run: (socket: EventEmitter) => Promise<boolean>;
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
 * @type {('integer' | 'number' | 'string' | 'boolean' | 'nested' | 'select' |
 * 'multiselect' | 'csvFile' | 'custom')} integer is an integer number while
 * number also supports float, nested is a nested object with its own
 * descriptor. 'select' and 'multiselect' are for options where the user must
 * select one or multiple values from a list of choices. 'custom' is a custom
 * type that will not be validated nor have a proper UI generated form for it.
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
          /**
           * Get the choices for this select option
           * @param object The complete object this descriptor option is part
           * of, with current values set
           * @returns
           */
          choices: (object: Record<string, unknown>) => { value: string; label?: string }[];
          default?: string;
      }
    | {
          type: 'multiselect';
          /**
           * Get the choices for this select option
           * @param object The complete object this descriptor option is part
           * of, with current values set
           * @returns
           */
          choices: (object: Record<string, unknown>) => { value: string; label?: string }[];
          default?: string[];
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

/**
 * Creates an options object with default values applied from the descriptor
 *
 * @param initialOptions Partial options object with some values already set
 * @param descriptor The algorithm descriptor containing option definitions
 * @returns Options object with default values applied where not already provided
 */
export function getDefaultOptionsFromDescriptor<T extends Record<string, unknown>>(
    initialOptions: Partial<T>,
    descriptor: SimulationAlgorithmDescriptor<T>
): Partial<T> {
    const options = { ...initialOptions };
    const optionDefinitions = descriptor.getOptions();

    for (const [key, optionDef] of Object.entries(optionDefinitions)) {
        if (optionDef.type === 'nested') {
            // Handle nested options recursively
            const nestedDescriptor = optionDef.descriptor();
            const existingNestedValue = options[key as keyof T] as Record<string, unknown> | undefined;
            const nestedDefaults = getDefaultOptionsFromDescriptor(existingNestedValue || {}, nestedDescriptor);
            (options as any)[key] = nestedDefaults;
        } else if (options[key as keyof T] === undefined && 'default' in optionDef && optionDef.default !== undefined) {
            (options as any)[key] = optionDef.default;
        }
    }

    return options;
}
