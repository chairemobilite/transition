/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { BatchRouteResultVisitor } from '../BatchRoutingJob';
import { OdTripRouteResult } from '../types';
import { createRoutingFileResultProcessor, generateFileOutputResults } from './TrRoutingBatchResult';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import pathDbQueries from '../../../models/db/transitPaths.db.queries';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { BatchRoutingResultProcessor } from './TrRoutingBatchResult';
import { JobDataType } from 'transition-common/lib/services/jobs/Job';

// Example concrete visitor for file generation
export class BatchRouteFileResultVisitor
implements BatchRouteResultVisitor<{ files: { csv?: string; detailedCsv?: string; geojson?: string } }> {
    private resultHandler: BatchRoutingResultProcessor;
    // Cache for path collection, to avoid loading it multiple times if geometries are included in the results, if no geometry asked, set to `false`
    private pathCollection: PathCollection | undefined | false = undefined;

    constructor(
        private job: ExecutableJob<JobDataType>,
        private batchParameters: BatchCalculationParameters,
        fileSuffix?: string
    ) {
        this.resultHandler = createRoutingFileResultProcessor(this.job, this.batchParameters, fileSuffix);
    }

    private prepareResultData = async (): Promise<void> => {
        let pathCollection: PathCollection | undefined = undefined;
        if (this.batchParameters.withGeometries) {
            pathCollection = new PathCollection([], {});
            if (this.batchParameters.scenarioId) {
                const pathGeojson = await pathDbQueries.geojsonCollection({
                    scenarioId: this.batchParameters.scenarioId
                });
                pathCollection.loadFromCollection(pathGeojson.features);
            }
            this.pathCollection = pathCollection;
        } else {
            this.pathCollection = false;
        }
    };

    visitTripResult = async (routingResult: OdTripRouteResult) => {
        if (this.pathCollection === undefined) {
            await this.prepareResultData();
        }
        const processedResults = await generateFileOutputResults(routingResult, {
            exportCsv: true,
            exportDetailed: this.batchParameters.detailed === true,
            withGeometries: this.batchParameters.withGeometries === true,
            pathCollection: this.pathCollection as PathCollection | undefined
        });
        this.resultHandler.processResult(processedResults);
    };

    end = () => {
        this.resultHandler.end();
    };

    getResult(): { files: { csv?: string; detailedCsv?: string; geojson?: string } } {
        return { files: this.resultHandler.getFiles() };
    }
}
