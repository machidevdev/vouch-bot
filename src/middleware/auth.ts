import { Context } from 'telegraf';
import { MyContext } from '../types';
import { config } from '../config/env';

// Group-only middleware - only allows commands in the specific group
export const groupOnlyMiddleware = () => async (ctx: MyContext, next: () => Promise<void>) => {
  if(config.isDevelopment){
    return next();
  }

  const chatId = ctx.chat?.id.toString();
  console.log('Group auth check - chatId:', chatId, 'allowedGroupId:', config.allowedGroupId);
  
  // Only allow in the specific group
  if (chatId !== config.allowedGroupId) {
    console.log('Access denied - not in allowed group');
    return; // Don't reply for unauthorized groups, just ignore
  }

  console.log('Group access granted - proceeding to command');
  return next();
};

// Legacy export for backward compatibility
export const authMiddleware = groupOnlyMiddleware;
