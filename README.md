# Safe Bot 🤖

A comprehensive Telegram bot built with TypeScript that provides a vouching system, anonymous feedback mechanisms, and rich media integration. Perfect for community management and social verification.

## ✨ Features

### 🏆 Vouching System

- **Public Vouches**: Create vouches for Twitter/X users with profile picture integration
- **Real-time Voting**: Community members can upvote/downvote vouches with interactive buttons
- **Dynamic Status Updates**: Automatic status changes based on vote thresholds
- **Multi-format Support**: Accept usernames, @mentions, or profile URLs

### 🔒 Anonymous Feedback (Veto System)

- **Private Reporting**: Submit anonymous feedback about users via DMs
- **Privacy-First**: All feedback submissions are completely anonymous
- **Interactive Process**: Guided step-by-step submission process
- **Comprehensive Management**: List, edit, and manage your submitted feedback

### 🎵 Rich Media Integration

- **Spotify Integration**: Automatic rich previews for Spotify tracks with audio samples
- **Image Processing**: Smart image resizing and optimization
- **Thumbnail Generation**: Automatic thumbnail creation for audio content

### 🛡️ Security & Authentication

- **Multi-level Auth**: Separate authentication for groups, DMs, and hybrid contexts
- **Admin Controls**: Special admin composer with elevated permissions
- **Session Management**: Secure session handling for multi-step processes
- **Environment-aware**: Different configurations for local, staging, and production

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Telegram Bot Token
- Environment variables configured

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd safe-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create environment-specific files:

   - `.env.local` for development
   - `.env.staging` for staging
   - `.env.production` for production

   Required variables:

   ```env
   BOT_TOKEN=your_telegram_bot_token
   DATABASE_URL=postgresql://username:password@localhost:5432/database
   ALLOWED_GROUP_ID=your_telegram_group_id
   THREAD_ID=optional_thread_id
   VOUCH_THREAD_ID=optional_vouch_thread_id
   ```

4. **Set up the database**

   ```bash
   # Deploy migrations
   npm run deploy:staging
   ```

5. **Start the bot**

   ```bash
   # Development
   npm run start:local

   # Staging
   npm run start:staging

   # Production
   npm run start:production
   ```

## 📖 Usage

### Vouching Commands

| Command                                       | Description                            | Example                                     |
| --------------------------------------------- | -------------------------------------- | ------------------------------------------- |
| `/vouch @username [description]`              | Create a vouch for a user              | `/vouch @johndoe Great contributor!`        |
| `/vouch https://x.com/username [description]` | Vouch using profile URL                | `/vouch https://x.com/johndoe Amazing work` |
| `/up`                                         | Update your vouch's profile picture    | `/up`                                       |
| `/x`                                          | Delete your own vouch (reply to vouch) | Reply `/x` to your vouch                    |

### Anonymous Feedback (DM Only)

| Command | Description                      |
| ------- | -------------------------------- |
| `/veto` | Start anonymous feedback process |
| `/list` | View all your submitted feedback |

### General Commands

| Command  | Description                 |
| -------- | --------------------------- |
| `/start` | Get started with the bot    |
| `/help`  | Show all available commands |

### Media Features

- **Spotify Links**: Share any Spotify track/album/playlist for rich preview with audio sample
- **TopGolf Integration**: Special TopGolf content handling

## 🏗️ Architecture

### Project Structure

```
src/
├── commands/          # Bot command handlers
├── composers/         # Telegram composers for modular functionality
├── config/           # Environment and configuration management
├── middleware/       # Authentication and logging middleware
├── types/           # TypeScript type definitions
├── utils/           # Utility functions and session management
└── index.ts         # Main bot entry point

prisma/
├── migrations/      # Database schema migrations
└── schema.prisma    # Database schema definition
```

### Database Schema

- **Vote**: Stores vouch information with upvotes/downvotes
- **Settings**: Configurable thresholds for voting
- **Feedback**: Anonymous feedback submissions

### Key Components

- **Session Manager**: Handles multi-step interactive processes
- **Authentication Middleware**: Role-based access control
- **Image Processing**: Sharp-based image optimization
- **Queue System**: Background task processing

## 🛠️ Development

### Available Scripts

| Script                    | Description                              |
| ------------------------- | ---------------------------------------- |
| `npm start`               | Start the bot (production)               |
| `npm run start:local`     | Start with local environment             |
| `npm run start:staging`   | Start with staging environment           |
| `npm run build`           | Compile TypeScript to JavaScript         |
| `npm run deploy:staging`  | Deploy database migrations to staging    |
| `npm run update-statuses` | Update vote statuses based on thresholds |

### Environment Management

The bot supports multiple environments with automatic environment file loading:

- **Local**: `.env.local` - Development with relaxed validation
- **Staging**: `.env.staging` - Pre-production testing
- **Production**: Environment variables from deployment platform

### Database Management

```bash
# Deploy migrations
npm run deploy:staging

# Update vote statuses
npm run update-statuses:staging

# Update message formats
npm run update-format:staging
```

## 🚀 Deployment

### Using Nixpacks (Railway, etc.)

The project includes a `nixpacks.toml` configuration for seamless deployment:

```toml
[variables]
NIXPACKS_NO_CACHE = "1"

[phases.setup]
nixPkgs = ['nodejs_18']

[start]
cmd = 'npm start'
```

### Environment Variables for Production

Ensure these are set in your deployment platform:

- `BOT_TOKEN`
- `DATABASE_URL`
- `ALLOWED_GROUP_ID`
- `APP_ENV=production`

## 🔧 Configuration

### Voting Thresholds

Adjust voting thresholds via the Settings model:

- `requiredUpvotes`: Votes needed for approval (default: 15)
- `requiredDownvotes`: Votes needed for rejection (default: 3)

### Admin Users

Update admin user IDs in `src/index.ts`:

```typescript
bot.use(
  Composer.acl([748045538, 6179266599, 6073481452, 820325877], adminComposer)
);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [package.json](package.json) file for details.

## 🐛 Troubleshooting

### Common Issues

**Bot not responding to commands**

- Check if the bot token is correct
- Verify the bot has necessary permissions in the group
- Ensure the group ID is correctly configured

**Database connection issues**

- Verify DATABASE_URL format
- Check if database migrations have been applied
- Ensure database is accessible from your environment

**Image loading failures**

- Some Twitter profile images may not load due to API limitations
- This is a known issue and doesn't affect bot functionality

**Spotify integration not working**

- Ensure spotify-url-info package is properly installed
- Check network connectivity for external API calls

## 🔮 Future Enhancements

- Enhanced admin dashboard
- More rich media integrations
- Advanced analytics and reporting
- Multi-language support
- Webhook integration for external services

---

Built with ❤️ using TypeScript, Telegraf, and Prisma
