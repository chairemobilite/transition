import express from 'express';
import { PassportStatic } from 'passport';

export default function (app: express.Express, passport: PassportStatic) {
    const router = express.Router();

    app.use('/api', router);

    router.use('/', passport.authenticate('api-login', { failWithError: true, failureMessage: true }))
    
    router.get('/',(req, res) => {
        res.send('The public API endpoint works!');
    });
}