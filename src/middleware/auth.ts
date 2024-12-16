import { Context } from 'telegraf';
import { MyContext } from '../types';

export const authMiddleware = () => async (ctx: MyContext, next: () => Promise<void>) => {
  const allowedGroupId = process.env.ALLOWED_GROUP_ID;
  
  if (!allowedGroupId) {
    console.warn('ALLOWED_GROUP_ID not set in environment variables');
    return next();
  }

  // Get the chat ID from the context
  const chatId = ctx.chat?.id.toString();

  if (!chatId) {
    console.warn('No chat ID found in context');
    return;
  }

  // Check if the message is from the allowed group
  if (chatId !== allowedGroupId) {
    console.log(`Unauthorized access attempt from chat ID: ${chatId}`);
    await ctx.reply('This bot is only available in the authorized group.');
    return;
  }

  return next();
};
