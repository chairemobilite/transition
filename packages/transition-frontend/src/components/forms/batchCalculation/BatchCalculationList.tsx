/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

import ExecutableJobComponent from '../../parts/executableJob/ExecutableJobComponent';
import TransitBatchRoutingCalculator from 'transition-common/lib/services/transitRouting/TransitBatchRoutingCalculator';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { BatchRoutingOdDemandFromCsvAttributes } from 'transition-common/lib/services/transitDemand/types';

interface BatchCalculationListProps extends WithTranslation {
    onNewAnalysis: (parameters?: {
        parameters: BatchCalculationParameters;
        demand: BatchRoutingOdDemandFromCsvAttributes;
        csvFields: string[];
    }) => void;
}

const BatchCalculationList: React.FunctionComponent<BatchCalculationListProps> = (props: BatchCalculationListProps) => {
    const [errors, setErrors] = React.useState<ErrorMessage[]>([]);
    const replayJob = async (jobId: number) => {
        try {
            const parameters = await TransitBatchRoutingCalculator.getCalculationParametersForJob(jobId);
            props.onNewAnalysis(parameters);
        } catch (error) {
            setErrors([
                TrError.isTrError(error)
                    ? error.export().localizedMessage
                    : 'transit:batchCalculation:errors:ErrorGettingReplayParameters'
            ]);
        }
    };
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
                    onClick={() => props.onNewAnalysis()}
                />
            </div>
            {errors.length > 0 && <FormErrors errors={errors} />}
            <ExecutableJobComponent
                customActions={[{ callback: replayJob, title: 'transit:batchCalculation:ReplayJob', icon: faRedoAlt }]}
                defaultPageSize={10}
                jobType="batchRoute"
            />
        </div>
    );
};

export default withTranslation('transit')(BatchCalculationList);
