/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MapboxGL from 'mapbox-gl';

// TODO: Make this independent of mapbox eventually. For now, we use mapbox
// types, as they are already defined, when we have more implementations, we can
// review this
type MapEventHandler = (e: MapboxGL.MapMouseEvent) => void;
type MapLayerEventHandler = (e: MapboxGL.MapLayerMouseEvent & MapboxGL.EventData) => void;

export type MapEventHandlerDescription =
    | {
          /** Type for handler that require selected features */
          type: 'layer';
          layerName: string;
          eventName: keyof MapboxGL.MapLayerEventType;
          /**
           * Condition function for which this handler applies. It will be checked
           * before actually calling the handler, so the handler can assume this is
           * true.
           *
           * TODO: This should depend on some application's state or context, that
           * should be passed here. For now, we pass the active section and the rest
           * can be accessed through the serviceLocator
           * */
          condition?: (activeSection: string) => boolean;
          /**
           * The event handler
           */
          handler: MapLayerEventHandler;
      }
    | {
          /** Type for handlers that only require the layer to be active */
          type: 'map';
          eventName: keyof MapboxGL.MapEventType;
          /**
           * Condition function for which this handler applies. It will be checked
           * before actually calling the handler, so the handler can assume this is
           * true.
           *
           * TODO: This should depend on some application's state or context, that
           * should be passed here. For now, we pass the active section and the rest
           * can be accessed through the serviceLocator
           * */
          condition?: (activeSection: string) => boolean;
          /**
           * The event handler
           */
          handler: MapEventHandler;
      };
