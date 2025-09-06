import { Context } from 'telegraf';
import { MyContext } from '../types';
import { config } from '../config/env';

export const dmAuthMiddleware = () => async (ctx: MyContext, next: () => Promise<void>) => {
  if (config.isDevelopment) {
    return next();
  }

  // Only allow DM messages (private chats)
  if (ctx.chat?.type !== 'private') {
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) {
    console.warn('No user ID found in context');
    return;
  }

  try {
    // Check if user is a member of the allowed group
    const chatMember = await ctx.telegram.getChatMember(config.allowedGroupId, userId);
    
    // Allow if user is a member (member, administrator, or creator)
    if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
      return next();
    } else {
      console.log(`Unauthorized DM attempt from user ID: ${userId} (status: ${chatMember.status})`);
      await ctx.reply('You must be a member of the authorized group to use this command.');
      return;
    }
  } catch (error) {
    console.error('Error checking group membership:', error);
    await ctx.reply('Unable to verify group membership. Please try again later.');
    return;
  }
};