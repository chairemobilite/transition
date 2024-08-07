/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/*
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Map } from 'mapbox-gl';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import GeoJson from 'geojson';

const getMapBoxDraw = (
    map: Map,
    modeChangeCallback: (p: GeoJson.Polygon) => void,
    createCallback: (p: GeoJson.Polygon) => void,
    deleteCallback: (p: GeoJson.Polygon) => void
): MapboxDraw => {
    const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true
        }
    });
    map.addControl(draw);
    map.on('draw.modechange', (data: any) => modeChangeCallback(data));
    map.on('draw.create', (data: any) => createCallback(data.features[0]));
    map.on('draw.delete', (data: any) => deleteCallback(data.features[0]));
    return draw;
};

const removeMapBoxDraw = (
    map: Map,
    draw: MapboxDraw,
    modeChangeCallback: (p: GeoJson.Polygon) => void,
    createCallback: (p: GeoJson.Polygon) => void,
    deleteCallback: (p: GeoJson.Polygon) => void
): void => {
    map.off('draw.modechange', (data: any) => modeChangeCallback(data));
    map.off('draw.create', (data: any) => createCallback(data));
    map.off('draw.delete', (data: any) => deleteCallback(data));
    draw.onRemove();
};

export { getMapBoxDraw, removeMapBoxDraw };
*/
// TODO Re-implement the polygon service for deck.gl
export default true;
