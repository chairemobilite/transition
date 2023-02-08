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

const CalculationPanel: React.FunctionComponent<WithTranslation> = (props: WithTranslation) => {
    const [scenarioCollection, setScenarioCollection] = React.useState<ScenarioCollection | undefined>(
        serviceLocator.collectionManager.get('scenarios')
    );
    const [isNewAnalysis, setIsNewAnalysis] = React.useState(false);

    const onScenarioCollectionUpdate = () => {
        setScenarioCollection(serviceLocator.collectionManager.get('scenarios'));
    };

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.scenarios', onScenarioCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.scenarios', onScenarioCollectionUpdate);
        };
    }, []);

    return (
        <div id="tr__form-transit-calculation-panel" className="tr__form-transit-calculation-panel tr__panel">
            {isNewAnalysis === false && <BatchCalculationList onNewAnalysis={() => setIsNewAnalysis(true)} />}
            {isNewAnalysis && <BatchCalculationForm onEnd={() => setIsNewAnalysis(false)} />}
        </div>
    );
};

export default withTranslation(['transit', 'main', 'form'])(CalculationPanel);
