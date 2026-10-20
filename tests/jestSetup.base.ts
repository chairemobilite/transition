// Initialize test wide variables
import { enableFetchMocks } from 'jest-fetch-mock';

// geobuf 4 and pbf 5 are ESM-only. This factory replaces them before test files are loaded.
jest.mock('geobuf', () => ({
    encode: jest.fn((geojson) => Buffer.from(JSON.stringify(geojson))),
    decode: jest.fn()
}));
jest.mock('pbf', () => ({
    PbfWriter: class PbfWriter {},
    PbfReader: class PbfReader {}
}));

process.env.PROJECT_CONFIG = `${__dirname}/config_test.js`;
process.env.IS_TESTING = 'true';
enableFetchMocks();
