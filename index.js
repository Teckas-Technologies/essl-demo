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
    
    // Parse device data if available
    if (data.rawBody) {
        console.log('📊 Parsing Device Data:');
        const parsedData = parseDeviceData(data.rawBody);
        
        // Store parsed data for further processing
        data.parsedData = parsedData;
        
        // Log summary
        const userCount = parsedData.filter(item => item.type === 'USER').length;
        const fpCount = parsedData.filter(item => item.type === 'FINGERPRINT').length;
        const attendanceCount = parsedData.filter(item => item.type === 'ATTENDANCE').length;
        
        console.log(`📈 Data Summary: ${userCount} users, ${fpCount} fingerprints, ${attendanceCount} attendance records`);
    }
}

// Helper function to parse USER data
function parseUserData(dataLine) {
    try {
        const userData = {};
        const pairs = dataLine.split('\t');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
                userData[key.trim()] = value.trim();
            }
        });
        
        return {
            type: 'USER',
            pin: userData.PIN,
            name: userData.Name,
            privilege: userData.Pri,
            password: userData.Passwd,
            card: userData.Card,
            group: userData.Grp,
            timezone: userData.TZ,
            expires: userData.Expires,
            startDatetime: userData.StartDatetime,
            endDatetime: userData.EndDatetime,
            validCount: userData.ValidCount
        };
    } catch (error) {
        console.log('  Error parsing user data:', error.message);
        return null;
    }
}

// Helper function to parse fingerprint data
function parseFingerprintData(dataLine) {
    try {
        const fpData = {};
        const pairs = dataLine.split('\t');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
                fpData[key.trim()] = value.trim();
            }
        });
        
        return {
            type: 'FINGERPRINT',
            pin: fpData.PIN,
            fid: fpData.FID,
            size: parseInt(fpData.Size),
            valid: parseInt(fpData.Valid),
            template: fpData.TMP
        };
    } catch (error) {
        console.log('  Error parsing fingerprint data:', error.message);
        return null;
    }
}

// Helper function to parse attendance records
function parseAttendanceRecord(dataLine) {
    try {
        const parts = dataLine.split('\t');
        if (parts.length >= 5) {
            return {
                type: 'ATTENDANCE',
                userPin: parts[0],
                timestamp: parts[1],
                status: parseInt(parts[2]), // 0=check-in, 1=check-out
                verifyType: parseInt(parts[3]), // 1=fingerprint, 0=other
                workCode: parseInt(parts[4]),
                reserved1: parts[5] || '',
                reserved2: parts[6] || '',
                reserved3: parts[7] || '0',
                reserved4: parts[8] || '0'
            };
        }
        return null;
    } catch (error) {
        console.log('  Error parsing attendance record:', error.message);
        return null;
    }
}

// Helper function to parse all data types
function parseDeviceData(rawData) {
    const lines = rawData.split('\n').filter(line => line.trim());
    const parsedData = [];
    
    lines.forEach(line => {
        line = line.trim();
        
        if (line.startsWith('USER ')) {
            const userData = parseUserData(line.substring(5));
            if (userData) {
                parsedData.push(userData);
                console.log(`  📝 User Data: ${userData.name} (PIN: ${userData.pin})`);
            }
        } else if (line.startsWith('FP ')) {
            const fpData = parseFingerprintData(line.substring(3));
            if (fpData) {
                parsedData.push(fpData);
                console.log(`  👆 Fingerprint: PIN ${fpData.pin}, FID ${fpData.fid}, Size ${fpData.size} bytes`);
            }
        } else if (line && !line.startsWith('USER') && !line.startsWith('FP')) {
            // Attendance record
            const attendanceData = parseAttendanceRecord(line);
            if (attendanceData) {
                parsedData.push(attendanceData);
                const statusText = attendanceData.status === 0 ? 'Check-In' : 'Check-Out';
                const verifyText = getVerifyMode(attendanceData.verifyType.toString());
                console.log(`  ⏰ Attendance: User ${attendanceData.userPin} - ${statusText} at ${attendanceData.timestamp} via ${verifyText}`);
            }
        }
    });
    
    return parsedData;
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

// ESS K90 Pro main data endpoint - /iclock/cdata.aspx
app.post('/iclock/cdata.aspx', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    console.log('\n🔔 --- ESS K90 Pro Data Received (iclock/cdata.aspx) ---');
    
    // Log the received data
    logAttendanceData({
        headers: req.headers,
        body: req.body,
        query: req.query,
        method: req.method,
        rawBody: req.rawBody
    }, '/iclock/cdata.aspx', clientIP);
    
    // Generate response stamp
    const responseStamp = Date.now();
    
    // Send success response to device (ZKTeco protocol)
    res.status(200).send(`OK\nSTAMP=${responseStamp}`);
    
    console.log(`✅ Response sent: OK STAMP=${responseStamp}`);
});

// Alternative iclock endpoints (some devices may use variations)
app.post('/iclock/cdata', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    console.log('\n🔔 --- ESS K90 Pro Data Received (iclock/cdata) ---');
    
    logAttendanceData({
        headers: req.headers,
        body: req.body,
        query: req.query,
        rawBody: req.rawBody
    }, '/iclock/cdata', clientIP);
    
    const responseStamp = Date.now();
    res.status(200).send(`OK\nSTAMP=${responseStamp}`);
    
    console.log(`✅ Response sent: OK STAMP=${responseStamp}`);
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ESS K90 Pro Attendance Server Running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints: ['/cdata', '/cdata.php', '/devicecmd', '/iclock/cdata.aspx', '/iclock/cdata'],
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