/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { faFileDownload } from '@fortawesome/free-solid-svg-icons/faFileDownload';
import moment from 'moment';
import { unparse } from 'papaparse';

import Button from '../input/Button';
import DownloadsUtils from '../../services/DownloadsService';
import GenericCollection from 'chaire-lib-common/lib/utils/objects/GenericCollection';

export type CollectionDownloadButtonsProps = {
    collection: GenericCollection<any>;
};

const CollectionDownloadButtons = function (props: CollectionDownloadButtonsProps) {
    const collection = props.collection;
    const collectionIsEmpty = !collection || collection.size() === 0;

    if (collectionIsEmpty) {
        return null;
    }

    const pluralName = collection.instanceClass.getCapitalizedPluralName();

    const onCsvDownloadClick =
        typeof (collection as any).forCsv === 'function'
            ? () => {
                DownloadsUtils.downloadCsvFromBlob(
                    DownloadsUtils.generateCsvDownloadUrl(unparse((collection as any).forCsv())),
                    `tr${pluralName}_${moment().format('YYYYMMDD_HHmmss')}.csv`
                );
            }
            : () => {
                return undefined;
            };

    const onCsvExcelClick =
        typeof (collection as any).forCsv === 'function'
            ? () => {
                DownloadsUtils.downloadCsvFromBlob(
                    DownloadsUtils.generateCsvDownloadUrl('\ufeff' + unparse((collection as any).forCsv())),
                    `tr${pluralName}_excel_${moment().format('YYYYMMDD_HHmmss')}.csv`
                );
            }
            : () => {
                return undefined;
            };

    const onJsonDownloadClick =
        typeof (collection as any).forJson === 'function'
            ? () => {
                DownloadsUtils.downloadJsonFromBlob(
                    DownloadsUtils.generateJsonDownloadUrl((collection as any).forJson()),
                    `tr${pluralName}_${moment().format('YYYYMMDD_HHmmss')}.json`
                );
            }
            : () => {
                return undefined;
            };

    const onGeoJsonDownloadClick =
        typeof (collection as any).toGeojson === 'function'
            ? () => {
                DownloadsUtils.downloadJsonFromBlob(
                    DownloadsUtils.generateJsonDownloadUrl((collection as any).toGeojson()),
                    `tr${pluralName}_${moment().format('YYYYMMDD_HHmmss')}.geojson`
                );
            }
            : () => {
                return undefined;
            };

    return (
        <div>
            <div className="tr__form-buttons-container">
                {typeof (collection as any).forCsv === 'function' && (
                    <React.Fragment>
                        <Button
                            color="blue"
                            icon={faFileDownload}
                            iconClass="_icon"
                            label={'CSV'}
                            onClick={onCsvDownloadClick}
                        />
                        <Button
                            color="blue"
                            icon={faFileDownload}
                            iconClass="_icon"
                            label={'CSV (Excel)'}
                            onClick={onCsvExcelClick}
                        />
                    </React.Fragment>
                )}
                {typeof (collection as any).forJson === 'function' && (
                    <Button
                        color="blue"
                        icon={faFileDownload}
                        iconClass="_icon"
                        label={'JSON'}
                        onClick={onJsonDownloadClick}
                    />
                )}
                {typeof (collection as any).toGeojson === 'function' && (
                    <Button
                        color="blue"
                        icon={faFileDownload}
                        iconClass="_icon"
                        label={'GEOJSON'}
                        onClick={onGeoJsonDownloadClick}
                    />
                )}
            </div>
        </div>
    );
};

export default CollectionDownloadButtons;
