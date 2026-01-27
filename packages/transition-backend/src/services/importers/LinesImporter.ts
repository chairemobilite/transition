/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as z from 'zod';

import CollectionImporter, { genericAttributesSchema } from './CollectionImporter';
import Line, { LineAttributes } from 'transition-common/lib/services/line/Line';
import dbQueries from '../../models/db/transitLines.db.queries';
import { rightOfWayCategories, transitModes } from 'transition-common/lib/services/line/types';
import { objectsToCache } from '../../models/capnpCache/transitLines.cache.queries';

const schema = genericAttributesSchema.extend({
    agency_id: z.string(),
    mode: z.enum(transitModes),
    category: z.union([z.enum(rightOfWayCategories), z.null()]).optional(),
    allow_same_line_transfers: z.union([z.boolean(), z.null()]).optional(),
    is_autonomous: z.union([z.boolean(), z.null()]).optional(),
    longname: z.union([z.string(), z.null()]).optional(),
    simulation_id: z.union([z.string(), z.null()]).optional(),
    is_enabled: z.union([z.boolean(), z.null()]).optional()
});

const servicesImporter = new CollectionImporter<LineAttributes>({
    dbQueries,
    newObjectMethod: (args: Partial<LineAttributes>) => new Line(args, false),
    schema,
    objectsToCache
});

export default servicesImporter;
