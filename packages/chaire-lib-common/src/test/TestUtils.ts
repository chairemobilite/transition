/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const makePoint = (coordinates: [number, number], properties = {}, extra = {}): GeoJSON.Feature<GeoJSON.Point> => {
    return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates },
        properties,
        ...extra
    };
};

// Set immediate may not be defined in all environments
const scheduler = typeof setImmediate === 'function' ? setImmediate : setTimeout;
const flushPromises = () => new Promise((resolve) => scheduler(resolve, 0));

export default {
    /**
     * Make a point geojson feature from coordinates and optionally properties
     * and extra information. It just abstracts the point feature syntax, which
     * can be heavy to read in unit tests.
     */
    makePoint,
    /**
     * Wait for all currently queued promises to be completed. Useful when
     * async tasks are probably scheduled to run and they need to be finished to
     * continue the test.
     */
    flushPromises
};
