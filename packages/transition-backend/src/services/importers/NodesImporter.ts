/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as z from 'zod';

import { genericAttributesSchema } from './CollectionImporter';
import CollectionImporter from './GeojsonCollectionImporter';
import Node, { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import dbQueries from '../../models/db/transitNodes.db.queries';
import { objectsToCache } from '../../models/capnpCache/transitNodes.cache.queries';

const schema = genericAttributesSchema.extend({
    geography: z.object({
        type: z.literal('Point'),
        coordinates: z.array(z.number())
    }),
    station_id: z.union([z.string(), z.null()]).optional(),
    code: z.string(),
    name: z.union([z.string(), z.null()]).optional(),
    routing_radius_meters: z.union([z.number(), z.null()]).optional(),
    default_dwell_time_seconds: z.union([z.number(), z.null()]).optional(),
    is_enabled: z.union([z.boolean(), z.null()]).optional()
});

const nodesImporter = new CollectionImporter<NodeAttributes>({
    dbQueries,
    newObjectMethod: (args: Partial<NodeAttributes>) => new Node(args, false),
    schema,
    objectsToCache
});

export default nodesImporter;
