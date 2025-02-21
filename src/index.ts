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
import { spotifyCommand } from './commands/spotify';
import { topgolfCommand } from './commands/topgolf';
// Initialize your bot
const bot = new Telegraf(config.botToken);
bot.use(Composer.acl([748045538, 6179266599, 6073481452, 820325877], adminComposer));


bot.catch((err, ctx) => {
  ctx.telegram.sendMessage(6179266599, `Error: ${err}`);
});

// Register regular commands in order of specificity
bot.command('vouch', vouchCommand);  // Register specific commands first
bot.command('start', startCommand);

// Register action handlers (for inline buttons)
bot.action(/^\/vote_(up|down)$/, voteCommand);

// Add the remove command handler
bot.use(helpCommand,removeCommand, spotifyCommand, topgolfCommand, loggerMiddleware, authMiddleware());




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

