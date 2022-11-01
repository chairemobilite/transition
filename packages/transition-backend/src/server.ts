/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
//require('@babel/register');
import fs from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import _dotenv from 'chaire-lib-common/lib/config/shared/dotenv.config';
import { setupServer } from './serverApp';
import setupSocketServerApp from './socketServerApp';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import express from 'express';
import { registerTranslationDir, addTranslationNamespace } from 'chaire-lib-backend/lib/config/i18next';
import config from 'chaire-lib-backend/lib/config/server.config';

const argv = yargs(hideBin(process.argv)).argv;

const useSSL = argv.ssl;
const port = argv.port ? parseInt(argv.port as string) : useSSL ? 8443 : 8080;

console.log(`starting server for project ${config.projectShortname} with port ${port}`);

process.on('uncaughtException', (err) => {
    // handle the error safely
    console.error('Just caught an uncaught exception!', err);
});

const app = express();

const { session } = setupServer(app);

if (!useSSL) {
    // Create http server
    const http = require('http');
    const server = http.createServer(app);
    server.listen(port);
    setupSocketServerApp(server, session);
} else {
    // Create the https server
    const pk = process.env.SSL_PRIVATE_KEY;
    const crt = process.env.SSL_CERT;
    if (!pk || !crt) {
        console.error(
            'Configuration error: you need to specify the SSL_PRIVATE_KEY and SSL_CERT keys in the .env file'
        );
        throw 'Configuration error: you need to specify the SSL_PRIVATE_KEY and SSL_CERT keys in the .env file';
    }
    try {
        const privateKey = fs.readFileSync(pk, 'utf8');
        const certificate = fs.readFileSync(crt, 'utf8');
        const https = require('https');
        const credentials = { key: privateKey, cert: certificate };
        const httpsServer = https.createServer(credentials, app);
        httpsServer.listen(port);
        setupSocketServerApp(httpsServer, session);
    } catch (err) {
        console.error('Error starting the https server: ', err);
        throw err;
    }
}

// Register server translations
registerTranslationDir(join(__dirname, '../../../locales/'));
addTranslationNamespace('transit');
