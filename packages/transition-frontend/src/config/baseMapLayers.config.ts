/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// Re-export BaseLayerType so frontend consumers can import it from either location
import type { BaseLayerType } from 'chaire-lib-common/lib/config/types';

/**
 * Configuration for a base map tile layer.
 * Add or remove entries here to change the available base map options
 * in the layer switcher control.
 *
 * ## Adding a new base map layer
 *
 * 1. Append a new entry to the `baseMapLayers` array below with a unique
 *    `shortname`, a `nameKey`, an `attributionKey`, and the XYZ tile `url`.
 *
 * 2. Add translations for `nameKey` and `attributionKey` in the locale files:
 *    - `locales/en/main.json`:
 *      - Display name under `map.controls`, e.g. `"myLayer": "My Layer Name"`
 *      - Attribution under `map`, e.g. `"myLayerAttribution": "© Provider"`
 *    - `locales/fr/main.json` — add the French equivalents under the same paths.
 *    The `nameKey` resolves as `t('main:map.controls.<nameKey>')` and
 *    `attributionKey` resolves as `t('main:map.<attributionKey>')`.
 *
 * 3. Add the new shortname to the `BaseLayerType` union in
 *    `chaire-lib-common/src/config/types.ts`.
 *
 * No other code changes are required — sources, layers, and dropdown options
 * are all generated automatically from this array.
 */
export type BaseMapLayerConfig = {
    /** Unique identifier used as the map source/layer id; must be a valid BaseLayerType (excluding 'aerial') */
    shortname: Exclude<BaseLayerType, 'aerial'>;
    /** i18n key for the display name (under `main:map.controls`) */
    nameKey: string;
    /** i18n key for the attribution string (under `main:map`) */
    attributionKey: string;
    /** XYZ tile URL template with {z}/{x}/{y} placeholders */
    url: string;
    /** Tile size in pixels (default: 256) */
    tileSize?: number;
};

/**
 * Available base map tile layers.
 * The first entry is used as the default layer.
 * To add a new base map, simply append a new entry to this array.
 */
const baseMapLayers = [
    {
        shortname: 'osm',
        nameKey: 'osm',
        attributionKey: 'osmAttribution',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    },
    {
        shortname: 'stadia_smooth',
        nameKey: 'stadiaSmooth',
        attributionKey: 'stadiaAttribution',
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png'
    },
    {
        shortname: 'stadia_smooth_dark',
        nameKey: 'stadiaSmoothDark',
        attributionKey: 'stadiaAttribution',
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png'
    },
    {
        shortname: 'osm_bright',
        nameKey: 'osmBright',
        attributionKey: 'stadiaAttribution',
        url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png'
    }
] as const satisfies readonly BaseMapLayerConfig[];

export default baseMapLayers;
