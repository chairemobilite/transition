/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import AgencyCollection from '../agency/AgencyCollection';
import LineCollection from '../line/LineCollection';
import ServiceCollection from '../service/ServiceCollection';

/**
 * Simulation algorithm class. This will actually run the algorithm
 *
 * @export
 * @interface SimulationAlgorithm
 */
// This interface used to have a type variable <T> that was documented as "The type of options".
// This was completely unused so it was removed, but a comment is left here in case we ever want to implement it again.
export interface SimulationAlgorithm {
    run: (
        socket: EventEmitter,
        collections: { lines: LineCollection; agencies: AgencyCollection; services: ServiceCollection }
    ) => Promise<boolean>;
}

export type SimulationAlgorithmOptionBase = {
    i18nName: string;
    i18nHelp?: string;
};

/**
 * Type of this option
 *
 * @type {('integer' | 'number' | 'string' | 'boolean')} integer is an
 * integer number while number also supports float
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
      };

export type SimulationAlgorithmOptionDescriptor = SimulationAlgorithmOptionBase & SimulationAlgorithmOptionByType;

/**
 * Simulation algorithm descriptor. This class describes the name and options
 * required by the algorithm.
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
    validateOptions: (options: Partial<T>) => { valid: boolean; errors: string[] };
}
