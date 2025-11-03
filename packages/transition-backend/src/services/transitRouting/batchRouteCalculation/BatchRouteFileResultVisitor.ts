/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { BatchRouteJobType, BatchRouteResultVisitor } from '../BatchRoutingJob';
import { OdTripRouteResult } from '../types';
import { createRoutingFileResultProcessor, generateFileOutputResults } from './TrRoutingBatchResult';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import pathDbQueries from '../../../models/db/transitPaths.db.queries';

// Example concrete visitor for file generation
export class BatchRouteFileResultVisitor
implements
        BatchRouteResultVisitor<{ files: { input: string; csv?: string; detailedCsv?: string; geojson?: string } }> {
    private resultHandler = createRoutingFileResultProcessor(this.job);
    private pathCollection: PathCollection | undefined | false = false;

    constructor(private job: ExecutableJob<BatchRouteJobType>) {
        // Nothing to do
    }

    private prepareResultData = async (): Promise<void> => {
        let pathCollection: PathCollection | undefined = undefined;
        if (this.job.attributes.data.parameters.transitRoutingAttributes.withGeometries) {
            pathCollection = new PathCollection([], {});
            if (this.job.attributes.data.parameters.transitRoutingAttributes.scenarioId) {
                const pathGeojson = await pathDbQueries.geojsonCollection({
                    scenarioId: this.job.attributes.data.parameters.transitRoutingAttributes.scenarioId
                });
                pathCollection.loadFromCollection(pathGeojson.features);
            }
            this.pathCollection = pathCollection;
        } else {
            this.pathCollection = false;
        }
    };

    visitTripResult = async (routingResult: OdTripRouteResult) => {
        if (this.pathCollection === false) {
            await this.prepareResultData();
        }
        const processedResults = await generateFileOutputResults(routingResult, {
            exportCsv: true,
            exportDetailed: this.job.attributes.data.parameters.transitRoutingAttributes.detailed === true,
            withGeometries: this.job.attributes.data.parameters.transitRoutingAttributes.withGeometries === true,
            pathCollection: this.pathCollection as PathCollection | undefined
        });
        this.resultHandler.processResult(processedResults);
    };

    end = () => {
        this.resultHandler.end();
    };

    getResult(): { files: { input: string; csv?: string; detailedCsv?: string; geojson?: string } } {
        return { files: this.resultHandler.getFiles() };
    }
}
