/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BaseObject } from '../BaseObject';

type TestAttributes = {
    shortname: string;
    name: string;
    otherField?: string;
}

class TestObject extends BaseObject<TestAttributes> {

    protected _prepareAttributes(attributes: Partial<TestAttributes>): TestAttributes {
        return { shortname: 'defaultShortname', name: 'defaultName', ...attributes };
    }

    protected _validate(): [boolean, string[]] {
        const errors: string[] = [];
        if (this.attributes.name === 'invalid') {
            errors.push('Name is invalid');
        }
        return [errors.length === 0, errors];
    }
}

let attributes: TestAttributes;

const testObjectName = 'Test Object';
const testObjectShortname = 'TO';
beforeEach(() => {
    attributes = {
        shortname: testObjectShortname,
        name: testObjectName,
    };
});

test('should create a new object with default attributes', () => {
    const obj = new TestObject({});
    expect(obj.attributes.shortname).toEqual('defaultShortname');
    expect(obj.attributes.name).toEqual('defaultName');
    expect(obj.attributes.otherField).toBeUndefined();
});

test('should create object with attributes correctly', () => {
    const obj = new TestObject(attributes);
    expect(obj.attributes.shortname).toEqual(testObjectShortname);
    expect(obj.attributes.name).toEqual(testObjectName);
    expect(obj.attributes.otherField).toBeUndefined();
});

describe('mergeAttributes', () => {
    test('should merge attributes correctly', () => {
        const obj = new TestObject(attributes);
        obj.mergeAttributes({ name: 'Updated Name' });
        expect(obj.attributes.name).toBe('Updated Name');
    });

    test('should merge attributes correctly, when resetting to undefined', () => {
        attributes = { shortname: 'InitialShortname', name: 'Initial Name', otherField: 'Initial Other' };
        const obj = new TestObject(attributes);
        obj.mergeAttributes({ otherField: undefined, name: 'Updated Name' });
        expect(obj.attributes).toEqual({
            name: 'Updated Name',
            shortname: 'InitialShortname',
            otherField: undefined
        });
    });
});

describe('isValid method', () => {

    test('should validate object correctly with valid object', () => {
        const obj = new TestObject(attributes);
        expect(obj.isValid()).toBe(true);
        expect(obj.getErrors()).toHaveLength(0);
    });

    test('should validate object correctly with invalid object', () => {
        const invalidObj = new TestObject({ name: 'invalid', shortname: 'TS' });
        expect(invalidObj.isValid()).toBe(false);
        expect(invalidObj.getErrors()).toContain('Name is invalid');
    });

    test('should reset validation when attributes are set with "_set" method and calling isValid, valid => invalid', () => {
        // First test with a valid object
        const obj = new TestObject(attributes);
        expect(obj.isValid()).toBe(true);
        expect(obj.getErrors()).toHaveLength(0);

        // Set the name to 'invalid' and make sure errors and validation are reset, calling isValid first
        obj.set('name', 'invalid');
        expect(obj.isValid()).toBe(false);
        expect(obj.getErrors()).toContain('Name is invalid');
    });

    test('should reset validation when attributes are set with "_set" method and calling isValid, invalid => valid', () => {
        // First test with an invalid object
        const obj = new TestObject({ name: 'invalid', shortname: 'TS' });
        expect(obj.isValid()).toBe(false);
        expect(obj.getErrors()).toContain('Name is invalid');

        // Set the name to a valid value and make sure errors and validation are reset, calling isValid first
        obj.set('name', attributes.name);
        expect(obj.isValid()).toBe(true);
        expect(obj.getErrors()).toHaveLength(0);
    });

    test('should reset validation when attributes are set with "_set" method and calling getErrors', () => {
        // First test with a valid object
        const obj = new TestObject(attributes);
        expect(obj.isValid()).toBe(true);
        expect(obj.getErrors()).toHaveLength(0);

        // Set the name to 'invalid' and make sure errors and validation are reset, calling getErrors first
        obj.set('name', 'invalid');
        expect(obj.getErrors()).toContain('Name is invalid');
        expect(obj.isValid()).toBe(false);
    });

    test('should reset validation when attributes are set with "mergeAttributes" method and calling isValid, valid => invalid', () => {
        // First test with a valid object
        const obj = new TestObject(attributes);
        expect(obj.isValid()).toBe(true);
        expect(obj.getErrors()).toHaveLength(0);

        // Set the name to 'invalid' and make sure errors and validation are reset, calling isValid first
        obj.mergeAttributes({ name: 'invalid' });
        expect(obj.isValid()).toBe(false);
        expect(obj.getErrors()).toContain('Name is invalid');
    });

    test('should reset validation when attributes are set with "mergeAttributes" method and calling isValid, invalid => valid', () => {
        // First test with an invalid object
        const obj = new TestObject({ name: 'invalid', shortname: 'TS' });
        expect(obj.isValid()).toBe(false);
        expect(obj.getErrors()).toContain('Name is invalid');

        // Set the name to a valid value and make sure errors and validation are reset, calling isValid first
        obj.mergeAttributes(attributes);
        expect(obj.isValid()).toBe(true);
        expect(obj.getErrors()).toHaveLength(0);
    });
});

test('should set and get attributes correctly', () => {
    const obj = new TestObject(attributes);
    expect(obj.attributes).toEqual(attributes);
    obj.set('name', 'New Name');
    expect(obj.get('name')).toBe('New Name');
    expect(obj.attributes).toEqual({ ...attributes, name: 'New Name' });
});

test('should get an undefined attribute with/without default value', () => {
    // Do not set the name
    const obj = new TestObject(attributes);
    const defaultOtherAttribute = 'Default Other';
    expect(obj.get('otherField', defaultOtherAttribute)).toBe(defaultOtherAttribute);
    expect(obj.get('otherField')).toBeUndefined();
});
