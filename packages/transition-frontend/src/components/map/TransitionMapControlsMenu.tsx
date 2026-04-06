/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ProjectMapBasemapShortname } from 'chaire-lib-common/lib/config/mapBaseLayersProject.types';
import {
    formatBasemapDisplayName,
    getBasemapZoomHintMessage,
    getProjectMapBaseLayers
} from '../../config/projectBaseMapLayers';

export interface MapControlsPanelProps {
    currentLayer: ProjectMapBasemapShortname;
    currentZoom: number;
    overlayOpacity: number;
    overlayColor: 'black' | 'white';
    onLayerChange: (layerType: ProjectMapBasemapShortname) => void;
    onOverlayOpacityChange: (opacity: number) => void;
    onOverlayColorChange: (color: 'black' | 'white') => void;
    onResetView: () => void;
}

/** Reusable layer option item for the dropdown */
const LayerOption: React.FC<{
    layerType: ProjectMapBasemapShortname;
    label: string;
    isActive: boolean;
    disabled?: boolean;
    suffix?: React.ReactNode;
    onSelect: (layerType: ProjectMapBasemapShortname) => void;
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

/**
 * Map controls panel rendered as a pure React component over the map.
 * Replaces the previous imperative MapLibre IControl implementation.
 */
const MapControlsPanel: React.FC<MapControlsPanelProps> = ({
    currentLayer,
    currentZoom,
    overlayOpacity,
    overlayColor,
    onLayerChange,
    onOverlayOpacityChange,
    onOverlayColorChange,
    onResetView
}) => {
    const { t } = useTranslation(['main', 'transit']);
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const [localOpacity, setLocalOpacity] = React.useState(overlayOpacity);
    const [localColor, setLocalColor] = React.useState(overlayColor);

    React.useEffect(() => {
        setLocalOpacity(overlayOpacity);
    }, [overlayOpacity]);
    React.useEffect(() => {
        setLocalColor(overlayColor);
    }, [overlayColor]);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleSelect = (layerType: ProjectMapBasemapShortname) => {
        onLayerChange(layerType);
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className="maplibregl-ctrl maplibregl-ctrl-group tr__map-controls tr__map-controls-panel"
        >
            <button
                className="maplibregl-ctrl-icon tr__map-controls-button"
                type="button"
                title={t('main:map.controls.title')}
                aria-label={t('main:map.controls.title')}
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <i className="fa fa-cog" aria-hidden="true"></i>
            </button>

            <div className="tr__map-controls-dropdown" style={{ display: isOpen ? 'flex' : 'none' }}>
                <p
                    className="tr__map-controls-dropdown-item"
                    onClick={(e) => {
                        e.stopPropagation();
                        onResetView();
                        setIsOpen(false);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onResetView();
                            setIsOpen(false);
                        }
                    }}
                >
                    <span>{t('main:map.controls.resetView')}</span>
                </p>

                <div className="tr__map-controls-dropdown-group-title">{t('main:map.controls.background')}:</div>

                {getProjectMapBaseLayers().map((layer) => {
                    const zoomHint = getBasemapZoomHintMessage(layer.shortname, currentZoom, t);
                    return (
                        <LayerOption
                            key={layer.shortname}
                            layerType={layer.shortname}
                            label={formatBasemapDisplayName(layer, t)}
                            isActive={currentLayer === layer.shortname}
                            disabled={zoomHint !== null}
                            onSelect={handleSelect}
                            suffix={
                                zoomHint ? (
                                    <span style={{ fontStyle: 'oblique', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                                        {zoomHint}
                                    </span>
                                ) : undefined
                            }
                        />
                    );
                })}

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
                                name="overlayColor"
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
                                name="overlayColor"
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
        </div>
    );
};

export default MapControlsPanel;
