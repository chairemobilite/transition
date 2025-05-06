import React, { useEffect, useRef, useState } from 'react';
import { DeckGL, DeckGLRef } from '@deck.gl/react';
import { Map as MapLibreMap, Source as MapLibreSource, Layer as MapLibreLayer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapTileRasterXYZLayerConfig } from '../../config/layers.config';
import { mapTileVectorLayerConfig } from '../../config/layers.config';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { MainMapProps } from './types/TransitionMainMapTypes';
import type { Layer, LayerProps, MapViewState } from '@deck.gl/core';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import layersConfig from '../../config/layers.config';
import getLayer from './layers/TransitionMapLayer';

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

    const [deckGlLayers, setDeckGlLayers] = useState<Layer<LayerProps>[]>([]);

    useEffect(() => {
        serviceLocator.eventManager.emit('map.loaded');

        getData().then((data: { nodes: GeoJSON.FeatureCollection, paths: GeoJSON.FeatureCollection }) => {
            console.log('data', data);
            const layerNameById = {
                'paths': 'transitPaths',
                'nodes': 'transitNodes'
            };
            const deckGlLayers: Layer<LayerProps>[][] = ['paths', 'nodes'].map((layerName) => {
                console.log('config', layersConfig, { ...layersConfig[layerNameById[layerName]], layerData: data[layerName], id: layerName });
                const layerResult = getLayer({
                    layerDescription: { configuration: { type: layersConfig[layerNameById[layerName]].type }, ...layersConfig[layerNameById[layerName]], layerData: data[layerName], id: layerName },
                    zoom: 15,
                    events: undefined,
                    activeSection: activeSection,
                    setIsDragging: () => {
                        return;
                    },
                    mapCallbacks: {
                        pickMultipleObjects: () => [],
                        pickObject: () => null,
                        pixelsToCoordinates: () => [0, 0]
                    },
                    updateCount: 0
                });

                console.log('layerResult', layerResult);
                if (layerResult) {
                    return layerResult;
                } else {
                    return [];
                }
            });
            console.log('deckGlLayersFlat', deckGlLayers.flat());
            setDeckGlLayers(deckGlLayers.flat());
        });
    }, []);


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
                    layers={deckGlLayers}
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

const getCollection = async (collectionName: string): Promise<GeoJSON.FeatureCollection | undefined> => {
    return new Promise((resolve) => {
        let collection = serviceLocator.collectionManager.get(collectionName);
        if (!collection) {
            const fetchedData = () => {
                collection = serviceLocator.collectionManager.get(collectionName);
                serviceLocator.eventManager.off('collection.update.' + collectionName, fetchedData);
                resolve(collection.toGeojson());
            };
            serviceLocator.eventManager.on('collection.update.' + collectionName, fetchedData);
        } else {
            resolve(collection);
        }
    });
};

const getData = async (): Promise<{ nodes: GeoJSON.FeatureCollection, paths: GeoJSON.FeatureCollection }> => {
    const nodes = await getCollection('nodes');
    const paths = await getCollection('paths');
    return {
        nodes: nodes || {
            type: 'FeatureCollection',
            features: []
        },
        paths: paths || {
            type: 'FeatureCollection',
            features: []
        }
    };
};

export default MainMap;
