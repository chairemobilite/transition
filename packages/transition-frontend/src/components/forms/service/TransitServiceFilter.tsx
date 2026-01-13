/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import DatePicker, { registerLocale } from 'react-datepicker';

import DayRange from 'chaire-lib-frontend/lib/components/input/DayRange';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import { fr } from 'date-fns/locale/fr';
import { enCA } from 'date-fns/locale/en-CA';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';

export interface TransitServiceFilterFields {
    name?: string;
    days?: number[];
    startDate?: Date;
    endDate?: Date;
}

export interface TransitServiceFilterProps extends WithTranslation {
    onFilterUpdate: (filters: TransitServiceFilterFields) => void;
    currentFilter: TransitServiceFilterFields;
}

const TransitServiceFilter: React.FunctionComponent<TransitServiceFilterProps> = (props: TransitServiceFilterProps) => {
    const [display, setDisplay] = useState(false);
    const [useDateRange, setUseDateRange] = useState(false);

    // TODO, make this more generic, when loading locales from date-fns, when need to make conditional import, which is hard to do with webpack in production. Still thinking about a better solution.
    useEffect(() => {
        registerLocale('fr', fr);
        registerLocale('en', enCA);
    }, []);

    if (!display) {
        return (
            <div className="tr__form-filter-box">
                <span className="_link" onClick={() => setDisplay(true)}>
                    {props.t('transit:transitService:ShowServiceFilter')}
                </span>
            </div>
        );
    }

    return (
        <div className="tr__form-filter-box">
            <div className="apptr__form-input-container _two-columns">
                <label>{props.t('transit:transitService:StringOrRegex')}</label>
                <InputString
                    id={'formFilterTransitServiceNameOrRegex'}
                    disabled={false}
                    value={props.currentFilter.name || ''}
                    onValueUpdated={(value) =>
                        props.onFilterUpdate(
                            Object.assign({}, props.currentFilter, {
                                name: value.value === '' ? undefined : value.value
                            })
                        )
                    }
                />
            </div>
            <div className="apptr__form-input-container _two-columns">
                <label>{props.t('transit:transitService:DayRange')}</label>
                <DayRange
                    id={'formFilterTransitServiceDays'}
                    onChange={(days) => props.onFilterUpdate(Object.assign({}, props.currentFilter, { days }))}
                    days={props.currentFilter.days || []}
                    showPeriodDropdown={false}
                />
            </div>
            <div className="apptr__form-input-container _two-columns">
                <label>
                    {props.t(
                        useDateRange ? 'transit:transitService:ValidityPeriod' : 'transit:transitService:ValidityDate'
                    )}
                </label>
                <div style={{ display: 'inline-flex', width: '-webkit-fill-available' }}>
                    {useDateRange && (
                        <DatePicker
                            locale={props.i18n.language}
                            selected={props.currentFilter.startDate || new Date()}
                            startDate={props.currentFilter.startDate || null}
                            endDate={props.currentFilter.endDate || null}
                            isClearable={true}
                            selectsRange
                            inline
                            showMonthDropdown={true}
                            showYearDropdown={true}
                            onChange={(dates) => {
                                if (Array.isArray(dates)) {
                                    const [startDate, endDate] = dates;
                                    props.onFilterUpdate(
                                        Object.assign({}, props.currentFilter, {
                                            startDate: startDate !== null ? startDate : undefined,
                                            endDate: endDate !== null ? endDate : undefined
                                        })
                                    );
                                }
                            }}
                        />
                    )}
                    {!useDateRange && (
                        <DatePicker
                            locale={props.i18n.language}
                            selected={props.currentFilter.startDate || null}
                            isClearable={true}
                            showMonthDropdown={true}
                            showYearDropdown={true}
                            onChange={(startDate) => {
                                props.onFilterUpdate(
                                    Object.assign({}, props.currentFilter, {
                                        startDate: startDate !== null ? startDate : undefined
                                    })
                                );
                            }}
                        />
                    )}
                </div>
            </div>
            <div className="apptr__form-input-container _two-columns">
                <InputCheckboxBoolean
                    id={'formFilterTransitServiceUseDateRange'}
                    label={props.t('transit:transitService:FilterValidityPeriod')}
                    isChecked={useDateRange}
                    onValueChange={(e) => {
                        setUseDateRange(e.target.value);
                        props.onFilterUpdate(Object.assign({}, props.currentFilter, { endDate: undefined }));
                    }}
                />
            </div>
            <span
                className="_link"
                onClick={() => {
                    setDisplay(false);
                    props.onFilterUpdate({});
                }}
            >
                {props.t('transit:transitService:HideServiceFilter')}
            </span>
        </div>
    );
};

export default withTranslation('transit')(TransitServiceFilter);
