import React, { useRef, useState } from 'react';
import { DeckGL, DeckGLRef } from '@deck.gl/react';
import { Map as MapLibreMap, Source as MapLibreSource, Layer as MapLibreLayer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapTileRasterXYZLayerConfig } from '../../config/layers.config';
import { mapTileVectorLayerConfig } from '../../config/layers.config';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { MainMapProps } from './types/TransitionMainMapTypes';
import type { MapViewState } from '@deck.gl/core';

const MainMap = ({ zoom, center, activeSection, children }: MainMapProps) => {
    const mapContainerRef = useRef<DeckGLRef>(null);

    const [vectorTilesLayerConfig, setVectorTilesLayerConfig] = useState(mapTileVectorLayerConfig(Preferences.current));
    const [rasterXYZLayerConfig, setRasterXYZLayerConfig] = useState(mapTileRasterXYZLayerConfig(Preferences.current));

    const initialViewState: MapViewState = {
        longitude: center[0],
        latitude: center[1],
        zoom,
        pitch: 0,
        bearing: 0
    };

    return (
        <section id="tr__main-map">
            {children}
            <div onContextMenu={(evt) => evt.preventDefault()}>
                <DeckGL
                    ref={mapContainerRef}
                    //viewState={viewState}
                    //controller={controllerOptions}
                    controller={true}
                    _animate={false}
                    layers={[]}
                    initialViewState={initialViewState}
                    //onViewStateChange={onViewStateChange}
                    //getTooltip={onTooltip}
                    //onResize={onResize}
                    useDevicePixels={true} // Improve rendering quality
                >
                    <MapLibreMap
                        mapStyle={vectorTilesLayerConfig.styleUrl}
                        renderWorldCopies={true} // Improve panning experience
                        reuseMaps={true} // Reuse WebGL context for better performance
                    >
                        {rasterXYZLayerConfig.url && rasterXYZLayerConfig.opacity > 0 && (
                            <MapLibreSource
                                id="raster-tiles"
                                type="raster"
                                tiles={[rasterXYZLayerConfig.url]}
                                tileSize={rasterXYZLayerConfig.tileSize}
                                minzoom={rasterXYZLayerConfig.minzoom}
                                maxzoom={rasterXYZLayerConfig.maxzoom}
                            >
                                <MapLibreLayer
                                    id="raster-layer"
                                    type="raster"
                                    paint={{
                                        'raster-opacity': rasterXYZLayerConfig.opacity
                                    }}
                                />
                            </MapLibreSource>
                        )}
                    </MapLibreMap>
                </DeckGL>
            </div>
        </section>
    );
};

export default MainMap;
