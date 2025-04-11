/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _toString from 'lodash/toString';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons/faSyncAlt';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputSelect, { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { _isBlank, _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import {
    decimalHourToTimeStr,
    secondsSinceMidnightToTimeStr,
    secondsToMinutes,
    minutesToSeconds
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Schedule, { ScheduleCalculationMode } from 'transition-common/lib/services/schedules/Schedule';
import Line from 'transition-common/lib/services/line/Line';

interface TransitSchedulePeriodProps {
    schedule: Schedule;
    line: Line;
    periodIndex: number;
    period: any;
    schedulePeriod: any;
    outboundPathsChoices: choiceType[];
    inboundPathsChoices: choiceType[];
    outboundPathIds: string[];
    inboundPathIds: string[];
    isFrozen: boolean;
    scheduleId: string;
    allowSecondsBasedSchedules: boolean;
    resetChangesCount: number;
    calculationMode: ScheduleCalculationMode;
    onValueChange: (path: string, newValue: { value: any }) => void;
}

const TransitSchedulePeriod: React.FC<TransitSchedulePeriodProps> = (props) => {
    const { t, i18n } = useTranslation();

    const {
        schedule,
        period,
        schedulePeriod,
        periodIndex,
        outboundPathsChoices,
        inboundPathsChoices,
        outboundPathIds,
        inboundPathIds,
        isFrozen,
        scheduleId,
        allowSecondsBasedSchedules,
        resetChangesCount,
        onValueChange,
        line,
        calculationMode
    } = props;

    const periodName = period.name[i18n.language];
    const periodShortname = period.shortname;
    const periodStartAtTimeStr = decimalHourToTimeStr(period.startAtHour);
    const periodEndAtTimeStr = decimalHourToTimeStr(period.endAtHour);

    const trips = schedulePeriod.trips || [];
    const tripsCount = trips.length;

    const actualOutboundPathId = schedulePeriod.outbound_path_id;
    const outboundPathId =
        actualOutboundPathId || (outboundPathsChoices.length === 1 ? outboundPathsChoices[0].value : '');

    const actualInboundPathId = schedulePeriod.inbound_path_id;
    const inboundPathId =
        actualInboundPathId || (inboundPathsChoices.length === 1 ? inboundPathsChoices[0].value : undefined);

    const outboundTripsCells: React.ReactNode[] = [];
    const inboundTripsCells: React.ReactNode[] = [];
    const tripRows: React.ReactNode[] = [];

    for (let tripI = 0; tripI < tripsCount; tripI++) {
        const trip = trips[tripI];
        if (outboundPathIds.includes(trip.path_id)) {
            // outbound trip
            outboundTripsCells.push(
                <td key={`outboundTrip_${tripI}`}>
                    {secondsSinceMidnightToTimeStr(trip.departure_time_seconds, true, allowSecondsBasedSchedules)}
                </td>
            );
        } else if (inboundPathIds.includes(trip.path_id)) {
            inboundTripsCells.push(
                <td key={`inboundTrip_${tripI}`}>
                    {secondsSinceMidnightToTimeStr(trip.departure_time_seconds, true, allowSecondsBasedSchedules)}
                </td>
            );
        }
    }

    const totalNumberOfTripRows = Math.max(outboundTripsCells.length, inboundTripsCells.length);

    for (let rowI = 0; rowI < totalNumberOfTripRows; rowI++) {
        tripRows.push(
            <tr key={rowI}>
                {outboundTripsCells[rowI] || <td key={`emptyOutboundTrip_${rowI}`}></td>}
                {inboundTripsCells[rowI] || <td key={`emptyInboundTrip_${rowI}`}></td>}
            </tr>
        );
    }

    const outboundIntervalSeconds = schedulePeriod.interval_seconds;
    const inboundIntervalSeconds = schedulePeriod.inbound_interval_seconds;
    const calculatedIntervalSeconds = schedulePeriod.calculated_interval_seconds;
    const numberOfUnits = schedulePeriod.number_of_units;
    const calculatedNumberOfUnits = schedulePeriod.calculated_number_of_units;
    const customStartAtStr =
        schedulePeriod.custom_start_at_str || decimalHourToTimeStr(period.startAtHour) || undefined;
    const customEndAtStr = schedulePeriod.custom_end_at_str || undefined;

    /* temporary for calculations: TODO Do we really need this? */
    line.attributes.data.tmpIntervalSeconds = outboundIntervalSeconds || calculatedIntervalSeconds;
    line.attributes.data.tmpNumberOfUnits = numberOfUnits || calculatedNumberOfUnits;
    /* */

    const handleGenerateSchedule = () => {
        schedule.set(`periods[${periodIndex}].outbound_path_id`, outboundPathId);
        schedule.set(`periods[${periodIndex}].inbound_path_id`, inboundPathId);

        const response = schedule.generateForPeriod(periodShortname);
        if (response.trips) {
            schedule.set(`periods[${periodIndex}].trips`, response.trips);
        }
        serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
    };

    const handleRemoveSchedule = () => {
        schedule.set(`periods[${periodIndex}].trips`, []);
        serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
    };

    const isReadyForScheduleGeneration = (
        calculationMode: ScheduleCalculationMode,
        inboundInterval?: number,
        outboundInterval?: number,
        numberOfUnits?: number
    ) => {
        return (
            (calculationMode === ScheduleCalculationMode.BASIC &&
                !_isBlank(outboundInterval) &&
                _isBlank(numberOfUnits)) ||
            (calculationMode === ScheduleCalculationMode.ASYMMETRIC &&
                !_isBlank(outboundInterval) &&
                !_isBlank(inboundInterval) &&
                _isBlank(numberOfUnits)) ||
            (!_isBlank(numberOfUnits) && _isBlank(outboundInterval) && _isBlank(inboundInterval))
        );
    };

    return (
        <div
            className="tr__form-section _flex-container-row"
            key={periodShortname}
            style={{
                borderRight: '1px solid rgba(255,255,255,0.2)',
                alignItems: 'flex-start',
                minWidth: '20rem'
            }}
        >
            <h4 className="_aside-heading-container" style={{ minHeight: '30rem' }}>
                <span className="_aside-heading">
                    <FontAwesomeIcon icon={faClock} className="_icon" />{' '}
                    <span className="_strong">{periodStartAtTimeStr}</span>{' '}
                    <FontAwesomeIcon icon={faArrowDown} className="_icon" />{' '}
                    <span className="_strong">{periodEndAtTimeStr}</span> <span>• {periodName}</span>
                </span>
            </h4>
            <div className="tr__form-section">
                <div className="tr__form-section">
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:OutboundPath')}</label>
                        <InputSelect
                            id={`formFieldTransitScheduleOutboundPathPeriod${periodShortname}${scheduleId}`}
                            value={outboundPathId}
                            choices={outboundPathsChoices}
                            disabled={isFrozen}
                            t={t}
                            onValueChange={(e) =>
                                onValueChange(`periods[${periodIndex}].outbound_path_id`, {
                                    value: e.target.value
                                })
                            }
                        />
                    </div>
                    {allowSecondsBasedSchedules !== true && (
                        <div className="apptr__form-input-container">
                            <label>{t('transit:transitSchedule:outboundIntervalMinutes')}</label>
                            <InputStringFormatted
                                id={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}`}
                                disabled={isFrozen}
                                value={outboundIntervalSeconds}
                                onValueUpdated={(value) => {
                                    onValueChange(`periods[${periodIndex}].interval_seconds`, value);
                                }}
                                key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}${resetChangesCount}`}
                                stringToValue={minutesToSeconds}
                                valueToString={(val) => _toString(secondsToMinutes(val))}
                            />
                        </div>
                    )}
                    {allowSecondsBasedSchedules === true && (
                        <div className="apptr__form-input-container">
                            <label>{t('transit:transitSchedule:outboundIntervalSeconds')}</label>
                            <InputStringFormatted
                                id={`formFieldTransitScheduleIntervalSecondsPeriod${periodShortname}${scheduleId}`}
                                disabled={isFrozen}
                                value={outboundIntervalSeconds}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}${resetChangesCount}`}
                                onValueUpdated={(value) => {
                                    onValueChange(`periods[${periodIndex}].interval_seconds`, value);
                                }}
                            />
                        </div>
                    )}
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:InboundPath')}</label>
                        <InputSelect
                            id={`formFieldTransitScheduleInboundPathPeriod${periodShortname}${scheduleId}`}
                            value={inboundPathId}
                            choices={inboundPathsChoices}
                            disabled={isFrozen}
                            t={t}
                            onValueChange={(e) =>
                                onValueChange(`periods[${periodIndex}].inbound_path_id`, {
                                    value: e.target.value
                                })
                            }
                        />
                    </div>

                    {allowSecondsBasedSchedules !== true && calculationMode === ScheduleCalculationMode.ASYMMETRIC && (
                        <div className="apptr__form-input-container">
                            <label>{t('transit:transitSchedule:inboundIntervalMinutes')}</label>
                            <InputStringFormatted
                                id={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}`}
                                disabled={isFrozen}
                                value={inboundIntervalSeconds}
                                onValueUpdated={(value) =>
                                    onValueChange(`periods[${periodIndex}].inbound_interval_seconds`, value)
                                }
                                key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}${resetChangesCount}`}
                                stringToValue={minutesToSeconds}
                                valueToString={(val) => _toString(secondsToMinutes(val))}
                            />
                        </div>
                    )}

                    {allowSecondsBasedSchedules === true &&
                        schedule.attributes.calculation_mode === ScheduleCalculationMode.ASYMMETRIC && (
                        <div className="apptr__form-input-container">
                            <label>{t('transit:transitSchedule:inboundIntervalSeconds')}</label>
                            <InputStringFormatted
                                id={`formFieldTransitScheduleIntervalSecondsPeriod${periodShortname}${scheduleId}`}
                                disabled={isFrozen}
                                value={inboundIntervalSeconds}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}${resetChangesCount}`}
                                onValueUpdated={(value) =>
                                    onValueChange(`periods[${periodIndex}].inbound_interval_seconds`, value)
                                }
                            />
                        </div>
                    )}

                    <p className="_small _oblique">
                        {!outboundIntervalSeconds &&
                        calculatedIntervalSeconds &&
                        numberOfUnits &&
                        !inboundIntervalSeconds
                            ? `${t('transit:transitSchedule:CalculatedInterval')}: ${Math.ceil(
                                calculatedIntervalSeconds / 60
                            )} ${t('main:minuteAbbr')}`
                            : ''}
                    </p>
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:NumberOfUnits')}</label>
                        <InputStringFormatted
                            id={`formFieldTransitScheduleNumberOfUnitsPeriod${periodShortname}${scheduleId}`}
                            disabled={isFrozen}
                            value={numberOfUnits}
                            stringToValue={_toInteger}
                            valueToString={_toString}
                            key={`formFieldTransitScheduleNumberOfUnitsPeriod${periodShortname}${scheduleId}${resetChangesCount}`}
                            onValueUpdated={(value) => onValueChange(`periods[${periodIndex}].number_of_units`, value)}
                        />
                    </div>
                    <p className="_small _oblique">
                        {!numberOfUnits && calculatedNumberOfUnits && outboundIntervalSeconds
                            ? `${roundToDecimals(calculatedNumberOfUnits, 1)} ${t(
                                'transit:transitSchedule:requiredUnits'
                            )}`
                            : ''}
                    </p>
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:CustomStartAt')}</label>
                        <InputString
                            id={`formFieldTransitScheduleCustomStartAtPeriod${periodShortname}${scheduleId}`}
                            disabled={isFrozen}
                            value={customStartAtStr}
                            onValueUpdated={(value) =>
                                onValueChange(`periods[${periodIndex}].custom_start_at_str`, value)
                            }
                        />
                    </div>
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:CustomEndAt')}</label>
                        <InputString
                            id={`formFieldTransitScheduleCustomEndAtPeriod${periodShortname}${scheduleId}`}
                            disabled={isFrozen}
                            value={customEndAtStr}
                            onValueUpdated={(value) =>
                                onValueChange(`periods[${periodIndex}].custom_end_at_str`, value)
                            }
                        />
                    </div>
                </div>
                <div className="tr__form-section">
                    {isFrozen !== true && (
                        <div className="tr__form-buttons-container _left">
                            {isReadyForScheduleGeneration(
                                calculationMode,
                                inboundIntervalSeconds,
                                outboundIntervalSeconds,
                                numberOfUnits
                            ) && (
                                <Button
                                    color="blue"
                                    icon={faSyncAlt}
                                    iconClass="_icon"
                                    label={t('transit:transitSchedule:GenerateSchedule')}
                                    onClick={handleGenerateSchedule}
                                />
                            )}
                        </div>
                    )}
                    {isFrozen !== true && tripsCount > 0 && (
                        <div className="tr__form-buttons-container _left">
                            <Button
                                color="red"
                                icon={faTrash}
                                iconClass="_icon"
                                label={t('transit:transitSchedule:RemoveSchedule')}
                                onClick={handleRemoveSchedule}
                            />
                        </div>
                    )}
                </div>
                {tripsCount > 0 && (
                    <div className="tr__form-section">
                        <table className="_schedule">
                            <tbody>
                                <tr>
                                    <th>{t('transit:transitPath:directions:outbound')}</th>
                                    <th>{t('transit:transitPath:directions:inbound')}</th>
                                </tr>
                                {tripRows}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransitSchedulePeriod;
