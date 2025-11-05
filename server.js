const express = require('express');
const cors = require('cors');
const path = require('path');
const { simpleDecrypt } = require('./auth/decrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import data
const marketingData = require('./data/marketing-data.json');
const users = require('./data/users.json');
const encryptedUsers = require('./data/encrypted-users.json');

// Authentication middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  
  // Simple token validation
  const user = users.users.find(u => u.password === token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Amana Marketing API Server', 
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/login',
      campaigns: '/api/campaigns',
      stats: '/api/stats',
      users: '/api/users'
    }
  });
});

// Authentication routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Check in regular users first
  let user = users.users.find(u => u.username === username && u.password === password);
  
  // If not found, check encrypted users
  if (!user) {
    const encryptedUser = encryptedUsers.users.find(u => u.username === username);
    if (encryptedUser) {
      const decryptedPassword = simpleDecrypt(encryptedUser.password);
      if (decryptedPassword === password) {
        user = { ...encryptedUser, password: decryptedPassword };
      }
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  res.json({
    message: 'Login successful',
    user: userWithoutPassword,
    token: user.password
  });
});

// Campaign routes
app.get('/api/campaigns', authenticateUser, (req, res) => {
  try {
    const { status, medium, category, page = 1, limit = 10 } = req.query;
    
    let filteredCampaigns = [...marketingData.campaigns];

    // Apply filters
    if (status) {
      filteredCampaigns = filteredCampaigns.filter(campaign => 
        campaign.status.toLowerCase() === status.toLowerCase()
      );
    }

    if (medium) {
      filteredCampaigns = filteredCampaigns.filter(campaign => 
        campaign.medium.toLowerCase() === medium.toLowerCase()
      );
    }

    if (category) {
      filteredCampaigns = filteredCampaigns.filter(campaign => 
        campaign.product_category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedCampaigns = filteredCampaigns.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedCampaigns,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(filteredCampaigns.length / limit),
        totalCampaigns: filteredCampaigns.length,
        showing: paginatedCampaigns.length
      },
      filters: {
        status,
        medium,
        category
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

app.get('/api/campaigns/:id', authenticateUser, (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const campaign = marketingData.campaigns.find(c => c.id === campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// Statistics routes
app.get('/api/stats/overview', authenticateUser, (req, res) => {
  try {
    const stats = marketingData.marketing_stats;
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

app.get('/api/stats/performance', authenticateUser, (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    const performanceData = {
      totalRevenue: marketingData.marketing_stats.total_revenue,
      totalSpend: marketingData.marketing_stats.total_spend,
      totalConversions: marketingData.marketing_stats.total_conversions,
      averageROAS: marketingData.marketing_stats.average_roas,
      topPerformingCampaigns: marketingData.campaigns
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          revenue: campaign.revenue,
          roas: campaign.roas,
          status: campaign.status
        }))
    };

    res.json({
      success: true,
      data: performanceData,
      period
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// User management routes (admin only)
app.get('/api/users', authenticateUser, requireAdmin, (req, res) => {
  try {
    const usersWithoutPasswords = users.users.map(({ password, ...user }) => user);
    res.json({
      success: true,
      data: usersWithoutPasswords
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Company info
app.get('/api/company', (req, res) => {
  try {
    res.json({
      success: true,
      data: marketingData.company_info
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch company information' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler - FIXED: Use proper wildcard pattern
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Amana Marketing Server running on port ${PORT}`);
  console.log(`📊 Loaded ${marketingData.campaigns.length} campaigns`);
  console.log(`👥 Loaded ${users.users.length} users`);
  console.log(`🏢 Company: ${marketingData.company_info.name}`);
  console.log(`📍 API available at: http://localhost:${PORT}`);
});