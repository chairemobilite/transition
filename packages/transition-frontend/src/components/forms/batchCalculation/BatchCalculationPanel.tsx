/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import BatchCalculationList from './BatchCalculationList';
import BatchCalculationForm from './BatchCalculationForm';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { BatchRoutingOdDemandFromCsvAttributes } from 'transition-common/lib/services/transitDemand/types';

export interface CalculationPanelPanelProps {
    availableRoutingModes?: string[];
}

const CalculationPanel: React.FunctionComponent<CalculationPanelPanelProps> = (props: CalculationPanelPanelProps) => {
    // TODO: scenarioCollection is never read. Implement a use for it, or remove the hook and onScenarioCollectionUpdate() entirely.
    // const [scenarioCollection, setScenarioCollection] = React.useState<ScenarioCollection | undefined>(
    //     serviceLocator.collectionManager.get('scenarios')
    // );

    const [isNewAnalysis, setIsNewAnalysis] = React.useState(false);
    const [initialValues, setInitialValues] = React.useState<
        | {
              parameters: BatchCalculationParameters;
              demand: BatchRoutingOdDemandFromCsvAttributes;
              csvFields: string[];
          }
        | undefined
    >(undefined);

    const onScenarioCollectionUpdate = () => {
        //setScenarioCollection(serviceLocator.collectionManager.get('scenarios'));
    };

    const onNewAnalysis = (parameters?: {
        parameters: BatchCalculationParameters;
        demand: BatchRoutingOdDemandFromCsvAttributes;
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

export default CalculationPanel;
