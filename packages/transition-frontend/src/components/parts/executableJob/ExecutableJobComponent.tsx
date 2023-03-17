/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { Column } from 'react-table';
import moment from 'moment';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { faStopCircle } from '@fortawesome/free-solid-svg-icons/faStopCircle';

import ExecutableJobList, { ReturnedJobAttributes } from './ExecutableJobList';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { JobsConstants } from 'transition-common/lib/api/jobs';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ExpandableText from './ExpandableText';
import ExpandableFiles from './ExpandableFileWidget';
import Button from '../Button';
import ButtonList from '../ButtonList';
import ButtonCell, { ButtonCellWithConfirm } from '../ButtonCell';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface ExecutableJobComponentProps {
    jobType?: string;
    defaultPageSize?: number;
    customActions?: {
        callback: (jobId: number) => void;
        title: string;
        icon: IconProp;
    }[];
}

const fetchFromSocket = (parameters: {
    jobType?: string;
    pageSize?: number;
    pageIndex?: number;
}): Promise<Status.Status<{ jobs: ReturnedJobAttributes[]; totalCount: number }>> => {
    return new Promise((resolve) => {
        serviceLocator.socketEventManager.emit(
            JobsConstants.LIST_JOBS,
            parameters,
            (response: Status.Status<{ jobs: ReturnedJobAttributes[]; totalCount: number }>) => {
                resolve(response);
            }
        );
    });
};

const deleteJobFromServer = (id: number): Promise<Status.Status<boolean>> => {
    return new Promise((resolve) => {
        serviceLocator.socketEventManager.emit(JobsConstants.DELETE_JOB, id, (response: Status.Status<boolean>) => {
            resolve(response);
        });
    });
};

const cancelJobFromServer = (id: number): Promise<Status.Status<boolean>> => {
    return new Promise((resolve) => {
        serviceLocator.socketEventManager.emit(JobsConstants.CANCEL_JOB, id, (response: Status.Status<boolean>) => {
            resolve(response);
        });
    });
};

const ExecutableJobComponent: React.FunctionComponent<ExecutableJobComponentProps & WithTranslation> = (
    props: ExecutableJobComponentProps & WithTranslation
) => {
    // We'll start our table without any data
    const [data, setData] = React.useState<ReturnedJobAttributes[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [totalCount, setTotalCount] = React.useState(0);
    const [pageCount, setPageCount] = React.useState(0);
    const fetchIdRef = React.useRef(0);

    // TODO Add a useEffect to register a listener to listen to job updates from server

    // Function to fetch data from the server, with paging and filtering
    const fetchData = React.useCallback(async ({ pageSize, pageIndex }) => {
        // Give this fetch an ID
        const fetchId = ++fetchIdRef.current;

        // Set the loading state
        setLoading(true);

        try {
            const status = await fetchFromSocket({ jobType: props.jobType, pageSize, pageIndex });

            if (fetchId !== fetchIdRef.current) {
                // There was another query since, ignore
                return;
            }
            const { jobs, totalCount } = Status.unwrap(status);
            const pageCount = pageSize !== 0 ? Math.ceil(totalCount / pageSize) : 0;
            setData(jobs);
            setTotalCount(totalCount);
            setPageCount(pageCount);
        } catch (error) {
            console.error(`Error fetching executable jobs from server: ${error}`);
            setData([]);
            setTotalCount(0);
        } finally {
            if (fetchId === fetchIdRef.current) {
                setLoading(false);
            }
        }
    }, []);

    const deleteJob = React.useCallback(async (id) => {
        try {
            const status = await deleteJobFromServer(id);
            Status.unwrap(status);
        } catch (error) {
            console.error(`Error delete job from server: ${error}`);
        }
    }, []);

    const cancelJob = React.useCallback(async (id) => {
        try {
            const status = await cancelJobFromServer(id);
            Status.unwrap(status);
        } catch (error) {
            console.error(`Error cancelling job from server: ${error}`);
        }
    }, []);

    // Columns of the executable job list
    // TODO Add column to delete and retrigger, when files are supported
    const columns = React.useMemo(() => {
        const columns = [
            {
                Header: props.t('transit:jobs:Date'),
                accessor: 'created_at',
                width: 100,
                Cell: (props) => moment(props.value).format('YYYY-MM-DD hh:mm')
            },
            {
                Header: props.t('transit:jobs:Status'),
                accessor: 'status',
                width: 70,
                Cell: (cellProps) => (
                    <div className={`status_${cellProps.value}`}>
                        {props.t(`transit:jobs:Status_${cellProps.value}`)}
                    </div>
                )
            },
            {
                Header: props.t('transit:jobs:Data'),
                accessor: 'data',
                Cell: (cellProps) => (
                    <ExpandableText textToShorten={JSON.stringify(cellProps.value)}>
                        <textarea
                            autoComplete="none"
                            disabled={true}
                            className="tr__form-input-textarea apptr__input _input-textarea"
                            value={JSON.stringify(cellProps.value, null, 2)}
                            rows={20}
                        ></textarea>
                    </ExpandableText>
                )
            },
            {
                Header: props.t('transit:jobs:Resources'),
                accessor: 'hasFiles',
                Cell: (cellProps) =>
                    cellProps.value !== true ? (
                        '--'
                    ) : (
                        <ExpandableFiles
                            showFileText={props.t('transit:jobs:ShowFiles')}
                            jobId={cellProps.row.original.id}
                        />
                    )
            },
            {
                Header: '',
                accessor: 'id',
                width: 'auto',
                Cell: (cellProps) => (
                    <ButtonList>
                        <Button
                            key={`${cellProps.value}`}
                            isSelected={false}
                            flushActionButtons={true}
                            onDelete={{
                                handler: () => deleteJob(cellProps.value),
                                message: props.t('transit:jobs:ConfirmDelete'),
                                altText: props.t('transit:jobs:Delete')
                            }}
                        >
                            {(cellProps.row.original.status === 'pending' ||
                                cellProps.row.original.status === 'inProgress') && (
                                <ButtonCellWithConfirm
                                    alignment="flush"
                                    onClick={() => cancelJob(cellProps.value)}
                                    title={props.t('transit:jobs:Cancel')}
                                    message={props.t('transit:jobs:ConfirmCancel')}
                                    confirmButtonText={props.t('transit:jobs:Cancel')}
                                >
                                    <FontAwesomeIcon icon={faStopCircle} />
                                </ButtonCellWithConfirm>
                            )}
                            {props.customActions !== undefined &&
                                props.customActions.length > 0 &&
                                props.customActions.map((action, index) => (
                                    <ButtonCell
                                        key={`execJob_customAction${index}`}
                                        alignment="flush"
                                        onClick={() => action.callback(cellProps.value)}
                                        title={props.t(action.title)}
                                    >
                                        <FontAwesomeIcon icon={action.icon} />
                                    </ButtonCell>
                                ))}
                        </Button>
                    </ButtonList>
                )
            }
        ] as Column<ReturnedJobAttributes>[];
        if (props.jobType === undefined) {
            columns.push({
                Header: props.t('transit:jobs:JobType') as string,
                accessor: 'name'
            });
        }
        return columns;
    }, [props.t, props.jobType]);

    return (
        <div className="admin">
            <ExecutableJobList
                columns={columns}
                data={data}
                fetchData={fetchData}
                loading={loading}
                pageCount={pageCount}
                itemCount={totalCount}
                defaultPageSize={props.defaultPageSize}
                jobType={props.jobType}
            />
        </div>
    );
};

export default withTranslation(['transit', 'main'])(ExecutableJobComponent);
