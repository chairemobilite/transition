// Unset project config env variable
process.env.PROJECT_SHORTNAME = 'test';
delete process.env.PROJECT_CONFIG;
import path from 'path';
import config from '../server.config';

test('Expected default without env', () => {
    expect(config.userDiskQuota).toEqual('1gb');
    expect(config.maxFileUploadMB).toEqual(256);
    expect(config.projectShortname).toEqual('test');
    expect(config.maxParallelCalculators).toEqual(3);
    expect(config.projectDirectory).toEqual(path.normalize(`${__dirname}/../../../../../../projects/${process.env.PROJECT_SHORTNAME}`));
});
