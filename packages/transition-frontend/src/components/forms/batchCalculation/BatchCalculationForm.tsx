/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import Button from 'chaire-lib-frontend/lib/components/input/Button';

export interface ScenarioAnalysisFormProps {
    availableRoutingModes?: string[];
    onEnd: () => void;
}
/**
 * Scenario Analysis form, to configure what to analyse:
 *
 * step 1: Select a demand and upload file if necessary
 *
 * step 2: Select analysis parameters
 *
 * step 3: Confirm and run analysis
 *
 * @param {(ScenarioAnalysisFormProps & WithTranslation)} props
 * @return {*}
 */
const ScenarioAnalysisForm: React.FunctionComponent<ScenarioAnalysisFormProps & WithTranslation> = (
    props: ScenarioAnalysisFormProps & WithTranslation
) => {
    return (
        <React.Fragment>
            {props.t('transit:batchCalculation:New')}
            <div className="tr__form-buttons-container">
                <span title={props.t('main:Cancel')}>
                    <Button key="back" color="grey" label={props.t('main:Cancel')} onClick={props.onEnd} />
                </span>
            </div>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(ScenarioAnalysisForm);
