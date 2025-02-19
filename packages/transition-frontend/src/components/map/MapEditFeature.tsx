/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { JSX } from 'react';
import { Layer, LayerProps } from '@deck.gl/core';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { TransitionMapLayerProps } from './layers/TransitionMapLayer';

export interface MapEditFeature {
    getEditMode: () => string;
    getMapEvents: () => MapEventHandlerDescription[];
    getLayers: (props: Omit<TransitionMapLayerProps, 'layerDescription' | 'events'>) => Layer<LayerProps>[];
    getMapComponent: () => JSX.Element | null;
}
