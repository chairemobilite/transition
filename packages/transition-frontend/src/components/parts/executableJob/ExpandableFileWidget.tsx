import React from 'react';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { JobsConstants } from 'transition-common/lib/api/jobs';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { withTranslation, WithTranslation } from 'react-i18next';

export interface ExpandableFileProps {
    jobId: number;
    showFileText: string;
}

type JobFileType = { [fileName: string]: { url: string; downloadName: string; title: string } };

const getFilesFromSocket = (id: number): Promise<Status.Status<JobFileType>> => {
    return new Promise((resolve) => {
        serviceLocator.socketEventManager.emit(JobsConstants.GET_FILES, id, (response: Status.Status<JobFileType>) => {
            resolve(response);
        });
    });
};

const ExpandableFileWidget: React.FunctionComponent<ExpandableFileProps & WithTranslation> = (
    props: React.PropsWithChildren<ExpandableFileProps & WithTranslation>
) => {
    const [expanded, setExpanded] = React.useState(false);
    const [loadRequested, setLoadRequested] = React.useState(false);
    const [files, setFiles] = React.useState<JobFileType | undefined>(undefined);

    React.useEffect(() => {
        if (files === undefined && loadRequested) {
            getFilesFromSocket(props.jobId).then((status) => {
                if (Status.isStatusOk(status)) {
                    setFiles(Status.unwrap(status));
                } else {
                    console.log(`Error getting files for job: ${status.error}`);
                }
            });
        }
    }, [loadRequested]);

    if (!expanded) {
        return (
            <div
                onClick={(e) => {
                    setExpanded(true);
                    setLoadRequested(true);
                }}
            >
                <FontAwesomeIcon icon={faChevronDown} />
                {props.showFileText}
            </div>
        );
    }
    return (
        <div>
            <FontAwesomeIcon onClick={(e) => setExpanded(false)} icon={faChevronUp} />
            {files &&
                Object.keys(files).map((fileName, fileIdx) => (
                    <p key={`jobFile${props.jobId}_${fileIdx}`}>
                        <a href={files[fileName].url} download={files[fileName].downloadName}>
                            {props.t(files[fileName].title)}
                        </a>
                    </p>
                ))}
        </div>
    );
};

export default withTranslation(['main', 'transit'])(ExpandableFileWidget);
