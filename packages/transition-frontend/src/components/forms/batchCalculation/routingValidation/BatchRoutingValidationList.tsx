/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

import ExecutableJobComponent from '../../../parts/executableJob/ExecutableJobComponent';
import TransitBatchRoutingValidator from 'transition-common/lib/services/transitRouting/TransitBatchRoutingValidator';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { TransitBatchValidationDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

interface BatchValidationListProps {
    onNewAnalysis: (parameters?: {
        parameters: BatchCalculationParameters;
        demand: TransitBatchValidationDemandAttributes;
        csvFields: string[];
    }) => void;
}

const BatchRoutingValidationList: React.FunctionComponent<BatchValidationListProps> = (
    props: BatchValidationListProps
) => {
    const { t } = useTranslation('transit');
    const [errors, setErrors] = React.useState<ErrorMessage[]>([]);
    const replayJob = async (jobId: number) => {
        try {
            const parameters = await TransitBatchRoutingValidator.getValidationParametersForJob(jobId);
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
                    alt={t('transit:batchCalculation:ValidationList')}
                />{' '}
                {t('transit:batchCalculation:ValidationList')}
            </h3>
            <div className="tr__form-buttons-container">
                <Button
                    color="blue"
                    icon={faPlus}
                    iconClass="_icon"
                    label={t('transit:batchCalculation:ValidationNew')}
                    onClick={() => props.onNewAnalysis()}
                />
            </div>
            {errors.length > 0 && <FormErrors errors={errors} />}
            <ExecutableJobComponent
                customActions={[{ callback: replayJob, title: 'transit:batchCalculation:ReplayJob', icon: faRedoAlt }]}
                defaultPageSize={10}
                jobType="batchValidate"
            />
        </div>
    );
};

export default BatchRoutingValidationList;
