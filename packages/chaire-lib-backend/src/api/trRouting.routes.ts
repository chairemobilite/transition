import express from 'express';

import { isLoggedIn } from '../services/auth/authorization';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import trRoutingService from '../utils/trRouting/TrRoutingServiceBackend';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

const router = express.Router();

router.use(isLoggedIn);

router.get('/route', async (req, res) => {
    try {
        const parameters = req.body;
        const routingResults = await trRoutingService.route(
            parameters.query,
            parameters.host || 'http://localhost',
            parameters.port || Preferences.get('trRouting.port')
        );
        return res.status(200).json(Status.createOk(routingResults));
    } catch (error) {
        console.error(error);
        return res.status(500).json(Status.createError(TrError.isTrError(error) ? error.message : error));
    }
});

router.get('/summary', async (req, res) => {
    try {
        const body = req.body;
        const summaryResults = await trRoutingService.summary(body);
        return res.status(200).json(Status.createOk(summaryResults));
    } catch (error) {
        console.error(error);
        return res.status(500).json(Status.createError(TrError.isTrError(error) ? error.message : error));
    }
});

export default function (app: express.Express) {
    app.use('/trRouting', router);
}
