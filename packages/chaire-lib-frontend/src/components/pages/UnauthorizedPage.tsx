/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { withTranslation, WithTranslation } from 'react-i18next';

export const UnauthorizedPage: React.FunctionComponent<WithTranslation> = (props: WithTranslation) => (
    <div>
        {props.t('auth:Unauthorized')} - <Link to="/login">{props.t('auth:BackToLoginPage')}</Link>
    </div>
);

export default withTranslation('auth')(UnauthorizedPage);
