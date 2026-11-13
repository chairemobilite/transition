// These dependencies are only published as ES modules, they need to be
// compiled to CommonJS for jest
const esmOnlyPackages = ['kdbush', 'geokdbush', 'tinyqueue', 'uuid', 'geobuf', 'pbf', 'stream-json', 'stream-chain'].join('|');

module.exports = {
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { 'tsconfig': 'tsconfig.json' }],
        [`/node_modules/(${esmOnlyPackages})/.+\\.js$`]: [
            'ts-jest',
            { tsconfig: { allowJs: true, module: 'commonjs', esModuleInterop: true } }
        ]
    },
    transformIgnorePatterns: [`/node_modules/(?!(${esmOnlyPackages})/)`],
    setupFilesAfterEnv: [
        '../../tests/jestSetup.base.ts'
    ],
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
