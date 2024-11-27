/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { AgencyImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';

export interface GtfsExistingAgencyImportProps extends WithTranslation {
    id: string;
    onAgencyDataUpdated: (agency: AgencyImportData) => void;
    agency: AgencyImportData;
}

const GtfsExistingAgencyImport: React.FunctionComponent<GtfsExistingAgencyImportProps> = (
    props: GtfsExistingAgencyImportProps
) => {
    const actionChoices = [
        {
            value: 'replace'
        },
        {
            value: 'mergeAndIgnore'
        },
        {
            value: 'mergeAndReplace'
        },
        {
            value: 'create'
        }
    ];

    const agencyAction = props.agency.agencyAction || { action: 'create', agencyId: props.agency.agency.agency_id };

    const onActionValueChange = React.useCallback(
        (e) => {
            const prevValue = agencyAction.action;
            const newAction = e.target.value;
            props.agency.agencyAction = {
                action: newAction,
                agencyId:
                    prevValue === 'create' && newAction !== 'create'
                        ? props.agency.existingAgencies[0].id
                        : newAction === 'create' && prevValue !== 'create'
                            ? props.agency.agency.agency_id
                            : agencyAction.agencyId
            };
            props.onAgencyDataUpdated(props.agency);
        },
        [props.agency.agencyAction]
    );

    const onAgencyIdChange = React.useCallback(
        (value: string) => {
            props.agency.agencyAction = {
                ...agencyAction,
                agencyId: value
            };
            props.onAgencyDataUpdated(props.agency);
        },
        [props.agency.agencyAction]
    );

    const subQuestionWidget =
        agencyAction.action === 'create' ? (
            <div className="apptr__form-input-container">
                <label className="_flex">{props.t('transit:gtfs:NewAgencyName')}</label>
                <InputString
                    id={`${props.id}_string`}
                    value={agencyAction.agencyId}
                    onValueUpdated={(value) => onAgencyIdChange(value.value)}
                />
            </div>
        ) : (
            <div className="apptr__form-input-container">
                <label className="_flex">
                    {props.t('transit:gtfs:SelectExistingAgency', { agency: props.agency.agency.agency_id })}
                </label>
                <InputSelect
                    choices={props.agency.existingAgencies.map((agency) => ({
                        value: agency.id,
                        label: agency.acronym
                    }))}
                    disabled={false}
                    id={`${props.id}_choice`}
                    value={agencyAction.agencyId}
                    onValueChange={(e) => onAgencyIdChange(e.target.value)}
                    noBlank={true}
                />
            </div>
        );

    return (
        <div className={'tr__form-filter-box'}>
            <div className="apptr__form-input-container">
                <label className="_flex">
                    {props.t('transit:gtfs:AgencyExists', { agency: props.agency.agency.agency_id })}
                </label>
                <InputRadio
                    choices={actionChoices}
                    disabled={false}
                    id={props.id}
                    value={agencyAction.action}
                    onValueChange={onActionValueChange}
                    localePrefix={'transit:gtfs'}
                    t={props.t}
                />
            </div>
            {subQuestionWidget}
        </div>
    );
};

export default withTranslation('transit')(GtfsExistingAgencyImport);
