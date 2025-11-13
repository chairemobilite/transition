/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { input, number, confirm, select, checkbox } from '@inquirer/prompts';
import _cloneDeep from 'lodash/cloneDeep';
import { TFunction } from 'i18next';

import Simulation, { SimulationDataAttributes } from 'transition-common/lib/services/simulation/Simulation';
import { SimulationRuntimeOptions } from 'transition-common/lib/services/simulation/SimulationRun';
import { SimulationAlgorithmOptionDescriptor } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import SimulationRunBackend from '../../services/simulation/SimulationRun';

const getPromptForDescriptor = async (
    descriptor: SimulationAlgorithmOptionDescriptor,
    options: { t: TFunction; name: string; default?: unknown }
): Promise<unknown> => {
    const message = options.t(descriptor.i18nName);

    // TODO Add validators
    switch (descriptor.type) {
    case 'integer':
    case 'number':
        return await number({
            message,
            default: options.default as number | undefined
        });
    case 'boolean':
        return await confirm({
            message,
            default: options.default as boolean | undefined
        });
    case 'select': {
        const choices = await descriptor.choices();
        return await select({
            message,
            choices: choices.map(({ value, label }) => ({
                value,
                name: label ? options.t(label) : value
            })),
            default: options.default as string | undefined
        });
    }
    default:
        return await input({
            message,
            default: options.default as string | undefined
        });
    }
};

export const editAlgorithmConfiguration = async (
    simulation: Simulation,
    options: { t: TFunction }
): Promise<SimulationDataAttributes> => {
    const newParameters = _cloneDeep(simulation.attributes.data);

    // Simulation and routing parameters cannot be changed.
    const descriptor = simulation.getAlgorithmDescriptor();
    if (descriptor === undefined) {
        throw 'Unknown or undefined algorithm';
    }
    const algoOptions = descriptor.getOptions();

    const answers: Record<string, unknown> = {};
    for (const optionKey of Object.keys(algoOptions)) {
        const value = await getPromptForDescriptor(algoOptions[optionKey], {
            t: options.t,
            name: optionKey,
            default: simulation.attributes.data.algorithmConfiguration?.config[optionKey]
        });
        answers[optionKey] = value;
    }

    Object.assign(newParameters.algorithmConfiguration?.config || {}, answers);

    return newParameters;
};

type RuntimeConfiguration = {
    seed: string;
} & SimulationRuntimeOptions;

const getSimulationFunctions = async (options: {
    t: TFunction;
}): Promise<{
    [key: string]: { [key: string]: unknown; weight: number };
}> => {
    const methods = SimulationRunBackend.getSimulationMethods();
    const choices = Object.keys(methods).map((methodId) => ({
        value: methodId,
        name: options.t(methods[methodId].getDescriptor().getTranslatableName())
    }));

    const selectedMethods = await checkbox({
        message: options.t('transit:simulation:simulationMethods:SelectSimulationFunctions'),
        choices: choices,
        validate: (selected) =>
            selected.length > 0
                ? true
                : options.t('transit:simulation:simulationMethods:SelectAtLeastOneSimulationFunction')
    });

    const simulationFunctions: {
        [key: string]: { [key: string]: unknown; weight: number };
    } = {};
    let remainingMethodWeight = 1;

    for (const [methodIndex, methodId] of selectedMethods.entries()) {
        let currentWeight = 0;
        if (selectedMethods.length === 1) {
            currentWeight = 1;
        } else if (selectedMethods.length - 1 === methodIndex) {
            currentWeight = remainingMethodWeight;
        } else {
            const weightValue = await number({
                message: options.t('transit:simulation:simulationMethods:MethodWeight', {
                    methodName: options.t(methods[methodId].getDescriptor().getTranslatableName())
                }),
                validate: (value: number | undefined) => {
                    if (value === undefined || value < 0 || value > remainingMethodWeight) {
                        return options.t('transit:simulation:simulationMethods:MethodWeightError', {
                            maxWeight: remainingMethodWeight
                        });
                    }
                    return true;
                },
                default: remainingMethodWeight / (selectedMethods.length - methodIndex)
            });
            currentWeight = weightValue ?? 0;
        }

        // Request method's specific options. If the weight is 0, don't add it
        if (currentWeight > 0) {
            const descriptor = methods[methodId].getDescriptor();
            const methodOptions = descriptor.getOptions();

            const methodAnswers: Record<string, unknown> = {};
            for (const optionKey of Object.keys(methodOptions)) {
                const value = await getPromptForDescriptor(methodOptions[optionKey], {
                    t: options.t,
                    name: optionKey
                });
                methodAnswers[optionKey] = value;
            }

            simulationFunctions[methodId] = {
                ...methodAnswers,
                weight: currentWeight
            };
        }
        remainingMethodWeight -= currentWeight;
    }

    return simulationFunctions;
};

export const getRuntimeConfiguration = async (
    simulationData: SimulationDataAttributes,
    options: { t: TFunction }
): Promise<RuntimeConfiguration> => {
    const seed = await input({
        message: options.t('server:simulation:randomSeed')
    });

    const numberOfThreads =
        (await number({
            message: options.t('server:simulation:numberOfThreads'),
            default: 1,
            required: true
        })) ?? 1;

    const trRoutingStartingPort =
        (await number({
            message: options.t('server:simulation:TrRoutingStartingPort'),
            default: 14000,
            required: true
        })) ?? 14000;

    const fitnessSorter = await select({
        message: options.t('transit:simulation:fitness:fitnessSorter'),
        choices: [
            {
                value: 'maximize',
                name: options.t('transit:simulation:fitness:maximize')
            },
            {
                value: 'minimize',
                name: options.t('transit:simulation:fitness:minimize')
            }
        ]
    });

    const simulationFunctions = await getSimulationFunctions(options);

    return {
        seed,
        numberOfThreads,
        trRoutingStartingPort,
        fitnessSorter,
        functions: simulationFunctions
    };
};
