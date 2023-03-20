// Test the server configuration without the environment variable, the file won't exists
delete process.env.PROJECT_CONFIG;
import fs from 'fs';
import os from 'os';

jest.mock('fs', () => {
    // Require the original module to not be mocked...
    const originalModule =
        jest.requireActual<typeof import('fs')>('fs');
  
    return {
        ...originalModule,
        existsSync: jest.fn().mockReturnValue(false)
    };
});
const existsSyncMock = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

test('Expected reading configuration files in default paths', () => {
    let error: unknown | undefined = undefined;
    try {
        require('../config')
    } catch (err) {
        error = err;
    }
    expect(error).toBeDefined();
    expect(existsSyncMock).toHaveBeenCalledTimes(2);
    expect(existsSyncMock).toHaveBeenCalledWith(`${os.homedir}/.config/transition/config.js`);
    expect(existsSyncMock).toHaveBeenCalledWith(`/etc/transition/config.js`);
});
