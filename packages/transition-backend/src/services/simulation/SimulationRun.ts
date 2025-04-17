/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import pQueue from 'p-queue';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import trRoutingService from 'chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend';
import config from 'chaire-lib-backend/lib/config/server.config';
import ServerConfig from 'chaire-lib-backend/lib/config/ServerConfig';

import Simulation, { SimulationDataAttributes } from 'transition-common/lib/services/simulation/Simulation';
import SimulationRun, {
    SimulationRunAttributes,
    SimulationRunDataAttributes,
    SimulationRuntimeOptions
} from 'transition-common/lib/services/simulation/SimulationRun';
import { SimulationMethodFactory } from './methods/SimulationMethod';
import simulationRunsDbQueries from '../../models/db/simulationRuns.db.queries';

export default class SimulationRunBackend extends SimulationRun {
    private poolOfTrRoutingPorts: number[] = [];
    private promiseQueue: pQueue | undefined;
    private static METHODS: { [key: string]: SimulationMethodFactory<any> } = {};

    static createFromSimulation(
        simulation: Simulation,
        runtimeConfig: SimulationRuntimeOptions,
        simulationData: SimulationDataAttributes
    ): SimulationRunBackend | undefined {
        if (simulationData.algorithmConfiguration === undefined) {
            return undefined;
        }
        const runAttributes = {
            data: simulationData as SimulationRunDataAttributes,
            status: 'notStarted' as const,
            simulation_id: simulation.getId(),
            options: runtimeConfig
        };

        return new SimulationRunBackend(runAttributes, true);
    }

    static registerSimulationMethod(name: string, methodFactory: SimulationMethodFactory<any>): void {
        SimulationRunBackend.METHODS[name] = methodFactory;
    }

    static getSimulationMethods(): { [key: string]: SimulationMethodFactory<any> } {
        return SimulationRunBackend.METHODS;
    }

    constructor(attributes: Partial<SimulationRunAttributes>, isNew: boolean) {
        super(attributes, isNew);
    }

    async restartTrRoutingInstances() {
        await TrRoutingProcessManager.stopBatch(this.getBatchPort());
        await TrRoutingProcessManager.startBatch((this.attributes.options?.numberOfThreads as number) || 1, {
            port: this.getBatchPort(),
            cacheDirectoryPath: this.getProjectRelativeCacheDirectoryPath()
        });
        this.promiseQueue = new pQueue({ concurrency: (this.attributes.options?.numberOfThreads as number) || 1 });
    }

    async reloadTrRoutingData(cacheNames: ('scenarios' | 'lines' | 'services' | 'schedules')[]) {
        const ports = this.poolOfTrRoutingPorts;
        console.log('Reloading caches', cacheNames, ports);
        const updatePromises = ports.map((port) =>
            trRoutingService.updateCache({ cacheNames }, 'http://localhost', port.toString())
        );
        await Promise.all(updatePromises);
    }

    async stopTrRoutingInstances() {
        await TrRoutingProcessManager.stopBatch(this.getBatchPort());
        this.promiseQueue = undefined;
    }

    async simulateScenario(
        scenario: Scenario
    ): Promise<{ results: { [key: string]: { fitness: number; results: unknown } } }> {
        const runtimeOptions = this.attributes.options;
        const promiseQueue = this.promiseQueue;
        if (!runtimeOptions || !runtimeOptions.functions) {
            throw new TrError('No simulation function defined', 'SIMSCEN001');
        }
        if (!promiseQueue) {
            throw new TrError('No promise queue, trRouting is probably not running', 'SIMSCEN002');
        }
        const methods = Object.keys(runtimeOptions.functions);
        const allResults: { [key: string]: { fitness: number; results: unknown } } = {};
        for (let i = 0; i < methods.length; i++) {
            const method = methods[i];
            const factory = SimulationRunBackend.METHODS[method];
            if (factory === undefined) {
                throw new TrError(`Unknown simulation method: ${method}`, 'SIOMSCEN004');
            }
            const simulationFunctionPromise = new Promise<{ fitness: number; results: unknown }>((resolve, reject) => {
                promiseQueue.add(async () => {
                    const trRoutingPort = this.getBatchPort();
                    if (trRoutingPort === undefined) {
                        throw new TrError(
                            'Error somewhere in the code, there is not trRouting available',
                            'SIOMSCEN003'
                        );
                    }
                    try {
                        const simOptions = runtimeOptions.functions[method];
                        const simulationMethod = factory.create(simOptions, this.attributes.data);
                        const results = await simulationMethod.simulate(scenario.getId(), {
                            trRoutingPort,
                            transitRoutingParameters: this.attributes.data.routingAttributes
                        });
                        resolve(results);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            const results = await simulationFunctionPromise;
            allResults[method] = results;
        }
        // TODO This return value used to return a totalFitness field, but different methods have different result fitness ranges, we need to figure out how to put them together
        return {
            results: allResults
        };
    }

    public getBatchPort(): number {
        return this.attributes.options.trRoutingStartingPort || ServerConfig.getTrRoutingConfig('batch').port;
    }

    public getCacheDirectoryPath(): string {
        return this.attributes.options.cachePathDirectory
            ? `simulations/${this.attributes.options.cachePathDirectory}`
            : `simulations/sim_${this.attributes.simulation_id}/${this.toString()}`;
    }

    public getProjectRelativeCacheDirectoryPath(): string {
        return `cache/${config.projectShortname}/${this.getCacheDirectoryPath()}`;
    }

    public getResultsDirectoryPath(): string {
        return `exports/simulations/${config.projectShortname}/${this.getCacheDirectoryPath()}`;
    }

    async saveSimulationScenarios(scenarioIds: string[]): Promise<boolean> {
        if (scenarioIds.length > 0) {
            await simulationRunsDbQueries.saveSimulationRunScenarios(this.getId(), scenarioIds);
            return true;
        }
        return false;
    }
}
