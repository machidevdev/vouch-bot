import { Context } from 'telegraf';
import { MyContext } from '../types';
import { config } from '../config/env';

export const authMiddleware = () => async (ctx: MyContext, next: () => Promise<void>) => {

  if(config.isDevelopment){
    return next();
  }

  // Get the chat ID from the context
  const chatId = ctx.chat?.id.toString();
  console.log('chatId', chatId);
  console.log('config.allowedGroupId', config.allowedGroupId);
  if (!chatId) {
    console.warn('No chat ID found in context');
    return;
  }

  // Check if the message is from the allowed group
  if (chatId !== config.allowedGroupId) {
    console.log(`Unauthorized access attempt from chat ID: ${chatId}`);
    return;
  }

  console.log('Auth middleware: proceeding to next()');
  return next();
};
