import { Composer } from "telegraf";


export const vouchCommand = Composer.command('vouch', async (ctx) => {
  await ctx.reply('Welcome! Bot is running.');
});