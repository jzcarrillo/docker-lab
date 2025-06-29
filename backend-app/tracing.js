const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'logs.txt');

function trace(message, serviceName = 'backend') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${serviceName.toUpperCase()}] ${message}\n`;
    fs.appendFileSync(logPath, logMessage, 'utf8');
    console.log(logMessage.trim());
}

module.exports = trace;
