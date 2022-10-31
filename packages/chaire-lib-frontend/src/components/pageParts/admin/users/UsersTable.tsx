/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint gives error about missing key prop in tr, th, etc, but the key is part of the element's props */
/* eslint-disable react/jsx-key */

import React from 'react';
import { useTable, usePagination, useFilters } from 'react-table';
import { WithTranslation, withTranslation } from 'react-i18next';

export interface UserDisplay {
    username: string;
    email: string;
    is_admin: boolean;
    permissions: { [key: string]: boolean };
}

interface UsersTableProps extends WithTranslation {
    columns: any[];
    data: UserDisplay[];
    fetchData: ({ pageSize, pageIndex, filters }: any) => void;
    loading: boolean;
    pageCount: number;
    itemCount: number;
}

// User react-table to handle a few table functionalities like paging and filtering
const UsersTable: React.FunctionComponent<UsersTableProps> = (props: UsersTableProps) => {
    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        prepareRow,
        page,
        canPreviousPage,
        canNextPage,
        pageOptions,
        pageCount,
        gotoPage,
        nextPage,
        previousPage,
        setPageSize,
        // Get the state from the instance
        state: { pageIndex, pageSize, filters }
    } = useTable(
        {
            columns: props.columns,
            data: props.data,
            initialState: { pageIndex: 0 },
            // We are handling our own pagination by the server queries, we don't have all the data loaded at once
            manualPagination: true,
            // Filters are also handled manually by the query to the server
            manualFilters: true,
            pageCount: props.pageCount
        },
        useFilters,
        usePagination
    );

    // Listen for changes in pagination and filters and use the state to fetch our new data
    React.useEffect(() => {
        props.fetchData({ pageIndex, pageSize, filters });
    }, [props.fetchData, pageIndex, pageSize, filters]);

    return (
        <div className="userTable">
            <table {...getTableProps()}>
                <thead>
                    {headerGroups.map((headerGroup) => (
                        <tr {...headerGroup.getHeaderGroupProps()}>
                            {headerGroup.headers.map((column) => (
                                <th {...column.getHeaderProps()}>
                                    {column.render('Header')}
                                    <span>{column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}</span>
                                    <div>{column.Filter ? column.render('Filter') : null}</div>
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody {...getTableBodyProps()}>
                    {page.map((row) => {
                        prepareRow(row);
                        return (
                            <tr {...row.getRowProps()}>
                                {row.cells.map((cell) => {
                                    return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>;
                                })}
                            </tr>
                        );
                    })}
                    <tr>
                        {props.loading ? (
                            // Use our custom loading state to show a loading indicator
                            <td colSpan={10000}>{props.t('main:Loading')}</td>
                        ) : (
                            <td colSpan={10000}>
                                {props.t('main:ShowingNofX', { n: page.length, x: props.itemCount })}
                            </td>
                        )}
                    </tr>
                </tbody>
            </table>
            <div className="pagination">
                <button onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
                    {'<<'}
                </button>{' '}
                <button onClick={() => previousPage()} disabled={!canPreviousPage}>
                    {'<'}
                </button>{' '}
                <button onClick={() => nextPage()} disabled={!canNextPage}>
                    {'>'}
                </button>{' '}
                <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
                    {'>>'}
                </button>{' '}
                <span>{props.t('main:PageNofX', { n: pageIndex + 1, x: pageOptions.length })}</span>
                <span>
                    | {props.t('main:GoToPage')}:{' '}
                    <input
                        type="number"
                        defaultValue={pageIndex + 1}
                        onChange={(e) => {
                            const page = e.target.value ? Number(e.target.value) - 1 : 0;
                            gotoPage(page);
                        }}
                        style={{ width: '100px' }}
                    />
                </span>{' '}
                <select
                    value={pageSize}
                    onChange={(e) => {
                        setPageSize(Number(e.target.value));
                    }}
                >
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                            {props.t('main:ShowN', { n: pageSize })}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default withTranslation('main')(UsersTable);
