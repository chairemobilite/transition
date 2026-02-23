/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ObjectWithHistory } from '../../utils/objects/ObjectWithHistory';
import { GenericAttributes } from '../../utils/objects/GenericObject';
import serviceLocator from '../../utils/ServiceLocator';

export const dataSourceTypesArray = [
    'none',
    'other',
    'gtfs',
    'odTrips',
    'transitSmartCardData',
    'transitOperationalData',
    'taxiTransactions',
    'carSharingTransactions',
    'bikeSharingTransactions',
    'gpsTraces',
    'streetSegmentSpeeds',
    'zones',
    'osmData',
    'places',
    'propertyRegistry'
] as const;

export type DataSourceType = (typeof dataSourceTypesArray)[number];

export interface DataSourceAttributes extends GenericAttributes {
    type: DataSourceType;
    owner?: number;
}

class DataSource extends ObjectWithHistory<DataSourceAttributes> {
    protected static displayName = 'DataSource';
    private _collectionManager: any;

    constructor(attributes = {}, isNew: boolean, collectionManager?) {
        super(attributes, isNew);

        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;
    }

    toString() {
        return this.attributes.name || this.attributes.shortname || this.getId();
    }

    get collectionManager(): any {
        // TODO: test or use dependency injection
        return this._collectionManager;
    }

    static getPluralName() {
        return 'dataSources';
    }

    static getCapitalizedPluralName() {
        return 'DataSources';
    }

    static getDisplayName() {
        return DataSource.displayName;
    }
}

export default DataSource;
