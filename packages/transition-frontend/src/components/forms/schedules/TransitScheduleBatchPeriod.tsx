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
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import Line from 'transition-common/lib/services/line/Line';
import Path from 'transition-common/lib/services/path/Path';

interface TransitScheduleBatchPeriodProps {
    schedules: Schedule[];
    lines: Line[];
    periodIndex: number;
    period: any;
    schedulePeriod: any;
    allowSecondsBasedSchedules: boolean;
    resetChangesCount: number;
    onValueChange: (path: string, newValue: { value: any }) => void;
}

const TransitScheduleBatchPeriod: React.FC<TransitScheduleBatchPeriodProps> = (props) => {
    const { t, i18n } = useTranslation();

    const {
        schedules,
        lines,
        period,
        schedulePeriod,
        periodIndex,
        allowSecondsBasedSchedules,
        resetChangesCount,
        onValueChange,
    } = props;

    const periodName = period.name[i18n.language];
    const periodShortname = period.shortname;
    const periodStartAtTimeStr = decimalHourToTimeStr(period.startAtHour);
    const periodEndAtTimeStr = decimalHourToTimeStr(period.endAtHour);

    let chosenInboundPathId = '';
    let chosenOutboundPathId = '';

    const trips = schedulePeriod.trips || [];
    const [generatedResponses, setGeneratedResponses] = React.useState<any[]>([])
    //const generatedResponses: any[] = [];
    const tripsCount = trips.length;

    // const actualOutboundPathId = schedulePeriod.outbound_path_id;
    // const outboundPathId =
    //     actualOutboundPathId || (outboundPathsChoices.length === 1 ? outboundPathsChoices[0].value : '');

    // const actualInboundPathId = schedulePeriod.inbound_path_id;
    // const inboundPathId = actualInboundPathId || (inboundPathsChoices.length === 1 ? inboundPathsChoices[0].value : '');

    // const outboundTripsCells: React.ReactNode[] = [];
    // const inboundTripsCells: React.ReactNode[] = [];
    // const tripRows: React.ReactNode[] = [];

    // for (let tripI = 0; tripI < tripsCount; tripI++) {
    //     const trip = trips[tripI];
    //     if (outboundPathIds.includes(trip.path_id)) {
    //         // outbound trip
    //         outboundTripsCells.push(
    //             <td key={`outboundTrip_${tripI}`}>
    //                 {secondsSinceMidnightToTimeStr(trip.departure_time_seconds, true, allowSecondsBasedSchedules)}
    //             </td>
    //         );
    //     } else if (inboundPathIds.includes(trip.path_id)) {
    //         inboundTripsCells.push(
    //             <td key={`inboundTrip_${tripI}`}>
    //                 {secondsSinceMidnightToTimeStr(trip.departure_time_seconds, true, allowSecondsBasedSchedules)}
    //             </td>
    //         );
    //     }
    // }

    // const totalNumberOfTripRows = Math.max(outboundTripsCells.length, inboundTripsCells.length);

    // for (let rowI = 0; rowI < totalNumberOfTripRows; rowI++) {
    //     tripRows.push(
    //         <tr key={rowI}>
    //             {outboundTripsCells[rowI] || <td key={`emptyOutboundTrip_${rowI}`}></td>}
    //             {inboundTripsCells[rowI] || <td key={`emptyInboundTrip_${rowI}`}></td>}
    //         </tr>
    //     );
    // }

    // Automatically select the paths with the bigger stops count
    lines.forEach(line => {
        const paths = line.paths
        let chosenOutboundPath;
        let chosenInboundPath;
        paths.forEach(path => {
            if (['outbound', 'loop', 'other'].includes(path.attributes.direction)) {
                chosenOutboundPath = chosenOutboundPath ? (chosenOutboundPath.countStops() < path.countStops() ? path : chosenOutboundPath) : path
            }
            else if (path.attributes.direction === 'inbound') {
                chosenInboundPath = chosenInboundPath ? (chosenInboundPath.countStops() < path.countStops() ? path : chosenInboundPath) : path
            }
        })
        chosenOutboundPathId = chosenOutboundPath ? chosenOutboundPath.getId() : ''
        chosenInboundPathId = chosenInboundPath ? chosenOutboundPath.getId() : ''
        const schedule = schedules.find((schedule) => {return schedule.attributes.line_id === line.getId() })
        if (schedule && chosenOutboundPath) {
            schedule.set(`periods[${periodIndex}].outbound_path_id`, chosenOutboundPath.getId());
            schedule.set(`periods[${periodIndex}].inbound_path_id`, chosenInboundPath.getId());
        }


    });


    const intervalSeconds = schedulePeriod.interval_seconds;
    const calculatedIntervalSeconds = schedulePeriod.calculated_interval_seconds;
    const numberOfUnits = schedulePeriod.number_of_units;
    const calculatedNumberOfUnits = schedulePeriod.calculated_number_of_units;
    const customStartAtStr =
        schedulePeriod.custom_start_at_str || decimalHourToTimeStr(period.startAtHour) || undefined;
    const customEndAtStr = schedulePeriod.custom_end_at_str || undefined;

    /* temporary for calculations: TODO Do we really need this? */
    // line.attributes.data.tmpIntervalSeconds = intervalSeconds || calculatedIntervalSeconds;
    // line.attributes.data.tmpNumberOfUnits = numberOfUnits || calculatedNumberOfUnits;
    /* */

    const handleGenerateSchedule = () => {
        const generatedResponsesTemp: any[] = []
        lines.forEach(line => {
            const schedule = schedules.find((schedule) => {return schedule.attributes.line_id === line.getId() })
            if (schedule) {
                // schedule.set(`periods[${periodIndex}].outbound_path_id`, outboundPathId);
                // schedule.set(`periods[${periodIndex}].inbound_path_id`, inboundPathId);

                const response = schedule.generateForPeriod(periodShortname);
                console.log(response)
                if (response.trips) {
                    schedule.set(`periods[${periodIndex}].trips`, response.trips);
                    generatedResponsesTemp.push(response)
                }
            }
            //serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
        });
        setGeneratedResponses(generatedResponsesTemp)
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
                    {allowSecondsBasedSchedules !== true && (
                        <div className="apptr__form-input-container">
                            <label>{t('transit:transitSchedule:IntervalMinutes')}</label>
                            <InputStringFormatted
                                id={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}`}
                                // disabled={isFrozen}
                                value={intervalSeconds}
                                onValueUpdated={(value) =>
                                    onValueChange(`periods[${periodIndex}].interval_seconds`, value)
                                }
                                key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${resetChangesCount}`}
                                stringToValue={minutesToSeconds}
                                valueToString={(val) => _toString(secondsToMinutes(val))}
                            />
                        </div>
                    )}
                    {allowSecondsBasedSchedules === true && (
                        <div className="apptr__form-input-container">
                            <label>{t('transit:transitSchedule:IntervalSeconds')}</label>
                            <InputStringFormatted
                                id={`formFieldTransitScheduleIntervalSecondsPeriod${periodShortname}`}
                                // disabled={isFrozen}
                                value={intervalSeconds}
                                stringToValue={_toInteger}
                                valueToString={_toString}
                                key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${resetChangesCount}`}
                                onValueUpdated={(value) =>
                                    onValueChange(`periods[${periodIndex}].interval_seconds`, value)
                                }
                            />
                        </div>
                    )}
                    <p className="_small _oblique">
                        {!intervalSeconds && calculatedIntervalSeconds && numberOfUnits
                            ? `${t('transit:transitSchedule:CalculatedInterval')}: ${Math.ceil(
                                calculatedIntervalSeconds / 60
                            )} ${t('main:minuteAbbr')}`
                            : ''}
                    </p>
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:NumberOfUnits')}</label>
                        <InputStringFormatted
                            id={`formFieldTransitScheduleNumberOfUnitsPeriod${periodShortname}`}
                            // disabled={isFrozen}
                            value={numberOfUnits}
                            stringToValue={_toInteger}
                            valueToString={_toString}
                            key={`formFieldTransitScheduleNumberOfUnitsPeriod${periodShortname}${resetChangesCount}`}
                            onValueUpdated={(value) => onValueChange(`periods[${periodIndex}].number_of_units`, value)}
                        />
                    </div>
                    <p className="_small _oblique">
                        {!numberOfUnits && calculatedNumberOfUnits && intervalSeconds
                            ? `${roundToDecimals(calculatedNumberOfUnits, 1)} ${t(
                                'transit:transitSchedule:requiredUnits'
                            )}`
                            : ''}
                    </p>
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:CustomStartAt')}</label>
                        <InputString
                            id={`formFieldTransitScheduleCustomStartAtPeriod${periodShortname}`}
                            // disabled={isFrozen}
                            value={customStartAtStr}
                            onValueUpdated={(value) =>
                                onValueChange(`periods[${periodIndex}].custom_start_at_str`, value)
                            }
                        />
                    </div>
                    <div className="apptr__form-input-container">
                        <label>{t('transit:transitSchedule:CustomEndAt')}</label>
                        <InputString
                            id={`formFieldTransitScheduleCustomEndAtPeriod${periodShortname}`}
                            // disabled={isFrozen}
                            value={customEndAtStr}
                            onValueUpdated={(value) =>
                                onValueChange(`periods[${periodIndex}].custom_end_at_str`, value)
                            }
                        />
                    </div>
                </div>
                <div className="tr__form-section">
                    {/* {isFrozen !== true && ( */}
                    {(
                        <div className="tr__form-buttons-container _left">
                            {!_isBlank(chosenOutboundPathId) &&
                                ((!_isBlank(intervalSeconds) && _isBlank(numberOfUnits)) ||
                                    (!_isBlank(numberOfUnits) && _isBlank(intervalSeconds))) && (
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
                </div>
                {generatedResponses.length > 0 && <span>{generatedResponses.length} horaires générés avec succès</span>}
            </div>
        </div>
    );
};

export default TransitScheduleBatchPeriod;
