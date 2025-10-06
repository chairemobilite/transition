/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import GeoJSON from 'geojson';

import { BaseObject } from 'chaire-lib-common/lib/utils/objects/BaseObject';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { TripRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';
import { validateTrQueryAttributes } from './TransitRoutingQueryAttributes';
import { validateAndCreateTripRoutingAttributes } from 'chaire-lib-common/lib/services/routing/RoutingAttributes';

export type TransitRoutingQuery = {
    routingName?: string;
    departureTimeSecondsSinceMidnight?: number;
    arrivalTimeSecondsSinceMidnight?: number;
    originGeojson: GeoJSON.Feature<GeoJSON.Point>;
    destinationGeojson: GeoJSON.Feature<GeoJSON.Point>;
};

type TransitRoutingSingleCalcAttributes = {
    // FIXME Refactor to use timeSecondsSinceMidnight and timeType instead
    departureTimeSecondsSinceMidnight?: number;
    arrivalTimeSecondsSinceMidnight?: number;
    odTripUuid?: string;
    // TODO: Should we have a type for colors?
    // FIXME: Move to the form
    originLocationColor?: string;
    destinationLocationColor?: string;
    walkingSegmentsColor?: string;
    savedForBatch: TransitRoutingQuery[];
    routingPort?: number; // TODO deprecate this or allow different port for each routing mode
};

export type TransitRoutingAttributes = TransitRoutingSingleCalcAttributes & Partial<TripRoutingQueryAttributes>;

const MAX_BATCH_ELEMENTS = 100;

export class TransitRouting extends BaseObject<TransitRoutingAttributes> {
    constructor(attributes: Partial<TransitRoutingAttributes>) {
        super(attributes);
    }

    protected _prepareAttributes(attributes: Partial<TransitRoutingAttributes>): TransitRoutingAttributes {
        // Initialize the colors to the preference.
        if (attributes.originLocationColor === undefined) {
            attributes.originLocationColor = Preferences.get('transit.routing.transit.originLocationColor');
        }
        if (attributes.destinationLocationColor === undefined) {
            attributes.destinationLocationColor = Preferences.get('transit.routing.transit.destinationLocationColor');
        }
        if (!attributes.savedForBatch) {
            attributes.savedForBatch = [];
        }
        return attributes as TransitRoutingAttributes;
    }

    protected _validate(): [boolean, string[]] {
        let isValid = true;
        const errors: string[] = [];
        const routingModes = this.attributes.routingModes || [];
        const hasTransitRoutingMode = routingModes.includes('transit');
        if (routingModes.length === 0) {
            isValid = false;
            errors.push('transit:transitRouting:errors:RoutingModesIsEmpty');
        }
        if (
            hasTransitRoutingMode &&
            _isBlank(this.attributes.odTripUuid) &&
            _isBlank(this.attributes.departureTimeSecondsSinceMidnight) &&
            _isBlank(this.attributes.arrivalTimeSecondsSinceMidnight)
        ) {
            isValid = false;
            errors.push('transit:transitRouting:errors:DepartureAndArrivalTimeAreBlank');
        }
        if (
            hasTransitRoutingMode &&
            _isBlank(this.attributes.odTripUuid) &&
            !_isBlank(this.attributes.departureTimeSecondsSinceMidnight) &&
            !_isBlank(this.attributes.arrivalTimeSecondsSinceMidnight)
        ) {
            isValid = false;
            errors.push('transit:transitRouting:errors:DepartureAndArrivalTimeAreBothNotBlank');
        }
        if (hasTransitRoutingMode) {
            const { valid: queryAttrValid, errors: queryAttrErrors } = validateTrQueryAttributes(this.attributes);
            if (!queryAttrValid) {
                isValid = false;
                errors.push(...queryAttrErrors);
            }
        }

        return [isValid, errors];
    }

    setOrigin(coordinates?: GeoJSON.Position, updatePreferences = true) {
        this.set(
            'originGeojson',
            coordinates === undefined
                ? undefined
                : {
                    type: 'Feature',
                    id: 1,
                    properties: { id: 1, color: this.attributes.originLocationColor, location: 'origin' },
                    geometry: { type: 'Point', coordinates: coordinates }
                }
        );
        if (updatePreferences) {
            this.updateRoutingPrefs();
        }
    }

    setDestination(coordinates?: GeoJSON.Position, updatePreferences = true) {
        this.set(
            'destinationGeojson',
            coordinates === undefined
                ? undefined
                : {
                    type: 'Feature',
                    id: 1,
                    properties: {
                        id: 2,
                        color: this.attributes.destinationLocationColor,
                        location: 'destination'
                    },
                    geometry: { type: 'Point', coordinates: coordinates }
                }
        );
        if (updatePreferences) {
            this.updateRoutingPrefs();
        }
    }

    hasOrigin() {
        return this.attributes.originGeojson !== undefined;
    }

    hasDestination() {
        return this.attributes.destinationGeojson !== undefined;
    }

    originDestinationToGeojson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
        const origin = this.attributes.originGeojson;
        if (origin) {
            features.push(origin);
        }
        const destination = this.attributes.destinationGeojson;
        if (destination) {
            features.push(destination);
        }
        return {
            type: 'FeatureCollection',
            features
        };
    }

    originLat() {
        const origin = this.attributes.originGeojson;
        if (origin) {
            return origin.geometry.coordinates[1];
        }
        return null;
    }

    originLon() {
        const origin = this.attributes.originGeojson;
        if (origin) {
            return origin.geometry.coordinates[0];
        }
        return null;
    }

    destinationLat() {
        const destination = this.attributes.destinationGeojson;
        if (destination) {
            return destination.geometry.coordinates[1];
        }
        return null;
    }

    destinationLon() {
        const destination = this.attributes.destinationGeojson;
        if (destination) {
            return destination.geometry.coordinates[0];
        }
        return null;
    }

    updateRoutingPrefs() {
        if (serviceLocator.socketEventManager) {
            const exportedAttributes = _cloneDeep(this.attributes) as Partial<TransitRoutingAttributes>;
            Preferences.update(
                {
                    'transit.routing.transit': exportedAttributes
                },
                serviceLocator.socketEventManager
            );
        }
    }

    addElementForBatch(element: TransitRoutingQuery) {
        const found = this.attributes.savedForBatch.find(
            (obj) =>
                obj.routingName === element.routingName &&
                obj.arrivalTimeSecondsSinceMidnight === element.arrivalTimeSecondsSinceMidnight &&
                obj.departureTimeSecondsSinceMidnight === element.departureTimeSecondsSinceMidnight &&
                obj.originGeojson.geometry.coordinates[0] === element.originGeojson.geometry.coordinates[0] &&
                obj.originGeojson.geometry.coordinates[1] === element.originGeojson.geometry.coordinates[1] &&
                obj.destinationGeojson.geometry.coordinates[0] === element.destinationGeojson.geometry.coordinates[0] &&
                obj.destinationGeojson.geometry.coordinates[1] === element.destinationGeojson.geometry.coordinates[1]
        );
        if (found) {
            return;
        }
        if (this.attributes.savedForBatch.length >= MAX_BATCH_ELEMENTS) {
            this.attributes.savedForBatch.splice(0, this.attributes.savedForBatch.length - MAX_BATCH_ELEMENTS + 1);
        }
        this.attributes.savedForBatch.push(element);
        this.updateRoutingPrefs();
    }

    resetBatchSelection() {
        this.set('savedForBatch', []);
        this.updateRoutingPrefs();
    }

    toTripRoutingQueryAttributes = (): TripRoutingQueryAttributes => {
        const attributes = validateAndCreateTripRoutingAttributes(this.attributes);
        attributes.timeSecondsSinceMidnight = !_isBlank(this.attributes.departureTimeSecondsSinceMidnight)
            ? (this.attributes.departureTimeSecondsSinceMidnight as number)
            : !_isBlank(this.attributes.arrivalTimeSecondsSinceMidnight)
                ? (this.attributes.arrivalTimeSecondsSinceMidnight as number)
                : 0;
        attributes.timeType = !_isBlank(this.attributes.arrivalTimeSecondsSinceMidnight) ? 'arrival' : 'departure';
        return attributes;
    };
}

export default TransitRouting;
