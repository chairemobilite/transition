/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import BatchRoutingCalculationList from './routingCalculation/BatchRoutingCalculationList';
import BatchCalculationForm from './routingCalculation/BatchRoutingCalculationForm';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { TransitBatchValidationDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import BatchRoutingValidationList from './routingValidation/BatchRoutingValidationList';
import BatchRoutingValidationForm from './routingValidation/BatchRoutingValidationForm';

export interface CalculationPanelPanelProps {
    availableRoutingModes?: string[];
}

const CalculationPanel: React.FunctionComponent<CalculationPanelPanelProps> = (props: CalculationPanelPanelProps) => {
    // State for routing calculation
    const [isNewCalculation, setIsNewCalculation] = React.useState(false);
    const [calculationInitialValues, setCalculationInitialValues] = React.useState<
        | {
              parameters: BatchCalculationParameters;
              demand: TransitBatchValidationDemandAttributes;
              csvFields: string[];
          }
        | undefined
    >(undefined);

    // State for routing validation
    const [isNewValidation, setIsNewValidation] = React.useState(false);
    const [validationInitialValues, setValidationInitialValues] = React.useState<
        | {
              parameters: BatchCalculationParameters;
              demand: TransitBatchValidationDemandAttributes;
              csvFields: string[];
          }
        | undefined
    >(undefined);
    const { t } = useTranslation(['transit', 'main']);

    const onScenarioCollectionUpdate = () => {
        // No-op for now
    };

    const onNewCalculation = (parameters?: {
        parameters: BatchCalculationParameters;
        demand: TransitBatchValidationDemandAttributes;
        csvFields: string[];
    }) => {
        setCalculationInitialValues(parameters);
        setIsNewCalculation(true);
    };

    const onNewValidation = (parameters?: {
        parameters: BatchCalculationParameters;
        demand: TransitBatchValidationDemandAttributes;
        csvFields: string[];
    }) => {
        setValidationInitialValues(parameters);
        setIsNewValidation(true);
    };

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.scenarios', onScenarioCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.scenarios', onScenarioCollectionUpdate);
        };
    }, []);

    return (
        <div id="tr__form-transit-calculation-panel" className="tr__form-transit-calculation-panel tr__panel">
            <Tabs>
                <TabList>
                    <Tab>{t('transit:batchCalculation:RoutingCalculation')}</Tab>
                    <Tab>{t('transit:batchCalculation:ValidationCalculation')}</Tab>
                </TabList>

                <TabPanel>
                    {isNewCalculation === false && <BatchRoutingCalculationList onNewAnalysis={onNewCalculation} />}
                    {isNewCalculation && (
                        <BatchCalculationForm
                            availableRoutingModes={props.availableRoutingModes}
                            initialValues={calculationInitialValues}
                            onEnd={() => setIsNewCalculation(false)}
                        />
                    )}
                </TabPanel>
                <TabPanel>
                    {isNewValidation === false && <BatchRoutingValidationList onNewAnalysis={onNewValidation} />}
                    {isNewValidation && (
                        <BatchRoutingValidationForm
                            availableRoutingModes={props.availableRoutingModes}
                            initialValues={validationInitialValues}
                            onEnd={() => setIsNewValidation(false)}
                        />
                    )}
                </TabPanel>
            </Tabs>
        </div>
    );
};

export default CalculationPanel;
