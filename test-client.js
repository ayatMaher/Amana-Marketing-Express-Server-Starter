// Simple test client using built-in Node.js modules
const http = require('http');

const API_BASE = 'http://localhost:3000';

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testAPI() {
  try {
    console.log('🧪 Testing Amana Marketing API...\n');

    // 1. Test server is running
    console.log('1. Testing server health...');
    const healthResponse = await makeRequest('GET', '/');
    console.log('✅ Server is running:', healthResponse.data.message);

    // 2. Test login
    console.log('\n2. Testing login...');
    const loginData = {
      username: 'ahmed_hassan',
      password: 'ahmedadmin123'
    };
    
    const loginResponse = await makeRequest('POST', '/api/auth/login', loginData);
    
    if (loginResponse.status === 200) {
      console.log('✅ Login successful');
      const token = loginResponse.data.token;
      const user = loginResponse.data.user;
      console.log(`   User: ${user.username} (${user.role})`);

      // 3. Test campaigns endpoint
      console.log('\n3. Testing campaigns endpoint...');
      const campaignsResponse = await makeRequest('GET', '/api/campaigns', null, token);
      
      if (campaignsResponse.status === 200) {
        console.log(`✅ Retrieved ${campaignsResponse.data.data.length} campaigns`);
        
        // 4. Test single campaign
        console.log('\n4. Testing single campaign...');
        const campaignResponse = await makeRequest('GET', '/api/campaigns/1', null, token);
        
        if (campaignResponse.status === 200) {
          console.log(`✅ Campaign: ${campaignResponse.data.data.name}`);
        }

        // 5. Test stats
        console.log('\n5. Testing stats endpoint...');
        const statsResponse = await makeRequest('GET', '/api/stats/overview', null, token);
        
        if (statsResponse.status === 200) {
          console.log('✅ Retrieved marketing statistics');
          console.log(`   Total Revenue: $${statsResponse.data.data.total_revenue}`);
          console.log(`   Total Campaigns: ${statsResponse.data.data.total_campaigns}`);
        }

      } else {
        console.log('❌ Failed to fetch campaigns:', campaignsResponse.data);
      }

    } else {
      console.log('❌ Login failed:', loginResponse.data);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('💡 Make sure the server is running on port 3000');
  }
}

testAPI();