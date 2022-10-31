/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as z from 'zod';

import CollectionImporter, { genericAttributesSchema } from './CollectionImporter';
import Service, { ServiceAttributes } from 'transition-common/lib/services/service/Service';
import dbQueries from '../../models/db/transitServices.db.queries';

const serviceSchema = genericAttributesSchema.extend({
    monday: z.union([z.boolean(), z.null()]).optional(),
    tuesday: z.union([z.boolean(), z.null()]).optional(),
    wednesday: z.union([z.boolean(), z.null()]).optional(),
    thursday: z.union([z.boolean(), z.null()]).optional(),
    friday: z.union([z.boolean(), z.null()]).optional(),
    saturday: z.union([z.boolean(), z.null()]).optional(),
    sunday: z.union([z.boolean(), z.null()]).optional(),
    start_date: z.union([z.string(), z.null()]).optional(),
    end_date: z.union([z.string(), z.null()]).optional(),
    only_dates: z.union([z.array(z.string()), z.null()]).optional(),
    except_dates: z.union([z.array(z.string()), z.null()]).optional(),
    simulation_id: z.union([z.string(), z.null()]).optional(),
    is_enabled: z.union([z.boolean(), z.null()]).optional()
});

const servicesImporter = new CollectionImporter<ServiceAttributes>({
    dbQueries,
    newObjectMethod: (args: Partial<ServiceAttributes>) => new Service(args, false),
    schema: serviceSchema
});

export default servicesImporter;
