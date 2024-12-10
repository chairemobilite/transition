/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

type MaintenancePageProps = {
    linkPath?: string;
};

export const MaintenancePage: React.FunctionComponent<MaintenancePageProps> = (props: MaintenancePageProps) => {
    const { t } = useTranslation('auth');

    return (
        <div>
            {t('auth:Maintenance')}
            <br />
            <Link to={props.linkPath ? props.linkPath : '/home'}>{t('auth:BackToHomePage')}</Link>
        </div>
    );
};

export default MaintenancePage;
