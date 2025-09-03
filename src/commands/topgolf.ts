import { Composer } from "telegraf";
import { message } from "telegraf/filters";
import path from 'path';

export const topgolfCommand = Composer.on(message('text'), async (ctx, next) => {
  const text = ctx.message.text.toLowerCase();
  console.log('Topgolf handler reached, checking text:', text);
  
  // Check for various topgolf combinations
  const hasTopgolf = text.includes('topgolf') || 
                    text.includes('TOPGOLF') ||
                    (text.includes('top') && text.includes('golf')) ||
                    text.includes('TopGolf');

  if (!hasTopgolf) {
    console.log('No topgolf match, passing to next handler');
    return next();
  }
  
  console.log('Topgolf match found, sending image');
  const imagePath = path.join(__dirname, '../assets/topgolf.webp');
  await ctx.replyWithPhoto({ source: imagePath }, {
    caption: 'Topgolf',
    reply_parameters: {
      message_id: ctx.message.message_id
    }
  });
  // Don't call next() - stop middleware chain here
});
