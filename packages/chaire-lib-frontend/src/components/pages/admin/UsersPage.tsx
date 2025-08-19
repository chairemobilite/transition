/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { lazy, Suspense } from 'react';
import Loader from 'react-spinners/HashLoader';

const LoaderComponent = () => <Loader size={30} color={'#aaaaaa'} loading={true} />;

const UsersComponent = lazy(() => import('../../pageParts/admin/users/UsersComponent'));

const UsersPage: React.FC = () => (
    <div className="admin">
        <Suspense fallback={<LoaderComponent />}>
            <UsersComponent />
        </Suspense>
    </div>
);

export default UsersPage;
