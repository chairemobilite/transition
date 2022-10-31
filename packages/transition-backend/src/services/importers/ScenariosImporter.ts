/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as z from 'zod';

import CollectionImporter, { genericAttributesSchema } from './CollectionImporter';
import Scenario, { ScenarioAttributes } from 'transition-common/lib/services/scenario/Scenario';
import dbQueries from '../../models/db/transitScenarios.db.queries';

const schema = genericAttributesSchema.extend({
    services: z.array(z.string()),
    only_agencies: z.array(z.string()),
    except_agencies: z.array(z.string()),
    only_lines: z.array(z.string()),
    except_lines: z.array(z.string()),
    only_nodes: z.array(z.string()),
    except_nodes: z.array(z.string()),
    only_modes: z.array(z.string()),
    except_modes: z.array(z.string()),
    simulation_id: z.union([z.string(), z.null()]).optional(),
    is_enabled: z.union([z.boolean(), z.null()]).optional()
});

const servicesImporter = new CollectionImporter<ScenarioAttributes>({
    dbQueries,
    newObjectMethod: (args: Partial<ScenarioAttributes>) => new Scenario(args, false),
    schema
});

export default servicesImporter;
