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

interface TransitionFSPanelState {
    selectedLine?: Line;
    selectedSchedule?: Schedule;
}

const FullSizePanel: React.FunctionComponent<LayoutSectionProps> = (_props: LayoutSectionProps) => {
    const [state, setState] = React.useState<TransitionFSPanelState>({
        selectedLine: serviceLocator.selectedObjectsManager.get('line'),
        selectedSchedule: serviceLocator.selectedObjectsManager.get('schedule')
    });

    React.useEffect(() => {
        const onSelectedLineUpdate = () =>
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            setState(({ selectedLine, ...rest }) => ({
                ...rest,
                selectedLine: serviceLocator.selectedObjectsManager.get('line')
            }));
        const onSelectedScheduleUpdate = () =>
            /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
            setState(({ selectedSchedule, ...rest }) => ({
                ...rest,
                selectedSchedule: serviceLocator.selectedObjectsManager.get('schedule')
            }));
        serviceLocator.eventManager.on('selected.update.line', onSelectedLineUpdate);
        serviceLocator.eventManager.on('selected.deselect.line', onSelectedLineUpdate);
        serviceLocator.eventManager.on('selected.update.schedule', onSelectedScheduleUpdate);
        serviceLocator.eventManager.on('selected.deselect.schedule', onSelectedScheduleUpdate);
        return () => {
            serviceLocator.eventManager.off('selected.update.line', onSelectedLineUpdate);
            serviceLocator.eventManager.off('selected.deselect.line', onSelectedLineUpdate);
            serviceLocator.eventManager.off('selected.update.schedule', onSelectedScheduleUpdate);
            serviceLocator.eventManager.off('selected.deselect.schedule', onSelectedScheduleUpdate);
        };
    }, []);

    return (
        <React.Fragment>
            {state.selectedLine && (
                <TransitSchedulesList selectedSchedule={state.selectedSchedule} selectedLine={state.selectedLine} />
            )}
        </React.Fragment>
    );
};

export default FullSizePanel;
