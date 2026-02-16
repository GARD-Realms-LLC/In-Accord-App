# Contributing to In-Accord App

Thank you for your interest in contributing to the In-Accord App! This document provides guidelines for contributing to the project.

## Code of Conduct

Please be respectful and constructive in all interactions with the community.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/GARD-Realms-LLC/In-Accord-App/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - System information

### Suggesting Enhancements

1. Open an issue with the enhancement proposal
2. Describe the feature and its benefits
3. Provide examples if possible

### Pull Requests

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Write or update tests as needed
5. Ensure all tests pass: `npm test`
6. Run linter: `npm run lint`
7. Commit your changes with a clear message
8. Push to your fork
9. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/In-Accord-App.git
cd In-Accord-App

# Install dependencies
npm install

# Create a branch for your changes
git checkout -b feature/my-new-feature

# Make changes and test
npm test
npm run lint
```

## Coding Standards

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Write tests for new features
- Keep functions small and focused

## Testing Guidelines

- Write unit tests for new functions
- Ensure all tests pass before submitting PR
- Aim for good test coverage
- Test edge cases and error conditions

## Documentation

- Update documentation for new features
- Keep README.md up to date
- Add JSDoc comments for public APIs

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.
