/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import InputSelect, { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

export type FieldMappingWidgetProps = {
    fieldName: string;
    i18nlabel: string;
    currentMappingValue?: string;
    csvFieldChoices: choiceType[];
    onValueChange: (fieldName: string, value: { value: string }) => void;
};

/**
 * Display a choice of geographic projections, for geographic mappings
 * @param props
 */
export const GeographicProjectionWidget = (props: Omit<FieldMappingWidgetProps, 'csvFieldChoices' | 'required'>) => {
    const { t } = useTranslation('main');
    const projectionChoices = Object.values(Preferences.get('proj4Projections')).map((projection: any) => {
        return {
            value: projection.srid.toString(),
            label: projection.label
        };
    });
    return (
        <div className="apptr__form-input-container _two-columns _small-inputs">
            <label>{t(props.i18nlabel)}</label>
            <InputSelect
                id={'formFieldMappingProjection'}
                value={props.currentMappingValue || ''}
                choices={projectionChoices}
                onValueChange={(e) => props.onValueChange(props.fieldName, { value: e.target.value })}
                noBlank={false}
            />
        </div>
    );
};

export function SingleMappingSelectionWidget(props: FieldMappingWidgetProps): JSX.Element {
    const { t } = useTranslation('transit');

    return (
        <div className="apptr__form-input-container _two-columns _small-inputs">
            <label>{t(props.i18nlabel)}</label>
            <InputSelect
                id={`formFieldMappingSelection${String(props.fieldName)}`}
                value={props.currentMappingValue || ''}
                choices={props.csvFieldChoices}
                onValueChange={(e) => props.onValueChange(props.fieldName, { value: e.target.value })}
                noBlank={false}
            />
        </div>
    );
}

export type LatLonMappingSelectionWidgetProps = Omit<FieldMappingWidgetProps, 'currentMappingValue'> & {
    currentLatValue?: string;
    currentLonValue?: string;
};

export const LatLonMappingSelectionWidget: React.FC<LatLonMappingSelectionWidgetProps> = (
    props: LatLonMappingSelectionWidgetProps
) => {
    const { t } = useTranslation('transit');

    return (
        <React.Fragment>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{t(`${props.i18nlabel}Lat`)}</label>
                <InputSelect
                    id={`formFieldMappingSelection${String(props.fieldName)}Lat`}
                    value={props.currentLatValue || ''}
                    choices={props.csvFieldChoices}
                    t={t}
                    onValueChange={(e) => props.onValueChange(`${props.fieldName}Lat`, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{t(`${props.i18nlabel}Lon`)}</label>
                <InputSelect
                    id={`formFieldMappingSelection${String(props.fieldName)}Lon`}
                    value={props.currentLonValue || ''}
                    choices={props.csvFieldChoices}
                    t={t}
                    onValueChange={(e) => props.onValueChange(`${props.fieldName}Lon`, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
        </React.Fragment>
    );
};

export type TimeMappingSelectionWidgetProps = FieldMappingWidgetProps & {
    currentTimeType?: 'departure' | 'arrival';
    currentTimeFormat?: 'HH:MM' | 'HMM' | 'secondsSinceMidnight';
};

export function TimeMappingSelectionWidget(props: TimeMappingSelectionWidgetProps): JSX.Element {
    const { t } = useTranslation('transit');
    const timeAttributes = [
        {
            value: 'departure',
            label: t('transit:transitRouting:departureTime')
        },
        {
            value: 'arrival',
            label: t('transit:transitRouting:arrivalTime')
        }
    ];

    const timeFormats = [
        {
            value: 'HH:MM',
            label: t('transit:transitRouting:HH_MM__HH_MM_SS')
        },
        {
            value: 'HMM',
            label: t('transit:transitRouting:HMM')
        },
        {
            value: 'secondsSinceMidnight',
            label: t('transit:transitRouting:SecondsSinceMidnight')
        }
    ];

    return (
        <React.Fragment>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{t(props.i18nlabel)}</label>
                <InputSelect
                    id={`formFieldMappingSelectionTime${String(props.fieldName)}`}
                    value={props.currentMappingValue || ''}
                    choices={props.csvFieldChoices}
                    t={t}
                    onValueChange={(e) => props.onValueChange(props.fieldName, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{t(`${props.i18nlabel}Type`)}</label>
                <InputSelect
                    id={`formFieldMappingSelectionTimeDepartureOrArrival${String(props.fieldName)}`}
                    value={props.currentTimeType || ''}
                    choices={timeAttributes}
                    onValueChange={(e) => props.onValueChange(`${props.fieldName}Type`, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label>{t(`${props.i18nlabel}Format`)}</label>
                <InputSelect
                    id={`formFieldMappingTimeFormat${String(props.fieldName)}`}
                    value={props.currentTimeFormat || ''}
                    choices={timeFormats}
                    onValueChange={(e) => props.onValueChange(`${props.fieldName}Format`, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
        </React.Fragment>
    );
}
