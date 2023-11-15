/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

export type LayerConfiguration = {
    // TODO Type this properly. When the data in layers.config.ts is used by the new API, add it here
    [key: string]: any;
};

export type MapLayer = {
    /** Unique identifier for this layer */
    id: string;
    /**
     * Whether the layer is visible. The layer visibility is typically defined
     * by the user. It does not mean it is always visible. It is only visible
     * when it is enabled by the application.
     */
    visible: boolean;
    /**
     * Configuration of the current layer. It should be fixed and not require
     * updates, except through Preferences if any
     */
    configuration: LayerConfiguration;
    /** Features contained in this layer */
    layerData: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
};
