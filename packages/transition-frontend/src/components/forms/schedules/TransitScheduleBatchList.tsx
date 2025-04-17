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
import Path from 'transition-common/lib/services/path/Path';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import TransitScheduleBatchButton from './TransitScheduleBatchButton';
import ButtonList from '../../parts/ButtonList';
import TransitScheduleBatchEdit from './TransitScheduleBatchEdit';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';


interface BatchListProps {
    batchSelectedLines: Line[];
    isSelectionConfirmed?: boolean;
    selectedNewSchedules?: Schedule[];
    //onObjectSelected?: (objectId: string) => void;
}

const TransitScheduleBatchList: React.FunctionComponent<BatchListProps & WithTranslation> = (props: BatchListProps & WithTranslation) => {

    const [state, setState] = React.useState<BatchListProps>({
        batchSelectedLines: [],
        isSelectionConfirmed: false,
        selectedNewSchedules: [],
        //selectedLine: serviceLocator.selectedObjectsManager.getSingleSelection('line') && serviceLocator.selectedObjectsManager.getSingleSelection('line')[0]
    });
    const agencyCollection = serviceLocator.collectionManager.get('agencies').getFeatures()
    const linesCollection = serviceLocator.collectionManager.get('lines').getFeatures()
    const filteredlinesCollection = linesCollection.filter((line) => (line.getOutboundPaths().length > 0 && line.getInboundPaths().length > 0))
    const transitServices = serviceLocator.collectionManager.get('services');
    // React.useEffect(() => {
    //     const onBatchSelectedLinesUpdate = () =>
    //         /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    //         setState(({ batchSelectedLines, ...rest }) => ({
    //             ...rest,
    //             batchSelectedLines: serviceLocator.selectedObjectsManager.getSingleSelection('scheduleBatchLines')
    //         }));
    //     serviceLocator.eventManager.on('selected.update.scheduleBatchLines', onBatchSelectedLinesUpdate);
    //     return () => {
    //         serviceLocator.eventManager.off('selected.update.scheduleBatchLines', onBatchSelectedLinesUpdate);
    //     };
    // }, []);

    const onLineSelectedUpdate = (selectedLine: Line, isSelected: boolean) => {
        if (isSelected === true && !(state.batchSelectedLines.some((line) => line.getId() === selectedLine.getId()))) {
            setState({ batchSelectedLines: state.batchSelectedLines.concat([selectedLine]), isSelectionConfirmed: false, selectedNewSchedules: [] })
        }
        else if (isSelected === false) {
            setState({ batchSelectedLines: state.batchSelectedLines.filter((line) => line.getId() !== selectedLine.getId()), isSelectionConfirmed: false, selectedNewSchedules: []})

        }

        //serviceLocator.selectedObjectsManager.setSelection('line', [state.selectedLine])
    }

    const onConfirmation = () => {
        const newSchedules = state.batchSelectedLines.map((line) => new Schedule(
            { line_id: line.getId() },
            true,
            serviceLocator.collectionManager
        ))
        setState({ isSelectionConfirmed: true, selectedNewSchedules: newSchedules, batchSelectedLines: state.batchSelectedLines })
    }


    const onUndoConfirmation = () => {
        setState({ isSelectionConfirmed: false, selectedNewSchedules: [], batchSelectedLines: state.batchSelectedLines })
    }

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

    agencyCollection.forEach(agency => {
        const agencyLinesButtons: any[] = []
        agency.getLines().forEach(line => {
            if (filteredlinesCollection.includes(line))
                agencyLinesButtons.push(
                <TransitScheduleBatchButton 
                    disabled={state.isSelectionConfirmed === true} 
                    key={line.getId()} 
                    line={line} selectedLines={state.batchSelectedLines} 
                    onLineSelectedUpdate={onLineSelectedUpdate} 
                    />)
        });

        if (agencyLinesButtons.length > 0)
            linesButtons.push(<h4 key={agency.getId()}>{agency.toString()}</h4>)
        linesButtons = linesButtons.concat(agencyLinesButtons)
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
                <div className='tr__form-buttons-container'>
                    <Button
                        color="grey"
                        icon={faWindowClose}
                        iconClass="_icon"
                        label={props.t('transit:transitSchedule:CloseSchedulesWindow')}
                        onClick={function () {
                            // close
                            serviceLocator.selectedObjectsManager.setSelection('scheduleMode', []);
                            serviceLocator.eventManager.emit('fullSizePanel.hide');
                        }}
                    />
                </div>
            )}
            {state.isSelectionConfirmed === false && <div className='tr__form-buttons-container _left'>
                <Button
                    disabled={state.batchSelectedLines.length === filteredlinesCollection.length}
                    color="blue"
                    label={props.t('main:SelectAll')}
                    onClick={function () {
                        setState({ batchSelectedLines: filteredlinesCollection, isSelectionConfirmed: false, selectedNewSchedules: [] })
                    }}
                />

                <Button
                    disabled={state.batchSelectedLines.length === 0}
                    color="blue"
                    label={props.t('main:UnselectAll')}
                    onClick={function () {
                        setState({ batchSelectedLines: [], isSelectionConfirmed: false, selectedNewSchedules: [] })
                    }}
                />
            </div>}

            {state.isSelectionConfirmed === false && <ButtonList>{linesButtons}</ButtonList>}

            <div className='tr__form-buttons-container _left'>
                {state.isSelectionConfirmed == true && 
                <span>
                    <Button
                        color="blue"
                        icon={faArrowLeft}
                        iconClass="_icon"
                        label={props.t('transit:transitSchedule:ReturnBatchLineSelection')}
                        onClick={onUndoConfirmation}
                    />
                </span>}
                
                {state.isSelectionConfirmed == false && <span title={props.t('transit:transitSchedule:ConfirmBatchLineSelection')}>
                    <Button
                        disabled={state.batchSelectedLines.length < 1 || state.isSelectionConfirmed}
                        icon={faCheckCircle}
                        iconClass="_icon"
                        label={props.t('transit:transitSchedule:ConfirmBatchLineSelection')}
                        onClick={onConfirmation}
                    />
                </span>}

            </div>
            {!props.batchSelectedLines && (
                <Button
                    color="grey"
                    icon={faWindowClose}
                    iconClass="_icon"
                    label={props.t('transit:transitSchedule:CloseSchedulesWindow')}
                    onClick={function () {
                        // close
                        serviceLocator.selectedObjectsManager.setSelection('scheduleMode', []);
                        serviceLocator.selectedObjectsManager.deselect('schedule');
                        serviceLocator.selectedObjectsManager.deselect('line');
                        serviceLocator.eventManager.emit('fullSizePanel.hide');
                    }}
                />
            )}

            {state.isSelectionConfirmed && 
                <TransitScheduleBatchEdit
                    lines={state.batchSelectedLines}
                    schedules={state.selectedNewSchedules}
                    availableServices={serviceChoices}
                />

            }
        </div>
    );
};

export default withTranslation('transit')(TransitScheduleBatchList);
