/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import moment from 'moment';
import fr from 'date-fns/locale/fr';
import en from 'date-fns/locale/en-CA';

//import config from 'chaire-lib-common/lib/config/shared/project.config';

/* TODO: start and end date should be string | number,
 * there should be a dateFormat props if string and the onChange should
 * have as parameters the same type/format as the input. There could
 * also be a wrapper component for string dates */
export type InputCalendarProps = {
    id: string;
    /** start and end are in ms since epoch */
    onChange: (start: number, end: number) => void;
    startDate: string;
    endDate?: string;
    dateFormat?: string;
    disabled?: boolean;
    language?: string;
};

enum DateState {
    START,
    END
}

interface InputCalendarState {
    /** start and end dates are in ms since epoch */
    startDate: number;
    endDate?: number;
    dateState: DateState;
}

export default class Calendar extends React.Component<InputCalendarProps, InputCalendarState> {
    static defaultProps: Partial<InputCalendarProps> = {
        dateFormat: 'DD-MM-YYYY',
        language: 'en'
    };

    constructor(props: InputCalendarProps) {
        super(props);

        this.state = {
            startDate: this.props.startDate
                ? moment(this.props.startDate, this.props.dateFormat).valueOf()
                : new Date().getTime(),
            endDate: this.props.endDate
                ? moment(this.props.endDate, this.props.dateFormat).hours(23).minutes(59).valueOf()
                : undefined,
            dateState: DateState.START
        };

        this.handleDateChange = this.handleDateChange.bind(this);

        registerLocale('fr', fr); // TODO, make this more generic, when loading locales from date-fns, when need to make conditional import, which is hard to do with webpack in production. Still thinking about a better solution.
        registerLocale('en', en);
    }

    componentDidUpdate(prevProps: InputCalendarProps, _prevState: InputCalendarState): void {
        if (prevProps.startDate !== this.props.startDate || prevProps.endDate !== this.props.endDate) {
            this.setState({
                startDate: this.props.startDate
                    ? moment(this.props.startDate, this.props.dateFormat).valueOf()
                    : new Date().getTime(),
                endDate: this.props.endDate ? moment(this.props.endDate, this.props.dateFormat).valueOf() : undefined
            });
        }
    }

    handleDateChange(date: Date): void {
        if (this.state.dateState === DateState.START) {
            const startDate = date.getTime();
            const endDate =
                !this.state.endDate || this.state.endDate < startDate
                    ? new Date(date).setHours(23, 59, 0, 0)
                    : this.state.endDate;
            this.setState(
                {
                    startDate,
                    endDate,
                    dateState: DateState.END
                },
                () => this.props.onChange(startDate, endDate)
            );
        } else {
            const endDate = new Date(date).setHours(23, 59, 0, 0);

            this.setState(
                {
                    endDate,
                    dateState: DateState.START
                },
                () => this.props.onChange(this.state.startDate, endDate)
            );
        }
    }

    _updateDateState(dateState: DateState): void {
        this.setState({ dateState: dateState });
    }

    render(): React.ReactNode {
        const inputStyle = { textAlign: 'center', cursor: 'context-menu', width: 'auto' } as React.CSSProperties;
        const { startDate, endDate, dateState } = this.state;

        /*for (let i = 0; i < config.languages.length; i++)
    {
      const language = config.languages[i];
      const locale   = config.locales && config.locales[language] ? config.locales[language] : language;
      console.log('lang', language, 'locale', locale);
      registerLocale(language, dateFnsLocales[locale]);
    }*/

        return (
            <div className="apptr__form-input-container" style={{ flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex' }}>
                    <input
                        id={`${this.props.id}_startDate`}
                        type="button"
                        value={moment(startDate).format(this.props.dateFormat)}
                        onClick={this._updateDateState.bind(this, DateState.START)}
                        autoComplete="off"
                        style={inputStyle}
                    />
                    <input
                        id={`${this.props.id}_endDate`}
                        type="button"
                        value={moment(endDate).format(this.props.dateFormat)}
                        onClick={this._updateDateState.bind(this, DateState.END)}
                        autoComplete="off"
                        style={inputStyle}
                    />
                </div>

                {!this.props.disabled && (
                    <div style={{ width: '-webkit-fill-available' }}>
                        <DatePicker
                            locale={this.props.language}
                            dateFormat="dd/MM/yyyy"
                            onChange={this.handleDateChange}
                            startDate={new Date(startDate)}
                            endDate={endDate ? new Date(endDate) : null}
                            minDate={dateState === DateState.END ? new Date(startDate) : null}
                            selectsEnd={dateState === DateState.END ? true : false}
                            openToDate={new Date(startDate)}
                            showMonthDropdown
                            showYearDropdown
                            disabledKeyboardNavigation
                            dropdownMode="select"
                            inline
                        />
                    </div>
                )}
            </div>
        );
    }
}
