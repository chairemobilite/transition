import React, { useEffect, useRef, useState } from 'react';
import _cloneDeep from 'lodash/cloneDeep';
import { DeckGL, DeckGLRef } from '@deck.gl/react';
import { Map as MapLibreMap, Source as MapLibreSource, Layer as MapLibreLayer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapTileRasterXYZLayerConfig } from '../../config/layers.config';
import { mapTileVectorLayerConfig } from '../../config/layers.config';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { MainMapProps } from './types/TransitionMainMapTypes';
import type { Layer, MapViewState } from '@deck.gl/core';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import layersConfig from '../../config/layers.config';
import getLayer, { getGeojsonLayerNoAlpha, getLineLayerTmp, getPathLayerTmp, getPathLayerTmpBinary } from './layers/TransitionMapLayer';
import { MapButton } from '../parts/MapButton';
import { FeatureCollection, LineString, GeoJsonProperties } from 'geojson';


const MainMap = ({ zoom, center, activeSection, children }: MainMapProps) => {
    const mapContainerRef = useRef<DeckGLRef>(null);

    const [vectorTilesLayerConfig, setVectorTilesLayerConfig] = useState(mapTileVectorLayerConfig(Preferences.current));
    const [rasterXYZLayerConfig, setRasterXYZLayerConfig] = useState(mapTileRasterXYZLayerConfig(Preferences.current));

    const [lineLayerIsVisible, setLineLayerIsVisible] = useState(true);
    const [nodeLayerIsVisible, setNodeLayerIsVisible] = useState(true);
    const [pathLayerIsVisible, setPathLayerIsVisible] = useState(true);
    const [lineLayerStyle, setLineLayerStyle] = useState(1);
    const [data, setData] = useState<{ nodes: GeoJSON.FeatureCollection; paths: GeoJSON.FeatureCollection; lineData: any; pathData: any, lineNoDup: any; pathBinaryData: any } | null>(
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

        getData().then((data: { nodes: GeoJSON.FeatureCollection; paths: GeoJSON.FeatureCollection; lineData: any; pathData: any, lineNoDup: any; pathBinaryData: any; }) => {
            console.log('data', data);
            setData(data);
        });
    }, []);

    const deckGlLayers: Layer<any>[] = [];
    if (data !== null) {
        const layerNameById = {
            paths: 'transitPaths',
            nodes: 'transitNodes'
        };
        // Add node layer
        deckGlLayers.push(...getLayer({
            layerDescription: {
                visible: nodeLayerIsVisible,
                configuration: layersConfig['transitNodes'] as any,
                layerData: data.nodes,
                id: 'transitNodes'
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
        })!);
        // Add various versions of the line layer
        // Our path layer that is slow
        deckGlLayers.push(...getLayer({
            layerDescription: {
                visible: lineLayerIsVisible && lineLayerStyle === 1,
                configuration: layersConfig['transitPaths'] as any,
                layerData: data.paths,
                id: 'transitPaths'
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
        })!);
        // Line layer instead of geojson
        deckGlLayers.push(...getLineLayerTmp({
            layerDescription: {
                visible: lineLayerIsVisible && lineLayerStyle === 2,
                configuration: layersConfig['transitPaths'] as any,
                layerData: data.lineData,
                id: 'transitPathsLines'
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
        })!);
        // Same path layer, but with offsetted lines
        deckGlLayers.push(getPathLayerTmp({
            layerDescription: {
                visible: lineLayerIsVisible && lineLayerStyle === 3,
                configuration: layersConfig['transitPaths'] as any,
                layerData: data.pathData,
                id: 'transitPathsAsPath'
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
        })!);
        // Same path layer, but with binary data
        deckGlLayers.push(getPathLayerTmpBinary({
            layerDescription: {
                visible: lineLayerIsVisible && lineLayerStyle === 5,
                configuration: layersConfig['transitPaths'] as any,
                layerData: data.pathBinaryData,
                id: 'transitPathsAsPathBinary'
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
        })!);
        deckGlLayers.push(...getLineLayerTmp({
            layerDescription: {
                visible: lineLayerIsVisible && lineLayerStyle === 4,
                configuration: layersConfig['transitPaths'] as any,
                layerData: data.lineNoDup,
                id: 'transitPathsLinesNoDup'
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
        })!);
        // Our path layer that is slow
        deckGlLayers.push(getGeojsonLayerNoAlpha({
            layerDescription: {
                visible: lineLayerIsVisible && lineLayerStyle === 6,
                configuration: layersConfig['transitPaths'] as any,
                layerData: data.paths,
                id: 'transitPathsNoAlpha'
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
        })!);
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
                            className={`${lineLayerIsVisible ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(!lineLayerIsVisible);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
                        />
                        <MapButton
                            title="Changer visibilité des noeuds"
                            key="mapbtn_resetNodes"
                            className={`${nodeLayerIsVisible ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setNodeLayerIsVisible(!nodeLayerIsVisible);
                            }}
                            iconPath={'/dist/images/icons/transit/node_white.svg'}
                        />
                        <MapButton
                            title="Changer visibilité du trajet"
                            key="mapbtn_resetPath"
                            className={`${pathLayerIsVisible ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setPathLayerIsVisible(!pathLayerIsVisible);
                            }}
                            iconPath={'/dist/images/icons/interface/routing_white.svg'}
                        />
                        <MapButton
                            title="Couche geojson"
                            key="mapbtn_lineGeojson"
                            className={`${lineLayerStyle === 1 ? 'active' : ''}`}
                            style={{ border: `${lineLayerStyle === 1 ? '5px' : '1px'} solid green` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(true);
                                setLineLayerStyle(1);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
                        />
                        <MapButton
                            title="Couche Line"
                            key="mapbtn_lineLine"
                            className={`${lineLayerStyle === 2 ? 'active' : ''}`}
                            style={{ border: `${lineLayerStyle === 2 ? '5px' : '1px'} solid pink` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(true);
                                setLineLayerStyle(2);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
                        />
                        <MapButton
                            title="Couche Path"
                            key="mapbtn_linePath"
                            className={`${lineLayerStyle === 3 ? 'active' : ''}`}
                            style={{ border: `${lineLayerStyle === 3 ? '5px' : '1px'} solid blue` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(true);
                                setLineLayerStyle(3);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
                        />
                        <MapButton
                            title="Couche Line sans doublons"
                            key="mapbtn_lineLineNoDup"
                            className={`${lineLayerStyle === 4 ? 'active' : ''}`}
                            style={{ border: `${lineLayerStyle === 4 ? '5px' : '1px'} solid yellow` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(true);
                                setLineLayerStyle(4);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
                        />
                        <MapButton
                            title="Couche Path binaire"
                            key="mapbtn_linePathBinary"
                            className={`${lineLayerStyle === 5 ? 'active' : ''}`}
                            style={{ border: `${lineLayerStyle === 5 ? '5px' : '1px'} solid cyan` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(true);
                                setLineLayerStyle(5);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
                        />
                        <MapButton
                            title="Couche Geojson sans opacité"
                            key="mapbtn_geojsonNoAlpha"
                            className={`${lineLayerStyle === 5 ? 'active' : ''}`}
                            style={{ border: `${lineLayerStyle === 6 ? '5px' : '1px'} solid orange` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setLineLayerIsVisible(true);
                                setLineLayerStyle(6);
                            }}
                            iconPath={'/dist/images/icons/transit/lines_white.svg'}
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

const stringToColor = (hexStringColor: string): [number, number, number, number] => [
    parseInt(hexStringColor.substring(1, 3), 16),
    parseInt(hexStringColor.substring(3, 5), 16),
    parseInt(hexStringColor.substring(5, 7), 16),
    hexStringColor.length === 9 ? parseInt(hexStringColor.substring(7, 9), 16) : 255
];

const pathToLineLayerDataNoDup = (pathLayerData: GeoJSON.FeatureCollection<GeoJSON.LineString>): { start: number[]; end: number[]; color:  [number, number, number, number] }[] => {
    const segments: { start: number[]; end: number[]; color: [number, number, number, number] }[] = [];

    const segmentExists = (() => {
        const segmentIdx: { [segmentKey: string]: number } = { };

        const addSegment = (start: number[], end: number[], idx) => {
            const key = `${start[0]},${start[1]}|${end[0]},${end[1]}`;
            segmentIdx[key] = idx;
        };

        const checkSegment = (start: number[], end: number[]) => {
            const key = `${start[0]},${start[1]}|${end[0]},${end[1]}`;
            return segmentIdx[key];
        };

        return { addSegment, checkSegment };
    })();

    let totalSegments = 0;
    pathLayerData.features.forEach((feature) => {
        if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 1) {
            totalSegments += feature.geometry.coordinates.length - 1;
            const coordinates = feature.geometry.coordinates;
            for (let i = 0; i < coordinates.length - 1; i++) {
                const segmentIdx = segmentExists.checkSegment(coordinates[i], coordinates[i + 1]);
                if (segmentIdx === undefined) {
                    segmentExists.addSegment(coordinates[i], coordinates[i + 1], segments.length);
                    segments.push({
                        start: coordinates[i],
                        end: coordinates[i + 1],
                        color: typeof feature.properties?.color === 'string' && feature.properties.color.startsWith('#')
                            ? stringToColor(feature.properties.color)
                            : [0, 0, 0, 255]
                    });
                } else {
                    segments[segmentIdx].color = typeof feature.properties?.color === 'string' && feature.properties.color.startsWith('#')
                    ? stringToColor(feature.properties.color)
                    : [0, 0, 0, 255]
                }
            }
        }
    });
    console.log('number of segments', totalSegments, segments.length);

    return segments;
}

const pathToLineLayerData = (pathLayerData: GeoJSON.FeatureCollection<GeoJSON.LineString>): { start: number[]; end: number[]; color:  [number, number, number, number] }[] => {
    const segments: { start: number[]; end: number[]; color: [number, number, number, number] }[] = [];

    pathLayerData.features.forEach((feature) => {
        if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 1) {
            const coordinates = feature.geometry.coordinates;
            const color = feature.properties?.color; 
            for (let i = 0; i < coordinates.length - 1; i++) {
                segments.push({
                    start: coordinates[i],
                    end: coordinates[i + 1],
                    color: typeof color === 'string' && color.startsWith('#') ? stringToColor(color) : [0, 0, 0, 255]
                });
            }
        }
    });

    return segments;
}

function pathToPathLayerData(pathLayerData: FeatureCollection<LineString, GeoJsonProperties>) {
    const paths: { path: number[][]; color: [number, number, number, number] }[] = [];

    pathLayerData.features.forEach((feature) => {
        if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 1) {
            const color = feature.properties?.color; 
            paths.push({
                color: typeof color === 'string' && color.startsWith('#') ? stringToColor(color) : [0, 0, 0, 255],
                path: feature.geometry.coordinates
            });
        }
    });

    return paths;
}

function pathToBinaryData(pathLayerData) {
    // Flatten PATH_DATA into several binary buffers. This is typically done on the server or in a worker
    // [-122.4, 37.7, -122.5, 37.8, -122.6, 37.85, ...]
    const positions = new Float64Array(pathLayerData.map(d => d.path).flat(2));
    // The color attribute must supply one color for each vertex
    // [255, 0, 0, 255, 0, 0, 255, 0, 0, ...]
    const colors = new Uint8Array(pathLayerData.map(d => d.path.map(_ => d.color)).flat(2));
    // The "layout" that tells PathLayer where each path starts
    const startIndices = new Uint32Array(pathLayerData.reduce((acc, d) => {
        const lastIndex = acc[acc.length - 1];
        acc.push(lastIndex + d.path.length);
            return acc;
        }, [0]));
    console.log('startIndeices', startIndices);
        
    return {
        length: pathLayerData.length,
        startIndices: startIndices, // this is required to render the paths correctly!
        attributes: {
            getPath: {value: positions, size: 2},
            getColor: {value: colors, size: 4}
        }
    };
};

const getData = async (): Promise<{ nodes: GeoJSON.FeatureCollection; paths: GeoJSON.FeatureCollection, lineData: any, pathData: any, lineNoDup: any, pathBinaryData: any }> => {
    const nodes = await getCollection('nodes');
    const paths = await getCollection('paths');
    const lineData = pathToLineLayerData(paths as GeoJSON.FeatureCollection<GeoJSON.LineString>);
    const lineNoDup = pathToLineLayerDataNoDup(paths as GeoJSON.FeatureCollection<GeoJSON.LineString>);
    const pathData = pathToPathLayerData(paths as GeoJSON.FeatureCollection<GeoJSON.LineString>);
    const pathBinaryData = pathToBinaryData(pathData);
    return {
        nodes: nodes || {
            type: 'FeatureCollection',
            features: []
        },
        paths: paths || {
            type: 'FeatureCollection',
            features: []
        },
        lineData,
        pathData,
        lineNoDup,
        pathBinaryData
    };
};

export default MainMap;
