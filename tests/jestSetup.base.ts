// Initialize test wide variables
import { enableFetchMocks } from 'jest-fetch-mock';

process.env.PROJECT_CONFIG = `${__dirname}/config_test.js`;
enableFetchMocks();
