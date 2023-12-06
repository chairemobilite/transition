/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import DataSourceCollection from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import PlaceCollection from 'transition-common/lib/services/places/PlaceCollection';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import SimulationCollection from 'transition-common/lib/services/simulation/SimulationCollection';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

// TODO: Bring back the missing data types
type LoadLayersOptions = {
    dataSourceCollection: DataSourceCollection;
    simulationCollection: SimulationCollection;
    nodeCollection: NodeCollection;
    agencyCollection: AgencyCollection;
    lineCollection: LineCollection;
    pathCollection: PathCollection;
    // unitCollection: any;
    // garageCollection: any;
    serviceCollection: ServiceCollection;
    scenarioCollection: ScenarioCollection;
    placeCollection: PlaceCollection;
    // aggregatedODGeojsonCollection: any;
    serviceLocator: any;
};

// TODO tahini Rethink this function, was just a quick copy/paste from Dashboard so it can be called from elsewhere
export const loadLayersAndCollections = async ({
    dataSourceCollection,
    simulationCollection,
    nodeCollection,
    agencyCollection,
    lineCollection,
    pathCollection,
    // unitCollection,
    // garageCollection,
    serviceCollection,
    scenarioCollection,
    placeCollection,
    // aggregatedODGeojsonCollection,
    serviceLocator
}: LoadLayersOptions) => {
    try {
        // Load dataSourceCollection
        await dataSourceCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.add('dataSources', dataSourceCollection);
        // Load simulation collection
        await simulationCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.add('simulations', simulationCollection);

        await nodeCollection.loadFromServer(serviceLocator.socketEventManager);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitNodes',
            data: nodeCollection.toGeojson()
        });
        serviceLocator.collectionManager.add('nodes', nodeCollection);

        await pathCollection.loadFromServer(serviceLocator.socketEventManager);
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitPaths',
            data: pathCollection.toGeojson()
        });
        serviceLocator.collectionManager.add('paths', pathCollection);

        await lineCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.add('lines', lineCollection);

        // await unitCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        // serviceLocator.collectionManager.add('units', unitCollection);

        // await garageCollection.loadFromServer(serviceLocator.socketEventManager);
        // serviceLocator.collectionManager.add('garages', garageCollection);
        //serviceLocator.eventManager.emit(`map.updateLayer`, 'transitGarages', garageCollection.toGeojson());

        await serviceCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.add('services', serviceCollection);

        await scenarioCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.add('scenarios', scenarioCollection);

        await agencyCollection.loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);
        serviceLocator.collectionManager.add('agencies', agencyCollection);

        await placeCollection.loadFromServer(serviceLocator.socketEventManager);
        serviceLocator.collectionManager.add('places', placeCollection);

        serviceLocator.pathLayerManager.updateFilter();
        /* if (Preferences.get('showAggregatedOdTripsLayer')) {
            await aggregatedODGeojsonCollection.loadFromServer(
                serviceLocator.socketEventManager,
                dataSourceCollection.size() > 0 ? dataSourceCollection.getFeatures()[0].get('id') : null
            );
        }

        serviceLocator.collectionManager.add('aggregatedOD', aggregatedODGeojsonCollection);
        serviceLocator.eventManager.emit('map.updateLayer', 'aggregatedOD', aggregatedODGeojsonCollection.toGeojson()); */
    } catch (error) {
        console.error(error); // todo: better error handling
    }
};
