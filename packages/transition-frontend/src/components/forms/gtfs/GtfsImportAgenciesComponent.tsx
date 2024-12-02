/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { AgencyImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { InputCheckbox } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import GtfsExistingAgencyImport from './GtfsExistingAgencyImport';

export interface GtfsImportAgenciesComponentProps {
    id: string;
    disabled?: boolean;
    value?: string[];
    defaultValue?: string[];
    columns?: number;
    onSelectionChange: (e: any) => void;
    onAgencyDataUpdated: (agency: AgencyImportData[]) => void;
    allowSelectAll?: boolean;
    agencies: AgencyImportData[];
}

const GtfsImportAgenciesComponent: React.FunctionComponent<GtfsImportAgenciesComponentProps> = (
    props: GtfsImportAgenciesComponentProps
) => {
    const agenciesChoices = props.agencies.map((agencyData) => {
        return {
            value: agencyData.agency.agency_id,
            label: agencyData.agency.agency_name
        };
    });

    const updateAgency = (agency: AgencyImportData) => {
        const replaceIndex = props.agencies.findIndex((a) => a.agency.agency_id === agency.agency.agency_id);
        if (replaceIndex !== -1) {
            props.agencies[replaceIndex] = agency;
            props.onAgencyDataUpdated(props.agencies);
        }
    };

    const agenciesEditionWidgets = props.agencies
        .filter((agency) => agency.selected === true && agency.existingAgencies.length > 0)
        .map((agency) => (
            <GtfsExistingAgencyImport
                key={`${props.id}_${agency.agency.agency_id}`}
                id={`${props.id}_${agency.agency.agency_id}`}
                agency={agency}
                onAgencyDataUpdated={updateAgency}
            />
        ));

    return (
        <React.Fragment>
            <InputCheckbox
                choices={agenciesChoices}
                disabled={props.disabled}
                id={props.id}
                value={props.value}
                onValueChange={props.onSelectionChange}
                allowSelectAll={props.allowSelectAll}
            />
            {agenciesEditionWidgets}
        </React.Fragment>
    );
};

export default GtfsImportAgenciesComponent;
