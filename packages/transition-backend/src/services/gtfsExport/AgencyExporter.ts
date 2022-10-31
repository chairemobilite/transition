/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import slugify from 'slugify';
import { unparse } from 'papaparse';

import { GtfsAgency } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Agency from 'transition-common/lib/services/agency/Agency';
import dbQueries from '../../models/db/transitAgencies.db.queries';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

const getAgencyGtfsId = (agency: Agency): string => {
    const acronym = agency.attributes.acronym;
    return acronym ? slugify(acronym) : agency.getId();
};

const objectToGtfs = (agency: Agency, includeCustomFields = false): GtfsAgency => {
    const agencyAttributes = agency.getAttributes();
    const gtfsFields: GtfsAgency = {
        agency_id: getAgencyGtfsId(agency), // slugified acronym or uuid, required
        agency_name: agencyAttributes.name || getAgencyGtfsId(agency), // required
        agency_url: agencyAttributes.data.gtfs?.agency_url || '', // required, TODO: add to database table (see issue #705)
        agency_timezone: agencyAttributes.data.gtfs?.agency_timezone || '', // required, TODO: add to database table (see issue #705)
        agency_lang: agencyAttributes.data.gtfs?.agency_lang, // optional, TODO: add to database table (see issue #705)
        agency_phone: agencyAttributes.data.gtfs?.agency_phone, // optional, TODO: add to database table (see issue #705)
        agency_fare_url: agencyAttributes.data.gtfs?.agency_fare_url, // optional, TODO: add to database table (see issue #705)
        agency_email: agencyAttributes.data.gtfs?.agency_email // optional, TODO: add to database table (see issue #705)
    };
    if (includeCustomFields) {
        gtfsFields.tr_agency_color = agencyAttributes.color;
        gtfsFields.tr_agency_description = agencyAttributes.description;
    }
    return gtfsFields;
};

export const exportAgency = async (
    agencyIds: string[],
    options: { directoryPath: string; quotesFct: (value: unknown) => boolean; includeTransitionFields?: boolean }
): Promise<
    | { status: 'success'; lineIds: string[]; agencyToGtfsId: { [key: string]: string } }
    | { status: 'error'; error: unknown }
> => {
    // Prepare the file stream
    const filePath = `${options.directoryPath}/${gtfsFiles.agency.name}`;
    fileManager.truncateFileAbsolute(filePath);
    const agencyStream = fs.createWriteStream(filePath);

    const agencies = await dbQueries.collection();
    const agencyCollection = new AgencyCollection([], {});
    agencyCollection.loadFromCollection(agencies);
    const lineIds: string[][] = [];
    const agencyToGtfsId: { [key: string]: string } = {};

    try {
        const gtfsAgencies = agencyIds.map((agencyId) => {
            const agency = agencyCollection.getById(agencyId);
            if (!agency) {
                throw new TrError(`Unknow agency for GTFS export ${agencyId}`, 'GTFSEXP0001');
            }
            lineIds.push(agency.attributes.line_ids || []);
            const gtfsAgency = objectToGtfs(agency, options.includeTransitionFields || false);
            agencyToGtfsId[agencyId] = gtfsAgency.agency_id;
            return gtfsAgency;
        });
        // Write the agencies to the gtfs file
        agencyStream.write(
            unparse(gtfsAgencies, {
                newline: '\n',
                quotes: options.quotesFct,
                header: true
            })
        );
        return { status: 'success', lineIds: lineIds.flatMap((ids) => ids), agencyToGtfsId };
    } catch (error) {
        return { status: 'error', error };
    } finally {
        agencyStream.end();
    }
};
