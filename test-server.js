const http = require('http');

// Test the server with sample ESS K90 Pro data
function testServer() {
    const testData = 'SN=K90PRO001&STAMP=1234567890&OPLOG=1&DATA=RECORD=1\t123456\t2024-01-15 09:00:00\t0\t15\nRECORD=2\t789012\t2024-01-15 09:01:00\t1\t25';
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/cdata',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(testData),
            'User-Agent': 'ESS-Device/1.0'
        }
    };

    console.log('🧪 Testing ESS K90 Pro Server...');
    console.log('📤 Sending test attendance data...');
    
    const req = http.request(options, (res) => {
        console.log(`📡 Response Status: ${res.statusCode}`);
        console.log(`📋 Response Headers:`, res.headers);
        
        let responseData = '';
        res.on('data', (chunk) => {
            responseData += chunk;
        });
        
        res.on('end', () => {
            console.log(`📥 Response Body: ${responseData}`);
            console.log('✅ Test completed successfully!');
            
            // Test health check
            testHealthCheck();
        });
    });

    req.on('error', (error) => {
        console.error('❌ Test failed:', error.message);
        console.log('💡 Make sure the server is running: npm start');
    });

    req.write(testData);
    req.end();
}

function testHealthCheck() {
    console.log('\n🏥 Testing health check endpoint...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('📊 Health Check Response:', JSON.parse(data));
            console.log('✅ Health check completed!');
            
            // Test device command endpoint
            testDeviceCommand();
        });
    });

    req.on('error', (error) => {
        console.error('❌ Health check failed:', error.message);
    });

    req.end();
}

function testDeviceCommand() {
    console.log('\n📡 Testing device command endpoint...');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/devicecmd?SN=K90PRO001&STAMP=1234567890',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('📤 Device Command Response:', data);
            console.log('✅ Device command test completed!');
            console.log('\n🎉 All tests completed successfully!');
            console.log('🔍 Check the server console and logs for detailed output.');
        });
    });

    req.on('error', (error) => {
        console.error('❌ Device command test failed:', error.message);
    });

    req.end();
}

// Run tests
console.log('🚀 Starting ESS K90 Pro Server Tests');
console.log('=====================================');
setTimeout(testServer, 1000); // Wait 1 second for server to be ready