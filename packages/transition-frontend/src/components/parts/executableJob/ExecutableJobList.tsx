/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint gives error about missing key prop in tr, th, etc, but the key is part of the element's props */
/* eslint-disable react/jsx-key */

import React from 'react';
import { useTable, usePagination, useFilters, useSortBy, useFlexLayout, Column } from 'react-table';
import { WithTranslation, withTranslation } from 'react-i18next';
import { JobAttributes, JobDataType } from 'transition-common/lib/services/jobs/Job';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

export type ReturnedJobAttributes = JobAttributes<JobDataType> & { hasFiles: boolean };

interface ExecutableJobListProps extends WithTranslation {
    columns: Column<ReturnedJobAttributes>[];
    data: ReturnedJobAttributes[];
    fetchData: ({ pageSize, pageIndex, filters }: any) => void;
    loading: boolean;
    pageCount: number;
    itemCount: number;
    defaultPageSize?: number;
    jobType?: string;
}

// User react-table to handle a few table functionalities like paging and filtering
const ExecutableJobList: React.FunctionComponent<ExecutableJobListProps> = (props: ExecutableJobListProps) => {
    const {
        getTableProps,
        prepareRow,
        headerGroups,
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
        state: { pageIndex, pageSize, filters, sortBy }
    } = useTable(
        {
            columns: props.columns,
            data: props.data,
            initialState: { pageIndex: 0, pageSize: props.defaultPageSize || 10 },
            // We are handling our own pagination by the server queries, we don't have all the data loaded at once
            manualPagination: true,
            // Filters are also handled manually by the query to the server
            manualFilters: true,
            // Sort handled by the query to the server
            manualSortBy: true,
            pageCount: props.pageCount
        },
        useFilters,
        useSortBy,
        usePagination,
        useFlexLayout
    );

    const reloadData = (data: { id: number; name: string }) => {
        if (props.jobType === undefined || props.jobType === data.name) {
            props.fetchData({ pageIndex, pageSize, filters, sortBy });
        }
    };

    // Listen for changes in pagination and filters and use the state to fetch our new data
    React.useEffect(() => {
        serviceLocator.socketEventManager.on('executableJob.updated', reloadData);
        props.fetchData({ pageIndex, pageSize, filters, sortBy });
        return () => {
            serviceLocator.socketEventManager.off('executableJob.updated', reloadData);
        };
    }, [props.fetchData, pageIndex, pageSize, filters, sortBy]);

    return props.loading ? (
        <div className="tr__list-container">
            <LoadingPage />
        </div>
    ) : (
        <div style={{ flexDirection: 'row', flex: '0 0 auto' }}>
            <div {...getTableProps()} className="table label">
                <div className="thead">
                    {headerGroups.map((headerGroup) => (
                        <div className="tr" {...headerGroup.getHeaderGroupProps()}>
                            {headerGroup.headers.map((column) => (
                                <div className="th" {...column.getHeaderProps()}>
                                    {column.render('Header')}
                                    <span>{column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}</span>
                                    <div>{column.Filter ? column.render('Filter') : null}</div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="tbody">
                    {page.map((row) => {
                        prepareRow(row);
                        return (
                            <div className={'tr'} {...row.getRowProps()}>
                                {row.cells.map((cell) => {
                                    return (
                                        <div className="td" {...cell.getCellProps()}>
                                            {cell.render('Cell')}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                    <div className="tr">
                        {props.loading ? (
                            // Use our custom loading state to show a loading indicator
                            <div className="td">{props.t('main:Loading')}</div>
                        ) : (
                            <div className="td">
                                {props.t('main:ShowingNofX', { n: page.length, x: props.itemCount })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="pagination">
                {pageCount > 1 && (
                    <React.Fragment>
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
                    </React.Fragment>
                )}
                <select
                    value={pageSize}
                    onChange={(e) => {
                        setPageSize(Number(e.target.value));
                    }}
                >
                    {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                            {props.t('main:ShowN', { n: pageSize })}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default withTranslation('main')(ExecutableJobList);
