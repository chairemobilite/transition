/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _get from 'lodash.get';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

import ExecutableJobComponent from '../../parts/executableJob/ExecutableJobComponent';

interface BatchCalculationListProps extends WithTranslation {
    onNewAnalysis: () => void;
}

const BatchCalculationList: React.FunctionComponent<BatchCalculationListProps> = (props: BatchCalculationListProps) => {
    return (
        <div className="tr__list-simulations-container">
            <h3>
                <img
                    src={'/dist/images/icons/interface/od_routing_white.svg'}
                    className="_icon"
                    alt={props.t('transit:batchCalculation:List')}
                />{' '}
                {props.t('transit:batchCalculation:List')}
            </h3>
            <div className="tr__form-buttons-container">
                <Button
                    color="blue"
                    icon={faPlus}
                    iconClass="_icon"
                    label={props.t('transit:batchCalculation:New')}
                    onClick={props.onNewAnalysis}
                />
            </div>
            <ExecutableJobComponent defaultPageSize={10} jobType="batchRoute" />
        </div>
    );
};

export default withTranslation(['transit', 'main', 'form', 'notifications'])(BatchCalculationList);
