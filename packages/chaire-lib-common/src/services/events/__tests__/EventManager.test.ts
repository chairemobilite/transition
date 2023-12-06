/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventEmitter from 'events/events';

import EventManager from '../EventManager';
import Event        from '../Event';

const eventManager      = new EventManager(new EventEmitter());

describe('Events', function() {
  
  test('should emit an event once', function(done) {

    const event = new Event('testEvent');

    eventManager.once(event, function() {
      
      expect(true);
      done();
      
    });

    eventManager.emit(event);

  });

  test('should emit an event', function(done) {

    const event = new Event('testEvent');

    const callback = function() {
      
      expect(true);
      eventManager.off(event, callback);
      done();
      
    };

    eventManager.on(event, callback);
    eventManager.emit(event, callback);

  });

  test('should correctly use addListener and removeListener aliases', function(done) {

    const event = new Event('testEvent');

    const callback = function() {
      
      expect(true);
      eventManager.removeListener(event, callback);
      done();
      
    };

    eventManager.addListener(event, callback);
    eventManager.emit(event, callback);

  });

  test('should emit an event from an event name (string)', function(done) {

    const eventName = 'testEvent';

    eventManager.once(eventName, function() {
      
      expect(true);
      done();
      
    });

    eventManager.emit(eventName);

  });

  test('should emit an event with data', function(done) {

    const event = new Event('testEvent');

    eventManager.once(event, function(data) {
      
      expect(data).toEqual({test: 'test'});
      done();
      
    });

    eventManager.emit(event, {test: 'test'});

  });

  test('should add and remove an event', function(done) {

    const event = new Event('testEvent');

    const callback = function() {
      
      eventManager.off(event, callback);
      expect(true);
      done();
      
    };

    eventManager.on(event, callback);
    eventManager.emit(event);

  });

  test('should emit an event, with typing', function(done) {
    const eventName = 'test.event';
    type TestEventType = {
        name: 'test.event',
        arguments: { 
            arg1: number,
            arg2: string
        };
    }
    const arg1Val = 100;
    const arg2Val = 'a string';

    const callback = function(args: { 
        arg1: number,
        arg2: string
    }) {
      expect(args.arg1).toEqual(arg1Val);
      expect(args.arg2).toEqual(arg2Val);
      eventManager.off(eventName, callback);
      done();
    };

    eventManager.onEvent<TestEventType>(eventName, callback);
    eventManager.emitEvent<TestEventType>(eventName, { arg1: arg1Val, arg2: arg2Val });

  });

});