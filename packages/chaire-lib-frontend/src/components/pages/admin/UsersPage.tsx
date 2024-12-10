/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';
import React from 'react';
import Loadable from 'react-loadable';
import { useNavigate } from 'react-router';
import Loader from 'react-spinners/HashLoader';

export type UsersPageProps = {
    isAuthenticated: boolean;
    // TODO Type the user
    user: CliUser;
};

const loader = function Loading() {
    return <Loader size={30} color={'#aaaaaa'} loading={true} />;
};

const UsersComponent = Loadable({
    loader: () => import('../../pageParts/admin/users/UsersComponent'),
    loading: loader
});

class UsersPage extends React.Component<UsersPageProps> {
    constructor(props: UsersPageProps) {
        const navigate = useNavigate();
        super(props);

        if (this.props.isAuthenticated && this.props.user.is_admin) {
            navigate('/admin/users');
        }
    }

    render() {
        return (
            <div className="admin">
                <UsersComponent />
            </div>
        );
    }
}

export default UsersPage;
