# Contributing to Nest Sentinel

Thank you for your interest in contributing to Nest Sentinel! This guide will help you get started with contributing to this project.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please treat all contributors with respect and create a welcoming environment for everyone.

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Git
- TypeScript knowledge
- NestJS familiarity

### Development Setup

1. **Fork and Clone**

   ```bash
   # Fork the repository on GitHub
   # Then clone your fork
   git clone https://github.com/YOUR_USERNAME/nest-sentinel.git
   cd nest-sentinel
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Set up Development Environment**

   ```bash
   # Run tests to ensure everything works
   npm test

   # Run type checking
   npm run typecheck

   # Build the project
   npm run build
   ```

4. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-fix-name
   ```

## 📝 Development Workflow

### 1. Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint and auto-fix
npm run lint

# Check formatting
npm run format:check

# Format code
npm run format
```

**Style Guidelines:**

- Use TypeScript for all new code
- Follow existing naming conventions
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and small

### 2. Testing

We maintain high test coverage. All changes should include appropriate tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

**Testing Guidelines:**

- Write unit tests for all new functionality
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies
- Maintain test coverage above 90%

### 3. Documentation

Update documentation for any changes:

- Update README.md for user-facing changes
- Update DEVELOPER.md for internal changes
- Add JSDoc comments for new public APIs
- Update type definitions as needed

## 🔧 Project Structure

```
src/
├── index.ts                    # Main exports
├── sentinel.module.ts          # NestJS module
├── cli/                       # Command-line interface
├── client/                    # HTTP client
├── decorators/                # Access control decorators
├── entities/                  # TypeORM entities
├── guards/                    # NestJS guards
├── interceptors/              # NestJS interceptors
├── interfaces/                # TypeScript interfaces
├── services/                  # Business logic services
└── utils/                     # Utility functions
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear Description**: What happened vs what you expected
2. **Reproduction Steps**: Step-by-step instructions to reproduce
3. **Environment**: Node.js version, NestJS version, database type
4. **Code Sample**: Minimal code that demonstrates the issue
5. **Error Messages**: Full error messages and stack traces

**Bug Report Template:**

```markdown
## Bug Description

Brief description of the bug

## Steps to Reproduce

1. Step one
2. Step two
3. ...

## Expected Behavior

What should have happened

## Actual Behavior

What actually happened

## Environment

- Node.js version:
- NestJS version:
- Nest Sentinel version:
- Database type:
- Operating System:

## Additional Context

Any other relevant information
```

## 💡 Feature Requests

For feature requests, please:

1. **Check Existing Issues**: Search for similar requests first
2. **Describe the Problem**: What problem does this solve?
3. **Proposed Solution**: How should it work?
4. **Use Cases**: Real-world scenarios where this would be useful
5. **Breaking Changes**: Would this require breaking changes?

## 🔀 Pull Request Process

### Before Submitting

1. **Test Your Changes**

   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

2. **Update Documentation**
   - Update README.md if user-facing changes
   - Update DEVELOPER.md if internal changes
   - Add/update JSDoc comments

3. **Write Good Commit Messages**
   ```
   feat: add geolocation-based access control
   fix: improve IPv6 CIDR range matching
   docs: update API documentation
   test: add tests for MAC address validation
   refactor: simplify access rule evaluation
   ```

### Submission Guidelines

1. **Pull Request Title**: Clear, descriptive title
2. **Description**: Explain what changes you made and why
3. **Link Issues**: Reference related issues with "Fixes #123"
4. **Checklist**: Complete the PR checklist

**Pull Request Template:**

```markdown
## Description

Brief description of changes

## Related Issues

Fixes #(issue number)

## Type of Change

- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Updated existing tests as needed

## Documentation

- [ ] Updated README.md
- [ ] Updated DEVELOPER.md
- [ ] Added/updated JSDoc comments
- [ ] Updated type definitions

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] No console.log statements left
- [ ] Breaking changes documented
```

### Review Process

1. **Automated Checks**: CI must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: Manual testing for complex features
4. **Documentation**: Ensure docs are updated
5. **Merge**: Squash and merge with clean commit message

## 🏷️ Types of Contributions

### Code Contributions

- **Bug Fixes**: Fix existing issues
- **New Features**: Add new functionality
- **Performance**: Optimize existing code
- **Refactoring**: Improve code structure
- **Tests**: Add or improve test coverage

### Non-Code Contributions

- **Documentation**: Improve guides and examples
- **Issues**: Report bugs and suggest features
- **Community**: Help other users in discussions
- **Examples**: Create usage examples and tutorials

## 🔍 Code Review Guidelines

### For Contributors

- **Small PRs**: Keep changes focused and small
- **Clear Intent**: Make the purpose of changes obvious
- **Test Coverage**: Include appropriate tests
- **Documentation**: Update relevant documentation

### For Reviewers

- **Be Constructive**: Provide helpful feedback
- **Be Specific**: Give concrete suggestions
- **Be Timely**: Review promptly when possible
- **Be Kind**: Remember there's a person behind the code

## 🚀 Release Process

### Version Management

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in package.json
2. Update CHANGELOG.md
3. Run full test suite
4. Build and verify distribution
5. Create release notes
6. Publish to npm
7. Create GitHub release

## 🛠️ Development Tools

### Recommended VS Code Extensions

- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Jest
- GitLens

### Debugging

Enable debug logging:

```typescript
process.env.SENTINEL_DEBUG = "true";
```

Use VS Code debugger configuration:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## 📞 Getting Help

- **Documentation**: Check README.md and DEVELOPER.md
- **Issues**: Search existing issues first
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community Discord (link in README)
- **Email**: Contact maintainers at dev@rastaweb.com

## 🙏 Recognition

Contributors will be:

- Listed in the README.md contributors section
- Mentioned in release notes for significant contributions
- Invited to the contributors Discord channel
- Considered for maintainer status based on ongoing contributions

Thank you for contributing to Nest Sentinel! 🛡️
