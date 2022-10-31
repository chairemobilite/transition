/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import TransitBatchRouting, {
    TransitBatchRoutingAttributes
} from 'transition-common/lib/services/transitRouting/TransitBatchRouting';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import * as BatchAttributeSelectionWidgets from '../../transitCalculation/widgets/AttributeSelectionWidget';

export interface BatchAttributesSelectionComponentProps extends WithTranslation {
    attributes: TransitBatchRoutingAttributes;
    csvAttributes: string[];
    onValueChange: (path: keyof TransitBatchRoutingAttributes, newValue: { value: any; valid?: boolean }) => void;
}

const BatchAttributesSelectionComponent: React.FunctionComponent<BatchAttributesSelectionComponentProps> = (
    props: BatchAttributesSelectionComponentProps
) => {
    const projectionChoices = Object.values(Preferences.get('proj4Projections')).map((projection: any) => {
        return {
            value: projection.srid.toString(),
            label: projection.label
        };
    });

    return (
        <React.Fragment>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('main:Projection')}</label>
                <InputSelect
                    id={'formFieldTransitBatchRoutingProjection'}
                    value={props.attributes.projection}
                    choices={projectionChoices}
                    onValueChange={(e) => props.onValueChange('projection', { value: e.target.value })}
                />
            </div>
            <BatchAttributeSelectionWidgets.CsvAttributeSelectionWidget
                csvAttributes={props.csvAttributes}
                currentAttribute="idAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.CsvAttributeSelectionWidget
                csvAttributes={props.csvAttributes}
                currentAttribute="originXAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.CsvAttributeSelectionWidget
                csvAttributes={props.csvAttributes}
                currentAttribute="originYAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.CsvAttributeSelectionWidget
                csvAttributes={props.csvAttributes}
                currentAttribute="destinationXAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.CsvAttributeSelectionWidget
                csvAttributes={props.csvAttributes}
                currentAttribute="destinationYAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.TimeAttributeSelectionWidget
                csvAttributes={props.csvAttributes}
                currentAttribute="timeAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.TimeFormatAttributeSelectionWidget
                currentAttribute="timeAttribute"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.BooleanAttributeSelectionWidget
                currentAttribute="detailed"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
            <BatchAttributeSelectionWidgets.BooleanAttributeSelectionWidget
                currentAttribute="withGeometries"
                onValueChange={props.onValueChange}
                attributes={props.attributes}
            />
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(BatchAttributesSelectionComponent);
