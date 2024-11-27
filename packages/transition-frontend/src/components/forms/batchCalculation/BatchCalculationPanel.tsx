/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import BatchCalculationList from './BatchCalculationList';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import BatchCalculationForm from './BatchCalculationForm';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { TransitBatchRoutingDemandAttributes } from 'transition-common/lib/services/transitDemand/types';

export interface CalculationPanelPanelProps {
    availableRoutingModes?: string[];
}

const CalculationPanel: React.FunctionComponent<CalculationPanelPanelProps & WithTranslation> = (
    props: CalculationPanelPanelProps & WithTranslation
) => {
    const [scenarioCollection, setScenarioCollection] = React.useState<ScenarioCollection | undefined>(
        serviceLocator.collectionManager.get('scenarios')
    );
    const [isNewAnalysis, setIsNewAnalysis] = React.useState(false);
    const [initialValues, setInitialValues] = React.useState<
        | {
              parameters: BatchCalculationParameters;
              demand: TransitBatchRoutingDemandAttributes;
              csvFields: string[];
          }
        | undefined
    >(undefined);

    const onScenarioCollectionUpdate = () => {
        setScenarioCollection(serviceLocator.collectionManager.get('scenarios'));
    };

    const onNewAnalysis = (parameters?: {
        parameters: BatchCalculationParameters;
        demand: TransitBatchRoutingDemandAttributes;
        csvFields: string[];
    }) => {
        setInitialValues(parameters);
        setIsNewAnalysis(true);
    };

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.scenarios', onScenarioCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.scenarios', onScenarioCollectionUpdate);
        };
    }, []);

    return (
        <div id="tr__form-transit-calculation-panel" className="tr__form-transit-calculation-panel tr__panel">
            {isNewAnalysis === false && <BatchCalculationList onNewAnalysis={onNewAnalysis} />}
            {isNewAnalysis && (
                <BatchCalculationForm
                    availableRoutingModes={props.availableRoutingModes}
                    initialValues={initialValues}
                    // TODO This function should receive some parameter, whether it is cancelled or a calculation is pending.
                    onEnd={() => setIsNewAnalysis(false)}
                />
            )}
        </div>
    );
};

export default withTranslation()(CalculationPanel);
