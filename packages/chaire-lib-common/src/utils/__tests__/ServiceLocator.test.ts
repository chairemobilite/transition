/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from '../ServiceLocator';

describe('Utils:ServiceLocator', function() {

  test('should add a service', function() {

    serviceLocator.addService('testService', { foo: 'bar' });
    expect(serviceLocator.hasService('testService')).toBe(true);
    expect(serviceLocator.testService).toEqual({ foo: 'bar' });
    serviceLocator.removeService('testService');

  });

  test('should remove a service', function() {

    serviceLocator.addService('testService', { foo: 'bar' });
    serviceLocator.removeService('testService');
    expect(serviceLocator.hasService('testService')).toBe(false);
    expect(serviceLocator.testService).toBe(undefined);

  });

});