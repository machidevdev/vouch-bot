import { Context, Telegraf } from 'telegraf';
import { loggerMiddleware } from './middleware/logger';
import { authMiddleware } from './middleware/auth';
import { config } from './config/env';
import { vouchCommand } from './commands/vouch';
import { removeCommand } from './commands/remove';
import { voteCommand } from './commands/vote';
import { helpCommand } from './commands/help';
import { startCommand } from './commands/start';

// Initialize your bot
const bot = new Telegraf(config.botToken);


bot.use(startCommand)
bot.use(vouchCommand)
bot.use(removeCommand)
bot.use(voteCommand)
bot.use(helpCommand)



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

