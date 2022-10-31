/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { withTranslation, WithTranslation } from 'react-i18next';

interface MaintenancePageProps extends WithTranslation {
    linkPath?: string;
}

export const MaintenancePage: React.FunctionComponent<MaintenancePageProps> = (props: MaintenancePageProps) => (
    <div>
        {props.t('Maintenance')}
        <br />
        <Link to={props.linkPath ? props.linkPath : '/home'}>{props.t('BackToHomePage')}</Link>
    </div>
);

export default withTranslation(['auth'])(MaintenancePage);
