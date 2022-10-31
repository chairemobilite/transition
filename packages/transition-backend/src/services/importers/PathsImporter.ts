/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as z from 'zod';

import { genericAttributesSchema } from './CollectionImporter';
import CollectionImporter from './GeojsonCollectionImporter';
import Path, { PathAttributes, pathDirectionArray } from 'transition-common/lib/services/path/Path';
import dbQueries from '../../models/db/transitPaths.db.queries';

// TODO For paths, the data in the 'data' field is important, we should add them to the schema
const schema = genericAttributesSchema.extend({
    geography: z.object({
        type: z.literal('LineString'),
        coordinates: z.array(z.array(z.number()))
    }),
    direction: z.union([z.enum(pathDirectionArray), z.null()]).optional(),
    line_id: z.string(),
    mode: z.string(),
    nodes: z.array(z.string()),
    stops: z.array(z.string()).optional(),
    segments: z.array(z.number()),
    is_enabled: z.union([z.boolean(), z.null()]).optional()
});

const pathsImporter = new CollectionImporter<PathAttributes>({
    dbQueries,
    newObjectMethod: (args: Partial<PathAttributes>) => new Path(args, false),
    schema
});

export default pathsImporter;
