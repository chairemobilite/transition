/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faWindowClose } from '@fortawesome/free-solid-svg-icons/faWindowClose';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import TransitScheduleBatchButton from './TransitScheduleBatchButton';
import ButtonList from '../../parts/ButtonList';
import TransitScheduleBatchEdit from './TransitScheduleBatchEdit';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import LineCollection from 'transition-common/lib/services/line/LineCollection';

interface BatchListProps {
    batchSelectedLines: LineCollection;
    isSelectionConfirmed?: boolean;
    selectedNewSchedules?: Schedule[];
}

// The batch schedule modification is only available on the lines that have at least
// one inbound and one outbound path. See the filteredLinesCollection below
const TransitScheduleBatchList: React.FunctionComponent<BatchListProps & WithTranslation> = (
    props: BatchListProps & WithTranslation
) => {
    const [state, setState] = React.useState<BatchListProps>({
        batchSelectedLines: new LineCollection([], undefined),
        isSelectionConfirmed: false,
        selectedNewSchedules: []
    });
    const agencyCollection = serviceLocator.collectionManager.get('agencies').getFeatures();
    const linesCollection = serviceLocator.collectionManager.get('lines').getFeatures();
    // Only the lines with one inbound and one outbound path are displayed
    const filteredlinesCollection = linesCollection.filter(
        (line) => line.getOutboundPaths().length > 0 && line.getInboundPaths().length > 0
    );
    const transitServices = serviceLocator.collectionManager.get('services');
    const onLineSelectedUpdate = (selectedLine: Line, isSelected: boolean) => {
        if (isSelected === true && !state.batchSelectedLines.getById(selectedLine.getId())) {
            state.batchSelectedLines.add(selectedLine);
            setState({
                batchSelectedLines: state.batchSelectedLines,
                isSelectionConfirmed: false,
                selectedNewSchedules: []
            });
        } else if (isSelected === false) {
            state.batchSelectedLines.removeById(selectedLine.getId());
            setState({
                batchSelectedLines: state.batchSelectedLines,
                isSelectionConfirmed: false,
                selectedNewSchedules: []
            });
        }
    };

    const onConfirmation = async () => {
        const newSchedules = state.batchSelectedLines
            .getFeatures()
            .map((line) => new Schedule({ line_id: line.getId() }, true, serviceLocator.collectionManager));

        const refreshPromises = state.batchSelectedLines
            .getFeatures()
            .map((line) => line.refreshSchedules(serviceLocator.socketEventManager));

        await Promise.all(refreshPromises);

        setState({
            isSelectionConfirmed: true,
            selectedNewSchedules: newSchedules,
            batchSelectedLines: state.batchSelectedLines
        });
    };

    const onUndoConfirmation = () => {
        setState({
            isSelectionConfirmed: false,
            selectedNewSchedules: [],
            batchSelectedLines: state.batchSelectedLines
        });
    };

    const serviceChoices: choiceType[] = [];
    if (transitServices && transitServices.size() > 0) {
        const serviceFeatures = transitServices.getFeatures();
        for (let i = 0, count = transitServices.size(); i < count; i++) {
            const serviceFeature = serviceFeatures[i];
            serviceChoices.push({
                value: serviceFeature.id,
                label: serviceFeature.toString(false)
            });
        }
    }

    let linesButtons: any[] = [];

    agencyCollection.forEach((agency) => {
        const agencyLinesButtons: any[] = [];
        agency.getLines().forEach((line) => {
            if (filteredlinesCollection.includes(line))
                agencyLinesButtons.push(
                    <TransitScheduleBatchButton
                        disabled={state.isSelectionConfirmed === true}
                        key={line.getId()}
                        line={line}
                        selectedLines={state.batchSelectedLines}
                        onLineSelectedUpdate={onLineSelectedUpdate}
                    />
                );
        });

        if (agencyLinesButtons.length > 0) linesButtons.push(<h4 key={agency.getId()}>{agency.toString()}</h4>);
        linesButtons = linesButtons.concat(agencyLinesButtons);
    });

    return (
        <div>
            <h3>
                <img
                    src={'/dist/images/icons/transit/schedule_white.svg'}
                    className="_icon"
                    alt={props.t('transit:transitSchedule:BatchSchedules')}
                />{' '}
                {props.t('transit:transitSchedule:BatchSchedules')}
            </h3>

            {state.isSelectionConfirmed === false && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="grey"
                        icon={faWindowClose}
                        iconClass="_icon"
                        label={props.t('transit:transitSchedule:CloseSchedulesWindow')}
                        onClick={function () {
                            serviceLocator.selectedObjectsManager.deselect('schedule');
                            serviceLocator.selectedObjectsManager.deselect('line');
                            serviceLocator.eventManager.emit('fullSizePanel.hide');
                        }}
                    />
                </div>
            )}
            {state.isSelectionConfirmed === false && (
                <div className="tr__form-buttons-container _left">
                    <Button
                        disabled={state.batchSelectedLines.length === filteredlinesCollection.length}
                        color="blue"
                        label={props.t('main:SelectAll')}
                        onClick={function () {
                            state.batchSelectedLines.setFeatures(filteredlinesCollection);
                            setState({
                                batchSelectedLines: state.batchSelectedLines,
                                isSelectionConfirmed: false,
                                selectedNewSchedules: []
                            });
                        }}
                    />

                    <Button
                        disabled={state.batchSelectedLines.length === 0}
                        color="blue"
                        label={props.t('main:UnselectAll')}
                        onClick={function () {
                            state.batchSelectedLines.clear();
                            setState({
                                batchSelectedLines: state.batchSelectedLines,
                                isSelectionConfirmed: false,
                                selectedNewSchedules: []
                            });
                        }}
                    />
                </div>
            )}

            {state.isSelectionConfirmed === false && <ButtonList>{linesButtons}</ButtonList>}

            <div className="tr__form-buttons-container _left">
                {state.isSelectionConfirmed === true && (
                    <span>
                        <Button
                            color="blue"
                            icon={faArrowLeft}
                            iconClass="_icon"
                            label={props.t('transit:transitSchedule:ReturnBatchLineSelection')}
                            onClick={onUndoConfirmation}
                        />
                    </span>
                )}

                {state.isSelectionConfirmed === false && (
                    <span title={props.t('transit:transitSchedule:ConfirmBatchLineSelection')}>
                        <Button
                            disabled={state.batchSelectedLines.length < 1 || state.isSelectionConfirmed}
                            icon={faCheckCircle}
                            iconClass="_icon"
                            label={props.t('transit:transitSchedule:ConfirmBatchLineSelection')}
                            onClick={onConfirmation}
                        />
                    </span>
                )}
            </div>
            {!props.batchSelectedLines && (
                <Button
                    color="grey"
                    icon={faWindowClose}
                    iconClass="_icon"
                    label={props.t('transit:transitSchedule:CloseSchedulesWindow')}
                    onClick={function () {
                        serviceLocator.selectedObjectsManager.deselect('schedule');
                        serviceLocator.selectedObjectsManager.deselect('line');
                        serviceLocator.eventManager.emit('fullSizePanel.hide');
                    }}
                />
            )}

            {state.isSelectionConfirmed && (
                <TransitScheduleBatchEdit
                    lines={state.batchSelectedLines}
                    schedules={state.selectedNewSchedules}
                    availableServices={serviceChoices}
                />
            )}
        </div>
    );
};

export default withTranslation('transit')(TransitScheduleBatchList);
