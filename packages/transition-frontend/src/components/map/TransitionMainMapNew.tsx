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
import { MapButton } from '../parts/MapButton';
import path from 'path';

const MainMap = ({ zoom, center, activeSection, children }: MainMapProps) => {
    const mapContainerRef = useRef<DeckGLRef>(null);

    const [vectorTilesLayerConfig, setVectorTilesLayerConfig] = useState(mapTileVectorLayerConfig(Preferences.current));
    const [rasterXYZLayerConfig, setRasterXYZLayerConfig] = useState(mapTileRasterXYZLayerConfig(Preferences.current));

    const [lineLayerIsVisible, setLineLayerIsVisible] = useState(true);
    const [nodeLayerIsVisible, setNodeLayerIsVisible] = useState(true);
    const [pathLayerIsVisible, setPathLayerIsVisible] = useState(true);
    const [data, setData] = useState<{ nodes: GeoJSON.FeatureCollection; paths: GeoJSON.FeatureCollection } | null>(
        null
    );

    const initialViewState: MapViewState = {
        longitude: center[0],
        latitude: center[1],
        zoom,
        pitch: 0,
        bearing: 0
    };

    useEffect(() => {
        serviceLocator.eventManager.emit('map.loaded');

        getData().then((data: { nodes: GeoJSON.FeatureCollection; paths: GeoJSON.FeatureCollection }) => {
            console.log('data', data);
            setData(data);
        });
    }, []);

    const deckGlLayers: Layer<LayerProps>[] = [];
    if (data !== null) {
        const layerNameById = {
            paths: 'transitPaths',
            nodes: 'transitNodes'
        };
        ['paths', 'nodes'].forEach((layerName) => {
            console.log('config', layersConfig, {
                ...layersConfig[layerNameById[layerName]],
                layerData: data[layerName],
                id: layerName
            });
            const layerResult = getLayer({
                layerDescription: {
                    visible: layerName === 'paths' ? lineLayerIsVisible : nodeLayerIsVisible,
                    configuration: layersConfig[layerNameById[layerName]],
                    layerData: data[layerName],
                    id: layerName
                },
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
                deckGlLayers.push(...layerResult);
            }
        });
        console.log('adding animated layer', data.paths.features[0]);
        // Select the first path
        deckGlLayers.push(
            ...getLayer({
                layerDescription: {
                    visible: pathLayerIsVisible,
                    configuration: layersConfig['transitPathsSelected'] as any,
                    layerData: {
                        type: 'FeatureCollection',
                        features: [data.paths.features[0]]
                    },
                    id: 'transitPathsSelected'
                },
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
            })!
        );
    }

    return (
        <section id="tr__main-map">
            {children}
            <div onContextMenu={(evt) => evt.preventDefault()}>
                <DeckGL
                    ref={mapContainerRef}
                    //viewState={viewState}
                    //controller={controllerOptions}
                    controller={true}
                    _animate={Preferences.get('map.enableMapAnimations', true)}
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
                    <div className="tr__map-button-container">
                        <MapButton
                            title="Changer visibilité des lignes"
                            key="mapbtn_resetView"
                            className={''}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(!lineLayerIsVisible);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
                        />
                        <MapButton
                            title="Changer visibilité des noeuds"
                            key="mapbtn_resetNodes"
                            className={''}
                            onClick={(e) => {
                                e.stopPropagation();
                                setNodeLayerIsVisible(!nodeLayerIsVisible);
                            }}
                            iconPath={'/dist/images/icons/transit/node_white.svg'}
                        />
                        <MapButton
                            title="Changer visibilité du trajet"
                            key="mapbtn_resetPath"
                            className={''}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPathLayerIsVisible(!pathLayerIsVisible);
                            }}
                            iconPath={'/dist/images/icons/interface/routing_white.svg'}
                        />
                    </div>
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

const getData = async (): Promise<{ nodes: GeoJSON.FeatureCollection; paths: GeoJSON.FeatureCollection }> => {
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
