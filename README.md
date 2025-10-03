# Things5 MCP Server - OpenAI Compatible

A Model Context Protocol (MCP) server for the Things5 IoT platform, **fully compatible with OpenAI MCP specifications**. Provides comprehensive device management and data access capabilities through both Streamable HTTP and HTTP/SSE transport protocols.

## OpenAI MCP Integration

This server is **fully compatible** with OpenAI's MCP specifications and can be used directly with the OpenAI Responses API. It supports:

- **Streamable HTTP Transport** (`POST /mcp`)
- **HTTP/SSE Transport** (`GET /sse`) 
- **OAuth 2.0 Authentication**
- **Dynamic Client Registration**
- **Session Management**
- **Tool Approval Workflows**

### Quick OpenAI Integration

```python
from openai import OpenAI

client = OpenAI()

resp = client.responses.create(
    model="gpt-5",
    tools=[
        {
            "type": "mcp",
            "server_label": "things5",
            "server_description": "Things5 IoT platform for device management and data access",
            "server_url": "https://your-server.com/sse",
            "authorization": "Bearer YOUR_ACCESS_TOKEN",
            "require_approval": "never",
        },
    ],
    input="Show me all my IoT devices and their current status",
)
```

**[Complete OpenAI Integration Guide](./OPENAI_MCP_INTEGRATION.md)**

## Features

- **Device Management**: List, create, update, and manage IoT devices
- **Data Access**: Read parameters, states, metrics, and events from devices  
- **Machine Commands**: Execute commands on connected machines
- **User Management**: Manage users and permissions
- **Firmware Management**: Handle device firmware updates
- **OAuth 2.0 Authentication**: Secure access via Keycloak integration
- **OpenAI MCP Compatible**: Direct integration with OpenAI Responses API

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Create `.env.local` with the following **OpenAI-compatible** configuration:

```bash
NODE_ENV=production
PORT=3000
KEYCLOAK_BASE_URL=https://auth.things5.digital
KEYCLOAK_CLIENT_ID=mcp-server
THINGS5_BASE_URL=http://api.things5.digital/v1
THINGS5_RECIPES_BASE_URL=https://api.things5.digital/v1/recipes
```

### For Development

Copy `.env.example` to `.env.local` and modify as needed:

```bash
cp .env.example .env.local
```

## Usage

### Development
```bash
npm run watch
```

### Production
```bash
npm run build
npm start
```

### Streamable HTTP Server (Recommended for OpenAI)
```bash
npm run start:streamableHttp
```

## API Endpoints

### MCP Protocol Endpoints
- `POST /mcp` - Streamable HTTP transport (MCP standard)
- `GET /sse` - **HTTP/SSE transport (OpenAI compatible)**
- `DELETE /mcp` - Session termination

### OAuth & Management
- `GET /health` - Health check
- `GET /.well-known/oauth-authorization-server` - OAuth metadata
- `POST /register` - Dynamic client registration
- `GET /authorize` - OAuth authorization
- `POST /token` - Token endpoint

## Available Tools

### Device Management
- `devicesList` - List all devices with filtering options
- `deviceDetails` - Get detailed information about a specific device
- `deviceCreate` - Create a new device
- `deviceUpdate` - Update device information
- `devicesGroupsList` - List device groups
- `showDeviceGroup` - Show specific device group
- `createDeviceGroupUser` - Create device group user

### Data Access
- `readParameters` - Read device parameters
- `readSingleParameter` - Read a specific parameter
- `statesRead` - Read device states
- `stateReadLastValue` - Read last state value
- `metricsRead` - Read device metrics
- `aggregatedMetrics` - Read aggregated metrics
- `eventsRead` - Read device events

### Machine Commands
- `machineCommandCreate` - Create machine commands
- `machineCommandExecute` - Execute commands on machines
- `machineCommandUpdate` - Update existing commands
- `machineCommandDelete` - Delete commands

### Overview & Monitoring
- `overviewEvents` - Get overview of events
- `overviewAlarms` - Get overview of alarms

### User Management
- `usersList` - List users
- `usersDetail` - Get user details
- `userCreate` - Create new users
- `rolesList` - List available roles

### Firmware Management
- `deviceFirmwareDetail` - Get firmware information
- `deviceFirmwareUpdateRequest` - Request firmware updates
- `deviceFirmwareUpdateStatus` - Check update status
- `deviceFirmwareUpdateCancel` - Cancel firmware updates

### Actions & Recipes
- `performAction` - Perform actions on devices
- `startRecipe` - Start recipe execution

## Authentication

### OAuth 2.0 (Recommended for Production)

Include your access token in the Authorization header:

```bash
Authorization: Bearer <your-access-token>
```

### Development Mode

For development/testing, bypass authentication:

```bash
curl "https://your-server.com/sse?no_auth=true"
```

## OpenAI MCP Usage Examples

### Basic Device Listing

```python
resp = client.responses.create(
    model="gpt-5",
    tools=[{
        "type": "mcp",
        "server_label": "things5",
        "server_url": "https://your-server.com/sse",
        "authorization": "Bearer YOUR_TOKEN",
        "require_approval": "never",
        "allowed_tools": ["devicesList", "deviceDetails"]
    }],
    input="List all my connected IoT devices"
)
```

### With Selective Approvals

```python
resp = client.responses.create(
    model="gpt-5",
    tools=[{
        "type": "mcp", 
        "server_label": "things5",
        "server_url": "https://your-server.com/sse",
        "authorization": "Bearer YOUR_TOKEN",
        "require_approval": {
            "never": {
                "tool_names": ["devicesList", "overviewEvents", "readParameters"]
            }
        }
    }],
    input="Show me device status and recent events"
)
```

## Testing

### Run All Tests
```bash
npm test
```

### Run OpenAI Compatibility Tests
```bash
npm run test src/tests/openai-mcp.test.ts
```

## Security & Best Practices

- **Always use HTTPS in production**
- **Configure tool approvals for sensitive operations**
- **Use `allowed_tools` to limit exposed functionality**
- **Monitor authentication logs**
- **Validate OAuth tokens regularly**

## Troubleshooting

### Common Issues

1. **Token Validation Failed**: Check token expiry and Keycloak configuration
2. **CORS Errors**: Server has CORS enabled for `*` by default
3. **Session Issues**: Use proper session ID management for Streamable HTTP
4. **SSE Connection Problems**: Verify WebSocket/SSE support in your environment

### Debug Mode

Enable detailed logging:

```bash
DEBUG=mcp:*
LOG_LEVEL=debug
```

## License

MIT
