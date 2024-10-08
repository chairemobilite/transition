module.exports = {
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { 'tsconfig': 'tsconfig.json' }]
    },
    setupFilesAfterEnv: [
        '../../tests/jestSetup.base.ts'
    ],
    'collectCoverage': true,
    'testEnvironment': 'node',
    preset: 'ts-jest',
    'testRegex': '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
    'moduleFileExtensions': [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node'
    ]
};
