/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';
import InputCheckbox from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';

interface ScheduleBatchPathSelectProps {
    selectedLine: Line;
    batchSelectedLines: Line[];
}

const TransitScheduleBatchPathSelect: React.FunctionComponent<ScheduleBatchPathSelectProps & WithTranslation> = ( 
    props: ScheduleBatchPathSelectProps & WithTranslation) => {
    const [state, setState] = React.useState<ScheduleBatchPathSelectProps>({
        selectedLine: serviceLocator.selectedObjectsManager.getSingleSelection('line'),
        batchSelectedLines: serviceLocator.selectedObjectsManager.getSingleSelection('scheduleMode'),
    });



    
    // const pathsSelectedLine = state.selectedLine.getPaths()
    

        
    return (
        // <div className="tr__form-section">
        //     <div className="apptr__form-input-container">
        //         <label>{props.t('transit:transitSchedule:OutboundPath')}</label>
        //         <InputSelect
        //             id={`formFieldTransitScheduleOutboundPath`}
        //             value={outboundPathId}
        //             choices={outboundPathsChoices}
        //             disabled={isFrozen}
        //             onValueChange={(e) =>
        //                 onValueChange(`periods[${periodIndex}].outbound_path_id`, {
        //                     value: e.target.value
        //                 })
        //             }
        //         />
        //     </div>
        //     <div className="apptr__form-input-container">
        //         <label>{props.t('transit:transitSchedule:InboundPath')}</label>
        //         <InputSelect
        //             id={`formFieldTransitScheduleInboundPath`}
        //             value={inboundPathId}
        //             choices={inboundPathsChoices}
        //             disabled={isFrozen}
        //             onValueChange={(e) =>
        //                 onValueChange(`periods[${periodIndex}].inbound_path_id`, {
        //                     value: e.target.value
        //                 })
        //             }
        //         />
        //     </div>
        // </div>
            <div>test</div>

    );
};

export default withTranslation(['transit', 'main', 'notifications'])(TransitScheduleBatchPathSelect);
