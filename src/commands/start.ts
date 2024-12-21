import { Context } from 'telegraf';

export const startCommand = async (ctx: Context) => {
  await ctx.reply('Safe.');
};
