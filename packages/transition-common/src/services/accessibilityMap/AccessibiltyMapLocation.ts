/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MapObjectAttributes } from 'chaire-lib-common/lib/utils/objects/MapObject';

export interface AccessibilityMapLocation extends MapObjectAttributes<GeoJSON.Point> {
    timeOfTrip: number;
    timeType: 'departure' | 'arrival';
}
