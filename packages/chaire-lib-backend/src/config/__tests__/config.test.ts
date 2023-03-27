process.env.PROJECT_CONFIG = `${__dirname}/../../../../../tests/config2_test.js`;
import { serverConfig, projectConfig, initializeConfig } from '../config';
import path from 'path';

test('Expected server/project config from file defined in .env', () => {
    initializeConfig();
    
    expect(serverConfig.userDiskQuota).toEqual('1gb');
    expect(serverConfig.maxFileUploadMB).toEqual(256);
    expect(serverConfig.maxParallelCalculators).toEqual(1);
    expect(serverConfig.projectDirectory).toEqual(path.normalize(`${__dirname}/../../../../../tests/dir`));
    expect(projectConfig.projectShortname).toEqual('unitTest');
    expect(projectConfig.languages).toEqual(['fr', 'en']);
    // Make sure the server options don't appear in the project configuration
    expect(projectConfig.userDiskQuota).toBeUndefined();
    expect(projectConfig.maxFileUploadMB).toBeUndefined();
    expect(projectConfig.maxParallelCalculators).toBeUndefined();
    expect(projectConfig.projectDirectory).toBeUndefined();
});
