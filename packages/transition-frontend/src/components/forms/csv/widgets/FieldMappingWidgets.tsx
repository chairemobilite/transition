/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
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
export const GeographicProjectionWidget: React.FC<Omit<FieldMappingWidgetProps, 'csvFieldChoices'>> = (
    props: Omit<FieldMappingWidgetProps, 'csvFieldChoices'>
) => {
    const { t } = useTranslation('main');
    const projectionChoices = Object.values(Preferences.get('proj4Projections')).map((projection: any) => {
        return {
            value: projection.srid.toString(),
            label: projection.label
        };
    });
    return (
        <div className="apptr__form-input-container _two-columns _small-inputs">
            <label htmlFor={'formFieldMappingProjection'}>{t(props.i18nlabel)}</label>
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

export const SingleMappingSelectionWidget: React.FC<FieldMappingWidgetProps> = (props: FieldMappingWidgetProps) => {
    const { t } = useTranslation('transit');

    return (
        <div className="apptr__form-input-container _two-columns _small-inputs">
            <label htmlFor={`formFieldMappingSelection${String(props.fieldName)}`}>{t(props.i18nlabel)}</label>
            <InputSelect
                id={`formFieldMappingSelection${String(props.fieldName)}`}
                value={props.currentMappingValue || ''}
                choices={props.csvFieldChoices}
                onValueChange={(e) => props.onValueChange(props.fieldName, { value: e.target.value })}
                noBlank={false}
            />
        </div>
    );
};

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
                <label htmlFor={`formFieldMappingSelection${String(props.fieldName)}Lat`}>
                    {t(`${props.i18nlabel}Lat`)}
                </label>
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
                <label htmlFor={`formFieldMappingSelection${String(props.fieldName)}Lon`}>
                    {t(`${props.i18nlabel}Lon`)}
                </label>
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

export type RoutingTimeMappingSelectionWidgetProps = FieldMappingWidgetProps & {
    currentTimeType?: 'departure' | 'arrival';
    currentTimeFormat?: 'HH:MM' | 'HMM' | 'secondsSinceMidnight';
};

export const RoutingTimeMappingSelectionWidget: React.FC<RoutingTimeMappingSelectionWidgetProps> = (
    props: RoutingTimeMappingSelectionWidgetProps
) => {
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

    const formFieldNamePrefix = `formFieldMappingSelectionRoutingTime${String(props.fieldName)}`;
    return (
        <React.Fragment>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label htmlFor={formFieldNamePrefix}>{t(props.i18nlabel)}</label>
                <InputSelect
                    id={formFieldNamePrefix}
                    value={props.currentMappingValue || ''}
                    choices={props.csvFieldChoices}
                    t={t}
                    onValueChange={(e) => props.onValueChange(props.fieldName, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label htmlFor={`${formFieldNamePrefix}DepartureOrArrival`}>{t(`${props.i18nlabel}Type`)}</label>
                <InputSelect
                    id={`${formFieldNamePrefix}DepartureOrArrival`}
                    value={props.currentTimeType || ''}
                    choices={timeAttributes}
                    onValueChange={(e) => props.onValueChange(`${props.fieldName}Type`, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
            <div className="apptr__form-input-container _two-columns _small-inputs">
                <label htmlFor={`${formFieldNamePrefix}Format`}>{t(`${props.i18nlabel}Format`)}</label>
                <InputSelect
                    id={`${formFieldNamePrefix}Format`}
                    value={props.currentTimeFormat || ''}
                    choices={timeFormats}
                    onValueChange={(e) => props.onValueChange(`${props.fieldName}Format`, { value: e.target.value })}
                    noBlank={false}
                />
            </div>
        </React.Fragment>
    );
};
