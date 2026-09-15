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
    const [showForm, setShowForm] = React.useState(false);
    const [initialValues, setInitialValues] = React.useState<TransitNetworkJobConfigurationType | undefined>(undefined);
    const [viewJobId, setViewJobId] = React.useState<number | undefined>(undefined);

    const onNewJob = (parameters?: TransitNetworkJobConfigurationType) => {
        setInitialValues(parameters);
        setViewJobId(undefined);
        setShowForm(true);
    };

    const onViewJob = (jobId: number, parameters: TransitNetworkJobConfigurationType) => {
        setInitialValues(parameters);
        setViewJobId(jobId);
        setShowForm(true);
    };

    const onJobConfigurationCompleted = () => {
        setShowForm(false);
        setInitialValues(undefined);
        setViewJobId(undefined);
    };

    return (
        <div id="tr__form-transit-network-design-panel" className="tr__form-transit-network-design-panel tr__panel">
            {!showForm && <TransitNetworkDesignList onNewJob={onNewJob} onViewJob={onViewJob} />}
            {showForm && (
                <TransitNetworkDesignForm
                    initialValues={initialValues}
                    jobId={viewJobId}
                    onJobConfigurationCompleted={onJobConfigurationCompleted}
                />
            )}
        </div>
    );
};

export default TransitNetworkDesignPanel;
