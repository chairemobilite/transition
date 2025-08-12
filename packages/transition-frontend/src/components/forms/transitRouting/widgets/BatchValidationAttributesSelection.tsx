/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { TransitValidationDemandFromCsvAttributes } from 'transition-common/lib/services/transitDemand/TransitValidationDemandFromCsv';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
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
    // Extract column names prefixes, ie the longest prefix that more than one column header share
    const prefixes: string[] = React.useMemo(() => {
        const prefixCounts: Record<string, number> = {};

        props.csvAttributes.forEach((attribute) => {
            for (let i = 3; i <= attribute.length; i++) {
                // Ensure prefixes are at least 3 characters long
                const prefix = attribute.substring(0, i);
                prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
            }
        });
        const manyColPrefixes = Object.keys(prefixCounts).filter((prefix) => prefixCounts[prefix] > 1);
        return manyColPrefixes.filter(
            (prefix) => !manyColPrefixes.some((otherPrefix) => otherPrefix.startsWith(prefix) && prefix !== otherPrefix)
        );
    }, [props.csvAttributes]);

    const prefixChoices = prefixes.map((csvAttribute) => {
        return { label: csvAttribute, value: csvAttribute };
    });

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
                <InputSelect
                    id={'formFieldTransitValidationAgenciesPrefix'}
                    value={props.attributes.agenciesAttributePrefix}
                    choices={prefixChoices}
                    onValueChange={(e) => props.onValueChange('agenciesAttributePrefix', { value: e.target.value })}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:batchCalculation:LinesAttributePrefix')}</label>
                <InputSelect
                    id={'formFieldTransitValidationLinesPrefix'}
                    value={props.attributes.linesAttributePrefix}
                    choices={prefixChoices}
                    onValueChange={(e) => props.onValueChange('linesAttributePrefix', { value: e.target.value })}
                />
            </div>
        </React.Fragment>
    );
};

export default withTranslation('main')(BatchValidationAttributesSelectionComponent);
