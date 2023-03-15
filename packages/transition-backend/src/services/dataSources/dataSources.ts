/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import DataSource, { DataSourceType } from 'transition-common/lib/services/dataSource/DataSource';
import DataSourceCollection from 'transition-common/lib/services/dataSource/DataSourceCollection';
import dbQueries from '../../models/db/dataSources.db.queries';

export const getDataSource = async (
    options: { isNew: true; dataSourceName: string; type: DataSourceType } | { isNew: false; dataSourceId: string },
    userId?: number
): Promise<DataSource> => {
    if (options.isNew === true) {
        const dataSourceCollection = new DataSourceCollection([], {});
        const collection = await dbQueries.collection({ type: options.type, userId: userId });
        dataSourceCollection.loadFromCollection(collection);
        const dataSource = dataSourceCollection.getByShortname(options.dataSourceName);
        if (dataSource !== undefined) {
            throw new TrError(
                `Cannot create data source ${options.dataSourceName}. A data source with that name already exists`,
                'DSERR01',
                'transit:transitRouting:errors:DataSourceAlreadyExists'
            );
        }
        const newDataSource = new DataSource(
            { type: options.type, name: options.dataSourceName, shortname: options.dataSourceName, owner: userId },
            true
        );
        await dbQueries.create(newDataSource.attributes);
        return newDataSource;
    } else {
        const dsAttributes = await dbQueries.read(options.dataSourceId, userId);
        return new DataSource(dsAttributes, false);
    }
};
