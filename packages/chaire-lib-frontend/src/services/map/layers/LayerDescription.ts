/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

export type LayerDescription = {
    /** Unique identifier for this layer */
    id: string;
    /** Whether the layer is visible, if enabled */
    visible: boolean;
    /**
     * Description of the current layer
     *
     * TODO Type this properly
     */
    layerDescription: { [key: string]: any };
    /** Features contained in this layer */
    layerData: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
};
