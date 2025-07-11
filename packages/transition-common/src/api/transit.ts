/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export class TransitApi {
    /**
     * Socket route name to delete the unused transit nodes
     *
     * @static
     * @memberof TransitApi
     */
    static readonly DELETE_UNUSED_NODES = 'transitNodes.deleteUnused';
    /**
     * Socket route name to call a batch routing validation calculation. It
     * takes parameter of type {@link TransitBatchRoutingDemandAttributes}. It
     * returns a {@link Status}, with a {@link TransitBatchCalculationResult} on
     * success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly BATCH_VALIDATE = 'service.trRouting.batchValidation';
    /**
     * Socket route name to call to get the parameters to replay a previously
     * saved task for transit validation. It takes the ID of the batch routing
     * job to replay. It returns a {@link Status}, with a object containing a
     * field named 'parameters' of type {@link BatchCalculationParameters}, a
     * 'demand' field of type {@link TransitOdDemandFromCsvAttributes} and a
     * 'csvFields' field containing the string headers of the fields of the csv
     * file on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly BATCH_VALIDATE_REPLAY = 'service.trRouting.batchValidationReplay';
}
