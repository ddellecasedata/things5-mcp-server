import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request as ExpressRequest, Response, Router } from "express";
import { createServer } from "./server/things5.js";
import { randomUUID } from 'node:crypto';
import { Oauth } from './oauth.js'
import cors from 'cors';

// Extended Request interface with auth_token property that's added by the OAuth middleware
interface Request extends ExpressRequest {
  auth_token?: string;
  user?: any;
}

console.error('Starting Streamable HTTP server...');
const app = express();

// Add JSON body parser middleware BEFORE routes
app.use(express.json());

app.use(cors({
  origin: '*',
  credentials: true,
  allowedHeaders: '*',
  exposedHeaders: ['Mcp-Session-Id'],
  methods: '*'
}));

// Create sub-router for API (OAuth + MCP)
const apiRouter: Router = express.Router();

const transports: Map<string, StreamableHTTPServerTransport> = new Map<string, StreamableHTTPServerTransport>();

const logRequest = (req: Request, context = '') => {
  const timestamp = new Date().toISOString();
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
  const authHeader = req.headers.authorization ? 'Bearer ***' : 'None';

  console.log(`[${timestamp}] ${context}`);
  console.log(`  Method: ${req.method} ${req.path}`);
  console.log(`  Client IP: ${clientIP}`);
  console.log(`  User-Agent: ${userAgent}`);
  console.log(`  Authorization: ${authHeader}`);

  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`  Body: ${JSON.stringify(req.body, null, 2)}`);
  }
  console.log('  ---');
}

const oauth = new Oauth({ logger: logRequest });
// Mount OAuth router under root
apiRouter.use('/', oauth.getRouter());


app.use((req, res, next) => {
  logRequest(req, 'INCOMING REQUEST');

  // Log response
  const originalSend = res.send;
  res.send = function (data) {
    console.log(`[${new Date().toISOString()}] RESPONSE STATUS: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.log(`[${new Date().toISOString()}] ERROR RESPONSE: ${data}`);
    }
    return originalSend.call(this, data);
  };

  next();
});

apiRouter.post('/mcp', async (req: Request, res: Response) => {
  console.error('Received MCP POST request');
  try {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else if (!sessionId) {
      // Require auth by default; allow unauth only if explicitly requested via ?no_auth=true
      const noAuthParam = (req.query?.no_auth ?? '').toString().toLowerCase();
      const allowNoAuth = ['true', '1', 'yes'].includes(noAuthParam);

      let auth_token = req.auth_token;
      if (!allowNoAuth) {
        // Enforce validation (this will 401 if header is missing/invalid)
        await oauth.validateToken(req as any, res, () => { });
        if (res.headersSent) {
          return; // validation already handled the response
        }
        auth_token = (req as any).auth_token;
      } else {
        // Optional validation if token present even when no_auth=true
        const authHeader = req.headers.authorization;
        if (!auth_token && authHeader && authHeader.startsWith('Bearer ')) {
          await oauth.validateToken(req as any, res, () => { });
          if (res.headersSent) {
            return;
          }
          auth_token = (req as any).auth_token;
        }
      }
      //console.error(`Using authentication token for API calls: ${auth_token ? 'Available' : 'Not available'}`);

      const { server, cleanup } = createServer(auth_token);

      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sessionId: string) => {
          // Store the transport by session ID when session is initialized
          // This avoids race conditions where requests might come in before the session is stored
          console.error(`Session initialized with ID: ${sessionId}`);
          transports.set(sessionId, transport);
        }
      });


      // Set up onclose handler to clean up transport when closed
      transport.onclose = async () => {
        const sid = transport.sessionId;
        if (sid && transports.has(sid)) {
          console.error(`Transport closed for session ${sid}, removing from transports map`);
          transports.delete(sid);
          await cleanup();
        }
      };
      // Connect the transport to the MCP server BEFORE handling the request
      // so responses can flow back through the same transport
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return; // Already handled
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: req?.body?.id,
      });
      return;
    }

    // Handle the request with existing transport - no need to reconnect
    // The existing transport is already connected to the server
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: req?.body?.id,
      });
      return;
    }
  }
});

apiRouter.get('/mcp', async (req: Request, res: Response) => {
  console.error('Received MCP GET request');
  try {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: req?.body?.id,
      });
      return;
    }

    // Handle the request with existing transport - no need to reconnect
    // The existing transport is already connected to the server
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling MCP GET request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
      return;
    }
  }
});

// Handle DELETE requests for session termination (according to MCP spec)
apiRouter.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: req?.body?.id,
    });
    return;
  }

  console.error(`Received session termination request for session ${sessionId}`);

  try {
    const transport = transports.get(sessionId);
    await transport!.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Error handling session termination',
        },
        id: req?.body?.id,
      });
      return;
    }
  }
});

// Health check endpoint (no auth required)
apiRouter.get('/health', (req, res) => {
  //console.log(`[${new Date().toISOString()}] HEALTH CHECK ENDPOINT CALLED`);

  const response = {
    status: 'ok',
    message: 'MCP Server is running',
    timestamp: new Date().toISOString()
  };

  //console.log(`[${new Date().toISOString()}] SENDING HEALTH RESPONSE:`, response);

  res.status(200).json(response);

  //console.log(`[${new Date().toISOString()}] HEALTH RESPONSE SENT`);
});


// Mount API router
app.use('/', apiRouter);

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.error(`MCP Streamable HTTP Server listening on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down server...');

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.error(`Closing transport for session ${sessionId}`);
      await transports.get(sessionId)!.close();
      transports.delete(sessionId);
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }

  console.error('Server shutdown complete');
  process.exit(0);
});
