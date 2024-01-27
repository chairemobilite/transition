import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.send('The public API endpoint works!');
});

export default function (app: express.Express) {
    app.use('/api', router);
}
