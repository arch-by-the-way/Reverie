const router = require('express').Router();
router.get('/health', (req, res) => res.status(200).json({ status: '200: ok' }));
module.exports = router;