module.exports = {
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { 'tsconfig': 'tsconfig.json' }]
    },
    // Runs before test files are imported, so the geobuf and pbf mocks are already in place.
    setupFiles: [
        '../../tests/jestSetup.base.ts'
    ],
    setupFilesAfterEnv: [],
    'collectCoverage': true,
    'testEnvironment': 'node',
    preset: 'ts-jest',
    'testRegex': '/__tests__/.*\\.(test|spec)\\.(jsx?|tsx?)$',
    'moduleFileExtensions': [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node'
    ]
};
