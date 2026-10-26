/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { getAllTimezones } from 'countries-and-timezones';

/**
 * Time zone choices for an agency: every name of the IANA time zone
 * database, which GTFS uses for agency_timezone. Aliases, like
 * America/Montreal, are included because GTFS feeds still use them. Their
 * label shows the time zone they point to.
 */
export const timezoneChoices: { label: string; value: string }[] = Object.values(getAllTimezones({ deprecated: true }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((timezone) => ({
        label: timezone.aliasOf ? `${timezone.name} (${timezone.aliasOf})` : timezone.name,
        value: timezone.name
    }));
