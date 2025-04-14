/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';

import { featureCollection as turfFeatureCollection, point as turfPoint } from '@turf/turf';

import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { validateTrQueryAttributes } from '../transitRouting/TransitRoutingQueryAttributes';
import { TransitQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';

export interface AccessibilityMapCalculationAttributes extends GenericAttributes {
    departureTimeSecondsSinceMidnight?: number;
    arrivalTimeSecondsSinceMidnight?: number;
    numberOfPolygons?: number;
    deltaSeconds?: number;
    deltaIntervalSeconds?: number;
    locationGeojson?: GeoJSON.Feature<GeoJSON.Point>;
    scenarioId?: string;
    locationColor?: string;
    placeName?: string;
}

export type AccessibilityMapAttributes = AccessibilityMapCalculationAttributes & TransitQueryAttributes;

class TransitAccessibilityMapRouting extends ObjectWithHistory<AccessibilityMapAttributes> {
    constructor(attributes: Partial<AccessibilityMapAttributes>, isNew = false) {
        super(attributes, isNew);

        // Initialize the colors to the preference.
        this.attributes.locationColor = Preferences.get('transit.routing.transitAccessibilityMap.locationColor');
        this.attributes.color = Preferences.get('transit.routing.transitAccessibilityMap.polygonColor');
    }

    validate() {
        const attributes = this.getAttributes();
        this._isValid = true;
        this.errors = [];
        if (
            _isBlank(attributes.departureTimeSecondsSinceMidnight) &&
            _isBlank(attributes.arrivalTimeSecondsSinceMidnight)
        ) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DepartureAndArrivalTimeAreBlank');
        }
        if (
            !_isBlank(attributes.departureTimeSecondsSinceMidnight) &&
            !_isBlank(attributes.arrivalTimeSecondsSinceMidnight)
        ) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DepartureAndArrivalTimeAreBothNotBlank');
        }

        // TODO Can we use the check from transit attributes instead of custom one?
        const maxTravelTime = attributes.maxTotalTravelTimeSeconds;
        if (!maxTravelTime) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:MaxTotalTravelTimeSecondsIsMissing');
        } else {
            if (isNaN(maxTravelTime)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:MaxTotalTravelTimeSecondsIsInvalid');
            }
        }

        const nbOfPolygons = attributes.numberOfPolygons;
        if (!nbOfPolygons) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:NumberOfPolygonsIsMissing');
        } else {
            if (isNaN(nbOfPolygons) || nbOfPolygons < 1) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:NumberOfPolygonsIsInvalid');
            } else if (this._isValid && maxTravelTime && nbOfPolygons * 60 > maxTravelTime) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:NumberOfPolygonsIsTooLarge');
            }
        }

        const deltaSeconds = attributes.deltaSeconds;
        if (deltaSeconds === undefined) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DeltaIsMissing');
        } else if (isNaN(deltaSeconds) || deltaSeconds < 0) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DeltaIsInvalid');
        } else if (deltaSeconds > 1800) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DeltaIsTooLarge');
        }

        const deltaIntervalSeconds = attributes.deltaIntervalSeconds;
        if (!deltaIntervalSeconds) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DeltaIntervalIsMissing');
        } else if (isNaN(deltaIntervalSeconds) || deltaIntervalSeconds < 0) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DeltaIntervalIsInvalid');
        } else if (deltaIntervalSeconds > 1800) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:DeltaIntervalIsTooLarge');
        }

        if (this._isValid && deltaIntervalSeconds && deltaSeconds) {
            if (deltaSeconds !== 0 && deltaSeconds % deltaIntervalSeconds !== 0) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:DeltaIntervalMustBeAMultipleOfDelta');
            }
        }

        // TODO Can we use the check from transit attributes instead of custom one?
        const maxAccessEgressTravelTimeSeconds = attributes.maxAccessEgressTravelTimeSeconds;
        if (!maxAccessEgressTravelTimeSeconds) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:MaxAccessEgressTravelTimeSecondsIsMissing');
        } else if (isNaN(maxAccessEgressTravelTimeSeconds) || maxAccessEgressTravelTimeSeconds < 60) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:MaxAccessEgressTravelTimeSecondsIsInvalid');
        } else if (this._isValid && maxAccessEgressTravelTimeSeconds > 1200) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:AccessEgressTravelTimeSecondsTooLarge');
        }

        // TODO Can we use the check from transit attributes instead of custom one?
        const walkingSpeedMps = attributes.walkingSpeedMps;
        if (!walkingSpeedMps) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:WalkingSpeedMpsIsMissing');
        } else if (isNaN(walkingSpeedMps) || walkingSpeedMps < 0) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:WalkingSpeedMpsIsInvalid');
        } else if (this._isValid && walkingSpeedMps > 10.0 / 3.6) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:WalkingSpeedMpsIsTooLarge');
        } else if (this._isValid && walkingSpeedMps < 2.0 / 3.6) {
            this._isValid = false;
            this.errors.push('transit:transitRouting:errors:WalkingSpeedMpsIsTooLow');
        }

        const { valid: queryAttrValid, errors: queryAttrErrors } = validateTrQueryAttributes(this.getAttributes());
        if (!queryAttrValid) {
            this._isValid = false;
            this.errors.push(...queryAttrErrors);
        }

        return this._isValid;
    }

    setLocation(coordinates, updatePreferences = true) {
        this.set(
            'locationGeojson',
            turfPoint(
                coordinates,
                {
                    id: 1,
                    color: this.get('locationColor'),
                    location: 'accessibilityMapLocation'
                },
                { id: 1 }
            )
        );
        if (updatePreferences) {
            this.updateRoutingPrefs();
        }
    }

    hasLocation() {
        return this.getAttributes().locationGeojson !== undefined;
    }

    locationToGeojson(): GeoJSON.FeatureCollection {
        const features: GeoJSON.Feature[] = [];
        const location = this.getAttributes().locationGeojson;
        if (location) {
            features.push(location);
        }
        return turfFeatureCollection(features);
    }

    locationLat() {
        return this.hasLocation() ? this.get('locationGeojson.geometry.coordinates[1]') : null;
    }

    locationLon() {
        return this.hasLocation() ? this.get('locationGeojson.geometry.coordinates[0]') : null;
    }

    updateRoutingPrefs() {
        if (serviceLocator.socketEventManager) {
            const exportedAttributes = _cloneDeep(this.attributes);
            if (exportedAttributes.data && exportedAttributes.data.results) {
                delete exportedAttributes.data.results;
            }
            Preferences.update(
                {
                    'transit.routing.transitAccessibilityMap': exportedAttributes
                },
                serviceLocator.socketEventManager
            );
        }
    }
}

export default TransitAccessibilityMapRouting;
