/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';

type ServiceChoice = {
    value: string;
    label: string;
};

type SegmentTimesToolbarProps = {
    selectedServiceId: string;
    serviceChoices: ServiceChoice[];
    onServiceChange: (value: string) => void;
};

const SegmentTimesToolbar: React.FunctionComponent<SegmentTimesToolbarProps> = ({
    selectedServiceId,
    serviceChoices,
    onServiceChange
}) => {
    const { t } = useTranslation('transit');

    return (
        <div className="toolbar">
            <span className="toolbar-spacer" />

            {/* Service selector */}
            <span className="toolbar-service-group">
                <InputWrapper twoColumns={false} label={t('transit:transitService:Service')}>
                    <InputSelect
                        id="segmentTimesByPeriod_service"
                        value={selectedServiceId}
                        choices={serviceChoices}
                        onValueChange={(e) => onServiceChange(e.target.value)}
                        noBlank={true}
                    />
                </InputWrapper>
            </span>
        </div>
    );
};

export default SegmentTimesToolbar;
