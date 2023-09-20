/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import _cloneDeep from 'lodash/cloneDeep';
import { TFunction } from 'i18next';

import Simulation, { SimulationDataAttributes } from 'transition-common/lib/services/simulation/Simulation';
import { SimulationRuntimeOptions } from 'transition-common/lib/services/simulation/SimulationRun';
import { SimulationAlgorithmOptionDescriptor } from 'transition-common/lib/services/simulation/SimulationAlgorithm';
import SimulationRunBackend from '../../services/simulation/SimulationRun';

const getInquirerObject = async (
    descriptor: SimulationAlgorithmOptionDescriptor,
    options: { t: TFunction; name: string; default?: unknown }
) => {
    const defaultProps: { message: string; name: string; default?: unknown } = {
        message: options.t(descriptor.i18nName),
        name: options.name
    };
    if (options.default) {
        defaultProps.default = options.default;
    }
    // TODO Add validators
    switch (descriptor.type) {
    case 'integer':
    case 'number':
        return {
            type: 'number',
            ...defaultProps
        };
    case 'boolean':
        return {
            type: 'confirm',
            ...defaultProps
        };
    case 'select': {
        const choices = await descriptor.choices();
        return {
            type: 'list',
            choices: choices.map(({ value, label }) => ({ value, name: label ? options.t(label) : undefined })),
            ...defaultProps
        };
    }
    default:
        return {
            type: 'input',
            ...defaultProps
        };
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
    const questions = await Promise.all(
        Object.keys(algoOptions).map(
            async (optionKey) =>
                await getInquirerObject(algoOptions[optionKey], {
                    t: options.t,
                    name: optionKey,
                    default: simulation.attributes.data.algorithmConfiguration?.config[optionKey]
                })
        )
    );

    const answers = await inquirer.prompt(questions);
    Object.assign(newParameters.algorithmConfiguration?.config || {}, answers);

    return newParameters;
};

type RuntimeConfiguration = {
    seed: string;
} & SimulationRuntimeOptions;

const getSimulationFunctions = async (options: {
    t: TFunction;
}): Promise<{
    [key: string]: unknown;
}> => {
    const methods = SimulationRunBackend.getSimulationMethods();
    const choices = Object.keys(methods).map((methodId) => ({
        value: methodId,
        name: options.t(methods[methodId].getDescriptor().getTranslatableName())
    }));
    const simFunctionsAnswers = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'simulationFunctions',
            choices: choices,
            message: options.t('transit:simulation:simulationMethods:SelectSimulationFunctions'),
            validate: (selectedMethods: string[]) =>
                selectedMethods.length > 0
                    ? true
                    : options.t('transit:simulation:simulationMethods:MustSelectOneFunction')
        }
    ]);
    const selectedMethods = simFunctionsAnswers['simulationFunctions'] as string[];

    const simulationFunctions = {};

    let remainingMethodWeight = 1;
    for (let methodIndex = 0; methodIndex < selectedMethods.length; methodIndex++) {
        const methodId = selectedMethods[methodIndex];
        console.log(`Selected Method: ${methodId}`);

        // Request weight of the method if there is more than one
        let currentWeight = remainingMethodWeight;
        if (selectedMethods.length > 1) {
            // For last method, use the remaining weight and add a message
            if (methodIndex === selectedMethods.length - 1) {
                console.log(
                    `${options.t('transit:simulation:simulationMethods:MethodWeight', {
                        interpolation: { escapeValue: false },
                        method: options.t(methods[methodId].getDescriptor().getTranslatableName())
                    })}: ${currentWeight}`
                );
            } else {
                const weightAnswer = await inquirer.prompt([
                    {
                        type: 'number',
                        name: 'methodWeight',
                        message: options.t('transit:simulation:simulationMethods:MethodWeight', {
                            interpolation: { escapeValue: false },
                            method: options.t(methods[methodId].getDescriptor().getTranslatableName())
                        }),
                        validate: (weight: unknown) =>
                            typeof weight === 'number' && weight >= 0 && weight <= remainingMethodWeight
                                ? true
                                : options.t('transit:simulation:simulationMethods:MethodWeightError', {
                                    maxWeight: remainingMethodWeight
                                }),
                        default: remainingMethodWeight / (selectedMethods.length - methodIndex)
                    }
                ]);
                currentWeight = weightAnswer['methodWeight'];
            }
        }

        // Request method's specific options. If the weight is 0, don't add it
        if (currentWeight > 0) {
            const descriptor = methods[methodId].getDescriptor();
            const methodOptions = descriptor.getOptions();
            const questions = await Promise.all(
                Object.keys(methodOptions).map(
                    async (optionKey) =>
                        await getInquirerObject(methodOptions[optionKey], {
                            t: options.t,
                            name: optionKey
                        })
                )
            );

            const answers = await inquirer.prompt(questions);
            simulationFunctions[methodId] = answers;
            simulationFunctions[methodId].weight = currentWeight;
        }
        remainingMethodWeight -= currentWeight;
    }

    return simulationFunctions;
};

export const getRuntimeConfiguration = async (
    simulationData: SimulationDataAttributes,
    options: { t: TFunction }
): Promise<RuntimeConfiguration> => {
    const answers = await inquirer.prompt([
        {
            name: 'seed',
            message: options.t('server:simulation:randomSeed'),
            type: 'input'
        },
        {
            name: 'numberOfThreads',
            message: options.t('server:simulation:numberOfThreads'),
            type: 'number',
            default: 1
        },
        {
            name: 'trRoutingStartingPort',
            message: options.t('server:simulation:TrRoutingStartingPort'),
            type: 'number',
            default: 14000
        },
        {
            name: 'fitnessSorter',
            message: options.t('transit:simulation:fitness:fitnessSorter'),
            type: 'list',
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
        }
    ]);

    const simulationFunctions = await getSimulationFunctions(options);
    answers.functions = simulationFunctions;

    return answers;
};
