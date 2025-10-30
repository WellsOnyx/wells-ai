# Contributing to Wells AI

Thank you for your interest in contributing to Wells AI! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and professional
- Focus on constructive feedback
- Maintain confidentiality of business information
- Follow Wells Onyx brand guidelines

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git
- A code editor (VS Code recommended)
- Access to required API keys (see .env.local.example)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/wells-ai.git
cd wells-ai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

4. Run the development server:
```bash
npm run dev
```

5. Open http://localhost:3000 in your browser

## Development Workflow

### Branch Naming

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Hotfixes: `hotfix/description`

Example: `feature/add-supplier-matching`

### Commit Messages

Follow conventional commits format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example: `feat: add real-time supplier notifications via Twilio`

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly
4. Update documentation if needed
5. Submit a pull request with:
   - Clear description of changes
   - Screenshots for UI changes
   - Test results
   - Any breaking changes noted

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define interfaces for all data structures
- Avoid `any` types when possible
- Use meaningful variable names

### React/Next.js

- Use functional components with hooks
- Keep components small and focused
- Use server components by default
- Client components only when needed (use 'use client' directive)

### Styling

- Use Tailwind CSS utility classes
- Follow Wells Onyx brand colors (defined in tailwind.config.js)
- Ensure mobile responsiveness
- Test across browsers

### API Routes

- Keep routes focused and single-purpose
- Validate all inputs
- Handle errors gracefully
- Return appropriate HTTP status codes
- Include proper error messages

## Testing

### Manual Testing

Before submitting a PR, test:

1. Core conversation flows (semiconductor, executive search)
2. Mobile responsiveness
3. Error handling
4. API integrations

### Test Scenarios

Run through these scenarios:

1. **Semiconductor Procurement:**
   - Start conversation: "I need chips for AI training"
   - Verify qualification questions
   - Check data capture

2. **Executive Search:**
   - Start conversation: "Need to hire a CTO"
   - Verify qualification flow
   - Ensure proper categorization

3. **Error Cases:**
   - Invalid inputs
   - Network failures
   - Missing environment variables

## Documentation

### When to Update Docs

- New features require documentation
- API changes need updated examples
- Configuration changes need setup guide updates
- Breaking changes need migration guides

### Documentation Standards

- Clear, concise writing
- Include code examples
- Add screenshots for UI features
- Keep README.md up to date

## Environment Variables

### Required Variables

See `.env.local.example` for all required variables.

### Adding New Variables

1. Add to `.env.local.example` with description
2. Document in relevant docs
3. Add validation in code
4. Update Vercel deployment instructions

## Release Process

### Version Numbers

Follow semantic versioning (semver):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Deployment

Production deployments happen via Vercel:
1. Merge to `main` branch
2. Vercel automatically deploys
3. Monitor deployment logs
4. Test production build
5. Notify team

## Integration Guidelines

### Adding New Integrations

When adding new service integrations (e.g., Slack, Stripe):

1. Create feature branch
2. Add environment variables to example file
3. Create API route in `/app/api/[integration]/`
4. Add types in `/lib/types/`
5. Document setup in `/docs/integrations/`
6. Test error handling
7. Add monitoring/logging

### Third-Party Services

Current integrations:
- Anthropic Claude (AI conversations)
- Twilio (SMS notifications)
- Notion (database)
- Vercel Postgres (persistence)
- Sentry (error tracking)

## Brand Guidelines

### Wells Onyx Identity

- **Colors:** Deep Blue (#183b6d), Gold (#dba63f)
- **Voice:** Expert, trusted, precise yet personal
- **Theme:** Constellation metaphor

### UI Consistency

- Use established component patterns
- Follow spacing and typography standards
- Maintain brand colors across all interfaces
- Ensure accessibility (WCAG 2.1 AA)

## Getting Help

### Resources

- Project documentation: `/docs`
- API documentation: `/docs/api`
- Architecture overview: `ARCHITECTURE.md`
- Setup guide: `/docs/setup/SETUP_GUIDE.md`

### Contact

- Technical questions: Create an issue
- Security concerns: Email jonah@wellsonyx.com
- General inquiries: See README.md

## License

This project is proprietary to Wells Onyx. All contributions become property of Wells Onyx upon submission.

---

**Thank you for contributing to Wells AI!**

*Built with precision. Powered by trust. Designed for generations.*
