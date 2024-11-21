/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import { TFunction } from 'i18next';
import _cloneDeep from 'lodash/cloneDeep';

import i18n from 'chaire-lib-backend/lib/config/i18next';
import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Simulation from 'transition-common/lib/services/simulation/Simulation';
import SimulationCollection from 'transition-common/lib/services/simulation/SimulationCollection';
import { EvolutionAlgorithmDescriptor } from 'transition-common/lib/services/evolutionaryAlgorithm';
import { runSimulation } from '../../services/simulation/SimulationExecution';
import { editAlgorithmConfiguration, getRuntimeConfiguration } from './AlgorithmEdition';
import SimulationRunBackend from '../../services/simulation/SimulationRun';
import { registerAlgorithmFactory } from '../../services/simulation/SimulationExecution';
import { evolutionaryAlgorithmFactory } from '../../services/evolutionaryAlgorithm';
import { OdTripSimulationTitle, OdTripSimulationFactory } from '../../services/simulation/methods/OdTripSimulation';
import {
    AccessMapSimulationTitle,
    AccessibilityMapSimulationFactory
} from '../../services/simulation/methods/AccessibilityMapSimulation';

Simulation.registerAlgorithm('evolutionaryAlgorithm', new EvolutionAlgorithmDescriptor());
registerAlgorithmFactory('evolutionaryAlgorithm', evolutionaryAlgorithmFactory);
SimulationRunBackend.registerSimulationMethod(OdTripSimulationTitle, new OdTripSimulationFactory());
SimulationRunBackend.registerSimulationMethod(AccessMapSimulationTitle, new AccessibilityMapSimulationFactory());

export default class RunSimulation implements GenericTask {
    private t: TFunction;

    constructor(lang?: string) {
        this.t = i18n().getFixedT(lang || i18n().language, ['main', 'server', 'transit']) as TFunction;
    }

    getSimulation = async (shortname: string | undefined): Promise<Simulation | undefined> => {
        // Select the simulation to run
        const simulationCollection = new SimulationCollection([], {});
        await simulationCollection.loadFromServer(serviceLocator.socketEventManager);
        const simulation = shortname !== undefined ? simulationCollection.getByShortname(shortname) : undefined;

        if (simulation !== undefined) {
            return simulation;
        }

        // Get the simulation choices
        const simulationChoices: { name: string; value: string }[] = simulationCollection
            .getFeatures()
            .map((simulation) => {
                const name = simulation.attributes.shortname;
                const algorithmType = simulation.attributes.data.algorithmConfiguration?.type;
                const algorithmDescriptor =
                    algorithmType === undefined ? undefined : Simulation.getAlgorithms()[algorithmType];
                const algorithmName =
                    algorithmDescriptor === undefined ? undefined : algorithmDescriptor.getTranslatableName();
                return {
                    name: `${name}${algorithmName !== undefined ? ` (${this.t(algorithmName)})` : ''}`,
                    value: simulation.getId()
                };
            });

        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'simulationId',
                message: this.t('server:simulation:selectSimulation'),
                choices: simulationChoices
            }
        ]);
        return simulationCollection.getById(answers['simulationId']);
    };

    async run(argv: { [key: string]: unknown }): Promise<void> {
        if (typeof argv.lang === 'string') {
            this.t = i18n().getFixedT(argv.lang || i18n().language, ['main', 'server', 'transit']) as TFunction;
        }

        // Request simulation to run
        const simulation = await this.getSimulation(typeof argv.simulation === 'string' ? argv.simulation : undefined);
        if (simulation === undefined) {
            throw 'Unknown simulation';
        }

        // Confirm parameters to run with and edit if required
        console.log(this.t('server:simulation:willRunSimulationWithParams'), simulation.attributes.data);
        const answers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'needEdit',
                message: this.t('server:simulation:edit'),
                default: false
            }
        ]);
        const dataParameters =
            answers['needEdit'] === true
                ? await editAlgorithmConfiguration(simulation, { t: this.t })
                : _cloneDeep(simulation.attributes.data);

        // Ask simulation specific parameters
        const { seed, ...runtimeConfig } = await getRuntimeConfiguration(dataParameters, { t: this.t });

        // Create simulation run and algorithm
        const simulationRun = SimulationRunBackend.createFromSimulation(simulation, runtimeConfig, dataParameters);
        if (simulationRun === undefined) {
            throw 'Cannot execute simulation: there may be invalid values';
        }
        simulationRun.attributes.seed = seed;
        simulationRun.attributes.options = { ...runtimeConfig };

        await simulationRun.save(serviceLocator.socketEventManager);
        await runSimulation(simulationRun, serviceLocator.socketEventManager);
    }
}
