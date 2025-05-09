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
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { _isBlank, _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import { decimalHourToTimeStr, secondsToMinutes, minutesToSeconds } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import LineCollection from 'transition-common/lib/services/line/LineCollection';

interface TransitScheduleBatchPeriodProps {
    schedules: Schedule[];
    lines: LineCollection;
    periodIndex: number;
    period: any;
    schedulePeriods: any[];
    allowSecondsBasedSchedules: boolean;
    resetChangesCount: number;
    onValueChange: (path: string, newValue: { value: any }) => void;
}

// FIXME this component is very similar to TransitSchedulePeriod and the two should be a single component.
// The main differences between the two are
// 1. This component takes an array of schedules and a line collection, instead of a single schedule/line.
// 2. This component has an extra function; chooseLongestPaths, since it would be complicated for the user
//    to select the paths for all the lines
// 3. This component doesn't have a remove schedule function
// 4. When a schedule is generated, this component doesn't display the tripRows, since they're different for each line.
//    it instead displays how many schedules have been generated
const TransitScheduleBatchPeriod: React.FC<TransitScheduleBatchPeriodProps> = (props) => {
    const { t, i18n } = useTranslation();

    const {
        schedules,
        lines,
        period,
        schedulePeriods,
        periodIndex,
        allowSecondsBasedSchedules,
        resetChangesCount,
        onValueChange
    } = props;

    const periodName = period.name[i18n.language];
    const periodShortname = period.shortname;
    const periodStartAtTimeStr = decimalHourToTimeStr(period.startAtHour);
    const periodEndAtTimeStr = decimalHourToTimeStr(period.endAtHour);
    const [generatedResponses, setGeneratedResponses] = React.useState<any[]>([]);

    // Automatically select the paths with the bigger node count
    const chooseLongestPaths = () => {
        lines.getFeatures().forEach((line) => {
            const paths = line.paths;
            let chosenOutboundPath;
            let chosenInboundPath;
            let chosenInboundPathId = '';
            let chosenOutboundPathId = '';
            paths.forEach((path) => {
                if (['outbound', 'loop', 'other'].includes(path.attributes.direction)) {
                    chosenOutboundPath = chosenOutboundPath
                        ? chosenOutboundPath.countNodes() < path.countNodes()
                            ? path
                            : chosenOutboundPath
                        : path;
                } else if (path.attributes.direction === 'inbound') {
                    chosenInboundPath = chosenInboundPath
                        ? chosenInboundPath.countNodes() < path.countNodes()
                            ? path
                            : chosenInboundPath
                        : path;
                }
            });
            chosenOutboundPathId = chosenOutboundPath ? chosenOutboundPath.getId() : '';
            chosenInboundPathId = chosenInboundPath ? chosenInboundPath.getId() : '';
            const schedule = schedules.find((schedule) => schedule.attributes.line_id === line.getId());
            if (schedule && chosenOutboundPath) {
                const scheduleIdx = schedules.indexOf(schedule);
                schedules[scheduleIdx].attributes.periods[periodIndex].outbound_path_id = chosenOutboundPathId;
                schedules[scheduleIdx].attributes.periods[periodIndex].inbound_path_id = chosenInboundPathId;
            }
        });
    };

    const intervalSeconds = schedulePeriods[0].interval_seconds;
    const calculatedIntervalSeconds = schedulePeriods[0].calculated_interval_seconds;
    const numberOfUnits = schedulePeriods[0].number_of_units;
    const calculatedNumberOfUnits = schedulePeriods[0].calculated_number_of_units;
    const customStartAtStr =
        schedulePeriods[0].custom_start_at_str || decimalHourToTimeStr(period.startAtHour) || undefined;
    const customEndAtStr = schedulePeriods[0].custom_end_at_str || undefined;
    const handleGenerateSchedule = () => {
        chooseLongestPaths();
        const generatedResponsesTemp: any[] = [];
        lines.getFeatures().forEach((line, index) => {
            const schedule = schedules.find((schedule) => {
                return schedule.attributes.line_id === line.getId();
            });
            if (schedule) {
                schedulePeriods[index].interval_seconds = intervalSeconds;
                schedulePeriods[index].calculated_interval_seconds = calculatedIntervalSeconds;
                schedulePeriods[index].number_of_units = numberOfUnits;
                schedulePeriods[index].calculated_number_of_units = calculatedNumberOfUnits;
                schedulePeriods[index].custom_start_at_str = customStartAtStr;
                schedulePeriods[index].custom_end_at_str = customEndAtStr;
                const response = schedule.generateForPeriod(periodShortname);
                if (response.trips) {
                    schedule.set(`periods[${periodIndex}].trips`, response.trips);
                    generatedResponsesTemp.push(response);
                }
            }
        });
        setGeneratedResponses(generatedResponsesTemp);
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
                            <label>{t('transit:transitSchedule:outboundIntervalMinutes')}</label>
                            <InputStringFormatted
                                id={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}`}
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
                            value={customEndAtStr}
                            onValueUpdated={(value) =>
                                onValueChange(`periods[${periodIndex}].custom_end_at_str`, value)
                            }
                        />
                    </div>
                </div>
                <div className="tr__form-section">
                    {
                        <div className="tr__form-buttons-container _left">
                            {((!_isBlank(intervalSeconds) && _isBlank(numberOfUnits)) ||
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
                    }
                </div>
                {generatedResponses.length > 0 && <span>{generatedResponses.length} horaires générés avec succès</span>}
            </div>
        </div>
    );
};

export default TransitScheduleBatchPeriod;
