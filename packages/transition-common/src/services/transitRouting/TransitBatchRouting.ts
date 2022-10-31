/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash.get';
import _set from 'lodash.set';
import _cloneDeep from 'lodash.clonedeep';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    TrRoutingConstants,
    TransitBatchRoutingAttributes as TransitBatchRoutingAttributesBase,
    TransitBatchCalculationResult
} from 'chaire-lib-common/lib/api/TrRouting';
import { TransitRouting } from './TransitRouting';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import DataSourceCollection from '../dataSource/DataSourceCollection';
import {
    TransitBatchCalculation,
    TransitBatchCalculationAttributes
} from '../transitCalculation/TransitBatchCalculation';

export interface TransitBatchRoutingAttributes extends TransitBatchCalculationAttributes {
    projection?: string;
    originXAttribute?: string;
    originYAttribute?: string;
    destinationXAttribute?: string;
    destinationYAttribute?: string;
    saveToDb: false | { type: 'new'; dataSourceName: string } | { type: 'overwrite'; dataSourceId: string };
}

// TODO tahini Refactor this class similar to TransitRouting, to separate data from the calculation results
export class TransitBatchRouting extends TransitBatchCalculation<TransitBatchRoutingAttributes> {
    private _transitRouting: TransitRouting;

    constructor(attributes: Partial<TransitBatchRoutingAttributes>, isNew = false, transitRouting: TransitRouting) {
        super(attributes, isNew, 'transit.routing.batch');

        this._transitRouting = transitRouting;
    }

    _prepareAttributes(attributes: Partial<TransitBatchRoutingAttributes>) {
        if (attributes.saveToDb === undefined) {
            attributes.saveToDb = false;
        }

        return super._prepareAttributes(attributes);
    }

    validate(): boolean {
        super.validate();
        this._transitRouting.validate();
        this.errors.concat(this._transitRouting.getErrors());
        const attributes = this.getAttributes();
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
        }
        if (attributes.saveToDb !== false) {
            const dataSourceCollection: DataSourceCollection = serviceLocator.collectionManager.get('dataSources');
            if (attributes.saveToDb.type === 'new') {
                // For new data source, make sure an odTrip data source with that name does not already exists
                // TODO Should we check shortname too?
                const dataSources = dataSourceCollection.getByAttribute('name', attributes.saveToDb.dataSourceName);
                if (dataSources.find((ds) => ds.attributes.type === 'odTrips') !== undefined) {
                    this._isValid = false;
                    this.errors.push('transit:transitRouting:errors:DataSourceAlreadyExists');
                }
            } else {
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

    updateRoutingPrefs() {
        if (serviceLocator.socketEventManager) {
            const exportedAttributes: TransitBatchRoutingAttributes = _cloneDeep(this._attributes);
            if (exportedAttributes.data && exportedAttributes.data.results) {
                delete exportedAttributes.data.results;
            }
            exportedAttributes.csvFile = null;
            Preferences.update(serviceLocator.socketEventManager, serviceLocator.eventManager, {
                'transit.routing.batch': exportedAttributes
            });
        }
    }

    private async _calculate(params: TransitBatchRoutingAttributesBase): Promise<any> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TrRoutingConstants.BATCH_ROUTE,
                params,
                this._transitRouting.getAttributes(),
                (routingStatus: Status.Status<TransitBatchCalculationResult>) => {
                    if (Status.isStatusOk(routingStatus)) {
                        resolve(Status.unwrap(routingStatus));
                    } else if (routingStatus.error === 'UserDiskQuotaReached') {
                        reject(
                            new TrError(
                                'Maximum allowed disk space reached',
                                'TRJOB0001',
                                'transit:transitRouting:errors:UserDiskQuotaReached'
                            )
                        );
                    } else {
                        reject(routingStatus.error);
                    }
                }
            );
        });
    }

    async calculate(updatePreferences: boolean, options = {}): Promise<TransitBatchCalculationResult> {
        if (!this.validate()) {
            const trError = new TrError(
                'cannot calculate transit batch route: the data is invalid',
                'TRBROUTING0001',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }
        if (updatePreferences) {
            this.updateRoutingPrefs();
        }

        const attributes = this.getAttributes();
        const parameters: TransitBatchRoutingAttributesBase = {
            calculationName: attributes.calculationName as string,
            projection: attributes.projection as string,
            detailed: attributes.detailed || false,
            idAttribute: attributes.idAttribute as string,
            originXAttribute: attributes.originXAttribute as string,
            originYAttribute: attributes.originYAttribute as string,
            destinationXAttribute: attributes.destinationXAttribute as string,
            destinationYAttribute: attributes.destinationYAttribute as string,
            timeAttributeDepartureOrArrival: attributes.timeAttributeDepartureOrArrival || 'departure',
            timeFormat: attributes.timeFormat as string,
            timeAttribute: attributes.timeAttribute as string,
            withGeometries: attributes.withGeometries || false,
            cpuCount: attributes.cpuCount || 1,
            saveToDb: attributes.saveToDb
        };

        try {
            const batchResult = await this._calculate(parameters);
            return batchResult;
        } catch (error) {
            // TODO Better handle erroneous and success return statuses
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot calculate transit batch route with trRouting: ${error}`,
                'TRBROUTING0001',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
            // FIXME:  Not part of the promise, can't resolve the error here
            // resolve(trError.export());
        }
    }
}

export default TransitBatchRouting;
