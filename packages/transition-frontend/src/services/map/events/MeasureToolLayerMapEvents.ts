/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { MjolnirEvent } from 'mjolnir.js';
import { MeasureTool } from 'transition-common/lib/services/measureTool/MeasureTool';
import { point as turfPoint, featureCollection as turfFeatureCollection } from '@turf/turf';

import {
    MapEventHandlerDescription,
    PointInfo
} from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

/* This file encapsulates map events specific for the 'measureToolDistance' toolbox */

const onMapClicked = (pointInfo: PointInfo, _event: MjolnirEvent) => {
    const measureTool = serviceLocator.selectedObjectsManager.get('measureTool') as MeasureTool;
    if (measureTool && serviceLocator.selectedObjectsManager.isSelected('measureTool')) {
        measureTool.addVertex(turfPoint(pointInfo.coordinates as [number, number]));
        const lineGeojson = measureTool.getLineGeojson();
        serviceLocator.selectedObjectsManager.update('measureTool', measureTool);
        const pointsGeojson = _cloneDeep(measureTool.getPointsGeojsonCollection()); // must clone deep otherwise the object fills the buffer
        const labelsGeojson = _cloneDeep(measureTool.getLabelsGeojsonCollection());

        serviceLocator.eventManager.emit('map.updateLayers', {
            measureToolLine: turfFeatureCollection(lineGeojson ? [lineGeojson] : []),
            measureToolPoint: pointsGeojson,
            measureToolText: labelsGeojson
        });
    }
};

const onMapRightClicked = (_pointInfo: PointInfo, _event: MjolnirEvent) => {
    const measureTool = serviceLocator.selectedObjectsManager.get('measureTool') as MeasureTool;
    if (measureTool && serviceLocator.selectedObjectsManager.isSelected('measureTool')) {
        serviceLocator.eventManager.emit('map.updateLayers', {
            measureToolPoint: turfFeatureCollection([]),
            measureToolLine: turfFeatureCollection([]),
            measureToolText: turfFeatureCollection([])
        });
        serviceLocator.selectedObjectsManager.deselect('measureTool');
    }
};

const measureToolEventDescriptors: MapEventHandlerDescription[] = [
    {
        type: 'map',
        eventName: 'onLeftClick',
        handler: onMapClicked
    },
    {
        type: 'map',
        eventName: 'onRightClick',
        handler: onMapRightClicked
    }
];

export default measureToolEventDescriptors;
