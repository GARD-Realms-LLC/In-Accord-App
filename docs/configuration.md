# Configuration

## Environment Variables

The In-Accord App can be configured using environment variables. Create a `.env` file in the root directory with the following options:

```bash
# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

## Configuration Files

Configuration files are located in the `config/` directory. You can create environment-specific configuration files:

- `config/default.json` - Default configuration
- `config/development.json` - Development environment settings
- `config/production.json` - Production environment settings

## Available Options

### General Settings

- `NODE_ENV`: Environment mode (development, production, test)
- `PORT`: Application port (default: 3000)
- `LOG_LEVEL`: Logging verbosity (debug, info, warn, error)

### Advanced Configuration

Additional configuration options will be documented as features are added to the application.

## Example Configuration

```json
{
  "app": {
    "name": "In-Accord App",
    "version": "0.1.0"
  },
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```
