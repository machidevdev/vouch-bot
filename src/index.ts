import { Composer, Telegraf } from 'telegraf';
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
import { refreshCommand } from './commands/refresh';
import { editxCommand } from './commands/editx';
import { vetoCommand } from './commands/veto';
import { vetoHandler } from './commands/vetoHandler';
import { vetoCallbacks } from './commands/vetoCallbacks';
import { vetoVoteCommand } from './commands/vetoVote';
import { listCommand } from './commands/list';
// Initialize your bot
const bot = new Telegraf(config.botToken);

bot.use(Composer.acl([748045538, 6179266599, 6073481452, 820325877], adminComposer));

bot.catch((err, ctx) => {
  try{
    ctx.telegram.sendMessage(6179266599, `Error: ${err}`);
  }catch(e){
    console.error('Failed to send error message:', e);
  }
});

// Register regular commands in order of specificity
bot.command('vouch', vouchCommand);  // Register specific commands first
bot.command('start', startCommand);
bot.command('up', refreshCommand);  // Add the refresh command
bot.command('veto', vetoCommand);
bot.command('help', helpCommand);

bot.use(startCommand, vetoHandler, listCommand);
bot.use(vetoCallbacks);

bot.use(removeCommand, spotifyCommand, topgolfCommand, loggerMiddleware, authMiddleware(), editxCommand);

// Register action handlers (for inline buttons)
bot.action(/^\/vote_(up|down)$/, voteCommand);
bot.action(/^\/veto_(up|down)$/, vetoVoteCommand);




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

