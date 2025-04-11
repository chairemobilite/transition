/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import Line from 'transition-common/lib/services/line/Line';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import TransitSchedulesList from '../forms/schedules/TransitScheduleList';
import TransitScheduleBatchLineSelect from '../forms/schedules/TransitScheduleBatchList';

interface TransitionFSPanelState {
    selectedLine?: Line;
    selectedSchedule?: Schedule;
    selectedScheduleMode: String;
}

const FullSizePanel: React.FunctionComponent<LayoutSectionProps> = (_props: LayoutSectionProps) => {
    const [state, setState] = React.useState<TransitionFSPanelState>({
        selectedLine: serviceLocator.selectedObjectsManager.getSingleSelection('line'),
        selectedSchedule: serviceLocator.selectedObjectsManager.getSingleSelection('schedule'),
        selectedScheduleMode: serviceLocator.selectedObjectsManager.getSingleSelection('scheduleMode')
    });

    React.useEffect(() => {
        const onSelectedLineUpdate = () =>
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            setState(({ selectedLine, ...rest }) => ({
                ...rest,
                selectedLine: serviceLocator.selectedObjectsManager.getSingleSelection('line')
            }));
        const onSelectedScheduleUpdate = () =>
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            setState(({ selectedSchedule, ...rest }) => ({
                ...rest,
                selectedSchedule: serviceLocator.selectedObjectsManager.getSingleSelection('schedule')
            }));
        const onSelectedScheduleModeUpdate = () =>
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            setState(({ selectedScheduleMode, ...rest }) => ({
                ...rest,
                selectedScheduleMode: serviceLocator.selectedObjectsManager.getSingleSelection('scheduleMode')
            }));
        serviceLocator.eventManager.on('selected.update.line', onSelectedLineUpdate);
        serviceLocator.eventManager.on('selected.deselect.line', onSelectedLineUpdate);
        serviceLocator.eventManager.on('selected.update.schedule', onSelectedScheduleUpdate);
        serviceLocator.eventManager.on('selected.deselect.schedule', onSelectedScheduleUpdate);
        serviceLocator.eventManager.on('selected.update.scheduleMode', onSelectedScheduleModeUpdate);
        return () => {
            serviceLocator.eventManager.off('selected.update.line', onSelectedLineUpdate);
            serviceLocator.eventManager.off('selected.deselect.line', onSelectedLineUpdate);
            serviceLocator.eventManager.off('selected.update.schedule', onSelectedScheduleUpdate);
            serviceLocator.eventManager.off('selected.deselect.schedule', onSelectedScheduleUpdate);
            serviceLocator.eventManager.off('selected.update.scheduleMode', onSelectedScheduleModeUpdate);
        };
    }, []);

    return (
        
        <React.Fragment>
            {state.selectedLine && state.selectedScheduleMode === 'single' && (
                <TransitSchedulesList selectedSchedule={state.selectedSchedule} selectedLine={state.selectedLine} />
            )}
            {!state.selectedLine && state.selectedScheduleMode === 'batch' && (
                <TransitScheduleBatchLineSelect/>
            )}
        </React.Fragment>
    );
};

export default FullSizePanel;
