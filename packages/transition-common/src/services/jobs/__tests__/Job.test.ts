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

const jobAttributes: JobAttributes<TestJobType> = {
    id: 1,
    name: 'test' as const,
    user_id: 3,
    status: 'pending',
    data: { parameters: { foo: 'bar' } },
    resources: { files: { testFile: 'path/to/file' } }
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
