/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash.tostring';

import { TransitBatchCalculationAttributes } from 'transition-common/lib/services/transitCalculation/TransitBatchCalculation';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import { _toBool } from 'chaire-lib-common/lib/utils/LodashExtensions';

interface BatchAttributeSelectionComponentProps<T extends TransitBatchCalculationAttributes> {
    currentAttribute: keyof T;
    attributes: T;
    onValueChange: (path: keyof T, newValue: { value: any; valid?: boolean }) => void;
}

interface BatchCsvAttributeSelectionComponentProps<T extends TransitBatchCalculationAttributes>
    extends BatchAttributeSelectionComponentProps<T> {
    csvAttributes: string[];
}

function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const getCsvAttributeChoice = (csvAttributes: string[]) => {
    return csvAttributes
        ? csvAttributes.map((csvAttribute) => {
            return { label: csvAttribute, value: csvAttribute };
        })
        : [];
};

function CsvAttributeSelectionWidgetBase<T extends TransitBatchCalculationAttributes>(
    props: BatchCsvAttributeSelectionComponentProps<T> & WithTranslation
) {
    const csvAttributesChoices = getCsvAttributeChoice(props.csvAttributes);

    return (
        <div className="apptr__form-input-container _two-columns _small-inputs">
            <label>
                {props.t(`transit:transitRouting:${capitalizeFirstLetter(props.currentAttribute as string)}`)}
            </label>
            <InputSelect
                id={`formFieldBatchCalculationSelection${props.currentAttribute}`}
                value={String(props.attributes[props.currentAttribute])}
                choices={csvAttributesChoices}
                onValueChange={(e) => props.onValueChange(props.currentAttribute, { value: e.target.value })}
            />
        </div>
    );
}

export const CsvAttributeSelectionWidget = withTranslation(['transit', 'main'])(CsvAttributeSelectionWidgetBase) as <
    T extends TransitBatchCalculationAttributes
>(
    props: BatchCsvAttributeSelectionComponentProps<T>
) => any;

function BooleanAttributeSelectionWidgetBase<T extends TransitBatchCalculationAttributes>(
    props: BatchAttributeSelectionComponentProps<T> & WithTranslation
) {
    return (
        <div className="apptr__form-input-container _two-columns _small-inputs">
            <label>
                {props.t(`transit:transitRouting:${capitalizeFirstLetter(props.currentAttribute as string)}`)}
            </label>
            <InputRadio
                id={`formFieldBatchCalculationSelection${props.currentAttribute}`}
                value={(props.attributes[props.currentAttribute] as unknown) as boolean | undefined}
                sameLine={true}
                disabled={false}
                choices={[
                    {
                        value: true
                    },
                    {
                        value: false
                    }
                ]}
                localePrefix="transit:transitRouting"
                t={props.t}
                isBoolean={true}
                onValueChange={(e) => props.onValueChange(props.currentAttribute, { value: _toBool(e.target.value) })}
            />
        </div>
    );
}

export const BooleanAttributeSelectionWidget = withTranslation(['transit', 'main'])(
    BooleanAttributeSelectionWidgetBase
) as <T extends TransitBatchCalculationAttributes>(props: BatchAttributeSelectionComponentProps<T>) => any;

function TimeAttributeSelectionWidgetBase<T extends TransitBatchCalculationAttributes>(
    props: BatchCsvAttributeSelectionComponentProps<T> & WithTranslation
) {
    const csvAttributesChoices = getCsvAttributeChoice(props.csvAttributes);
    const timeAttributes = [
        {
            value: 'departure',
            label: props.t('transit:transitRouting:departureTime')
        },
        {
            value: 'arrival',
            label: props.t('transit:transitRouting:arrivalTime')
        }
    ];

    return (
        <React.Fragment>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:transitRouting:TimeAttribute')}</label>
                <InputSelect
                    id={'formFieldBatchCalculationSelectionTimeAttribute'}
                    value={props.attributes.timeAttribute}
                    choices={csvAttributesChoices}
                    t={props.t}
                    onValueChange={(e) => props.onValueChange('timeAttribute', { value: e.target.value })}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{props.t('transit:transitRouting:TimeAttributeDepartureOrArrival')}</label>
                <InputSelect
                    id={'formFieldBatchCalculationSelectionTimeAttributeDepartureOrArrival'}
                    value={props.attributes.timeAttributeDepartureOrArrival}
                    choices={timeAttributes}
                    onValueChange={(e) =>
                        props.onValueChange('timeAttributeDepartureOrArrival', { value: e.target.value })
                    }
                />
            </div>
        </React.Fragment>
    );
}

export const TimeAttributeSelectionWidget = withTranslation(['transit', 'main'])(TimeAttributeSelectionWidgetBase);

function TimeFormatAttributeSelectionWidgetBase<T extends TransitBatchCalculationAttributes>(
    props: BatchAttributeSelectionComponentProps<T> & WithTranslation
) {
    const timeFormats = [
        {
            value: 'HH:MM',
            label: props.t('transit:transitRouting:HH_MM__HH_MM_SS')
        },
        {
            value: 'HMM',
            label: props.t('transit:transitRouting:HMM')
        },
        {
            value: 'secondsSinceMidnight',
            label: props.t('transit:transitRouting:SecondsSinceMidnight')
        }
    ];

    return (
        <div className="apptr__form-input-container _two-columns _small-inputs">
            <label>{props.t('transit:transitRouting:TimeFormat')}</label>
            <InputSelect
                id={'formFieldTransitBatchRoutingTimeFormat'}
                value={props.attributes.timeFormat}
                choices={timeFormats}
                t={props.t}
                onValueChange={(e) => props.onValueChange('timeFormat', { value: e.target.value })}
            />
        </div>
    );
}

export const TimeFormatAttributeSelectionWidget = withTranslation(['transit', 'main'])(
    TimeFormatAttributeSelectionWidgetBase
);
