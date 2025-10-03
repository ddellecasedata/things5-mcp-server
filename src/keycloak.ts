import axios from 'axios';
import jwt from 'jsonwebtoken';

// Cache for OIDC configurations
const oidcConfigCache: any = {};
import { KEYCLOAK_BASE_URL } from './config.js';
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export class Keycloak {

  // Helper functions for multi-tenant support
  getRealmFromHostname = (hostname: string) => {
    // Extract realm from subdomain (e.g. first part of any hostname)
    if (!hostname) return null;
    if (hostname === 'localhost') {
      return 'demo-staging'
    }
    // Use the first part of the hostname as the realm name
    // Example: "things5-staging.mcp.things5.digital" -> "things5-staging"
    const parts = hostname.split('.');
    if (parts.length > 1) {
      if (parts[0] === 'things5-staging') {
        return 'demo-staging'
      }
      return parts[0]; // Always take first segment as realm
    }
    return null;
  }

  // Helper functions for multi-tenant support
  getRealmFromToken = (token: string): string | null => {
    try {
      // Decode JWT token without verification to extract issuer
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      if (!decoded || !decoded.iss) {
        return null;
      }

      // Extract realm from issuer URL
      // Example: "https://keycloak.example.com/realms/realm-name" -> "realm-name"
      const issuerUrl = decoded.iss;
      const match = issuerUrl.match(/\/realms\/([^\/]+)/);

      if (match && match[1]) {
        return match[1];
      }

      return null;
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }

  /**
   * Fetches OIDC configuration from Keycloak for a specific realm
   * @param {string} realm - Keycloak realm name
   * @returns {Promise<Object>} OIDC configuration
   */
  getKeycloakOIDCConfig = async (realm: string) => {
    const cacheKey = `oidc-config-${realm}`;

    // Check if we have a fresh cached configuration
    if (oidcConfigCache[cacheKey] &&
      oidcConfigCache[cacheKey].timestamp + CACHE_TTL > Date.now()) {
      console.log(`[${new Date().toISOString()}] Using cached OIDC config for realm '${realm}'`);
      return oidcConfigCache[cacheKey].config;
    }

    try {
      console.log(`[${new Date().toISOString()}] Fetching OIDC config for realm '${realm}'`);
      const oidcConfigUrl = `${KEYCLOAK_BASE_URL}/auth/realms/${realm}/.well-known/openid-configuration`;
      console.log(`[${new Date().toISOString()}] OIDC config URL: ${oidcConfigUrl}`);

      const response = await axios.get(oidcConfigUrl, {
        headers: { Accept: 'application/json' },
        timeout: 5000 // 5 second timeout
      });

      if (response.status === 200 && response.data) {
        // Cache the configuration
        oidcConfigCache[cacheKey] = {
          config: response.data,
          timestamp: Date.now()
        };

        console.log(`[${new Date().toISOString()}] Successfully fetched OIDC config for realm '${realm}'`);
        return response.data;
      } else {
        console.error(`[${new Date().toISOString()}] Failed to fetch OIDC config for realm '${realm}'. Status: ${response.status}`);
        throw new Error(`Failed to fetch OIDC configuration for realm '${realm}'`);
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Error fetching OIDC config for realm '${realm}':`, error.message);
      throw error;
    }
  }
}
