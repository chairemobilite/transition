/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import UsersTable, { UserDisplay } from './UsersTable';
import { DefaultColumnFilter } from './TableFilters';
import WidgetChangePermission from './WidgetChangePermission';

const UsersComponent: React.FC = () => {
    const { t } = useTranslation('admin');

    // We'll start our table without any data
    const [data, setData] = React.useState<UserDisplay[]>([]);
    const [roles, setRoles] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [totalCount, setTotalCount] = React.useState(0);
    const [pageCount, setPageCount] = React.useState(0);
    const fetchIdRef = React.useRef(0);

    // Function to fetch data from the server, with paging and filtering
    const fetchData = React.useCallback(async ({ pageSize, pageIndex, filters }) => {
        // Give this fetch an ID
        const fetchId = ++fetchIdRef.current;

        // Set the loading state
        setLoading(true);

        // Make a query string from the filters
        const additionalQueryString = !filters
            ? undefined
            : filters.map((obj) => `${encodeURI(obj.id)}=${encodeURI(obj.value)}`).join('&');

        try {
            const response = await fetch(
                `/api/admin/usersList?pageSize=${pageSize}&pageIndex=${pageIndex}${
                    additionalQueryString ? `&${additionalQueryString}` : ''
                }`
            );
            if (fetchId !== fetchIdRef.current) {
                // There was another query since, ignore
                return;
            }
            if (response.status === 200) {
                const jsonData = await response.json();
                if (jsonData.users) {
                    setData(jsonData.users);
                }
                if (jsonData.totalCount) {
                    setTotalCount(jsonData.totalCount);
                    setPageCount(Math.ceil(jsonData.totalCount / pageSize));
                }
                if (jsonData.roles) {
                    setRoles(jsonData.roles);
                }
            } else {
                console.error('Invalid response code from server: ', response.status);
            }
        } catch (error) {
            console.error(`Error fetching user data from server: ${error}`);
            setData([]);
            setTotalCount(0);
        } finally {
            if (fetchId === fetchIdRef.current) {
                setLoading(false);
            }
        }
    }, []);

    // Columns of the user table
    // TODO This may be where we add column formatting
    const columns = React.useMemo(() => {
        const columns = [
            {
                Header: t('admin:user:Username'),
                accessor: 'username',
                Filter: DefaultColumnFilter
            },
            {
                Header: t('admin:user:Email'),
                accessor: 'email',
                Filter: DefaultColumnFilter
            },
            {
                Header: t('admin:user:isAdmin'),
                accessor: 'is_admin',
                Cell: (props) => (
                    <input type="checkbox" className={'_input-checkbox'} disabled={true} checked={props.value} />
                )
            }
        ];
        if (roles.length > 0) {
            columns.push({
                Header: t('admin:user:roles'),
                accessor: 'permissions',
                Cell: (props) => (
                    <WidgetChangePermission
                        roles={roles}
                        currentValues={props.value}
                        userUuid={props.row.original.uuid}
                    />
                )
            });
        }
        return columns;
    }, [t, roles]);

    return (
        <div className="admin">
            <UsersTable
                columns={columns}
                data={data}
                fetchData={fetchData}
                loading={loading}
                pageCount={pageCount}
                itemCount={totalCount}
            />
        </div>
    );
};

export default UsersComponent;
