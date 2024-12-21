import { Composer, Context, Telegraf } from 'telegraf';
import { loggerMiddleware } from './middleware/logger';
import { authMiddleware } from './middleware/auth';
import { config } from './config/env';
import { vouchCommand } from './commands/vouch';
import { removeCommand } from './commands/remove';
import { voteCommand } from './commands/vote';
import { helpCommand } from './commands/help';
import { startCommand } from './commands/start';
import { adminComposer } from './composers/adminComposer';
import './commands/update';
import './commands/settings';

// Initialize your bot
const bot = new Telegraf(config.botToken);
bot.use(Composer.acl([748045538, 6179266599, 6073481452, 820325877], adminComposer));

// Register regular commands in order of specificity
bot.command('vouch', vouchCommand);  // Register specific commands first
bot.command('help', helpCommand);

bot.command('start', startCommand);  // Register more general commands last

// Register action handlers (for inline buttons)
bot.action(/^\/vote_(up|down)$/, voteCommand);


// Register middlewares
bot.use(loggerMiddleware);
bot.use(authMiddleware());

// Start bot
bot.launch()
  .then(() => {
    console.log('Bot is running!');
  })
  .catch((err) => {
    console.error('Bot launch failed:', err);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 

