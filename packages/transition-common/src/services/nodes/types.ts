/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** Weather protection for stops/stations:
 * none: no protection (only a sign)
 * covered: overhead/sheltered/roof (bus shelter, tramway shelter, etc.)
 * indoor: indoor with climate control (train station)
 * unknown: used if the value is not set for the stop/station.
 */
export const weatherProtections = ['none', 'covered', 'indoor', 'unknown'] as const;

/** An enumeration of weather protections */
export type WeatherProtection = (typeof weatherProtections)[number];
