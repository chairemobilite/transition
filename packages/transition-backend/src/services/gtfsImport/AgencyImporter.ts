/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Agency, { AgencyAttributes } from 'transition-common/lib/services/agency/Agency';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { AgencyImportData, GtfsImportData, GtfsAgency } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { getUniqueAgencyAcronym } from 'transition-common/lib/services/agency/AgencyUtils';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
// eslint-disable-next-line n/no-unpublished-import
import type { Agency as GtfsAgencySpec } from 'gtfs-types';
import { GtfsObjectImporter } from './GtfsObjectImporter';
import { formatColor, GtfsInternalData } from './GtfsImportTypes';

export class AgencyImporter implements GtfsObjectImporter<AgencyImportData, Agency> {
    public static DEFAULT_AGENCY_ACRONYM = 'single';

    private _filePath: string;
    private _existingAgencies: AgencyCollection;

    constructor(options: { directoryPath: string; agencies: AgencyCollection }) {
        this._filePath = _isBlank(options.directoryPath)
            ? gtfsFiles.agency.name
            : `${options.directoryPath}/${gtfsFiles.agency.name}`;
        this._existingAgencies = options.agencies;
    }

    /**
     * Parse the data in the GTFS agency file and prepare it for presentation to
     * the user. It also validates if the agency already exists in the
     * application, so that the user may choose what to do with existing
     * agencies.
     *
     * @return {*}  {Promise<AgencyImportData[]>}
     * @memberof AgencyImporter
     */
    async prepareImportData(): Promise<AgencyImportData[]> {
        const agencies: AgencyImportData[] = [];
        await parseCsvFile(
            this._filePath,
            (data, rowNum) => {
                const agencyData = data as GtfsAgencySpec;
                if (_isBlank(agencyData.agency_id) && rowNum > 1) {
                    throw 'No agency ID and more than one agency in file';
                }
                const { agency_id, agency_name, ...agencyRest } = agencyData;
                const actualAgencyId = _isBlank(agency_id)
                    ? AgencyImporter.DEFAULT_AGENCY_ACRONYM
                    : (agency_id as string);

                // Does this agency exists
                const existingAgencies = this._existingAgencies
                    .getFeatures()
                    .filter(
                        (existing) =>
                            existing.attributes.acronym === actualAgencyId ||
                            actualAgencyId === existing.attributes.data?.gtfs?.agency_id
                    )
                    .map((existing) => ({
                        id: existing.getId(),
                        acronym: existing.attributes.acronym
                    }));

                // Default behavior is to overwrite the first matching agency.
                agencies.push({
                    agency: { agency_id: actualAgencyId, agency_name, ...agencyRest },
                    existingAgencies,
                    agencyAction:
                        existingAgencies.length === 0
                            ? undefined
                            : {
                                action: 'replace',
                                agencyId: existingAgencies[0].id
                            }
                });
            },
            { header: true }
        );
        return agencies;
    }

    async import(importData: GtfsImportData, internalData: GtfsInternalData): Promise<{ [key: string]: Agency }> {
        const importObjects: AgencyImportData[] = importData.agencies;
        const importedAgencies: { [key: string]: Agency } = {};
        const agencyDefaultColor = importData.agencies_color;

        const agencyImportPromises = importObjects
            .filter((importObject) => importObject.selected === true)
            .map(async (importObject) => {
                importedAgencies[importObject.agency.agency_id] = await this.importAgency(
                    importObject,
                    internalData,
                    agencyDefaultColor
                );
            });
        await Promise.allSettled(agencyImportPromises);
        return importedAgencies;
    }

    private gtfsToObjectAttributes(gtfsObject: GtfsAgency, agencyDefaultColor?: string): Partial<AgencyAttributes> {
        const agencyAttributes: Partial<AgencyAttributes> = {
            acronym: gtfsObject.agency_id,
            name: gtfsObject.agency_name,
            data: {
                gtfs: gtfsObject
            },
            color: formatColor(gtfsObject.tr_agency_color, agencyDefaultColor)
        };
        if (gtfsObject.tr_agency_description) {
            agencyAttributes.description = gtfsObject.tr_agency_description;
        } else {
            // Create the description string from agency data
            const descriptionStrings: string[] = [];
            if (gtfsObject.agency_url) {
                descriptionStrings.push(gtfsObject.agency_url);
            }
            if (gtfsObject.agency_phone) {
                descriptionStrings.push(gtfsObject.agency_phone);
            }
            if (gtfsObject.agency_fare_url) {
                descriptionStrings.push(gtfsObject.agency_fare_url);
            }
            if (descriptionStrings.length > 0) {
                agencyAttributes.description = descriptionStrings.join(', ');
            }
        }
        return agencyAttributes;
    }

    private async importAgency(
        agencyToImport: AgencyImportData,
        internalData: GtfsInternalData,
        agencyDefaultColor?: string
    ): Promise<Agency> {
        const agencyAction = agencyToImport.agencyAction || {
            action: 'create',
            agencyId: agencyToImport.agency.agency_id
        };
        const agencyAttributes = this.gtfsToObjectAttributes(agencyToImport.agency, agencyDefaultColor);
        switch (agencyAction.action) {
        case 'replace': {
            // Delete the agency to replace
            const agencyToReplace = this._existingAgencies
                .getFeatures()
                .find((existing) => existing.getId() === agencyAction.agencyId);
            const newAcronym = agencyToReplace ? agencyToReplace.attributes.acronym : undefined;
            if (agencyToReplace) {
                // Found the agency to replace, delete it and create it again
                await agencyToReplace.delete(serviceLocator.socketEventManager);
            }
            return await this.createNewAgency(agencyAttributes, newAcronym);
        }
        case 'mergeAndIgnore':
        case 'mergeAndReplace': {
            const agencyToMerge = this._existingAgencies
                .getFeatures()
                .find((existing) => existing.getId() === agencyAction.agencyId);
            if (agencyToMerge) {
                if (agencyAction.action === 'mergeAndIgnore') {
                    internalData.doNotUpdateAgencies.push(agencyToMerge.getId());
                }
                // Found agency to merge. Update if requested
                return agencyAction.action === 'mergeAndReplace'
                    ? await this.updateAgency(agencyToMerge, agencyAttributes)
                    : agencyToMerge;
            }
            console.error(
                'Agency was supposed to be merged with existing, but it was not found. Creating a new one instead.'
            );
            return await this.createNewAgency(agencyAttributes);
        }
        case 'create':
            return await this.createNewAgency(agencyAttributes, agencyAction.agencyId);
        }
    }

    private async updateAgency(agency: Agency, agencyAttributes: Partial<AgencyAttributes>): Promise<Agency> {
        Object.keys(agencyAttributes).forEach((attrib) => {
            if (attrib !== 'acronym') {
                agency.attributes[attrib] = agencyAttributes[attrib];
            }
        });
        await agency.save(serviceLocator.socketEventManager);
        return agency;
    }

    private async createNewAgency(agencyAttributes: Partial<AgencyAttributes>, newAcronym?: string) {
        const uniqueAcronym = getUniqueAgencyAcronym(
            this._existingAgencies,
            newAcronym || agencyAttributes.acronym || AgencyImporter.DEFAULT_AGENCY_ACRONYM
        );
        agencyAttributes.acronym = uniqueAcronym;
        const newAgency = new Agency(agencyAttributes, true);
        // TODO Save only at the end of the whole import, with a batch save
        await newAgency.save(serviceLocator.socketEventManager);
        return newAgency;
    }
}

export default AgencyImporter;
