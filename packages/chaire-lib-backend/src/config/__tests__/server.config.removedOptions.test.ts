/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Test that a configuration file with removed options prevents the server from
// starting, instead of starting with the default configuration
process.env.PROJECT_CONFIG = `${__dirname}/../../../../../tests/config_removed_options_test.js`;

test('Configuration file with top-level local login options', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => require('../server.config')).toThrow(
        'The `confirmEmail`, `confirmEmailStrategy` options at the top level of the configuration are no longer supported. Please move them to `auth.localLogin` instead.'
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading server configuration in file'));
    errorSpy.mockRestore();
});
