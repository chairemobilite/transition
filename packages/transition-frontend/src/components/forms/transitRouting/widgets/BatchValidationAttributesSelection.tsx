/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { TransitValidationDemandFromCsvAttributes } from 'transition-common/lib/services/transitDemand/TransitValidationDemandFromCsv';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import BatchAttributesSelection from './BatchAttributesSelection';
import * as BatchAttributeSelectionWidgets from '../../transitCalculation/widgets/AttributeSelectionWidget';

export interface BatchValidationAttributesSelectionComponentProps extends WithTranslation {
    attributes: TransitValidationDemandFromCsvAttributes;
    csvAttributes: string[];
    onValueChange: (
        path: keyof TransitValidationDemandFromCsvAttributes,
        newValue: { value: any; valid?: boolean }
    ) => void;
}

const BatchValidationAttributesSelectionComponent: React.FunctionComponent<
    BatchValidationAttributesSelectionComponentProps
> = (props: BatchValidationAttributesSelectionComponentProps) => {
    return (
        <React.Fragment>
            <BatchAttributesSelection
                attributes={props.attributes}
                csvAttributes={props.csvAttributes}
                onValueChange={props.onValueChange}
            />
            <BatchAttributeSelectionWidgets.CsvAttributeSelectionWidget
                csvAttributes={props.csvAttributes}
                currentAttribute="tripDateAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:batchCalculation:AgenciesAttributePrefix')}</label>
                <InputString
                    id={'formFieldTransitValidationAgenciesPrefix'}
                    value={props.attributes.agenciesAttributePrefix}
                    onValueUpdated={(value) => props.onValueChange('agenciesAttributePrefix', { value })}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:batchCalculation:LinesAttributePrefix')}</label>
                <InputString
                    id={'formFieldTransitValidationLinesPrefix'}
                    value={props.attributes.linesAttributePrefix}
                    onValueUpdated={(value) => props.onValueChange('linesAttributePrefix', { value })}
                />
            </div>
        </React.Fragment>
    );
};

export default withTranslation('main')(BatchValidationAttributesSelectionComponent);
