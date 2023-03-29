process.env.PROJECT_CONFIG = `${__dirname}/../../../../../tests/config2_test.js`;
import { serverConfig, projectConfig, initializeConfig, ServerConfiguration } from '../config';
import path from 'path';
import { ProjectConfiguration } from 'chaire-lib-common/lib/config/shared/project.config';

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

test('Expected server/project config from file defined in .env, with custom parsers', () => {
    type TypeServerConfig = {
        extraServerField: string;
    };
    type TypeProjectConfig = {
        extraProjectField: number;
    }
    const additionalServerConfig = {
        extraServerField: 'bar'
    };
    const additionalProjectConfig = {
        extraProjectField: 1234
    }
    const parseServer = jest.fn().mockReturnValue(additionalServerConfig);
    const parseProject = jest.fn().mockReturnValue(additionalProjectConfig);
    initializeConfig<TypeServerConfig, TypeProjectConfig>(parseServer, parseProject, true);

    // Verify new values and parse function calls
    const customServerConfig = serverConfig as ServerConfiguration<TypeServerConfig>;
    const customProjectConfig = projectConfig as ProjectConfiguration<TypeProjectConfig>;
    expect(customServerConfig).toEqual(expect.objectContaining(additionalServerConfig));
    expect(customProjectConfig).toEqual(expect.objectContaining(additionalProjectConfig));
    expect(parseServer).toHaveBeenCalledTimes(1);
    expect(parseProject).toHaveBeenCalledTimes(1);
    expect(parseServer).toHaveBeenCalledWith(expect.objectContaining({
        extraServerField: 'foo'
    }));
    expect(parseProject).toHaveBeenCalledWith(expect.objectContaining({
        extraProjectField: '1234'
    }));
    
    // Verify previous values are still ok
    expect(serverConfig.userDiskQuota).toEqual('1gb');
    expect(serverConfig.maxFileUploadMB).toEqual(256);
    expect(serverConfig.maxParallelCalculators).toEqual(1);
    expect(serverConfig.projectDirectory).toEqual(path.normalize(`${__dirname}/../../../../../tests/dir`));
    expect(projectConfig.projectShortname).toEqual('unitTest');
    expect(projectConfig.languages).toEqual(['fr', 'en']);
});
