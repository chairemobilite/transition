/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as z from 'zod';

import CollectionImporter, { genericAttributesSchema } from './CollectionImporter';
import { Agency, AgencyAttributes } from 'transition-common/lib/services/agency/Agency';
import dbQueries from '../../models/db/transitAgencies.db.queries';

const agencySchema = genericAttributesSchema.extend({
    acronym: z.string(),
    simulation_id: z.union([z.string(), z.null()]).optional(),
    is_enabled: z.union([z.boolean(), z.null()]).optional()
});

const agenciesImporter = new CollectionImporter<AgencyAttributes>({
    dbQueries,
    newObjectMethod: (args: Partial<AgencyAttributes>) => new Agency(args, false),
    schema: agencySchema
});

export default agenciesImporter;
