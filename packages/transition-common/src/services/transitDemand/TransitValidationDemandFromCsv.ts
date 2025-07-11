/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import DataSourceCollection from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import { TransitDemandFromCsv, DemandCsvAttributes } from './TransitDemandFromCsv';
import { TransitDemandFromCsValidationAttributes } from './types';

export type TransitValidationDemandFromCsvAttributes = DemandCsvAttributes &
    Partial<TransitDemandFromCsValidationAttributes>;

/**
 * Describe a CSV file field mapping for a transition origin/destination pair file
 */
export class TransitValidationDemandFromCsv extends TransitDemandFromCsv<TransitValidationDemandFromCsvAttributes> {
    constructor(attributes: Partial<TransitValidationDemandFromCsvAttributes>, isNew = false) {
        super(attributes, isNew, 'transit.validation.batch');
    }

    _prepareAttributes(attributes: Partial<TransitValidationDemandFromCsvAttributes>) {
        if (attributes.saveToDb === undefined) {
            attributes.saveToDb = false;
        }

        return super._prepareAttributes(attributes);
    }

    validate(): boolean {
        super.validate();
        const attributes = this.attributes;
        if (attributes.csvFile) {
            if (_isBlank(attributes.projection)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:ProjectionIsMissing');
            }
            if (_isBlank(attributes.originXAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:OriginXAttributeIsMissing');
            }
            if (_isBlank(attributes.originYAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:OriginYAttributeIsMissing');
            }
            if (_isBlank(attributes.destinationXAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:DestinationXAttributeIsMissing');
            }
            if (_isBlank(attributes.destinationYAttribute)) {
                this._isValid = false;
                this.errors.push('transit:transitRouting:errors:DestinationYAttributeIsMissing');
            }
            if (_isBlank(attributes.tripDateAttribute)) {
                this._isValid = false;
                this.errors.push('transit:batchCalculation:errors:TripDateAttributeIsMissing');
            }
            if (_isBlank(attributes.agenciesAttributePrefix)) {
                this._isValid = false;
                this.errors.push('transit:batchCalculation:errors:AgenciesAttributePrefixIsMissing');
            }
            if (_isBlank(attributes.linesAttributePrefix)) {
                this._isValid = false;
                this.errors.push('transit:batchCalculation:errors:LinesAttributePrefixIsMissing');
            }
        }
        if (attributes.saveToDb !== false) {
            const dataSourceCollection: DataSourceCollection = serviceLocator.collectionManager.get('dataSources');
            if (attributes.saveToDb?.type === 'new') {
                // For new data source, make sure an odTrip data source with that name does not already exists
                // TODO Should we check shortname too?
                const dataSources = dataSourceCollection.getByAttribute('name', attributes.saveToDb.dataSourceName);
                if (dataSources.find((ds) => ds.attributes.type === 'odTrips') !== undefined) {
                    this._isValid = false;
                    this.errors.push('transit:transitRouting:errors:DataSourceAlreadyExists');
                }
            } else if (attributes.saveToDb?.type === 'overwrite') {
                // For data source replacement, make sure it exists
                const dataSource = dataSourceCollection.getById(attributes.saveToDb.dataSourceId);
                if (dataSource === undefined) {
                    this._isValid = false;
                    this.errors.push('transit:transitRouting:errors:DataSourceDoesNotExists');
                } else if (dataSource.attributes.type !== 'odTrips') {
                    this._isValid = false;
                    this.errors.push('transit:transitRouting:errors:InvalidOdTripsDataSource');
                }
            }
        }
        return this._isValid;

        // TODO: add validations for all attributes fields
    }

    protected onCsvFileAttributesUpdated = (_csvFields: string[]): void => {
        if (this.attributes.originXAttribute && !_csvFields.includes(this.attributes.originXAttribute)) {
            this.attributes.originXAttribute = undefined;
        }
        if (this.attributes.originYAttribute && !_csvFields.includes(this.attributes.originYAttribute)) {
            this.attributes.originYAttribute = undefined;
        }
        if (this.attributes.destinationXAttribute && !_csvFields.includes(this.attributes.destinationXAttribute)) {
            this.attributes.destinationXAttribute = undefined;
        }
        if (this.attributes.destinationYAttribute && !_csvFields.includes(this.attributes.destinationYAttribute)) {
            this.attributes.destinationYAttribute = undefined;
        }
        if (this.attributes.tripDateAttribute && !_csvFields.includes(this.attributes.tripDateAttribute)) {
            this.attributes.tripDateAttribute = undefined;
        }
        // Make sure some fields start with the prefix
        const agenciesPrefix = this.attributes.agenciesAttributePrefix;
        if (typeof agenciesPrefix === 'string' && !_csvFields.some((field) => field.startsWith(agenciesPrefix))) {
            this.attributes.agenciesAttributePrefix = undefined;
        }
        const linePrefix = this.attributes.linesAttributePrefix;
        if (typeof linePrefix === 'string' && !_csvFields.some((field) => field.startsWith(linePrefix))) {
            this.attributes.linesAttributePrefix = undefined;
        }
    };
}

export default TransitValidationDemandFromCsv;
