/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// External packages
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { WithTranslation } from 'react-i18next';

// chaire-lib imports
import defaultPreferences from 'chaire-lib-common/lib/config/defaultPreferences.config';

// Local workspace imports
import maplibregl from 'maplibre-gl';

interface MapControlsMenuProps {
    t: WithTranslation['t'];
    isOpen: boolean;
    onToggle: () => void;
    onResetView: () => void;
    onLayerChange?: (layerType: 'osm' | 'aerial') => void;
    getCurrentLayer?: () => 'osm' | 'aerial';
    isZoomInAerialRange?: () => boolean;
    getCurrentZoom?: () => number;
    minZoom?: number;
    maxZoom?: number;
    aerialTilesUrl?: string;
}

const MapControlsDropdown: React.FC<MapControlsMenuProps> = ({
    t,
    isOpen,
    onToggle,
    onResetView,
    onLayerChange,
    getCurrentLayer,
    isZoomInAerialRange,
    getCurrentZoom,
    minZoom,
    maxZoom,
    aerialTilesUrl
}) => {
    const currentLayer = getCurrentLayer?.() || 'osm';
    const inRange = isZoomInAerialRange?.() ?? true;
    const currentZoom = getCurrentZoom?.() ?? 0;

    // Determine zoom range message - show when outside valid zoom range
    let zoomMessage: string | null = null;
    if (aerialTilesUrl && !inRange && minZoom !== undefined && maxZoom !== undefined) {
        if (currentZoom < minZoom) {
            zoomMessage = `(min zoom: ${minZoom})`;
        } else if (currentZoom > maxZoom) {
            zoomMessage = `(max zoom: ${maxZoom})`;
        }
    }

    const handleResetView = (e: React.MouseEvent) => {
        e.stopPropagation();
        onResetView();
        onToggle();
    };

    const handleOsmClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onLayerChange?.('osm');
        onToggle();
    };

    const handleAerialClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (inRange) {
            onLayerChange?.('aerial');
        }
        onToggle();
    };

    return (
        <div className="tr__map-controls-dropdown" style={{ display: isOpen ? 'flex' : 'none' }}>
            <p className="tr__map-controls-dropdown-item" onClick={handleResetView}>
                <span>{t('main:map.controls.resetView')}</span>
            </p>

            {onLayerChange && getCurrentLayer && (
                <>
                    <div className="tr__map-controls-dropdown-group-title">{t('main:map.controls.background')}:</div>
                    <p
                        onClick={handleOsmClick}
                        className={`tr__map-controls-dropdown-item ${currentLayer === 'osm' ? '_active' : ''}`}
                    >
                        {t('main:map.controls.osm')}
                    </p>
                    <p
                        onClick={handleAerialClick}
                        className={`tr__map-controls-dropdown-item ${currentLayer === 'aerial' && inRange && aerialTilesUrl ? '_active' : ''}`}
                        style={{
                            opacity: aerialTilesUrl && inRange ? 1 : 0.5,
                            cursor: aerialTilesUrl && inRange ? 'pointer' : 'not-allowed',
                            pointerEvents: aerialTilesUrl && inRange ? 'auto' : 'none'
                        }}
                    >
                        {t('main:map.controls.aerial')}
                        {zoomMessage && (
                            <span style={{ fontStyle: 'oblique', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                                {zoomMessage}
                            </span>
                        )}
                    </p>
                </>
            )}
        </div>
    );
};

// Create a map controls dropdown menu with a gear icon
class MapControlsMenu {
    private container!: HTMLElement;
    private map!: maplibregl.Map | undefined;
    private defaultCenter: [number, number];
    private defaultZoom: number;
    private button!: HTMLButtonElement;
    private dropdown!: HTMLDivElement;
    private dropdownRoot!: Root;
    private isOpen: boolean = false;
    private t: WithTranslation['t'];
    private documentClickListener!: (e: MouseEvent) => void;
    private onLayerChange?: (layerType: 'osm' | 'aerial') => void;
    private getCurrentLayer?: () => 'osm' | 'aerial';
    private isZoomInAerialRange?: () => boolean;
    private getCurrentZoom?: () => number;
    private aerialTilesUrl?: string;
    private minZoom: number = 0;
    private maxZoom: number = 22;
    private zoomChangeListener?: () => void;
    constructor(
        t: WithTranslation['t'],
        options?: {
            onLayerChange?: (layerType: 'osm' | 'aerial') => void;
            getCurrentLayer?: () => 'osm' | 'aerial';
            isZoomInAerialRange?: () => boolean;
            getCurrentZoom?: () => number;
            aerialTilesUrl?: string;
            minZoom?: number;
            maxZoom?: number;
        }
    ) {
        this.defaultCenter = defaultPreferences.map.center;
        this.defaultZoom = defaultPreferences.map.zoom;
        this.t = t;
        this.onLayerChange = options?.onLayerChange;
        this.getCurrentLayer = options?.getCurrentLayer;
        this.isZoomInAerialRange = options?.isZoomInAerialRange;
        this.getCurrentZoom = options?.getCurrentZoom;
        this.aerialTilesUrl = options?.aerialTilesUrl;
        this.minZoom = options?.minZoom ?? 0;
        this.maxZoom = options?.maxZoom ?? 22;
    }

    onAdd(map: maplibregl.Map) {
        this.map = map;

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group tr__map-controls';

        // Create toggle button with gear icon
        this.button = document.createElement('button');
        this.button.className = 'maplibregl-ctrl-icon tr__map-controls-button';
        this.button.type = 'button';
        this.button.title = this.t('main:map.controls.title');
        this.button.setAttribute('aria-label', this.t('main:map.controls.title'));
        this.button.innerHTML = '<i class="fa fa-cog" aria-hidden="true"></i>';

        // Create dropdown menu container for React component
        this.dropdown = document.createElement('div');
        this.dropdownRoot = createRoot(this.dropdown);

        // Render dropdown React component
        this.renderDropdown();

        this.container.appendChild(this.button);
        this.container.appendChild(this.dropdown);

        // Add click handler for toggle button
        this.button.onclick = () => {
            this.toggleDropdown();
        };

        // Close dropdown when clicking outside
        this.documentClickListener = (e: MouseEvent) => {
            if (this.isOpen && !this.container.contains(e.target as Node)) {
                this.toggleDropdown();
            }
        };
        document.addEventListener('click', this.documentClickListener);

        // Re-render dropdown when zoom changes to update zoom messages and enabled state
        this.zoomChangeListener = () => {
            if (this.isOpen) {
                this.renderDropdown();
            }
        };
        map.on('zoom', this.zoomChangeListener);
        map.on('moveend', this.zoomChangeListener); // Also update on moveend in case zoom changed

        return this.container;
    }

    /**
     * Update the callbacks and configuration for this control
     * This allows updating the control without removing/re-adding it
     */
    updateCallbacks(options?: {
        onLayerChange?: (layerType: 'osm' | 'aerial') => void;
        getCurrentLayer?: () => 'osm' | 'aerial';
        isZoomInAerialRange?: () => boolean;
        getCurrentZoom?: () => number;
        aerialTilesUrl?: string;
        minZoom?: number;
        maxZoom?: number;
    }) {
        if (options?.onLayerChange !== undefined) {
            this.onLayerChange = options.onLayerChange;
        }
        if (options?.getCurrentLayer !== undefined) {
            this.getCurrentLayer = options.getCurrentLayer;
        }
        if (options?.isZoomInAerialRange !== undefined) {
            this.isZoomInAerialRange = options.isZoomInAerialRange;
        }
        if (options?.getCurrentZoom !== undefined) {
            this.getCurrentZoom = options.getCurrentZoom;
        }
        if (options?.aerialTilesUrl !== undefined) {
            this.aerialTilesUrl = options.aerialTilesUrl;
        }
        if (options?.minZoom !== undefined) {
            this.minZoom = options.minZoom;
        }
        if (options?.maxZoom !== undefined) {
            this.maxZoom = options.maxZoom;
        }
        // Re-render dropdown with updated callbacks
        this.renderDropdown();
    }

    private renderDropdown() {
        this.dropdownRoot.render(
            <MapControlsDropdown
                t={this.t}
                isOpen={this.isOpen}
                onToggle={() => this.toggleDropdown()}
                onResetView={() => {
                    this.map?.flyTo({
                        center: this.defaultCenter,
                        zoom: this.defaultZoom
                    });
                }}
                onLayerChange={this.onLayerChange}
                getCurrentLayer={this.getCurrentLayer}
                isZoomInAerialRange={this.isZoomInAerialRange}
                getCurrentZoom={this.getCurrentZoom}
                minZoom={this.minZoom}
                maxZoom={this.maxZoom}
                aerialTilesUrl={this.aerialTilesUrl}
            />
        );
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
        this.renderDropdown();
    }

    /**
     * Get the container element for this control
     * Used to check if control is still attached to the map
     */
    getContainer(): HTMLElement | undefined {
        return this.container;
    }

    onRemove() {
        // Remove zoom listeners
        if (this.map && this.zoomChangeListener) {
            this.map.off('zoom', this.zoomChangeListener);
            this.map.off('moveend', this.zoomChangeListener);
        }
        // Unmount React root - this is safe because onRemove is called
        // when MapLibre removes the control, not during React rendering
        if (this.dropdownRoot) {
            this.dropdownRoot.unmount();
        }
        // Clean up DOM and event listeners
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        document.removeEventListener('click', this.documentClickListener);
        this.map = undefined;
    }
}

export default MapControlsMenu;
