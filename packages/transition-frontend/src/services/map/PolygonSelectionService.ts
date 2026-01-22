/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import maplibregl from 'maplibre-gl';
import _cloneDeep from 'lodash/cloneDeep';
import * as turf from '@turf/turf';
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import type GeoJson from 'geojson';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { findOverlappingFeatures } from 'chaire-lib-common/lib/services/geodata/FindOverlappingFeatures';
import {
    getTerraDraw,
    removeTerraDraw,
    TerraDrawAdapter
} from 'chaire-lib-frontend/lib/services/map/MapPolygonService';

import Node from 'transition-common/lib/services/nodes/Node';

export type PolygonType = GeoJson.Feature<GeoJson.Polygon | GeoJson.MultiPolygon> | GeoJson.FeatureCollection;

/**
 * Service for managing polygon selection on the map.
 * Handles TerraDraw integration for drawing polygons and selecting nodes within them.
 */
export class PolygonSelectionService {
    private draw: TerraDrawAdapter | undefined;
    private currentSelectionPolygon: PolygonType | null = null;

    /**
     * Initialize the TerraDraw polygon drawing service on the map
     * @param map The MapLibre map instance
     */
    initializeDrawService(map: maplibregl.Map): void {
        this.draw = getTerraDraw(
            map,
            (modeChange) => {
                this.handleModeChange(modeChange);
            },
            (polygon) => {
                this.handleDrawPolygon(polygon);
            },
            (_polygon) => {
                // Delete callback: clear selection when polygon is deleted
                this.clearSelection();
            },
            (polygon) => {
                // Update callback: re-select nodes when polygon is modified (e.g., dragged)
                this.handleDrawPolygon(polygon);
            }
        );
    }

    /**
     * Remove the TerraDraw service from the map
     * @param map The MapLibre map instance
     */
    removeDrawService(map: maplibregl.Map): void {
        if (this.draw) {
            this.deleteSelectedPolygon();
            removeTerraDraw(map, this.draw);
            this.draw = undefined;
        }
    }

    /**
     * Check if the draw service is initialized
     */
    isInitialized(): boolean {
        return this.draw !== undefined;
    }

    /**
     * Get the current selection polygon
     */
    getCurrentSelectionPolygon(): PolygonType | null {
        return this.currentSelectionPolygon;
    }

    /**
     * In the nodes active section, if you click on the map a new node will be created.
     * If the user clicks on the tool for drawing a polygon,
     * selectedNodes will put a value that will prevent a new node from being created.
     * If the user clicks again on the tool for drawing a polygon and selectedNodes doesn't contain nodes (type object),
     * selectedNodes will be cleared so a new node can be created.
     * @param data The next mode, i.e. the mode that Draw is changing to (from terra-draw API)
     */
    private handleModeChange(data: { mode?: string }): void {
        if (data.mode && (data.mode === 'draw_polygon' || data.mode === 'polygon' || data.mode === 'select')) {
            // Set the explicitly dedicated flag for drawing mode
            serviceLocator.selectedObjectsManager.setSelection('isDrawPolygon', [true]);
        } else {
            // When leaving draw mode (simple_select)
            serviceLocator.selectedObjectsManager.deselect('isDrawPolygon');

            // Clean up the hack if it was present (legacy cleanup)
            const selectedNodes = serviceLocator.selectedObjectsManager.getSingleSelection('nodes');
            if (selectedNodes && typeof selectedNodes !== 'object' && data.mode && data.mode === 'simple_select') {
                serviceLocator.selectedObjectsManager.deselect('nodes');
            }
        }
    }

    /**
     * Handle polygon drawing and select nodes within the polygon
     * @param polygonOrCollection The drawn polygon or feature collection
     */
    handleDrawPolygon(polygonOrCollection: PolygonType): void {
        this.currentSelectionPolygon = polygonOrCollection;

        // Defensive check: ensure nodes collection exists before accessing
        const nodesCollection = serviceLocator.collectionManager?.get('nodes');
        if (!nodesCollection) {
            console.error('PolygonSelectionService: nodes collection not available');
            return;
        }
        const allNodes = nodesCollection.getFeatures();
        const overlappingNodesMap = new Map<string, Node>();

        // Normalize input to an array of features
        const features: GeoJson.Feature<GeoJson.Polygon | GeoJson.MultiPolygon>[] =
            polygonOrCollection.type === 'FeatureCollection'
                ? (polygonOrCollection.features as GeoJson.Feature<GeoJson.Polygon | GeoJson.MultiPolygon>[])
                : [polygonOrCollection as GeoJson.Feature<GeoJson.Polygon | GeoJson.MultiPolygon>];

        // Process each feature (Polygon or MultiPolygon)
        for (const feature of features) {
            if (feature.geometry.type === 'Polygon') {
                this.findNodesInPolygon(feature as GeoJson.Feature<GeoJson.Polygon>, allNodes, overlappingNodesMap);
            } else if (feature.geometry.type === 'MultiPolygon') {
                // Explode MultiPolygon into individual Polygons
                // We iterate coordinates manually to avoid potential turf.flatten issues
                // with odd/even polygon counts or winding rules interpreting disjoint polygons as holes.
                for (const coords of feature.geometry.coordinates) {
                    const polygon = turf.polygon(coords);
                    this.findNodesInPolygon(polygon, allNodes, overlappingNodesMap);
                }
            }
        }

        // Filter out frozen nodes (frozen nodes should not be edited, so we remove them from the selection)
        const selectedNodes = Array.from(overlappingNodesMap.values()).filter((node) => {
            return node.get('is_frozen', false) === false && !node.wasFrozen();
        });

        const geojson = selectedNodes.map((node) => _cloneDeep(node.toGeojson()));

        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodesSelected: turfFeatureCollection(geojson)
        });
        serviceLocator.selectedObjectsManager.setSelection('nodes', selectedNodes);
        // if at least one selected node was frozen, send info so we can warn the user:
        serviceLocator.selectedObjectsManager.setSelection('isContainSelectedFrozenNodes', [
            selectedNodes.length !== overlappingNodesMap.size
        ]);
        serviceLocator.selectedObjectsManager.setSelection('isDrawPolygon', [true]);
    }

    /**
     * Find nodes within a polygon and add them to the map (avoiding duplicates)
     */
    private findNodesInPolygon(
        polygon: GeoJson.Feature<GeoJson.Polygon>,
        allNodes: GeoJson.Feature[],
        overlappingNodesMap: Map<string, Node>
    ): void {
        const nodesInPolygon = findOverlappingFeatures(polygon, allNodes);
        for (const node of nodesInPolygon) {
            const nodeId = node.properties?.id;
            if (nodeId && !overlappingNodesMap.has(nodeId)) {
                // Use Node.fromGeojson to properly include geometry in the Node instance
                overlappingNodesMap.set(nodeId, Node.fromGeojson(node, false, serviceLocator.collectionManager));
            }
        }
    }

    /**
     * Clear the polygon selection and deselect all nodes
     */
    clearSelection(): void {
        this.currentSelectionPolygon = null;
        serviceLocator.selectedObjectsManager.deselect('nodes');
        serviceLocator.selectedObjectsManager.deselect('isContainSelectedFrozenNodes');
        serviceLocator.selectedObjectsManager.deselect('isDrawPolygon');
        serviceLocator.eventManager.emit('map.updateLayers', {
            transitNodesSelected: turfFeatureCollection([]),
            transitNodes250mRadius: turfFeatureCollection([]),
            transitNodes500mRadius: turfFeatureCollection([]),
            transitNodes750mRadius: turfFeatureCollection([]),
            transitNodes1000mRadius: turfFeatureCollection([]),
            transitNodesRoutingRadius: turfFeatureCollection([])
        });
    }

    /**
     * Delete the selected polygon from TerraDraw
     */
    deleteSelectedPolygon(): void {
        if (this.draw) {
            // This will trigger the delete callback, which calls clearSelection
            this.draw.deleteAll().getAll();
            if (this.draw.reset) {
                this.draw.reset();
            }
        } else {
            // Only call clearSelection directly when draw is not available
            this.clearSelection();
        }
    }

    /**
     * Called when nodes are updated to re-select nodes within the current polygon
     */
    onNodesUpdated(): void {
        if (this.currentSelectionPolygon && this.draw) {
            this.handleDrawPolygon(this.currentSelectionPolygon);
        }
    }

    /**
     * Handle draw control based on section change
     * @param map The MapLibre map instance
     * @param section The current active section
     */
    handleSectionChange(map: maplibregl.Map, section: string): void {
        if (section === 'nodes' && !this.draw) {
            this.initializeDrawService(map);
        } else if (section !== 'nodes' && this.draw) {
            this.removeDrawService(map);
        }
    }
}

// Export a singleton instance for use across the application
export const polygonSelectionService = new PolygonSelectionService();
