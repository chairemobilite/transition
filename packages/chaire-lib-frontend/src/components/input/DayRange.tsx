/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _isEqual from 'lodash/isEqual';

import InputSelect from './InputSelect';

export type DayRangeProps = WithTranslation & {
    id: string;
    /** selection contains the number of the day, where 0 is monday */
    onChange: (selection: number[]) => void;
    days: number[];
    disabled?: boolean;
    showPeriodDropdown?: boolean;
};

type dayRangeType = 'custom' | 'week' | 'week-end' | 'all';

const periodsGroupValues = {
    week: [0, 1, 2, 3, 4],
    'week-end': [5, 6],
    all: [0, 1, 2, 3, 4, 5, 6]
};

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export class DayRange extends React.Component<DayRangeProps> {
    static defaultProps: Partial<DayRangeProps> = {
        disabled: false,
        showPeriodDropdown: true
    };

    constructor(props: DayRangeProps) {
        super(props);

        this.handleDayChange = this.handleDayChange.bind(this);
        this.handlePeriodChange = this.handlePeriodChange.bind(this);
    }

    handleDayChange(e, day: string) {
        const selection = [...this.props.days];
        const value = weekDays.indexOf(day);
        if (e.target.checked) {
            selection.push(value);
        } else {
            const idx = selection.indexOf(value);
            selection.splice(idx, 1);
        }
        this.props.onChange(selection);
    }

    handlePeriodChange(e) {
        const period = e.target.value;

        if (period !== 'custom') {
            const selection = periodsGroupValues[period];
            this.props.onChange(selection);
        }
    }

    renderButton(day: string, isChecked: boolean): JSX.Element {
        return (
            <div className="dayPickerOption" key={`${this.props.id}_${day}`}>
                <input
                    type="checkbox"
                    id={`${this.props.id}_${day}`}
                    value={day}
                    title={day}
                    name={day}
                    checked={isChecked}
                    onChange={(e) => this.handleDayChange(e, day)}
                    disabled={this.props.disabled}
                ></input>
                <label htmlFor={`${this.props.id}_${day}`}>
                    {this.props.t('main:dateTime:weekdaysAbbr:' + day.toLowerCase())}
                </label>
            </div>
        );
    }

    render() {
        const renderWeekDays: JSX.Element[] = [];
        const days = this.props.days;
        weekDays.forEach((day, index) => {
            const idx = days.indexOf(index);
            renderWeekDays.push(this.renderButton(day, idx >= 0));
        });

        let period = 'custom';
        for (const periodGroup in periodsGroupValues) {
            if (_isEqual(periodsGroupValues[periodGroup], days)) {
                period = periodGroup;
            }
        }

        const periodsGroupChoices = [
            { value: 'custom', label: this.props.t('main:dateTime:dayPeriod:Custom') },
            { value: 'week', label: this.props.t('main:dateTime:dayPeriod:Week') },
            { value: 'week-end', label: this.props.t('main:dateTime:dayPeriod:WeekEnd') },
            { value: 'all', label: this.props.t('main:dateTime:dayPeriod:All') }
        ];

        return (
            <div>
                {this.props.showPeriodDropdown && (
                    <div className="apptr__form-input-container _two-columns">
                        <label> {this.props.t('main:dateTime:Day')}</label>
                        <InputSelect
                            id={`${this.props.id}_periodGroup`}
                            t={this.props.t}
                            value={period}
                            choices={periodsGroupChoices}
                            noBlank={true}
                            disabled={this.props.disabled}
                            onValueChange={this.handlePeriodChange}
                        />
                    </div>
                )}
                <div className="tr__form-dayPicker">{renderWeekDays}</div>
            </div>
        );
    }
}

export default withTranslation('main')(DayRange);
