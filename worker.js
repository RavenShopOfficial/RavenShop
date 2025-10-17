// Cloudflare Worker for Raven Panel
// این فایل را در Cloudflare Workers آپلود کنید

import { createServer } from 'http';

// JWT implementation (simple version for demo)
class JWT {
  static encode(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = btoa(encodedHeader + '.' + encodedPayload + secret);
    return encodedHeader + '.' + encodedPayload + '.' + signature;
  }

  static decode(token, secret) {
    try {
      const [header, payload, signature] = token.split('.');
      const expectedSignature = btoa(header + '.' + payload + secret);
      
      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }
      
      return JSON.parse(atob(payload));
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

// Password hashing (simple version - در محیط واقعی از bcrypt استفاده کنید)
class Password {
  static async hash(password) {
    // در محیط واقعی از bcrypt استفاده کنید
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'raven_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async verify(password, hash) {
    const hashedPassword = await this.hash(password);
    return hashedPassword === hash;
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Main handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Routes
      if (path.startsWith('/api/auth/')) {
        return handleAuth(request, env, path);
      } else if (path.startsWith('/api/users')) {
        return handleUsers(request, env, path, url);
      } else {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

// Auth handlers
async function handleAuth(request, env, path) {
  if (path === '/api/auth/register' && request.method === 'POST') {
    return handleRegister(request, env);
  } else if (path === '/api/auth/login' && request.method === 'POST') {
    return handleLogin(request, env);
  } else if (path === '/api/auth/me' && request.method === 'GET') {
    return handleAuthMe(request, env);
  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Register handler
async function handleRegister(request, env) {
  try {
    const body = await request.json();
    const { username, email, accountId, server, password } = body;

    // Validation
    if (!username || !email || !accountId || !server || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'All fields are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ? OR accountId = ?'
    ).bind(username, email, accountId).first();

    if (existingUser) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Username, email, or account ID already exists' 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Hash password
    const passwordHash = await Password.hash(password);
    const userId = crypto.randomUUID();

    // Insert user
    await env.DB.prepare(`
      INSERT INTO users (id, username, email, accountId, server, passwordHash, createdAt, lastActive, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      username,
      email,
      accountId,
      server,
      passwordHash,
      new Date().toISOString(),
      new Date().toISOString(),
      'online'
    ).run();

    // Generate token
    const token = JWT.encode(
      { userId, username, email },
      env.JWT_SECRET || 'raven_secret_key'
    );

    const user = {
      id: userId,
      username,
      email,
      accountId,
      server,
      createdAt: new Date().toISOString()
    };

    return new Response(JSON.stringify({
      success: true,
      user,
      token
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Registration failed' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Login handler
async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Identifier and password are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Find user
    const user = await env.DB.prepare(`
      SELECT id, username, email, accountId, server, passwordHash, createdAt
      FROM users 
      WHERE username = ? OR email = ?
    `).bind(identifier, identifier).first();

    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid credentials' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify password
    const isValidPassword = await Password.verify(password, user.passwordHash);
    if (!isValidPassword) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid credentials' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Update last active
    await env.DB.prepare(
      'UPDATE users SET lastActive = ?, status = ? WHERE id = ?'
    ).bind(new Date().toISOString(), 'online', user.id).run();

    // Generate token
    const token = JWT.encode(
      { userId: user.id, username: user.username, email: user.email },
      env.JWT_SECRET || 'raven_secret_key'
    );

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      accountId: user.accountId,
      server: user.server,
      createdAt: user.createdAt
    };

    return new Response(JSON.stringify({
      success: true,
      user: userData,
      token
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Login failed' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Auth me handler
async function handleAuthMe(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No token provided' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.substring(7);
    const decoded = JWT.decode(token, env.JWT_SECRET || 'raven_secret_key');

    const user = await env.DB.prepare(`
      SELECT id, username, email, accountId, server, createdAt, lastActive, status
      FROM users WHERE id = ?
    `).bind(decoded.userId).first();

    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Auth me error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid token' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Users handlers
async function handleUsers(request, env, path, url) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Authentication required' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const token = authHeader.substring(7);
    JWT.decode(token, env.JWT_SECRET || 'raven_secret_key');
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid token' 
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (path === '/api/users' && request.method === 'GET') {
    return handleGetUsers(request, env, url);
  } else if (path.startsWith('/api/users/') && path.endsWith('/last-active') && request.method === 'POST') {
    const userId = path.split('/')[3];
    return handleUpdateLastActive(request, env, userId);
  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Get users handler
async function handleGetUsers(request, env, url) {
  try {
    const server = url.searchParams.get('server');
    let query = 'SELECT id, username, email, accountId, server, createdAt, lastActive, status FROM users';
    const params = [];

    if (server && server !== 'all') {
      query += ' WHERE server = ?';
      params.push(server);
    }

    query += ' ORDER BY lastActive DESC';

    const users = await env.DB.prepare(query).bind(...params).all();

    return new Response(JSON.stringify({
      success: true,
      users: users.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get users error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch users' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Update last active handler
async function handleUpdateLastActive(request, env, userId) {
  try {
    await env.DB.prepare(
      'UPDATE users SET lastActive = ?, status = ? WHERE id = ?'
    ).bind(new Date().toISOString(), 'online', userId).run();

    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Update last active error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update last active' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}