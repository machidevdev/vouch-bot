import { Composer } from 'telegraf';
import { dmAuthMiddleware } from '../middleware/dmAuth';

export const startCommand = Composer.command('start', dmAuthMiddleware(), async (ctx) => {
  const userName = ctx.from.first_name || 'there';
  
  await ctx.reply(
    `Safe.\n\n` +
    `🚨 <b>Anonymous Veto</b> - Report problematic users privately\n` +
    `📋 <b>View Reports</b> - See community feedback and votes\n\n` +
    `Select a feature to get started:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚨 Start Veto Process', callback_data: 'start_veto' }],
          [{ text: '📋 View Reports', callback_data: 'start_list' }],
          [{ text: 'ℹ️ Help & Info', callback_data: 'start_help' }]
        ]
      }
    }
  );
});
