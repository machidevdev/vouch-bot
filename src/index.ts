import { Composer, Telegraf } from 'telegraf';
import { loggerMiddleware } from './middleware/logger';
import { authMiddleware } from './middleware/auth';
import { hybridAuthMiddleware } from './middleware/hybridAuth';
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
import { vouchHandler } from './commands/vouchHandler';
import { vouchCallbacks } from './commands/vouchCallbacks';
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

// Register message handlers first (work in all chats)
bot.use(topgolfCommand, spotifyCommand);

// Register group-only commands (with auth middleware)
bot.command('vouch', hybridAuthMiddleware(), vouchCommand);
bot.command('up', authMiddleware(), refreshCommand);

// Register universal commands
bot.command('start', startCommand);
bot.command('help', helpCommand);

// Register callback handlers first (before other middleware)
bot.use(vouchCallbacks);
bot.use(vetoCallbacks);

// Register DM-only handlers
bot.use(vetoHandler, listCommand, vetoCommand);

// Register vouch handlers (work in both DMs and groups)
bot.use(vouchHandler);

// Register remaining middleware
bot.use(removeCommand, loggerMiddleware, editxCommand);

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

