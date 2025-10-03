import { Router, NextFunction, Request, Response } from "express";
import { Keycloak } from "./keycloak.js";
import bodyParser from 'body-parser';
import axios from 'axios';

import { KEYCLOAK_BASE_URL, KEYCLOAK_CLIENT_ID } from './config.js';

function getPublicAuthorizationServer(req: any) {
  return `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
}

export class Oauth {
  private router: Router;
  private keycloak: Keycloak;
  private logger: (req: Request, context?: string) => any;

  constructor({ logger }: { logger: (req: Request, context?: string) => any }) {
    this.router = Router();
    this.keycloak = new Keycloak();
    this.logger = logger;

    // Register routes immediately
    this.registerRoutes();

    // OAuth Authorization Server Metadata endpoint (RFC 8414)
    this.router.get('/.well-known/oauth-authorization-server', async (req, res) => {
      this.logger(req, 'OAUTH AUTHORIZATION SERVER METADATA REQUEST');

      const hostname = req.hostname;
      const realm = this.keycloak.getRealmFromHostname(hostname);

      if (realm) {
        try {
          // Fetch OIDC configuration from Keycloak
          const oidcConfig = await this.keycloak.getKeycloakOIDCConfig(realm);

          // Build public OAuth authorization server metadata (facade) managing Keycloak behind the scenes
          const publicAuthServer = getPublicAuthorizationServer(req);
          const metadata = {
            issuer: publicAuthServer,
            authorization_endpoint: `${publicAuthServer}/authorize`,
            token_endpoint: `${publicAuthServer}/token`,
            userinfo_endpoint: oidcConfig.userinfo_endpoint,
            jwks_uri: oidcConfig.jwks_uri,
            // Use X-Forwarded-Proto if present to ensure correct https in Kubernetes ingress
            registration_endpoint: `${publicAuthServer}/register`,
            scopes_supported: oidcConfig.scopes_supported || ["openid", "profile", "email", "claudeai"],
            response_types_supported: oidcConfig.response_types_supported || ["code"],
            grant_types_supported: oidcConfig.grant_types_supported || ["authorization_code", "refresh_token"],
            token_endpoint_auth_methods_supported: oidcConfig.token_endpoint_auth_methods_supported || ["none", "client_secret_post"],
            code_challenge_methods_supported: oidcConfig.code_challenge_methods_supported || ["S256"]
          };

          //console.log(`[${new Date().toISOString()}] OAUTH AUTHORIZATION SERVER METADATA RESPONSE:`, JSON.stringify(metadata, null, 2));
          res.json(metadata);
        } catch (error: any) {
          console.error(`[${new Date().toISOString()}] ERROR GETTING OAUTH METADATA:`, error.message);
          res.status(500).json({
            error: "server_error",
            error_description: "Failed to retrieve authorization server metadata"
          });
        }
      }
    });

    // Dynamic Client Registration endpoint (RFC 7591)
    this.router.post('/register', bodyParser.json(), async (req: Request, res: Response) => {
      this.logger(req, 'DYNAMIC CLIENT REGISTRATION REQUEST');

      const hostname = req.hostname;
      const realm = this.keycloak.getRealmFromHostname(hostname);

      if (realm) {
        try {
          // Fetch OIDC configuration from Keycloak
          const oidcConfig = await this.keycloak.getKeycloakOIDCConfig(realm);

          // Build public OAuth authorization server URL (this MCP server)
          const publicAuthServer = getPublicAuthorizationServer(req);

          // For Claude integration, we redirect to our MCP server facade endpoints
          const response = {
            client_id: KEYCLOAK_CLIENT_ID, // Use the pre-configured client in Keycloak
            client_name: req.body.client_name || "Claude AI",
            redirect_uris: req.body.redirect_uris || ["https://claude.ai/api/mcp/auth_callback"],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
            scope: "openid profile email",
            // Point Claude to the actual Keycloak authorization server endpoints
            authorization_endpoint: `${publicAuthServer}/authorize`,
            token_endpoint: `${publicAuthServer}/token`,
            userinfo_endpoint: oidcConfig.userinfo_endpoint
          };

          //console.log(`[${new Date().toISOString()}] CLIENT REGISTRATION RESPONSE:`, JSON.stringify(response, null, 2));
          res.status(201).json(response);
        } catch (error: any) {
          console.error(`[${new Date().toISOString()}] ERROR IN CLIENT REGISTRATION:`, error.message);
          res.status(500).json({
            error: "server_error",
            error_description: "Failed to process client registration"
          });
        }
      }
    });

    // OAuth 2.0 Authorization Endpoint - proxies to Keycloak
    this.router.get('/authorize', async (req: any, res: Response) => {
      const hostname = req.hostname;
      const realm = this.keycloak.getRealmFromHostname(hostname);
      const kcAuth = `${KEYCLOAK_BASE_URL}/auth/realms/${realm}/protocol/openid-connect/auth`;
      const qs = new URLSearchParams(req.query).toString();
      const redirectUrl = `${kcAuth}?${qs}`;
      this.logger(req, 'PROXY /authorize -> ' + redirectUrl);
      res.redirect(302, redirectUrl);
    });

    // OAuth 2.0 Token Endpoint - proxies to Keycloak
    this.router.post('/token', bodyParser.urlencoded({ extended: false }), async (req: Request, res: Response) => {
      const hostname = req.hostname;
      const realm = this.keycloak.getRealmFromHostname(hostname);
      const kcToken = `${KEYCLOAK_BASE_URL}/auth/realms/${realm}/protocol/openid-connect/token`;
      try {
        const kcResp = await axios.post(kcToken, new URLSearchParams(req.body).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        this.logger(req, 'TOKEN PROXY RESPONSE: ' + JSON.stringify(kcResp.data, null, 2));
        res.status(kcResp.status).json(kcResp.data);
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] TOKEN PROXY ERROR:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { error: 'server_error' });
      }
    });

    // OAuth 2.0 Protected Resource Metadata endpoint (RFC 9728)
    this.router.get('/.well-known/oauth-protected-resource', (req, res) => {
      //console.log('OAUTH METADATA REQUEST');
      const authorizationServer = getPublicAuthorizationServer(req);

      const metadata = {
        resource: `${req.protocol}://${req.get('host')}`,
        authorization_servers: [
          authorizationServer
        ],
        bearer_methods_supported: ["header"],
        resource_documentation: `${req.protocol}://${req.get('host')}/docs`
      };

      //console.log(`[${new Date().toISOString()}] OAUTH METADATA RESPONSE:`, JSON.stringify(metadata, null, 2));
      res.json(metadata);
    });
  }

  private getAuthorizationServer(token: string): string {
    const realm = this.keycloak.getRealmFromToken(token) || 'demo10'; // Default to demo10 realm
    return `${KEYCLOAK_BASE_URL}/auth/realms/${realm}`;
  }

  // Token validation middleware - now exposed as a public method
  public async validateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    const organizationId = req.query.organization_id;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[${new Date().toISOString()}] TOKEN VALIDATION FAILED: Missing or invalid authorization header`);
      this.logger(req, 'AUTH FAILURE - NO TOKEN');

      const wwwAuthHeader = `Bearer realm="MCP Server", resource_metadata_uri="${req.protocol}://${req.get('host')}/.well-known/oauth-protected-resource"`;
      res.status(401)
        .header('WWW-Authenticate', wwwAuthHeader)
        .json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Missing Bearer token' },
          id: null
        });
      return;
    }

    const token = authHeader.substring(7);
    //console.log(`[${new Date().toISOString()}] TOKEN VALIDATION: Validating token with Keycloak...`);
    //console.log(`[${new Date().toISOString()}] TOKEN: ${token.substring(0, 50)}...`);

    try {
      // Validate token with Keycloak - must use the actual Keycloak URL
      const authorizationServer = this.getAuthorizationServer(token);
      //console.log(`[${new Date().toISOString()}] TOKEN VALIDATION: Using authorization server: ${authorizationServer}`);

      const response = await fetch(`${authorizationServer}/protocol/openid-connect/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      //console.log(`[${new Date().toISOString()}] TOKEN VALIDATION RESPONSE STATUS: ${response.status}`);

      if (!response.ok) {
        console.log(`[${new Date().toISOString()}] TOKEN VALIDATION FAILED: Keycloak returned ${response.status}`);

        const wwwAuthHeader = `Bearer realm="MCP Server", resource_metadata_uri="${req.protocol}://${req.get('host')}/.well-known/oauth-protected-resource"`;

        if (response.status === 401) {
          console.log(`[${new Date().toISOString()}] TOKEN EXPIRED: Suggesting refresh to client`);
          this.logger(req, 'AUTH FAILURE - TOKEN EXPIRED');
          res.status(401)
            .header('WWW-Authenticate', wwwAuthHeader)
            .json({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Token expired or invalid' },
              id: null
            });
        } else {
          this.logger(req, 'AUTH FAILURE - INVALID TOKEN');
          res.status(response.status)
            .header('WWW-Authenticate', wwwAuthHeader)
            .json({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Token validation failed' },
              id: null
            });
        }
        return;
      }

      // SUCCESS PATH - Token is valid
      const userInfo = await response.json();
      console.log(`[${new Date().toISOString()}] TOKEN VALIDATION SUCCESS: User ${userInfo.preferred_username || userInfo.sub}`);
      //console.log(`[${new Date().toISOString()}] USER INFO:`, JSON.stringify(userInfo, null, 2));

      // Add organization info to user object
      (req as any).user = {
        ...userInfo,
        organization_id: organizationId,
        realm: this.keycloak.getRealmFromToken(token)
      };
      (req as any).auth_token = token;

      // Continue to next middleware
      next();

    } catch (error) {
      console.error(`[${new Date().toISOString()}] TOKEN VALIDATION ERROR:`, error);
      this.logger(req, 'AUTH FAILURE - VALIDATION ERROR');

      const wwwAuthHeader = `Bearer realm="MCP Server", resource_metadata_uri="${req.protocol}://${req.get('host')}/.well-known/oauth-protected-resource"`;
      res.status(401)
        .header('WWW-Authenticate', wwwAuthHeader)
        .json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Token validation failed' },
          id: null
        });
      return;
    }
  }

  // Helper method to get the middleware function bound to this instance
  public getValidateTokenMiddleware() {
    return this.validateToken.bind(this);
  }

  // Alternative: Arrow function property that automatically binds 'this'
  public validateTokenMiddleware = async (req: any, res: Response, next: NextFunction): Promise<void> => {
    return this.validateToken(req, res, next);
  };

  public getRouter() {
    return this.router;
  }

  private registerRoutes() {
    // Routes are defined inline in constructor; nothing additional here.
  }
}