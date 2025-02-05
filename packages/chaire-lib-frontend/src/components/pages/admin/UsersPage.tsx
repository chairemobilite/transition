/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Loadable from 'react-loadable';
import Loader from 'react-spinners/HashLoader';

const loader = function Loading() {
    return <Loader size={30} color={'#aaaaaa'} loading={true} />;
};

const UsersComponent = Loadable({
    loader: () => import('../../pageParts/admin/users/UsersComponent'),
    loading: loader
});

const UsersPage: React.FC = () => (
    <div className="admin">
        <UsersComponent />
    </div>
);

export default UsersPage;
