/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import path from 'path';
import type { Express, Request, Response, RequestHandler } from 'express';

import _camelCase from 'lodash/camelCase';
import * as express from 'express';
import favicon from 'serve-favicon';
import expressSession from 'express-session';
import KnexConnection from 'connect-session-knex';
import morgan from 'morgan'; // http logger
import authRoutes from 'chaire-lib-backend/lib/api/auth.routes';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import config from 'chaire-lib-backend/lib/config/server.config';
import { userAuthModel } from 'chaire-lib-backend/lib/services/auth/userAuthModel';
import publicRoutes from './api/public.routes';
import userFilesRoutes from './api/userFiles.routes';
import configurePassport from 'chaire-lib-backend/lib/config/auth';

export const setupServer = (app: Express) => {
    const projectShortname = config.projectShortname;
    if (!projectShortname) {
        throw 'Project short name is not set';
    }

    // Public directory from which files are served
    const publicDirectory = path.join(__dirname, '..', '..', '..', 'public');
    const publicDistDirectory = path.join(publicDirectory, 'dist', projectShortname);
    // Local path where locales are stored
    const localeDirectory = path.join(__dirname, '..', '..', '..', 'locales');

    // FIXME Why this dir?
    directoryManager.createDirectoryIfNotExistsAbsolute(publicDistDirectory);
    directoryManager.createDirectoryIfNotExistsAbsolute(config.projectDirectory);
    directoryManager.createDirectoryIfNotExists('logs');
    directoryManager.createDirectoryIfNotExists('imports');
    directoryManager.createDirectoryIfNotExists('cache');
    directoryManager.createDirectoryIfNotExists('gtfs');
    directoryManager.createDirectoryIfNotExists('exports');
    directoryManager.createDirectoryIfNotExists('parsers');
    directoryManager.createDirectoryIfNotExists('tasks');
    directoryManager.createDirectoryIfNotExists('osrm');
    directoryManager.createDirectoryIfNotExists('valhalla');
    directoryManager.createDirectoryIfNotExists('userData');

    const indexPath = path.join(
        publicDistDirectory,
        `index-${projectShortname}${process.env.NODE_ENV === 'test' ? '_test' : ''}.html`
    );
    const publicPath = express.static(publicDistDirectory);
    const localePath = express.static(localeDirectory);

    const KnexSessionStore = KnexConnection(expressSession);
    const sessionStore = new KnexSessionStore({
        knex: knex,
        tablename: 'sessions' // optional. Defaults to 'sessions'
    });

    const session = expressSession({
        name:
            'trsession' +
            _camelCase(projectShortname + (process.env.PROJECT_SAMPLE ? '_' + process.env.PROJECT_SAMPLE : '')),
        secret: process.env.EXPRESS_SESSION_SECRET_KEY as string,
        resave: false,
        saveUninitialized: false,
        store: sessionStore
    });
    const passport = configurePassport(userAuthModel);

    app.use(
        morgan('combined', {
            // do not log if nolog=true is part of the url params:
            skip: function (req) {
                return req.url.indexOf('nolog=true') !== -1;
            }
        })
    );
    // FIXME Since upgrading @types/node, the types are wrong and we get compilation error. It is documented for example https://github.com/DefinitelyTyped/DefinitelyTyped/issues/53584 the real fix would require upgrading a few packages and may have side-effects. Simple casting works for now.
    app.use(express.json({ limit: '500mb' }) as RequestHandler);
    app.use(express.urlencoded({ limit: '500mb', extended: true }) as RequestHandler);
    app.use(session);
    app.use(favicon(path.join(publicDirectory, 'favicon.ico')));
    app.use(passport.initialize());
    app.use(passport.session());

    // Auth routes initialize passport, which needs to be initialized before the other routes
    authRoutes(app, userAuthModel, passport);

    app.set('trust proxy', true); // allow nginx or other proxy server to send request ip address

    // send js and css compressed (gzip) to save bandwidth:
    app.get(/.*\.js$/, (req, res, next) => {
        req.url = req.url + '.gz';
        res.set('Content-Encoding', 'gzip');
        res.set('Content-Type', 'text/javascript');
        next();
    });

    app.get(/.*\.css$/, (req, res, next) => {
        req.url = req.url + '.gz';
        res.set('Content-Encoding', 'gzip');
        res.set('Content-Type', 'text/css');
        next();
    });

    app.get(/.*\.json$/, (req: Request, res: Response, next) => {
        res.set('Content-Type', 'application/json');
        next();
    });

    // Set up public API
    publicRoutes(app, passport);

    // Routes to download the user's files
    userFilesRoutes(app);

    app.use('/dist/', publicPath); // this needs to be after gzip middlewares.
    app.use('/locales/', localePath); // this needs to be after gzip middlewares.
    // Fallback to 404 if missing translation file, otherwise, it returns the index.html file
    app.use('/locales/', (_req, res) => res.sendStatus(404));

    app.get(/.*/, (req: Request, res: Response): void => {
        res.sendFile(indexPath);
    });
    return { app, session };
};

process.on('unhandledRejection', (err: any) => {
    if (err) {
        console.error(err.stack);
    }
});
