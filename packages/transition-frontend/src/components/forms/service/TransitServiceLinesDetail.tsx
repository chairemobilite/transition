/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Service from 'transition-common/lib/services/service/Service';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitServiceLineItem from '../service/TransitServiceLineItem';
import ButtonList from '../../parts/ButtonList';

interface TransitServiceLinesDetailProps {
    service: Service;
}

const TransitServiceLinesDetail: React.FunctionComponent<TransitServiceLinesDetailProps> = ({ service }) => {
    const lines = React.useMemo(() => {
        const lineCollection = serviceLocator.collectionManager.get('lines');
        if (!lineCollection) return [];

        return lineCollection
            .getFeatures()
            .filter((line) => line.attributes.service_ids?.includes(service.getId()))
            .sort((lineA, lineB) => lineA.toString().localeCompare(lineB.toString()));
    }, [service]);

    return (
        <div className="tr__form-service-lines">
            <ButtonList key={`button_list_${service.getId()}`}>
                {lines.map((line) => (
                    <TransitServiceLineItem key={`line_${line.getId()}`} line={line} />
                ))}
            </ButtonList>
        </div>
    );
};

export default TransitServiceLinesDetail;
