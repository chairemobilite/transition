/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Inline MapLibre style root (same JSON shape as a remote style document).
 * Intentionally loose: project `config.js` supplies partial style objects; map code validates at runtime.
 * @see https://maplibre.org/maplibre-style-spec/
 */
export type MapLibreStyleJson = {
    version: number;
    sources?: Record<string, unknown>;
    layers?: unknown[];
    /** String URL, array of URLs, or MapLibre sprite spec entries — keep loose for config + cloned runtime styles. */
    sprite?: unknown;
    glyphs?: string;
};

export type ProjectMapBasemapShortname = string;

/**
 * Fields on each `mapBaseLayers` entry (UI label, optional zoom fallback).
 *
 * **`minZoom` / `maxZoom`**: when set, outside that inclusive range the map falls back to OSM.
 *
 * Map API keys: use `process.env.YOUR_VAR` in `config.js` (evaluated when webpack builds the bundle;
 * load secrets via root `.env` before `yarn build:*`). Keys still ship in the client bundle, like any client-side tiles setup.
 */
export type ProjectMapBasemapLayerMeta = {
    shortname: string;
    name: string;
    minZoom?: number;
    maxZoom?: number;
};

/**
 * Basemap loaded from a remote MapLibre **style** document URL.
 * @see https://maplibre.org/maplibre-style-spec/
 */
export type ProjectMapBasemapFromUrl = ProjectMapBasemapLayerMeta & {
    styleUrl: string;
};

/**
 * Basemap from a full MapLibre `style` object (same JSON shape as a remote style root).
 */
export type ProjectMapBasemapFromInlineStyle = ProjectMapBasemapLayerMeta & {
    style: MapLibreStyleJson;
};

export type ProjectMapBasemapLayer = ProjectMapBasemapFromUrl | ProjectMapBasemapFromInlineStyle;

export type ResolvedProjectBasemapLayer = ProjectMapBasemapLayer;

/**
 * Built-in OpenStreetMap (not listed in project `mapBaseLayers`).
 * Display name and attribution come from i18n (`main:map.controls.osm`, `main:map.osmAttribution`).
 */
export type BuiltInOsmRasterBasemapLayer = {
    type: 'raster';
    shortname: 'osm';
    url: string;
};

export type ResolvedMapBasemapLayer = BuiltInOsmRasterBasemapLayer | ResolvedProjectBasemapLayer;

export function isProjectBasemapStyleUrl(
    layer: ProjectMapBasemapLayer | ResolvedProjectBasemapLayer
): layer is ProjectMapBasemapFromUrl {
    return 'styleUrl' in layer && typeof (layer as ProjectMapBasemapFromUrl).styleUrl === 'string';
}
