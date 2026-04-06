/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { TFunction } from 'i18next';
import _cloneDeep from 'lodash/cloneDeep';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

import type {
    BuiltInOsmRasterBasemapLayer,
    ProjectMapBasemapLayer,
    ResolvedMapBasemapLayer,
    ResolvedProjectBasemapLayer
} from 'chaire-lib-common/lib/config/mapBaseLayersProject.types';
import { isProjectBasemapStyleUrl } from 'chaire-lib-common/lib/config/mapBaseLayersProject.types';
import config from 'chaire-lib-frontend/lib/config/project.config';

import { overlaySource } from './layers.config';

/**
 * Copy layer from bundled config (already includes `process.env` expanded when webpack built `__CONFIG__`).
 * Deep-clone inline `style` so overlay composition does not mutate the shared config object.
 */
function resolveProjectMapBasemapLayer(layer: ProjectMapBasemapLayer): ResolvedProjectBasemapLayer {
    if (isProjectBasemapStyleUrl(layer)) {
        return { ...layer };
    }
    if ('style' in layer && layer.style) {
        return { ...layer, style: _cloneDeep(layer.style) as StyleSpecification };
    }
    throw new Error(
        `[mapBaseLayers] "${layer.shortname}" must include a MapLibre style: set "styleUrl" or inline "style".`
    );
}

/** Clones a MapLibre style and appends the Transition dimming overlay so it covers labels/symbols too. */
export function composeMapStyleWithOverlay(
    baseStyle: StyleSpecification,
    overlayOpacityPct: number,
    overlayColor: 'black' | 'white'
): StyleSpecification {
    const style = _cloneDeep(baseStyle) as StyleSpecification;
    style.version = 8;
    style.sources = style.sources || {};
    style.layers = style.layers || [];
    style.sources.overlay = {
        type: 'geojson',
        data: overlaySource
    };

    const overlayLayer: LayerSpecification = {
        id: 'base-overlay',
        type: 'fill',
        source: 'overlay',
        paint: {
            'fill-color': overlayColor === 'white' ? '#ffffff' : '#000000',
            'fill-opacity': overlayOpacityPct / 100
        }
    };

    const existingIdx = style.layers.findIndex((l) => l.id === 'base-overlay');
    if (existingIdx >= 0) {
        style.layers.splice(existingIdx, 1);
    }
    style.layers.push(overlayLayer);

    return style;
}

/** Built-in OSM; labels from i18n in the app (not from this object). */
export const OSM_DEFAULT_LAYER: BuiltInOsmRasterBasemapLayer = {
    type: 'raster',
    shortname: 'osm',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
};

type ProjectConfigWithMapLayers = {
    mapBaseLayers?: readonly ProjectMapBasemapLayer[];
};

let _cachedLayers: ResolvedMapBasemapLayer[] | null = null;

/**
 * OSM plus project `mapBaseLayers` from bundled config (secrets come from `process.env` in `config.js` at webpack build).
 * Result is computed once and cached since the config is static at runtime.
 */
export function getProjectMapBaseLayers(): ResolvedMapBasemapLayer[] {
    if (_cachedLayers) {
        return _cachedLayers;
    }
    const raw = (config as ProjectConfigWithMapLayers).mapBaseLayers || [];
    const extra = raw.map((ly) => resolveProjectMapBasemapLayer(ly));

    const seen = new Set<string>([OSM_DEFAULT_LAYER.shortname]);
    for (const layer of extra) {
        if (seen.has(layer.shortname)) {
            console.warn(
                `[mapBaseLayers] Duplicate shortname "${layer.shortname}" — only the first entry will be used.`
            );
        }
        seen.add(layer.shortname);
    }

    _cachedLayers = [OSM_DEFAULT_LAYER, ...extra];
    return _cachedLayers;
}

/** True for the built-in OSM entry (no `name`; project entries always have `name`). */
export function isBuiltInOsm(layer: ResolvedMapBasemapLayer): layer is BuiltInOsmRasterBasemapLayer {
    return layer.shortname === 'osm' && !('name' in layer);
}

export function getProjectBasemapByShortname(shortname: string): ResolvedProjectBasemapLayer | undefined {
    const layer = getProjectMapBaseLayers().find((l) => l.shortname === shortname);
    if (!layer || isBuiltInOsm(layer)) {
        return undefined;
    }
    return layer;
}

/** Built-in OSM raster only (for the legacy raster + overlay initial style path). */
export function getBuiltInOsmRasterIfActive(shortname: string): BuiltInOsmRasterBasemapLayer | undefined {
    if (shortname !== 'osm') {
        return undefined;
    }
    const layer = getProjectMapBaseLayers().find((l) => l.shortname === shortname);
    return layer && isBuiltInOsm(layer) ? layer : undefined;
}

/** Default upper zoom when only `minZoom` is set on a basemap layer. */
export const DEFAULT_MAX_BASEMAP_ZOOM = 22;

/** When a basemap is out of its configured zoom range, the map shows this layer instead. */
export const DEFAULT_FALLBACK_BASEMAP_SHORTNAME = 'osm';

export function getBasemapZoomBoundsFromConfigFields(layer: {
    minZoom?: number;
    maxZoom?: number;
}): { min: number; max: number } | null {
    if (layer.minZoom === undefined && layer.maxZoom === undefined) {
        return null;
    }
    return {
        min: layer.minZoom ?? 0,
        max: layer.maxZoom ?? DEFAULT_MAX_BASEMAP_ZOOM
    };
}

export function getZoomBoundsForBasemapShortname(shortname: string): { min: number; max: number } | null {
    if (shortname === 'osm') {
        return null;
    }
    const layer = getProjectMapBaseLayers().find((l) => l.shortname === shortname);
    if (!layer || isBuiltInOsm(layer)) {
        return null;
    }
    return getBasemapZoomBoundsFromConfigFields(layer);
}

/** Zoom bounds for `shortname` when the map should fall back to OSM outside that range. */
export function getZoomBoundsForOsMFallbackBasemap(shortname: string): { min: number; max: number } | null {
    if (shortname === DEFAULT_FALLBACK_BASEMAP_SHORTNAME) {
        return null;
    }
    return getZoomBoundsForBasemapShortname(shortname);
}

export function getBasemapZoomHintMessage(shortname: string, currentZoom: number, t: TFunction): string | null {
    const bounds = getZoomBoundsForBasemapShortname(shortname);
    if (!bounds) {
        return null;
    }
    if (currentZoom >= bounds.min && currentZoom <= bounds.max) {
        return null;
    }
    if (currentZoom < bounds.min) {
        return t('main:map.controls.minZoom', { zoom: bounds.min });
    }
    return t('main:map.controls.maxZoom', { zoom: bounds.max });
}

export function isStyleBasemapShortname(shortname: string): boolean {
    return getProjectBasemapByShortname(shortname) !== undefined;
}

/** @deprecated Use {@link isStyleBasemapShortname}. */
export const isVectorBasemapShortname = isStyleBasemapShortname;

/** Every basemap id the user can select (`osm` plus project `mapBaseLayers`). */
export function getValidBasemapShortnames(): string[] {
    return getProjectMapBaseLayers().map((l) => l.shortname);
}

function maxZoomFromSources(sources: Record<string, unknown> | undefined): number | undefined {
    if (!sources) {
        return undefined;
    }
    let max: number | undefined;
    for (const src of Object.values(sources)) {
        if (
            src &&
            typeof src === 'object' &&
            'maxzoom' in src &&
            typeof (src as { maxzoom: unknown }).maxzoom === 'number'
        ) {
            const mz = (src as { maxzoom: number }).maxzoom;
            max = max === undefined ? mz : Math.max(max, mz);
        }
    }
    return max;
}

/** Upper bound for `MapLibreMap` `maxZoom` from configured basemaps. */
export function getMaxConfiguredRasterBasemapZoom(): number {
    let maxZ = DEFAULT_MAX_BASEMAP_ZOOM;
    for (const layer of getProjectMapBaseLayers()) {
        if (isBuiltInOsm(layer)) {
            continue;
        }
        if (isProjectBasemapStyleUrl(layer)) {
            continue;
        }
        const mz = maxZoomFromSources(layer.style.sources);
        if (mz !== undefined) {
            maxZ = Math.max(maxZ, mz);
        }
        if (layer.maxZoom !== undefined) {
            maxZ = Math.max(maxZ, layer.maxZoom);
        }
    }
    return maxZ;
}

export function formatBasemapDisplayName(layer: { name?: string; shortname: string }, t: TFunction): string {
    if (layer.shortname === 'osm' && !('name' in layer)) {
        return t('main:map.controls.osm');
    }
    if (layer.name !== undefined && layer.name !== '') {
        return layer.name;
    }
    return layer.shortname;
}

export function formatRasterBasemapAttribution(
    layer: { attribution?: string; shortname?: string; name?: string },
    t: TFunction
): string {
    if (layer.shortname === 'osm' && !('name' in layer)) {
        return t('main:map.osmAttribution');
    }
    if (layer.attribution !== undefined && layer.attribution !== '') {
        return layer.attribution;
    }
    return '';
}
