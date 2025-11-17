/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

import ExecutableJobComponent from '../../parts/executableJob/ExecutableJobComponent';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { AlgorithmConfiguration } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { SimulationMethodConfiguration } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import NetworkDesignFrontendExecutor from '../../../services/networkDesign/NetworkDesignFrontendExecutor';

interface TransitNetworkDesignListProps {
    onNewJob: (parameters?: {
        transitNetworkDesignParameters: TransitNetworkDesignParameters;
        algorithmConfiguration: AlgorithmConfiguration;
        simulationMethod: SimulationMethodConfiguration;
    }) => void;
}

const TransitNetworkDesignList: React.FunctionComponent<TransitNetworkDesignListProps> = (
    props: TransitNetworkDesignListProps
) => {
    const { t } = useTranslation('transit');
    const [errors, setErrors] = React.useState<ErrorMessage[]>([]);

    const replayJob = async (jobId: number) => {
        try {
            // This would be similar to TransitBatchRoutingCalculator.getCalculationParametersForJob
            // but for network design jobs
            console.log('Replay job', jobId);
            const parameters = await NetworkDesignFrontendExecutor.getCalculationParametersForJob(jobId);
            props.onNewJob(parameters);
            // const parameters = await TransitNetworkDesignCalculator.getJobParametersForReplay(jobId);
            // props.onNewJob(parameters);
        } catch (error) {
            setErrors([
                TrError.isTrError(error)
                    ? error.export().localizedMessage
                    : 'transit:networkDesign:errors:ErrorGettingReplayParameters'
            ]);
        }
    };

    return (
        <div className="tr__list-simulations-container">
            <h3>
                <img
                    src={'/dist/images/icons/interface/simulation_white.svg'}
                    className="_icon"
                    alt={t('transit:networkDesign:List')}
                />{' '}
                {t('transit:networkDesign:List')}
            </h3>
            <div className="tr__form-buttons-container">
                <Button
                    color="blue"
                    icon={faPlus}
                    iconClass="_icon"
                    label={t('transit:networkDesign:New')}
                    onClick={() => props.onNewJob()}
                />
            </div>
            {errors.length > 0 && <FormErrors errors={errors} />}
            <ExecutableJobComponent
                customActions={[
                    {
                        callback: replayJob,
                        title: 'transit:networkDesign:ReplayJob',
                        icon: faRedoAlt
                    }
                ]}
                defaultPageSize={10}
                jobType="evolutionaryTransitNetworkDesign"
            />
        </div>
    );
};

export default TransitNetworkDesignList;
