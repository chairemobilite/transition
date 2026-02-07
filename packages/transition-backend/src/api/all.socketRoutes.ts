/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { isSocketIo } from './socketUtils';
import uploadsSocketRoutes from './uploads.socketRoutes';
import routingSocketRoutes from 'chaire-lib-backend/lib/api/routing.socketRoutes';
import gtfsSocketRoutes from './gtfs.socketRoutes';
import cacheSocketRoutes from './cache.socketRoutes';
import servicesSocketRoutes from './services.socketRoutes';
import dataSourcesSocketRoutes from './dataSources.socketRoutes';
import odPairsSocketRoutes from './odPairs.socketRoutes';
import simulationsSocketRoutes from './simulations.socketRoutes';
import transitSocketRoutesNew from './transit.socketRoutes';
import transitObjectsSocketRoutes from './transitObjects.socketRoutes';
import transitPathsSocketRoutes from './transitPaths.socketRoutes';
import transitPathCurvesSocketRoutes from './transitPathCurves.socketRoutes';
import placesSocketRoutes from './places.socketRoutes';
import jobsSocketRoutes from './jobs.socketRoutes';
import osmSocketRoutes from './osm.socketRoutes';
import definitionsSocketRoutes from './definitions.socketRoutes';

export default function (socket: EventEmitter, userId?: number) {
    dataSourcesSocketRoutes(socket, userId);
    cacheSocketRoutes(socket);
    servicesSocketRoutes(socket, userId);
    transitSocketRoutesNew(socket);
    transitObjectsSocketRoutes(socket);
    transitPathsSocketRoutes(socket);
    transitPathCurvesSocketRoutes(socket);
    simulationsSocketRoutes(socket);
    odPairsSocketRoutes(socket);
    placesSocketRoutes(socket);
    osmSocketRoutes(socket);
    definitionsSocketRoutes(socket);

    // Routes only to add if there is an authenticated user
    if (userId !== undefined) {
        gtfsSocketRoutes(socket, userId);
        jobsSocketRoutes(socket, userId);
        if (isSocketIo(socket)) {
            uploadsSocketRoutes(socket, userId);
            routingSocketRoutes(socket, userId);
        }
    }
}
