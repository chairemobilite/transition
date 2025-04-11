/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faWindowClose } from '@fortawesome/free-solid-svg-icons/faWindowClose';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import TransitScheduleEdit from './TransitScheduleEdit';
import TransitScheduleButton from './TransitScheduleButton';
import TransitScheduleBatchButton from './TransitScheduleBatchButton';
import ButtonList from '../../parts/ButtonList';

interface BatchLineSelectProps extends WithTranslation {
    batchSelectedSchedules?: Map<String, [Schedule, Schedule]>;
    batchSelectedLines?: Line[];
    selectedLine: Line;
    onObjectSelected?: (objectId: string) => void;
}

const TransitScheduleBatchLineSelect: React.FunctionComponent<BatchLineSelectProps> = (props: BatchLineSelectProps) => {
    // const isFrozen = props.selectedLine.isFrozen();
    // props.selectedLine.refreshPaths();
    // const scheduleByServiceId = props.selectedLine.attributes.scheduleByServiceId;
    const lineCollection = serviceLocator.collectionManager.get('lines').getFeatures().sort((lineA, lineB) => lineA.getAttributes().agency_id.localeCompare(lineB.getAttributes().agency_id));
    // const activeServiceIds: string[] = Object.keys(scheduleByServiceId);
    const transitServices = serviceLocator.collectionManager.get('services');
    

    // const scheduleButtons = Object.keys(scheduleByServiceId).map((serviceId) => {
    //     const schedule = new Schedule(scheduleByServiceId[serviceId], false, serviceLocator.collectionManager);
    //     schedule.startEditing();
    //     return (
    //         <TransitScheduleButton
    //             key={schedule.id}
    //             schedule={schedule}
    //             selectedSchedule={props.selectedSchedule}
    //             line={props.selectedLine}
    //         />
    //     );
    // });

    // const serviceChoices: choiceType[] = [];
    // if (transitServices && transitServices.size() > 0) {
    //     const serviceFeatures = transitServices.getFeatures();
    //     for (let i = 0, count = transitServices.size(); i < count; i++) {
    //         const serviceFeature = serviceFeatures[i];
    //         if (
    //             !activeServiceIds.includes(serviceFeature.id) ||
    //             (props.selectedSchedule && props.selectedSchedule.attributes.service_id === serviceFeature.id)
    //         ) {
    //             serviceChoices.push({
    //                 value: serviceFeature.id,
    //                 label: serviceFeature.toString(false)
    //             });
    //         }
    //     }
    // }
    const linesButtons = lineCollection.map((line) => (
        <TransitScheduleBatchButton
            key={line.id}
            line={line}
            selectedLine={props.selectedLine}
            lineIsHidden={
                serviceLocator.pathLayerManager ? serviceLocator.pathLayerManager.lineIsHidden(line.id) : false
            }
            onObjectSelected={props.onObjectSelected}
        />
    ));

    return (

        <div>
            {/* <ButtonList key={`lines${props.agency.getId()}`}> */}
            <ButtonList>
                {linesButtons}
            </ButtonList>
            {/* {props.selectedSchedule && (
                <TransitScheduleEdit
                    availableServices={serviceChoices}
                    schedule={props.selectedSchedule}
                    line={props.selectedLine}
                />
            )} */}
            {
                !props.batchSelectedLines && (
                    <Button
                        color="grey"
                        icon={faWindowClose}
                        iconClass="_icon"
                        label={props.t('transit:transitSchedule:CloseSchedulesWindow')}
                        onClick={function () {
                            // close
                            serviceLocator.eventManager.emit('fullSizePanel.hide');
                        }}
                    />
                )
            }
        </div>

    );
};

export default withTranslation('transit')(TransitScheduleBatchLineSelect);
