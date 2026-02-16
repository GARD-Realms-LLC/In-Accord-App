# Troubleshooting

## Common Issues and Solutions

### Installation Issues

#### npm install fails

**Problem:** Dependencies fail to install

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

#### Node version mismatch

**Problem:** Application requires a different Node.js version

**Solution:**
- Check required version in `package.json`
- Install the correct Node.js version using nvm:
```bash
nvm install 18
nvm use 18
```

### Runtime Issues

#### Application won't start

**Problem:** Application fails to start

**Solution:**
1. Check that all dependencies are installed: `npm install`
2. Verify Node.js version: `node --version`
3. Check for port conflicts
4. Review error messages in console

#### Port already in use

**Problem:** Application port is already in use

**Solution:**
```bash
# Find the process using the port (e.g., 3000)
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm start
```

### Testing Issues

#### Tests fail to run

**Problem:** Jest tests don't execute

**Solution:**
- Ensure Jest is installed: `npm install --save-dev jest`
- Check jest.config.js is present
- Run tests with verbose flag: `npm test -- --verbose`

#### Test coverage issues

**Problem:** Coverage reports are incomplete

**Solution:**
```bash
# Generate coverage report
npm test -- --coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Build Issues

#### Build fails

**Problem:** Build process encounters errors

**Solution:**
1. Clear any previous build artifacts
2. Check for syntax errors in code
3. Verify all dependencies are installed
4. Review build logs for specific errors

## Getting Help

If you encounter issues not covered here:

1. Check existing [GitHub Issues](https://github.com/GARD-Realms-LLC/In-Accord-App/issues)
2. Search closed issues for similar problems
3. Create a new issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - Error messages
   - System information (OS, Node.js version, etc.)

## Useful Commands

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# View installed packages
npm list

# Check for outdated packages
npm outdated

# Audit dependencies for vulnerabilities
npm audit
```
