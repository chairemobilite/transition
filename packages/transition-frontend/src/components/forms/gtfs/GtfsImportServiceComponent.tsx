/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import Service, { serviceDays } from 'transition-common/lib/services/service/Service';
import { ServiceImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { InputCheckbox } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import TransitServiceFilter, { TransitServiceFilterFields } from '../service/TransitServiceFilter';
import { serviceMatches } from '../../../services/transitService/TransitServiceUtils';

export interface GtfsImportServiceComponentProps extends WithTranslation {
    id: string;
    disabled?: boolean;
    value?: string[];
    defaultValue?: string[];
    columns?: number;
    onValueChange: (e: any) => void;
    allowSelectAll?: boolean;
    services: ServiceImportData[];
}

const GtfsImportServiceComponent: React.FunctionComponent<GtfsImportServiceComponentProps> = (
    props: GtfsImportServiceComponentProps
) => {
    const [currentFilter, setCurrentFilter] = useState<TransitServiceFilterFields>({});

    // Filter services if there are filter keys, otherwise take the list as is, to avoid creating new objects
    const filteredServices =
        Object.keys(currentFilter).length > 0
            ? props.services.filter((serviceData) =>
                serviceMatches(new Service(serviceData.service, true), currentFilter)
            )
            : props.services;
    const servicesChoices =
        filteredServices.map((serviceData) => {
            let label = serviceData.service.name;
            const serviceWeekdays: string[] = [];
            for (let i = 0, count = serviceDays.length; i < count; i++) {
                if (serviceData.service[serviceDays[i]] === 1) {
                    serviceWeekdays.push(props.t(`main:dateTime:weekdaysAbbr:${serviceDays[i]}`));
                }
            }
            if (serviceWeekdays.length > 0) {
                label += ` (${serviceWeekdays.join(', ')})`;
            }
            if (serviceData.service.start_date && serviceData.service.end_date) {
                label += ` [${serviceData.service.start_date} -> ${serviceData.service.end_date}]`;
            } else if (serviceData.service.start_date) {
                label += ` [${serviceData.service.start_date} -> ...]`;
            }
            return {
                value: serviceData.service.name || '',
                label: label
            };
        }) || [];

    return (
        <React.Fragment>
            <TransitServiceFilter onFilterUpdate={setCurrentFilter} currentFilter={currentFilter} />
            <InputCheckbox
                choices={servicesChoices}
                disabled={props.disabled}
                id={props.id}
                value={props.value}
                allowSelectAll={props.allowSelectAll}
                onValueChange={props.onValueChange}
            />
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(GtfsImportServiceComponent);
