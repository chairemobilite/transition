/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Union of all supported base map layer identifiers.
 * Each value must match a `shortname` in the `baseMapLayers` config array
 * defined in `transition-frontend`, or 'aerial' for satellite imagery.
 *
 * When adding a new base map layer to the config, add its shortname here too.
 */
export type BaseLayerType = 'osm' | 'stadia_smooth' | 'stadia_smooth_dark' | 'osm_bright' | 'aerial';
