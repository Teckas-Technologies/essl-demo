# ESS K90 Pro Attendance Server

A simple Node.js server to receive and log attendance data from ESS K90 Pro biometric devices using push protocol.

## Features

- ✅ Receives attendance data from ESS K90 Pro devices
- ✅ Logs all incoming data with timestamps
- ✅ Supports multiple endpoints for device compatibility
- ✅ Real-time console output
- ✅ Daily log files organization
- ✅ JSON API for log viewing
- ✅ Health check endpoint
- ✅ Graceful error handling

## Installation

1. **Clone or create the project:**
   ```bash
   mkdir ess-k90-server
   cd ess-k90-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

   Or for development (with auto-restart):
   ```bash
   npm run dev
   ```

## Configuration

### Server Configuration
- **Port:** 3000 (default) or set `PORT` environment variable
- **Host:** 0.0.0.0 (accepts connections from any IP)

### ESS K90 Pro Device Configuration
Configure your ESS K90 Pro device with these settings:

```
Network Settings:
- Server IP: your-domain.com (or your server IP)
- Server Port: 3000
- Push URL: /cdata
- Push Mode: Enabled
- Protocol: HTTP
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check and server status |
| `/cdata` | POST | Main endpoint for attendance data |
| `/cdata.php` | POST | Alternative endpoint for compatibility |
| `/devicecmd` | GET/POST | Device command management |
| `/logs` | GET | View all logs as text |
| `/logs/today` | GET | View today's logs |
| `/logs/json` | GET | View logs as JSON |
| `/logs` | DELETE | Clear all logs |

## Usage Examples

### View Server Status
```bash
curl http://localhost:3000/
```

### View Logs
```bash
curl http://localhost:3000/logs
```

### Simulate Device Data (for testing)
```bash
curl -X POST http://localhost:3000/cdata \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "SN=K90PRO001&STAMP=1234567890&OPLOG=1&DATA=RECORD=1	123456	2024-01-15 09:00:00	0	15"
```

## Log Format

The server creates detailed logs with the following information:
- Timestamp
- Client IP address
- Endpoint accessed
- Request headers
- Raw and parsed data
- Device information

### Sample Log Entry:
```
========================================
Timestamp: 2024-01-15T09:00:01.500Z
Endpoint: /cdata
Client IP: 203.45.67.10
Device User-Agent: ESS-Device/1.0
Content-Type: application/x-www-form-urlencoded
Raw Body: SN=K90PRO001&STAMP=1234567890&OPLOG=1&DATA=RECORD=1	123456	2024-01-15 09:00:00	0	15
Parsed Data: {
  "SN": "K90PRO001",
  "STAMP": "1234567890",
  "OPLOG": "1",
  "DATA": "RECORD=1	123456	2024-01-15 09:00:00	0	15"
}
========================================
```

## File Structure

```
ess-k90-server/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── README.md              # This file
├── attendance_logs.txt    # Main log file
└── logs/                  # Daily log files
    └── attendance_YYYY-MM-DD.txt
```

## Console Output

When running, the server provides real-time console output:

```
🚀 ESS K90 Pro Attendance Server Started
=====================================
📡 Server running on port: 3000
📝 Main log file: /path/to/attendance_logs.txt
📅 Daily logs: /path/to/logs
🌐 Server accessible at: http://localhost:3000
📊 View logs at: http://localhost:3000/logs
📱 Health check: http://localhost:3000/
=====================================
⏳ Waiting for ESS K90 Pro device data...

🔔 --- ESS K90 Pro Data Received ---
Endpoint: /cdata
Raw Data: SN=K90PRO001&STAMP=1234567890&OPLOG=1&DATA=RECORD=1	123456	2024-01-15 09:00:00	0	15
Parsed Attendance Records:
  Record 1: User 123456 - Check-In at 2024-01-15 09:00:00 via Fingerprint Template
✅ Response sent: OK STAMP=1705312801500
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## Production Deployment

For production deployment:

1. **Set production port:**
   ```bash
   export PORT=80
   ```

2. **Run with PM2 (recommended):**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "ess-k90-server"
   pm2 startup
   pm2 save
   ```

3. **Configure firewall** to allow incoming connections on your chosen port

4. **Set up reverse proxy** (nginx) if needed

## Troubleshooting

### Device Not Connecting
1. Check device network settings
2. Verify server IP and port
3. Check firewall settings
4. Test server accessibility: `curl http://your-server:3000/`

### No Data Received
1. Verify device push mode is enabled
2. Check device push URL setting
3. Monitor server logs for connection attempts
4. Test with curl command (see usage examples)

### Logs Not Creating
1. Check file permissions
2. Verify disk space
3. Check server console for errors

## Support

For issues or questions:
1. Check the console output for error messages
2. Review the log files
3. Verify device configuration
4. Test server endpoints manually

## License

MIT License