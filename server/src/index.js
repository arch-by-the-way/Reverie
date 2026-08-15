const express = require('express');
const healthRouter = require('./routes/health');

const app = express();
app.use(express.json());
app.use(healthRouter);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`server listening on ${PORT}`));
}

module.exports = app;