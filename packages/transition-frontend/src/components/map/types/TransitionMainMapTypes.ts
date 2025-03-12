import { Layer } from 'deck.gl';
import { LayerProps } from 'react-map-gl';

import { ControllerOptions } from '@deck.gl/core/dist/controllers/controller';
import { MapEventsManager } from '../../../services/map/MapEventsManager';
import { TransitionMapController } from '../../../services/map/TransitionMapController';
import { MapCallbacks } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';

export type MapEditTool = {
    getLayers: (args: {
        viewState: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };
        activeSection: string;
        setIsDragging: (isDragging: boolean) => void;
        mapCallbacks: MapCallbacks;
        updateCount: number;
    }) => Layer<LayerProps>[];
    getEditMode: () => string;
    getMapComponent: () => React.ReactNode;
    getMapEvents: () => any[];
};

export type TransitionMapControllerProps = ControllerOptions & {
    type: typeof TransitionMapController;
    mapEventsManager: MapEventsManager;
    mapCallbacks: MapCallbacks;
    activeSection: string;
};

export type MainMapProps = {
    zoom: number;
    center: [number, number];
    activeSection: string;
    children: React.ReactNode;
};
