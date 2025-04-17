/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validate as uuidValidate } from 'uuid';
import * as z from 'zod';

import { GenericObject, GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { parseJsonFile, FileReaderCallback } from 'chaire-lib-backend/lib/services/files/JsonFileReader';

type Literal = boolean | null | number | string;
type Json = Literal | { [key: string]: Json } | Json[];
const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonSchema: z.ZodSchema<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]));
// TODO Should we remove null choices or keep their values when exporting?
export const genericAttributesSchema = z.object({
    id: z.string(),
    data: z.object({}).catchall(jsonSchema),
    is_frozen: z.boolean().optional(),
    integer_id: z.union([z.number(), z.null()]).optional(),
    internal_id: z.union([z.string(), z.null()]).optional(),
    shortname: z.string().optional(),
    name: z.string().optional(),
    description: z.union([z.string(), z.null()]).optional(),
    color: z.union([z.string(), z.null()]).optional(),
    created_at: z.string().optional(),
    updated_at: z.union([z.string(), z.null()]).optional()
});

interface ValidatorAttributes<T extends GenericAttributes> {
    // TODO Type the queries
    dbQueries: any;
    objectsToCache?: any;
    newObjectMethod: (args: Partial<T>) => GenericObject<T>;
    schema: z.AnyZodObject;
}

class CollectionImporter<T extends GenericAttributes> {
    private _attributes: ValidatorAttributes<T>;

    constructor(attributes: ValidatorAttributes<T>) {
        this._attributes = attributes;
    }

    private processJsonObject(data: { [key: string]: any }): Partial<T> {
        // Parse on a partial of the schema
        const attributes = this._attributes.schema.partial().parse(data) as Partial<T>;
        if (Object.keys(attributes).length === 0) {
            // Will happen for objects with no valid fields. Since each field should be optional, that object would pass but contain no data
            throw 'No valid fields';
        }
        const object = this._attributes.newObjectMethod(attributes);
        if (!uuidValidate(object.getId())) {
            throw 'Invalid ID format';
        }
        if (!object.validate()) {
            throw `${object.errors}`;
        }
        // Do not push object.attributes as unset fields may end up being set here
        return attributes;
    }

    protected callFileParser(filePath: string, callback: FileReaderCallback) {
        return parseJsonFile(filePath, callback);
    }

    async import(
        filePath: string
    ): Promise<{ result: 'success'; created: number; updated: number } | { result: 'error'; error: any }> {
        const objects: Partial<T>[] = [];
        try {
            await this.callFileParser(filePath, (data: { [key: string]: any }, rowNum: number) => {
                try {
                    objects.push(this.processJsonObject(data));
                } catch (error) {
                    throw `Error validating data for object at position ${rowNum}: ${error}`;
                }
            });
            const newObjects: Partial<T>[] = [];
            const updatedObjects: Partial<T>[] = [];
            const promises = objects.map(async (data) => {
                const object = this._attributes.newObjectMethod(data);
                if (await this._attributes.dbQueries.exists(object.getId())) {
                    // TODO: the attributes obtained this way may have some
                    // unset values set by the constructor and thus override
                    // whatever is in the DB. Is that acceptable? Ideally, we
                    // would just update whatever was in the file, then fetch
                    // the objects in the DB again and send them to cache. But
                    // then, if only some fields are set, they may not match the
                    // value of other fields. So saving the whole objects like
                    // here would be better? Anyway, we assume whatever is
                    // imported was first exported from a valid instance...
                    updatedObjects.push(object.attributes);
                } else {
                    // Here we push the complete new object's attributes which may have filled the blank mandatory fields
                    newObjects.push(object.attributes);
                }
            });
            await Promise.all(promises);
            if (newObjects.length > 0) {
                await this._attributes.dbQueries.createMultiple(newObjects);
                if (this._attributes.objectsToCache) {
                    await this._attributes.objectsToCache(newObjects);
                }
            }
            if (updatedObjects.length > 0) {
                await this._attributes.dbQueries.updateMultiple(updatedObjects);
                if (this._attributes.objectsToCache) {
                    await this._attributes.objectsToCache(updatedObjects);
                }
            }
            return { result: 'success', created: newObjects.length, updated: updatedObjects.length };
        } catch (error) {
            return { result: 'error', error };
        }
    }
}

export default CollectionImporter;
