# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Environment-specific development:**
- `npm run start:local` - Run bot in local development mode with auto-restart
- `npm run start:staging` - Run bot in staging environment 
- `npm run start:production` - Run bot in production environment
- `npm run build` - Compile TypeScript to JavaScript
- `npm run sync` - Run synchronization script

**Database operations:**
- `npm run deploy:staging` - Deploy Prisma migrations to staging database
- `npm run pull:staging` - Pull database schema from staging to update Prisma schema
- `npm run update-statuses` - Run status update script (local)
- `npm run update-statuses:staging` - Run status update script on staging
- `npm run update-format` - Run format update script (local)  
- `npm run update-format:staging` - Run format update script on staging

## Architecture Overview

This is a **Telegram bot** built with Node.js, TypeScript, and Telegraf that manages a voting/vouching system for Twitter users. The bot operates as a community moderation tool.

**Core Architecture:**
- **Telegraf Framework**: Main bot framework handling Telegram API interactions
- **Prisma ORM**: Database access layer with PostgreSQL backend
- **Command-based Architecture**: Individual command handlers in `src/commands/`
- **Middleware System**: Authentication and logging middleware
- **Admin Access Control**: Specific user IDs have admin privileges via ACL

**Key Components:**
- `src/index.ts` - Main bot initialization and command registration
- `src/commands/` - Individual command handlers (vouch, vote, settings, etc.)
- `src/middleware/` - Authentication and logging middleware
- `src/composers/adminComposer.ts` - Admin-only command handling
- `src/utils.ts` - Core utilities including Twitter profile image fetching
- `prisma/schema.prisma` - Database schema defining Vote and Settings models

**Database Schema:**
- **Vote model**: Tracks vouch requests with upvoter/downvoter arrays, status, and metadata
- **Settings model**: Configurable thresholds for required up/down votes
- Uses PostgreSQL with Prisma migrations

**Environment Configuration:**
- Multi-environment support (local, staging, production)
- Environment-specific .env files (`.env.local`, `.env.staging`)
- Required: `BOT_TOKEN`, `DATABASE_URL`, `ALLOWED_GROUP_ID` (production)
- Development mode bypasses group restrictions

**Authentication:**
- Group-based access control - bot only responds in configured group
- Admin ACL with hardcoded user IDs for admin commands
- Development mode bypasses authentication

**Key Features:**
- Twitter username/URL parsing and validation
- Profile image fetching with error handling
- Inline keyboard voting system
- Message cleanup and management
- Status tracking (pending/approved/rejected)