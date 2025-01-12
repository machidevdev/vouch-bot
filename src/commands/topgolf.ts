import { Composer } from "telegraf";
import { message } from "telegraf/filters";
import path from 'path';

export const topgolfCommand = Composer.on(message('text'), async (ctx, next) => {
  const text = ctx.message.text;
  if (!text.includes('topgolf')) return next();

  const imagePath = path.join(__dirname, '../assets/topgolf.webp');
  await ctx.replyWithPhoto({ source: imagePath }, {
    caption: 'Topgolf'
  });
  await next();
});