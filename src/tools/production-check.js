require('dotenv').config();
const { buildProductionReport, formatProductionReport } = require('../services/productionCheckService');

buildProductionReport(null, { skipNetwork: false })
  .then(report => {
    console.log(formatProductionReport(report));
    process.exit(report.okCount >= Math.max(1, report.total - 2) ? 0 : 1);
  })
  .catch(error => {
    console.error('Production-check failed:', error);
    process.exit(1);
  });
