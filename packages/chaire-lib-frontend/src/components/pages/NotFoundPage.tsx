/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { withTranslation, WithTranslation } from 'react-i18next';

export const NotFoundPage: React.FunctionComponent<WithTranslation> = (props: WithTranslation) => (
    <div>
        404 - <Link to="/">{props.t('auth:BackToHomePage')}</Link>
    </div>
);

export default withTranslation('auth')(NotFoundPage);
