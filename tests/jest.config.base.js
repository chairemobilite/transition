// These dependencies are only published as ES modules, they need to be
// compiled to CommonJS for jest
const esmOnlyPackages = ['kdbush', 'geokdbush', 'tinyqueue', 'uuid', 'geobuf', 'pbf', 'p-queue'].join('|');

module.exports = {
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tsconfig.json',
                // transition-backend uses `module: node20`, which ts-jest warns about for each file
                // unless `isolatedModules` is set, but that would stop type checking the tests
                diagnostics: { ignoreCodes: [151002] }
            }
        ],
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
