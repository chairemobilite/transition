/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// External packages
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useTranslation, WithTranslation } from 'react-i18next';

// chaire-lib imports
import defaultPreferences from 'chaire-lib-common/lib/config/defaultPreferences.config';

// Local workspace imports
import maplibregl from 'maplibre-gl';
import type { BaseLayerType } from 'chaire-lib-common/lib/config/types';
import baseMapLayers from '../../config/baseMapLayers.config';

type MapControlsMenuProps = {
    isOpen: boolean;
    onToggle: () => void;
    onResetView: () => void;
    onLayerChange: (layerType: BaseLayerType) => void;
    getCurrentLayer: () => BaseLayerType;
    isZoomInAerialRange: () => boolean;
    getCurrentZoom: () => number;
    minZoom?: number;
    maxZoom?: number;
    /** URL for aerial tiles. If undefined, the aerial option is hidden */
    aerialTilesUrl?: string;
    /** Callback when overlay opacity changes (0–100) */
    onOverlayOpacityChange: (opacity: number) => void;
    /** Get the current overlay opacity (0–100) */
    getOverlayOpacity: () => number;
    /** Callback when overlay color changes */
    onOverlayColorChange: (color: 'black' | 'white') => void;
    /** Get the current overlay color */
    getOverlayColor: () => 'black' | 'white';
};

/** Reusable layer option item for the dropdown */
const LayerOption: React.FC<{
    layerType: BaseLayerType;
    label: string;
    isActive: boolean;
    disabled?: boolean;
    suffix?: React.ReactNode;
    onSelect: (layerType: BaseLayerType) => void;
}> = ({ layerType, label, isActive, disabled = false, suffix, onSelect }) => (
    <p
        onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
                onSelect(layerType);
            }
        }}
        className={`tr__map-controls-dropdown-item ${isActive ? '_active' : ''}`}
        style={
            disabled
                ? {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    pointerEvents: 'none'
                }
                : undefined
        }
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault();
                e.stopPropagation();
                onSelect(layerType);
            }
        }}
    >
        {label}
        {suffix}
    </p>
);

const MapControlsDropdown: React.FC<MapControlsMenuProps> = ({
    isOpen,
    onToggle,
    onResetView,
    onLayerChange,
    getCurrentLayer,
    isZoomInAerialRange,
    getCurrentZoom,
    minZoom,
    maxZoom,
    aerialTilesUrl,
    onOverlayOpacityChange,
    getOverlayOpacity,
    onOverlayColorChange,
    getOverlayColor
}) => {
    const currentLayer = getCurrentLayer();
    const inRange = isZoomInAerialRange();
    const currentZoom = getCurrentZoom();
    const { t } = useTranslation(['main', 'transit']);

    // Generate instance-unique ID prefix to avoid radio name collisions
    // across multiple mounted instances of this component
    const instanceId = React.useId();

    // Local state for immediate UI feedback on slider / radio changes
    const [localOpacity, setLocalOpacity] = React.useState(getOverlayOpacity());
    const [localColor, setLocalColor] = React.useState(getOverlayColor());

    // Sync local state when external values change (e.g. from preferences panel)
    // We use the getter result as dependency so it updates if the parent re-renders with new values.
    // However, we MUST ensure the getter is called in the render body to capture the value.
    const propOpacity = getOverlayOpacity();
    const propColor = getOverlayColor();

    React.useEffect(() => {
        setLocalOpacity(propOpacity);
    }, [propOpacity]);
    React.useEffect(() => {
        setLocalColor(propColor);
    }, [propColor]);

    // Determine zoom range message - show when outside valid zoom range
    let zoomMessage: string | null = null;
    if (aerialTilesUrl && !inRange && minZoom !== undefined && maxZoom !== undefined) {
        if (currentZoom < minZoom) {
            zoomMessage = t('main:map.controls.minZoom', { zoom: minZoom });
        } else if (currentZoom > maxZoom) {
            zoomMessage = t('main:map.controls.maxZoom', { zoom: maxZoom });
        }
    }

    const handleSelect = (layerType: BaseLayerType) => {
        onLayerChange(layerType);
        onToggle();
    };

    return (
        <div className="tr__map-controls-dropdown" style={{ display: isOpen ? 'flex' : 'none' }}>
            <p
                className="tr__map-controls-dropdown-item"
                onClick={(e) => {
                    e.stopPropagation();
                    onResetView();
                    onToggle();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onResetView();
                        onToggle();
                    }
                }}
            >
                <span>{t('main:map.controls.resetView')}</span>
            </p>

            <div className="tr__map-controls-dropdown-group-title">{t('main:map.controls.background')}:</div>

            {baseMapLayers.map((layer) => (
                <LayerOption
                    key={layer.shortname}
                    layerType={layer.shortname}
                    label={t(`main:map.controls.${layer.nameKey}`)}
                    isActive={currentLayer === layer.shortname}
                    onSelect={handleSelect}
                />
            ))}

            {/* Aerial option - conditional on availability and zoom range */}
            {aerialTilesUrl && (
                <LayerOption
                    layerType="aerial"
                    label={t('main:map.controls.aerial')}
                    isActive={currentLayer === 'aerial'}
                    disabled={!inRange}
                    onSelect={handleSelect}
                    suffix={
                        zoomMessage ? (
                            <span style={{ fontStyle: 'oblique', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                                {zoomMessage}
                            </span>
                        ) : undefined
                    }
                />
            )}

            <div className="tr__map-controls-dropdown-group-title" style={{ marginTop: '0.5rem' }}>
                {t('main:map.controls.overlayOpacity')}:
            </div>
            <div className="tr__map-controls-slider-container">
                <input
                    className="tr__map-controls-slider-input"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={localOpacity}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalOpacity(val);
                        // We update the parent imperatively (for map update) but we rely on local state for the slider UI
                        onOverlayOpacityChange(val);
                    }}
                    aria-label={t('main:map.controls.overlayOpacity')}
                />
                <span className="tr__map-controls-slider-value">{localOpacity}%</span>
            </div>
            <div className="tr__map-controls-dropdown-group-title">{t('main:map.controls.overlayColor')}:</div>
            <div className="tr__map-controls-color-container">
                <div className="tr__map-controls-radio-group">
                    <label className="tr__map-controls-radio-item">
                        <input
                            type="radio"
                            name={`overlayColor-${instanceId}`}
                            value="black"
                            checked={localColor === 'black'}
                            onChange={() => {
                                setLocalColor('black');
                                onOverlayColorChange('black');
                            }}
                        />
                        {t('main:Black')}
                    </label>
                    <label className="tr__map-controls-radio-item">
                        <input
                            type="radio"
                            name={`overlayColor-${instanceId}`}
                            value="white"
                            checked={localColor === 'white'}
                            onChange={() => {
                                setLocalColor('white');
                                onOverlayColorChange('white');
                            }}
                        />
                        {t('main:White')}
                    </label>
                </div>
            </div>
        </div>
    );
};

/** Options for MapControlsMenu constructor */
type MapControlsMenuOptions = {
    onLayerChange: (layerType: BaseLayerType) => void;
    getCurrentLayer: () => BaseLayerType;
    isZoomInAerialRange: () => boolean;
    getCurrentZoom: () => number;
    /** URL for aerial tiles. If undefined, the aerial option is hidden */
    aerialTilesUrl?: string;
    minZoom?: number;
    maxZoom?: number;
    /** Callback when overlay opacity changes (0–100) */
    onOverlayOpacityChange: (opacity: number) => void;
    /** Get the current overlay opacity (0–100) */
    getOverlayOpacity: () => number;
    /** Callback when overlay color changes */
    onOverlayColorChange: (color: 'black' | 'white') => void;
    /** Get the current overlay color */
    getOverlayColor: () => 'black' | 'white';
};

// Create a map controls dropdown menu with a gear icon
class MapControlsMenu {
    private container!: HTMLElement;
    private map!: maplibregl.Map | undefined;
    private defaultCenter: [number, number];
    private defaultZoom: number;
    private button!: HTMLButtonElement;
    private dropdown!: HTMLDivElement;
    private dropdownRoot: Root | undefined;
    private isOpen: boolean = false;
    private t: WithTranslation['t'];
    private documentClickListener!: (e: MouseEvent) => void;
    private onLayerChange: (layerType: BaseLayerType) => void;
    private getCurrentLayer: () => BaseLayerType;
    private isZoomInAerialRange: () => boolean;
    private getCurrentZoom: () => number;
    private aerialTilesUrl?: string;
    private minZoom: number = 0;
    private maxZoom: number = 22;
    private zoomChangeListener?: () => void;
    private onOverlayOpacityChange: (opacity: number) => void;
    private getOverlayOpacity: () => number;
    private onOverlayColorChange: (color: 'black' | 'white') => void;
    private getOverlayColor: () => 'black' | 'white';

    constructor(t: WithTranslation['t'], options: MapControlsMenuOptions) {
        this.defaultCenter = defaultPreferences.map.center;
        this.defaultZoom = defaultPreferences.map.zoom;
        this.t = t;
        this.onLayerChange = options.onLayerChange;
        this.getCurrentLayer = options.getCurrentLayer;
        this.isZoomInAerialRange = options.isZoomInAerialRange;
        this.getCurrentZoom = options.getCurrentZoom;
        this.aerialTilesUrl = options.aerialTilesUrl;
        this.minZoom = options.minZoom ?? 0;
        this.maxZoom = options.maxZoom ?? 22;
        this.onOverlayOpacityChange = options.onOverlayOpacityChange;
        this.getOverlayOpacity = options.getOverlayOpacity;
        this.onOverlayColorChange = options.onOverlayColorChange;
        this.getOverlayColor = options.getOverlayColor;
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
        onLayerChange?: (layerType: BaseLayerType) => void;
        getCurrentLayer?: () => BaseLayerType;
        isZoomInAerialRange?: () => boolean;
        getCurrentZoom?: () => number;
        aerialTilesUrl?: string;
        minZoom?: number;
        maxZoom?: number;
        onOverlayOpacityChange?: (opacity: number) => void;
        getOverlayOpacity?: () => number;
        onOverlayColorChange?: (color: 'black' | 'white') => void;
        getOverlayColor?: () => 'black' | 'white';
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
        if (options?.onOverlayOpacityChange !== undefined) {
            this.onOverlayOpacityChange = options.onOverlayOpacityChange;
        }
        if (options?.getOverlayOpacity !== undefined) {
            this.getOverlayOpacity = options.getOverlayOpacity;
        }
        if (options?.onOverlayColorChange !== undefined) {
            this.onOverlayColorChange = options.onOverlayColorChange;
        }
        if (options?.getOverlayColor !== undefined) {
            this.getOverlayColor = options.getOverlayColor;
        }
        // Re-render dropdown with updated callbacks
        this.renderDropdown();
    }

    private renderDropdown() {
        // Guard against calling render when not mounted (before onAdd or after onRemove)
        if (!this.dropdownRoot) return;

        this.dropdownRoot.render(
            <MapControlsDropdown
                isOpen={this.isOpen}
                onToggle={() => this.toggleDropdown()}
                onResetView={() => {
                    this.map?.flyTo({
                        center: this.defaultCenter,
                        zoom: this.defaultZoom,
                        bearing: 0,
                        pitch: 0
                    });
                }}
                onLayerChange={this.onLayerChange}
                getCurrentLayer={this.getCurrentLayer}
                isZoomInAerialRange={this.isZoomInAerialRange}
                getCurrentZoom={this.getCurrentZoom}
                minZoom={this.minZoom}
                maxZoom={this.maxZoom}
                aerialTilesUrl={this.aerialTilesUrl}
                onOverlayOpacityChange={this.onOverlayOpacityChange}
                getOverlayOpacity={this.getOverlayOpacity}
                onOverlayColorChange={this.onOverlayColorChange}
                getOverlayColor={this.getOverlayColor}
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
            this.dropdownRoot = undefined;
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
