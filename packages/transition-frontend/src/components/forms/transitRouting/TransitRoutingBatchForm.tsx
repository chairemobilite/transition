/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';

import _cloneDeep from 'lodash.clonedeep';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import TransitOdDemandFromCsv from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

export interface TransitBatchRoutingFormProps {
    routingEngine: TransitRouting;
    isRoutingEngineValid?: () => boolean;
}

class TransitRoutingBatchForm extends ChangeEventsForm<
    TransitBatchRoutingFormProps & WithTranslation,
    ChangeEventsState<TransitOdDemandFromCsv>
> {
    constructor(props: TransitBatchRoutingFormProps & WithTranslation) {
        super(props);

        const batchRoutingEngine = new TransitOdDemandFromCsv(
            Object.assign(_cloneDeep(Preferences.get('transit.routing.batch')), { saveToDb: false }),
            false
        );

        this.state = {
            object: batchRoutingEngine,
            formValues: {}
        };
    }

    render() {
        // TODO This feature has moved in february 2023. Keep this message for a
        // few months, just so users get a warning if they are used to coming
        // here for batch calculation
        return (
            <Collapsible trigger={this.props.t('transit:transitRouting:BatchRoutingCsv')} transitionTime={100}>
                <div className="tr__form-section">
                    <label>{this.props.t('transit:transitRouting:BatchRoutingHasMoved')}</label>
                    <Button
                        color="blue"
                        iconClass="_icon small"
                        label={this.props.t('transit:transitRouting:GoToBatchRouting')}
                        onClick={() => {
                            // notifications are handled inside saveAndUpdateAll function:
                            serviceLocator.eventManager.emit('section.change', 'batchCalculation', false);
                        }}
                    />
                </div>
            </Collapsible>
        );
    }
}

// ** File upload
//export default FileUploaderHOC(TransitRoutingForm, null, false);
export default withTranslation(['transit', 'main'])(TransitRoutingBatchForm);
