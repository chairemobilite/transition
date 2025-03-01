/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import GeoJSON from 'geojson';

import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { TripRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';
import { validateTrQueryAttributes } from './TransitRoutingQueryAttributes';
import { validateAndCreateTripRoutingAttributes } from 'chaire-lib-common/lib/services/routing/RoutingAttributes';

export interface TransitRoutingQuery {
    routingName?: string;
    departureTimeSecondsSinceMidnight?: number;
    arrivalTimeSecondsSinceMidnight?: number;
    originGeojson: GeoJSON.Feature<GeoJSON.Point>;
    destinationGeojson: GeoJSON.Feature<GeoJSON.Point>;
}

interface TransitRoutingSingleCalcAttributes extends GenericAttributes {
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
}

export type TransitRoutingAttributes = TransitRoutingSingleCalcAttributes & Partial<TripRoutingQueryAttributes>;

const MAX_BATCH_ELEMENTS = 100;

const prepareTransitAttributes = (attributes: Partial<TransitRoutingAttributes>): Partial<TransitRoutingAttributes> => {
    // Initialize the colors to the preference.
    attributes.originLocationColor = Preferences.get('transit.routing.transit.originLocationColor');
    attributes.destinationLocationColor = Preferences.get('transit.routing.transit.destinationLocationColor');

    if (!attributes.savedForBatch) {
        attributes.savedForBatch = [];
    }
    return attributes;
};

export class TransitRouting extends ObjectWithHistory<TransitRoutingAttributes> {
    constructor(attributes: Partial<TransitRoutingAttributes>, isNew = false) {
        super(prepareTransitAttributes(attributes), isNew);
    }

    validate(): boolean {
        this._isValid = true;
        const routingModes = this.getAttributes().routingModes || [];
        const hasTransitRoutingMode = routingModes.includes('transit');
        this.errors = [];
        if (routingModes.length === 0) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:RoutingModesIsEmpty');
        }
        if (
            hasTransitRoutingMode &&
            _isBlank(this.getAttributes().odTripUuid) &&
            _isBlank(this.getAttributes().departureTimeSecondsSinceMidnight) &&
            _isBlank(this.getAttributes().arrivalTimeSecondsSinceMidnight)
        ) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DepartureAndArrivalTimeAreBlank');
        }
        if (
            hasTransitRoutingMode &&
            _isBlank(this.getAttributes().odTripUuid) &&
            !_isBlank(this.getAttributes().departureTimeSecondsSinceMidnight) &&
            !_isBlank(this.getAttributes().arrivalTimeSecondsSinceMidnight)
        ) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DepartureAndArrivalTimeAreBothNotBlank');
        }
        if (hasTransitRoutingMode) {
            const { valid: queryAttrValid, errors: queryAttrErrors } = validateTrQueryAttributes(this.getAttributes());
            if (!queryAttrValid) {
                this._isValid = false;
                this.errors.push(...queryAttrErrors);
            }
        }

        return this._isValid;
    }

    setOrigin(coordinates?: GeoJSON.Position, updatePreferences = true) {
        this.attributes.originGeojson =
            coordinates === undefined
                ? undefined
                : {
                    type: 'Feature',
                    id: 1,
                    properties: { id: 1, color: this.getAttributes().originLocationColor, location: 'origin' },
                    geometry: { type: 'Point', coordinates: coordinates }
                };
        if (updatePreferences) {
            this.updateRoutingPrefs();
        }
    }

    setDestination(coordinates?: GeoJSON.Position, updatePreferences = true) {
        this.attributes.destinationGeojson =
            coordinates === undefined
                ? undefined
                : {
                    type: 'Feature',
                    id: 1,
                    properties: {
                        id: 2,
                        color: this.getAttributes().destinationLocationColor,
                        location: 'destination'
                    },
                    geometry: { type: 'Point', coordinates: coordinates }
                };
        if (updatePreferences) {
            this.updateRoutingPrefs();
        }
    }

    hasOrigin() {
        return this.getAttributes().originGeojson !== undefined;
    }

    hasDestination() {
        return this.getAttributes().destinationGeojson !== undefined;
    }

    originDestinationToGeojson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
        const origin = this.getAttributes().originGeojson;
        if (origin) {
            features.push(origin);
        }
        const destination = this.getAttributes().destinationGeojson;
        if (destination) {
            features.push(destination);
        }
        return {
            type: 'FeatureCollection',
            features
        };
    }

    originLat() {
        const origin = this.getAttributes().originGeojson;
        if (origin) {
            return origin.geometry.coordinates[1];
        }
        return null;
    }

    originLon() {
        const origin = this.getAttributes().originGeojson;
        if (origin) {
            return origin.geometry.coordinates[0];
        }
        return null;
    }

    destinationLat() {
        const destination = this.getAttributes().destinationGeojson;
        if (destination) {
            return destination.geometry.coordinates[1];
        }
        return null;
    }

    destinationLon() {
        const destination = this.getAttributes().destinationGeojson;
        if (destination) {
            return destination.geometry.coordinates[0];
        }
        return null;
    }

    updateRoutingPrefs() {
        if (serviceLocator.socketEventManager) {
            const exportedAttributes = _cloneDeep(this._attributes) as Partial<TransitRoutingAttributes>;
            // Data and paths are volatile, do not save it in preferences
            exportedAttributes.data = {};
            delete exportedAttributes.id;
            Preferences.update(
                {
                    'transit.routing.transit': exportedAttributes
                },
                serviceLocator.socketEventManager
            );
        }
    }

    addElementForBatch(element: TransitRoutingQuery) {
        const found = this._attributes.savedForBatch.find(
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
        if (this._attributes.savedForBatch.length >= MAX_BATCH_ELEMENTS) {
            this._attributes.savedForBatch.splice(0, this._attributes.savedForBatch.length - MAX_BATCH_ELEMENTS + 1);
        }
        this._attributes.savedForBatch.push(element);
        this.updateRoutingPrefs();
    }

    resetBatchSelection() {
        this._attributes.savedForBatch.splice(0, this._attributes.savedForBatch.length);
        this.updateRoutingPrefs();
    }

    toTripRoutingQueryAttributes = (): TripRoutingQueryAttributes => {
        const attributes = validateAndCreateTripRoutingAttributes(this.getAttributes());
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
