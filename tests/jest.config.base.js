module.exports = {
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { 'tsconfig': 'tsconfig.json' }],
        // These dependencies are only published as ES modules, compile them to CommonJS for jest
        '/node_modules/(kdbush|geokdbush|tinyqueue)/.+\\.js$': [
            'ts-jest',
            { tsconfig: { allowJs: true, module: 'commonjs', esModuleInterop: true } }
        ]
    },
    transformIgnorePatterns: ['/node_modules/(?!(kdbush|geokdbush|tinyqueue)/)'],
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
