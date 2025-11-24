/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import TransitNetworkDesignList from './TransitNetworkDesignList';
import TransitNetworkDesignForm from './TransitNetworkDesignForm';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';

const TransitNetworkDesignPanel: React.FunctionComponent = () => {
    const [isNewJob, setIsNewJob] = React.useState(false);
    const [initialValues, setInitialValues] = React.useState<TransitNetworkJobConfigurationType | undefined>(undefined);

    const onNewJob = (parameters?: TransitNetworkJobConfigurationType) => {
        setInitialValues(parameters);
        setIsNewJob(true);
    };

    const onJobConfigurationCompleted = () => {
        setIsNewJob(false);
        setInitialValues(undefined);
    };

    return (
        <div id="tr__form-transit-network-design-panel" className="tr__form-transit-network-design-panel tr__panel">
            {!isNewJob && <TransitNetworkDesignList onNewJob={onNewJob} />}
            {isNewJob && (
                <TransitNetworkDesignForm
                    initialValues={initialValues}
                    onJobConfigurationCompleted={onJobConfigurationCompleted}
                />
            )}
        </div>
    );
};

export default TransitNetworkDesignPanel;
