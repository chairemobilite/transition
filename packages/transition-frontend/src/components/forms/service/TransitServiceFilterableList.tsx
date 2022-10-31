/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import TransitServiceFilter, { TransitServiceFilterFields } from './TransitServiceFilter';
import Service from 'transition-common/lib/services/service/Service';
import { InputCheckbox } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import { getServiceLabel, serviceMatches } from '../../../services/transitService/TransitServiceUtils';

export interface TransitServiceFilterableProps extends WithTranslation {
    id: string;
    disabled?: boolean;
    value?: string[];
    defaultValue?: string[];
    columns?: number;
    onValueChange: (e: any) => void;
    allowSelectAll?: boolean;
    services: Service[];
}

const TransitServiceFilterableList: React.FunctionComponent<TransitServiceFilterableProps> = (
    props: TransitServiceFilterableProps
) => {
    const [currentFilter, setCurrentFilter] = useState<TransitServiceFilterFields>({});
    let servicesChoices: { value: string; label: string }[] = [];

    servicesChoices = props.services
        .filter((service) => serviceMatches(service, currentFilter))
        .map((service) => {
            return {
                value: service.id,
                label: getServiceLabel(service, props.t)
            };
        });

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

export default withTranslation(['transit', 'main'])(TransitServiceFilterableList);
