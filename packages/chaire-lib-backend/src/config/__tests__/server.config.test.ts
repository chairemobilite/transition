process.env.PROJECT_CONFIG = `${__dirname}/../../../../../../projects/test/config2.js`;
import config from '../server.config';
import path from 'path';

test('Expected default with env', () => {
    expect(config.userDiskQuota).toEqual('1gb');
    expect(config.maxFileUploadMB).toEqual(256);
    expect(config.projectShortname).toEqual('unitTest');
    expect(config.maxParallelCalculators).toEqual(1);
    expect(config.projectDirectory).toEqual(path.normalize(`${__dirname}/../../../../../../projects/test/dir`));
});
