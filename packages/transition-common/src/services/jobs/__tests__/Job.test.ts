/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Job, { JobAttributes } from '../Job';

type TestJobType = {
    name: 'test';
    data: {
        parameters: {
            foo: string
        };
        results?: number;
    },
    files: {
        testFile: boolean;
        testFile2: boolean;
    }
}

type TestJobTypeWithInternalData = TestJobType &{
    internal_data: {
        internal_value1?: string;
        internal_value2?: {
            nestedKey: number;
        } 
    }
}

const jobAttributes: JobAttributes<TestJobType> = {
    id: 1,
    name: 'test' as const,
    user_id: 3,
    status: 'pending',
    internal_data: { },
    data: { parameters: { foo: 'bar' } },
    resources: { files: { testFile: 'path/to/file' } }
};

const jobAttributesWithInternalData: JobAttributes<TestJobTypeWithInternalData> = {
    ...jobAttributes,
    internal_data: { checkpoint: 100, internal_value1: 'value1' }
};

test('Test constructor', () => {
    const mainJobObj = new Job<TestJobType>(jobAttributes);
    expect(mainJobObj.status).toEqual('pending');
    expect(mainJobObj.attributes.name).toEqual('test');
    expect((mainJobObj.attributes as any).status).toBeUndefined();
});

test('Test constructor: without resources', () => {
    const { resources, ...rest } = jobAttributes;
    const mainJobObj = new Job<TestJobType>({ ...rest });
    expect(mainJobObj.status).toEqual('pending');
    expect(mainJobObj.attributes.name).toEqual('test');
    expect((mainJobObj.attributes as any).status).toBeUndefined();
});

test('Test setting internal data', () => {
    const mainJobObj = new Job<TestJobTypeWithInternalData>(jobAttributesWithInternalData);
    expect(mainJobObj.attributes.internal_data).toEqual(jobAttributesWithInternalData.internal_data);
    // Set new values for internal data
    mainJobObj.attributes.internal_data.internal_value2 = { nestedKey: 42 };
    mainJobObj.attributes.internal_data.internal_value1 = 'new value';
    mainJobObj.attributes.internal_data.checkpoint = 200;
    expect(mainJobObj.attributes.internal_data).toEqual({
        checkpoint: 200,
        internal_value1: 'new value',
        internal_value2: { nestedKey: 42 }
    });
})
