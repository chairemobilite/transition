/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { connect } from 'react-redux';
import { Route } from 'react-router-dom';

import { Header } from '../pageParts';

export const PublicRoute = ({ isAuthenticated, component: Component, config, ...rest }) => (
    <Route
        {...rest}
        component={(props) => (
            <React.Fragment>
                <Header {...props} path={rest.path} />
                <Component {...props} location={rest.location} config={config} />
            </React.Fragment>
        )}
    />
);

const mapStateToProps = (state) => ({
    isAuthenticated: !!state.auth.uuid
});

export default connect(mapStateToProps)(PublicRoute);
