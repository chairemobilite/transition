/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
var mockSpawn = require('mock-spawn');

var osrmSpawn = mockSpawn();
require('child_process').spawn = osrmSpawn;

import { directoryManager } from '../../filesystem/directoryManager';
import { fileManager } from '../../filesystem/fileManager';

import OSRMProcessManager from '../OSRMProcessManager';
import OSRMServicePreparation from '../OSRMServicePreparation';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import OSRMService from '../../osrm/OSRMService';

// Mock process.kill to make sure we don't kill random processes
//const mockKill = jest.fn();
//mockKill.mockName("Mock Process.Kill()");
//mockKill.mockImplementation((pid, signal?) => {console.log(`Fake killing process ${pid}`); return true;});
//global.process.kill = mockKill;
jest.setTimeout(30000);

beforeAll(function(done) {
  directoryManager.emptyDirectory('osrm');
  done();
});

afterAll(function(done) {

    //TODO Since we mocked spawn, we don't need to really kill the process at the end
    // Investigate if we need other clean up
  //await OSRMProcessManager.stop({
  //  mode: 'walking'
  //});
  directoryManager.emptyDirectory('osrm');
  done();
});

describe('OSRM Service Manager', function() {

  beforeEach(function () {
    var verbose = false; // make it true to see additional verbose output
    osrmSpawn = mockSpawn(verbose);
    osrmSpawn.setStrategy(null);
    require('child_process').spawn = osrmSpawn;
  });

  test('should extract, contract and/or prepare osm file for single mode walking with default config', async function() {

    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));

    const extractResult = await OSRMServicePreparation.extract({
      mode: 'walking'
    });
    expect(extractResult.status).toBe('extracted');
    expect(osrmSpawn.calls[0].command).toBe('osrm-extract');
    const args0 = osrmSpawn.calls[0].args;
    expect(args0.length).toBe(2);
    expect(args0[0]).toMatch(/(utils\/processManagers\/osrmProfiles\/walking.lua)/i);

    const contractResult = await OSRMServicePreparation.contract({
      mode: 'walking'
    });
    expect(contractResult.status).toBe('contracted');
    expect(osrmSpawn.calls[1].command).toBe('osrm-contract');

    const prepareResult = await OSRMServicePreparation.prepare(['walking']) ;
    expect(prepareResult.status).toBe('prepared');
    expect(osrmSpawn.calls[2].command).toBe('osrm-extract');
    expect(osrmSpawn.calls[2].args).toEqual(args0);
    expect(osrmSpawn.calls[3].command).toBe('osrm-contract');

  });

  test('should extract, contract and/or prepare osm file for all modes with default config', async function() {

    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));

    const prepareResult = await OSRMServicePreparation.prepare();
    expect(prepareResult.status).toBe('prepared');
    expect(osrmSpawn.calls[0].command).toBe('osrm-extract');
    expect(osrmSpawn.calls[1].command).toBe('osrm-contract');
    expect(osrmSpawn.calls[2].command).toBe('osrm-extract');
    expect(osrmSpawn.calls[3].command).toBe('osrm-contract');
    expect(osrmSpawn.calls[4].command).toBe('osrm-extract');
    expect(osrmSpawn.calls[5].command).toBe('osrm-contract');
    expect(osrmSpawn.calls[6].command).toBe('osrm-extract');
    expect(osrmSpawn.calls[7].command).toBe('osrm-contract');
    expect(osrmSpawn.calls[8].command).toBe('osrm-extract');
    expect(osrmSpawn.calls[9].command).toBe('osrm-contract');

  });

  test('should extract, contract and/or prepare osm file for single mode walking with custom config', async function() {

    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));

    const prepareResult = await OSRMServicePreparation.prepare(['walking'], directoryManager.getAbsolutePath('imports/network2.osm'), 'custom');
    expect(prepareResult.status).toBe('prepared');

    expect(osrmSpawn.calls.length).toBe(2);
    expect(osrmSpawn.calls[0].command).toBe('osrm-extract');
    const args0 = osrmSpawn.calls[0].args;
    expect(args0.length).toBe(2);
    expect(args0[0]).toMatch(/(utils\/processManagers\/osrmProfiles\/walking.lua)/i);
    expect(args0[1]).toMatch(/(custom_walking\/custom_walking.osm)/i);
    expect(osrmSpawn.calls[1].command).toBe('osrm-contract');

  });

  test('should extract, contract and/or prepare osm file for single mode walking with no prefix', async function() {

    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));

    const prepareResult = await OSRMServicePreparation.prepare(['walking'], undefined, '');
    expect(prepareResult.status).toBe('prepared');

    expect(osrmSpawn.calls.length).toBe(2);
    expect(osrmSpawn.calls[0].command).toBe('osrm-extract');
    const args0 = osrmSpawn.calls[0].args;
    expect(args0.length).toBe(2);
    expect(args0[0]).toMatch(/(utils\/processManagers\/osrmProfiles\/walking.lua)/i);
    expect(args0[1]).toMatch(/(walking\/walking.osm)/i);
    expect(osrmSpawn.calls[1].command).toBe('osrm-contract');

  });

  test('should return an error if osm file does not exists', async function() {

    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, null, "[error] Input file not found"));

    const prepareResult = await OSRMServicePreparation.prepare(['walking'], directoryManager.getAbsolutePath('imports/network_does_not_exist.osm'), '');
    expect(prepareResult.status).toBe('error');
    expect(osrmSpawn.calls[0].command).toBe('osrm-extract');

  });

  test.skip('should route walking correctly', async () => {

    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, 'running and waiting for requests' /* stdout */));
    
    const prepareResult = await OSRMServicePreparation.prepare(['walking']);
    expect(prepareResult.status).toBe('prepared');

    const osrmServerStatus = await OSRMProcessManager.start({
      mode: 'walking'
    });
    expect(osrmServerStatus.status.includes('started', 'already_running')).toBe(true);

  });

  // TODO is this test title the right one?
  test('should start only walking and update preferences', async () => {

      // Clean up pids file, so that configureAllOsrmServers to not attempt a restart and try to kill
      // a random process
      fileManager.deleteFile("pids/osrmMode__driving__port7999.pid");
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] To prepare the data for routing, run:' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, '[info] finished preprocessing' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, 'running and waiting for requests' /* stdout */));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, null, 'required files are missing, cannot continue'));
    osrmSpawn.sequence.add(osrmSpawn.simple(0 /* exit code */, null, 'required files are missing, cannot continue'));

    const prepareResult = await OSRMServicePreparation.prepare(['walking']);
    expect(prepareResult.status).toBe('prepared');

    // Make sure the list of osrms to auto-start is longer than 1
    const autoStartOsrm : string[] = [];
    const osrmServerPrefsBefore = Preferences.current.osrmRouting;
    for (const routingMode in osrmServerPrefsBefore.modes) {
      if (osrmServerPrefsBefore.modes[routingMode].autoStart === true) {
        autoStartOsrm.push(routingMode);
      }
    }

    await OSRMProcessManager.configureAllOsrmServers();
      
    expect(osrmSpawn.calls[2].command).toBe('osrm-routed');
    expect(osrmSpawn.calls[3].command).toBe('osrm-routed');
    expect(osrmSpawn.calls[4].command).toBe('osrm-routed');

    const availableOsrms : string[] = [];
    const osrmServerPrefsAfter = Preferences.current.osrmRouting;
    for (const routingMode in osrmServerPrefsAfter.modes) {
      if (osrmServerPrefsAfter.modes[routingMode].enabled === true) {
        availableOsrms.push(routingMode);
      }
    }

    let containsAll = (baseArray, contained) => contained.every(v => baseArray.includes(v));
    expect(containsAll(autoStartOsrm, availableOsrms)).toBe(true);
    expect(containsAll(availableOsrms, autoStartOsrm)).toBe(false);

  });

  test('should not start servers if start is not request, even if autostart is true', async () => {

    // Clean up pids file, so that configureAllOsrmServers to not attempt a restart and try to kill
    // a random process
    fileManager.deleteFile("pids/osrmMode__driving__port7999.pid");

    // Make sure the list of osrms to auto-start is longer than 1
    const autoStartOsrm : string[] = [];
    const osrmServerPrefsBefore = Preferences.current.osrmRouting;
    for (const routingMode in osrmServerPrefsBefore.modes) {
        if (osrmServerPrefsBefore.modes[routingMode].autoStart === true) {
            autoStartOsrm.push(routingMode);
        }
    }

    await OSRMProcessManager.configureAllOsrmServers(false);

    expect(osrmSpawn.calls.length).toBe(0);

    const availableOsrms : string[] = [];
    const osrmServerPrefsAfter = Preferences.current.osrmRouting;
    for (const routingMode in osrmServerPrefsAfter.modes) {
        if (osrmServerPrefsAfter.modes[routingMode].enabled === true) {
            availableOsrms.push(routingMode);
        }
    }

    let containsAll = (baseArray, contained) => contained.every(v => baseArray.includes(v));
    expect(containsAll(autoStartOsrm, availableOsrms)).toBe(true);
    expect(containsAll(availableOsrms, autoStartOsrm)).toBe(false);

    for (let i = 0; i < availableOsrms.length; i++) {
        expect(OSRMService.getMode(availableOsrms[i] as any)).toBeDefined();
    }

  });

});
