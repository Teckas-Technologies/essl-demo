const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.text());

// Custom middleware to capture raw body
app.use((req, res, next) => {
    req.rawBody = '';
    req.on('data', (chunk) => {
        req.rawBody += chunk;
    });
    next();
});

// Log file setup
const logFile = path.join(__dirname, 'attendance_logs.txt');
const dailyLogFile = path.join(__dirname, 'logs', `attendance_${new Date().toISOString().split('T')[0]}.txt`);

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Helper function to log data
function logAttendanceData(data, endpoint, clientIP) {
    const timestamp = new Date().toISOString();
    const logEntry = `
========================================
Timestamp: ${timestamp}
Endpoint: ${endpoint}
Client IP: ${clientIP}
Device User-Agent: ${data.headers['user-agent'] || 'Unknown'}
Content-Type: ${data.headers['content-type'] || 'Unknown'}
Content-Length: ${data.headers['content-length'] || 'Unknown'}
Raw Body: ${data.rawBody || JSON.stringify(data.body)}
Parsed Data: ${JSON.stringify(data.body, null, 2)}
Query Parameters: ${JSON.stringify(data.query, null, 2)}
========================================

`;
    
    // Log to main file
    fs.appendFileSync(logFile, logEntry);
    
    // Log to daily file
    fs.appendFileSync(dailyLogFile, logEntry);
    
    console.log(`[${timestamp}] Data received from ESS K90 Pro at ${clientIP}`);
    console.log('Endpoint:', endpoint);
    console.log('Raw Data:', data.rawBody || JSON.stringify(data.body));
    
    // Parse attendance data if available
    if (data.body && data.body.DATA) {
        console.log('Parsed Attendance Records:');
        parseAttendanceData(data.body.DATA);
    }
}

// Helper function to parse attendance data
function parseAttendanceData(dataString) {
    try {
        const records = dataString.split('\n').filter(line => line.trim().startsWith('RECORD='));
        
        records.forEach(record => {
            const parts = record.split('\t');
            if (parts.length >= 5) {
                const recordNum = parts[0].replace('RECORD=', '');
                const userId = parts[1];
                const timestamp = parts[2];
                const checkType = parts[3] === '0' ? 'Check-In' : 'Check-Out';
                const verifyMode = getVerifyMode(parts[4]);
                
                console.log(`  Record ${recordNum}: User ${userId} - ${checkType} at ${timestamp} via ${verifyMode}`);
            }
        });
    } catch (error) {
        console.log('  Error parsing attendance data:', error.message);
    }
}

// Helper function to get verification mode description
function getVerifyMode(code) {
    const modes = {
        '1': 'Fingerprint',
        '2': 'Face Recognition',
        '3': 'Card',
        '4': 'Password',
        '15': 'Fingerprint Template',
        '25': 'Face Template'
    };
    return modes[code] || `Unknown (${code})`;
}

// Main endpoint for ESS K90 Pro attendance data
app.post('/cdata', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    console.log('\n🔔 --- ESS K90 Pro Data Received ---');
    
    // Log the received data
    logAttendanceData({
        headers: req.headers,
        body: req.body,
        query: req.query,
        method: req.method,
        rawBody: req.rawBody
    }, '/cdata', clientIP);
    
    // Generate response stamp
    const responseStamp = Date.now();
    
    // Send success response to device
    res.status(200).send(`OK\nSTAMP=${responseStamp}`);
    
    console.log(`✅ Response sent: OK STAMP=${responseStamp}`);
});

// Alternative endpoint (some devices use different paths)
app.post('/cdata.php', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    console.log('\n🔔 --- ESS K90 Pro Data Received (PHP endpoint) ---');
    
    logAttendanceData({
        headers: req.headers,
        body: req.body,
        query: req.query,
        rawBody: req.rawBody
    }, '/cdata.php', clientIP);
    
    const responseStamp = Date.now();
    res.status(200).send(`OK\nSTAMP=${responseStamp}`);
    
    console.log(`✅ Response sent: OK STAMP=${responseStamp}`);
});

// Device command endpoint (for device management)
app.get('/devicecmd', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const deviceSN = req.query.SN || 'Unknown';
    
    console.log(`\n📡 Device ${deviceSN} checking for commands from ${clientIP}`);
    
    logAttendanceData({
        query: req.query,
        headers: req.headers,
        endpoint: 'devicecmd'
    }, '/devicecmd', clientIP);
    
    // No commands for now, just respond with NO
    res.status(200).send('NO');
    
    console.log('✅ Response sent: NO (no pending commands)');
});

// Device command POST endpoint
app.post('/devicecmd', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    console.log('\n📡 Device command POST received');
    
    logAttendanceData({
        headers: req.headers,
        body: req.body,
        query: req.query,
        rawBody: req.rawBody
    }, '/devicecmd (POST)', clientIP);
    
    res.status(200).send('OK');
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ESS K90 Pro Attendance Server Running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints: ['/cdata', '/cdata.php', '/devicecmd'],
        logFile: logFile,
        version: '1.0.0'
    });
});

// Get logs endpoint (for viewing logged data)
app.get('/logs', (req, res) => {
    try {
        const logs = fs.readFileSync(logFile, 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(logs);
    } catch (error) {
        res.status(404).send('No logs found');
    }
});

// Get daily logs
app.get('/logs/today', (req, res) => {
    try {
        const logs = fs.readFileSync(dailyLogFile, 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(logs);
    } catch (error) {
        res.status(404).send('No logs found for today');
    }
});

// Get logs as JSON
app.get('/logs/json', (req, res) => {
    try {
        const logs = fs.readFileSync(logFile, 'utf8');
        const entries = logs.split('========================================')
            .filter(entry => entry.trim().length > 0)
            .map(entry => {
                const lines = entry.trim().split('\n');
                const data = {};
                lines.forEach(line => {
                    if (line.includes(':')) {
                        const [key, ...value] = line.split(':');
                        data[key.trim()] = value.join(':').trim();
                    }
                });
                return data;
            });
        
        res.json({
            totalEntries: entries.length,
            logs: entries.slice(-50) // Last 50 entries
        });
    } catch (error) {
        res.status(404).json({ error: 'No logs found' });
    }
});

// Clear logs endpoint
app.delete('/logs', (req, res) => {
    try {
        fs.writeFileSync(logFile, '');
        res.json({ message: 'Logs cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

// Handle all other POST requests (catch-all for unknown endpoints)
app.post('*', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    console.log(`\n⚠️ Unknown endpoint accessed: ${req.path}`);
    
    logAttendanceData({
        headers: req.headers,
        body: req.body,
        query: req.query,
        path: req.path,
        rawBody: req.rawBody
    }, req.path, clientIP);
    
    res.status(200).send('OK');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ESS K90 Pro Attendance Server Started');
    console.log('=====================================');
    console.log(`📡 Server running on port: ${PORT}`);
    console.log(`📝 Main log file: ${logFile}`);
    console.log(`📅 Daily logs: ${logsDir}`);
    console.log(`🌐 Server accessible at: http://localhost:${PORT}`);
    console.log(`📊 View logs at: http://localhost:${PORT}/logs`);
    console.log(`📱 Health check: http://localhost:${PORT}/`);
    console.log('=====================================');
    console.log('⏳ Waiting for ESS K90 Pro device data...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down ESS K90 Pro server...');
    console.log('💾 All logs have been saved.');
    process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    fs.appendFileSync(logFile, `\nERROR: ${new Date().toISOString()} - ${error.message}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    fs.appendFileSync(logFile, `\nERROR: ${new Date().toISOString()} - Unhandled Rejection: ${reason}\n`);
});