/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries           from '../transitAgencies.db.queries';
import simulationDbQueries from '../simulations.db.queries';
import Collection          from 'transition-common/lib/services/agency/AgencyCollection';
import ObjectClass         from 'transition-common/lib/services/agency/Agency';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const objectName   = 'agency';
const simulationId = '373a583c-df49-440f-8f44-f39fb0033c56';

const newObjectAttributes = {
  id           : uuidV4(),
  internal_id  : 'internalTestId',
  acronym      : 'ATEST',
  name         : 'Agency test',
  is_frozen: false,
  integer_id   : 1,
  is_enabled   : true,
  color        : '#ffffff',
  description  : null,
  simulation_id: null,
  data         : {
    foo: 'bar',
    bar: 'foo'
  }
};

const newObjectAttributes2 = {
  id           : uuidV4(),
  internal_id  : 'internalTestId2',
  acronym      : 'ATEST2',
  name         : 'Agency test 2',
  is_frozen    : false,
  is_enabled: true,
  integer_id   : 2,
  color        : '#000000',
  description  : 'description test',
  simulation_id: simulationId,
  data         : {
    foo2: 'bar2',
    bar2: 'foo2'
  }
};

const updatedAttributes = {
  name       : 'Agency test 1b',
  internal_id: 'internalTestId1b'
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await simulationDbQueries.create({
        id: simulationId,
        data: {
            transitNetworkDesignParameters: {} as any, // Casting as `any` to avoid having to define all parameters, simulations will be removed shortly anyway
            routingAttributes: {}
        }
    });
});

afterAll(async() => {
    await dbQueries.truncate();
    await simulationDbQueries.truncate();
    await knex.destroy();
});

describe(`${objectName}`, () => {

    test('exists should return false if object is not in database', async () => {

        const exists = await dbQueries.exists(uuidV4())
        expect(exists).toBe(false);

    });

    test('should create a new object in database', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read a new object in database', async() => {

        const attributes = await dbQueries.read(newObjectAttributes.id) as any;
        delete attributes.updated_at;
        delete attributes.created_at;
        expect(attributes).toEqual(newObjectAttributes);

    });

    test('should update an object in database', async() => {

        const id = await dbQueries.update(newObjectAttributes.id, updatedAttributes);
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read an updated object from database', async() => {

        const updatedObject = await dbQueries.read(newObjectAttributes.id) as any;
        for (const attribute in updatedAttributes)
        {
            expect(updatedObject[attribute]).toBe(updatedAttributes[attribute]);
        }

    });

    test('should create a second new object indatabase', async() => {

        const newObject = new ObjectClass(newObjectAttributes2, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes2.id);

    });

    test('should read collection from database', async() => {

        const _collection = await dbQueries.collection();
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributes);
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        expect(collection[0].getId()).toBe(_newObjectAttributes.id);
        expect(collection[0].attributes).toEqual(new ObjectClass(_newObjectAttributes, false).attributes);
        expect(collection[1].getId()).toBe(_newObjectAttributes2.id);
        expect(collection[1].attributes).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);

    });

    test('update multiple objects, with error, none should be updated', async() => {

        // Reset the first object to its original state
        const _updatedAttributes = Object.assign({}, newObjectAttributes);
        const updatedObject = new ObjectClass(_updatedAttributes, true);
        // Add a simulationID to second object, should throw an error
        const _updatedAttributes2 = { id: newObjectAttributes2.id, simulation_id: uuidV4() };
        const updatedObject2 = new ObjectClass(_updatedAttributes2, true);

        let error: any = undefined;
        try {
            await dbQueries.updateMultiple([updatedObject.attributes, updatedObject2.attributes]);
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Make sure the first object has not been updated since the update is a transaction
        const _collection = await dbQueries.collection();
        const object = _collection.find(obj => obj.id === newObjectAttributes.id);
        expect(object).toBeDefined();
        for (const attribute in updatedAttributes)
        {
            expect((object as any)[attribute]).toEqual(updatedAttributes[attribute]);
        }
    });

    test('update multiple objects, with success', async() => {

        // Reset the first object to its original state
        const _updatedAttributes = Object.assign({}, newObjectAttributes);
        const updatedObject = new ObjectClass(_updatedAttributes, true);
        const _updatedAttributes2 = { id: newObjectAttributes2.id, ...updatedAttributes };

        const response = await dbQueries.updateMultiple([updatedObject.attributes, _updatedAttributes2]);
        expect(response.length).toEqual(2);

        // Make sure both objects have been updated
        const _collection = await dbQueries.collection();
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributes);
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes2[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        // Find new object
        const object1 = collection.find((obj) => obj.getId() === _newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect((object1 as any).attributes).toEqual(new ObjectClass(_newObjectAttributes, false).attributes);
        const object2 = collection.find((obj) => obj.getId() === _newObjectAttributes2.id);
        expect(object2).toBeDefined();
        expect((object2 as any).attributes).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);
    });

    test('should delete objects from database', async() => {

        const id = await dbQueries.delete(newObjectAttributes.id)
        expect(id).toBe(newObjectAttributes.id);

        const ids = await dbQueries.deleteMultiple([newObjectAttributes.id, newObjectAttributes2.id]);
        expect(ids).toEqual([newObjectAttributes.id, newObjectAttributes2.id]);

    });

    test('create multiple with errors, it should be a transaction', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        // Simulation ID does not exist, it shouldn't be possible to insert this object
        const newObject2 = new ObjectClass(Object.assign({}, newObjectAttributes2, { simulation_id: uuidV4() }), true);

        let error: any = undefined;
        try {
            await dbQueries.createMultiple([newObject.attributes, newObject2.attributes]);
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();
        const _collection = await dbQueries.collection();
        expect(_collection.length).toEqual(0);

    });

    test('create multiple with success', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const newObject2 = new ObjectClass(newObjectAttributes2, true);

        const ids = await dbQueries.createMultiple([newObject.attributes, newObject2.attributes]);

        expect(ids).toEqual([{ id: newObject.getId() }, { id: newObject2.getId() }]);
        const _collection = await dbQueries.collection();
        expect(_collection.length).toEqual(2);

    });

});

describe('isAcronymSuffixClash', () => {
    beforeEach(async () => {
        await dbQueries.truncate();
        // Create 2 objects
        await dbQueries.create(new ObjectClass(newObjectAttributes, true).attributes);
        await dbQueries.create(new ObjectClass(newObjectAttributes2, true).attributes);
    });

    test('should not clash if suffix is available', async () => {
        expect(await dbQueries.isAcronymSuffixClash({
            agencyIds: [newObjectAttributes.id],
            suffix: ' copy'
        })).toEqual(false);
    });

    test('should not clash if suffix is available for the given interview', async () => {
        const suffix = ' copy';
        // Insert an agency with the suffix, but the original is not part of the of query
        await dbQueries.create({
            acronym: newObjectAttributes2.acronym + suffix,
            data: {}
        } as any);

        // Validate suffix with the other agency, it should be available
        expect(await dbQueries.isAcronymSuffixClash({
            agencyIds: [newObjectAttributes.id],
            suffix: ' copy'
        })).toEqual(false);
    });

    test('should clash if suffix is not available for the given interview', async () => {
        const suffix = ' copy';
        // Insert an agency with the suffix, but the original is not part of the of query
        await dbQueries.create({
            acronym: newObjectAttributes2.acronym + suffix,
            data: {}
        } as any);

        // Validate suffix with the other agency, it should be available
        expect(await dbQueries.isAcronymSuffixClash({
            agencyIds: [newObjectAttributes2.id],
            suffix: ' copy'
        })).toEqual(true);
    });

    test('should clash if suffix is not available for any interview', async () => {
        const suffix = ' copy';
        // Insert an agency with the suffix, but the original is not part of the of query
        await dbQueries.create({
            acronym: newObjectAttributes2.acronym + suffix,
            data: {}
        } as any);

        // Validate suffix with the other agency, it should be available
        expect(await dbQueries.isAcronymSuffixClash({
            agencyIds: [newObjectAttributes2.id, newObjectAttributes.id],
            suffix: ' copy'
        })).toEqual(true);
    });

    test('should clash if suffix is not available for any interview and no interview is specified', async () => {
        const suffix = ' copy';
        // Insert an agency with the suffix, but the original is not part of the of query
        await dbQueries.create({
            acronym: newObjectAttributes2.acronym + suffix,
            data: {}
        } as any);

        // Validate suffix with the other agency, it should be available
        expect(await dbQueries.isAcronymSuffixClash({
            agencyIds: [],
            suffix: ' copy'
        })).toEqual(true);
    });

    test('rejects empty or invalid agency IDs', async () => {
        await expect(dbQueries.isAcronymSuffixClash({ agencyIds: ['not-a-uuid'], suffix: ' copy' })).rejects.toThrow(
            TrError
        );
    });

    test('rejects empty suffix string', async () => {
        await expect(dbQueries.isAcronymSuffixClash({ agencyIds: [newObjectAttributes.id], suffix: '' })).rejects.toThrow(TrError);
    });
});

describe('Agency duplication', () => {
    beforeEach(async () => {
        await dbQueries.truncate();
        await dbQueries.create(new ObjectClass(newObjectAttributes, true).attributes);
        await dbQueries.create(new ObjectClass(newObjectAttributes2, true).attributes);
    });

    test('duplicates selected agencies with a suffix and returns their ID mapping', async () => {
        const agencyIdMapping = await dbQueries.duplicate({
            agencyIds: [newObjectAttributes2.id, newObjectAttributes.id],
            newAgencySuffix: ' copy'
        });

        expect(Object.keys(agencyIdMapping)).toEqual(
            expect.arrayContaining([newObjectAttributes.id, newObjectAttributes2.id])
        );
        expect(Object.keys(agencyIdMapping)).toHaveLength(2);

        const duplicatedAgency = await dbQueries.read(agencyIdMapping[newObjectAttributes2.id]);
        expect(duplicatedAgency).toEqual(expect.objectContaining({
            ...newObjectAttributes2,
            id: agencyIdMapping[newObjectAttributes2.id],
            acronym: `${newObjectAttributes2.acronym} copy`,
            name: `${newObjectAttributes2.name} copy`,
            integer_id: expect.any(Number)
        }));
    });

    test('deduplicates requested agency IDs', async () => {
        const agencyIdMapping = await dbQueries.duplicate({
            agencyIds: [newObjectAttributes.id, newObjectAttributes.id],
            newAgencySuffix: ' duplicate'
        });

        expect(Object.keys(agencyIdMapping)).toEqual([newObjectAttributes.id]);
    });

    test('rejects when agency acronym already exists', async () => {
        const suffix = ' copy';
        // Create an agency with an acronym that contains the suffix used in the duplicate query
        await dbQueries.create({
            acronym: newObjectAttributes.acronym + suffix,
            data: {}
        } as any);

        await expect(dbQueries.duplicate({
            agencyIds: [newObjectAttributes.id, newObjectAttributes.id],
            newAgencySuffix: suffix
        })).rejects.toThrow(TrError);
    });

    test('returns an empty mapping when no requested agency exists', async () => {
        expect(await dbQueries.duplicate({ agencyIds: [uuidV4()], newAgencySuffix: ' copy' })).toEqual({});
    });

    test('rejects empty or invalid agency IDs', async () => {
        await expect(dbQueries.duplicate({ agencyIds: [], newAgencySuffix: ' copy' })).rejects.toThrow(TrError);
        await expect(dbQueries.duplicate({ agencyIds: ['not-a-uuid'], newAgencySuffix: ' copy' })).rejects.toThrow(
            TrError
        );
    });

    test('rejects empty suffix string', async () => {
        await expect(dbQueries.duplicate({ agencyIds: [newObjectAttributes.id], newAgencySuffix: '' })).rejects.toThrow(TrError);
    });

    test('honors the provided transaction', async () => {
        let rolledBackAgencyId: string | undefined;
        await expect(
            knex.transaction(async (trx) => {
                const mapping = await dbQueries.duplicate({
                    agencyIds: [newObjectAttributes.id],
                    newAgencySuffix: ' rollback',
                    transaction: trx
                });
                rolledBackAgencyId = mapping[newObjectAttributes.id];
                throw new Error('rollback');
            })
        ).rejects.toThrow('rollback');

        expect(rolledBackAgencyId).toBeDefined();
        expect(await dbQueries.exists(rolledBackAgencyId as string)).toBe(false);
    });
});

describe('Agency, with transactions', () => {

    beforeEach(async () => {
        // Empty the table and add 1 object
        await dbQueries.truncate();
        const newObject = new ObjectClass(newObjectAttributes, true);
        await dbQueries.create(newObject.attributes);
    });

    test('Create, update with success', async() => {
        const currentAgencyNewName = 'new agency name';
        await knex.transaction(async (trx) => {
            const newObject = new ObjectClass(newObjectAttributes2, true);
            await dbQueries.create(newObject.attributes, { transaction: trx });
            await dbQueries.update(newObjectAttributes.id, { name: currentAgencyNewName }, { transaction: trx });
        });

        // Make sure the new object is there and the old has been updated
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(2);
        const { name, ...currentObject } = newObjectAttributes
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining({
            name: currentAgencyNewName,
            ...currentObject
        }));

        const object2 = collection.find((obj) => obj.id === newObjectAttributes2.id);
        expect(object2).toBeDefined();
        expect(object2).toEqual(expect.objectContaining(newObjectAttributes2));
    });

    test('Create, update with error', async() => {
        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                const newObject = new ObjectClass(newObjectAttributes2, true);
                await dbQueries.create(newObject.attributes, { transaction: trx });
                // Update with unexisting simulation ID, should throw an error
                await dbQueries.update(newObjectAttributes.id, { simulation_id: uuidV4() }, { transaction: trx });
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // The new object should not have been added and the one in DB should not have been updated
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining(newObjectAttributes));
    });

    test('Create, update, delete with error', async() => {
        const currentAgencyNewName = 'new agency name';
        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                const newObject = new ObjectClass(newObjectAttributes2, true);
                await dbQueries.create(newObject.attributes, { transaction: trx });
                await dbQueries.update(newObjectAttributes.id, { name: currentAgencyNewName }, { transaction: trx });
                await dbQueries.delete(newObjectAttributes.id, { transaction: trx });
                throw 'error';
            });
        } catch(err) {
            error = err;
        }
        expect(error).toEqual('error');

        // Make sure the existing object is still there and no new one has been added
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining(newObjectAttributes));
    });

});
