/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation } from 'react-i18next';

import TransitPathNodesList from '../forms/path/TransitPathNodeList';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Path from 'transition-common/lib/services/path/Path';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';

const BottomPanel: React.FunctionComponent<LayoutSectionProps> = (props: LayoutSectionProps) => {
    const [path, setPath] = React.useState<{ path: Path | undefined }>({
        path: serviceLocator.selectedObjectsManager.get('path')
    });

    React.useEffect(() => {
        const onSelectedPathUpdate = () => {
            setPath({ path: serviceLocator.selectedObjectsManager.get('path') });
        };
        serviceLocator.eventManager.on('selected.update.path', onSelectedPathUpdate);
        serviceLocator.eventManager.on('selected.deselect.path', onSelectedPathUpdate);
        return () => {
            serviceLocator.eventManager.off('selected.update.path', onSelectedPathUpdate);
            serviceLocator.eventManager.off('selected.deselect.path', onSelectedPathUpdate);
        };
    }, []);

    return <React.Fragment>{path.path && <TransitPathNodesList selectedPath={path.path} />}</React.Fragment>;
};

export default withTranslation()(BottomPanel);
