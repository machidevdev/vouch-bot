import { MyContext } from '../types';
import { config } from '../config/env';

// Hybrid middleware - allows commands in both the specific group AND DMs from group members
export const hybridAuthMiddleware = () => async (ctx: MyContext, next: () => Promise<void>) => {
  if (config.isDevelopment) {
    return next();
  }

  const chatId = ctx.chat?.id.toString();
  const chatType = ctx.chat?.type;
  const userId = ctx.from?.id;

  if (!userId) {
    console.warn('No user ID found in context');
    return;
  }

  // If it's in the allowed group, allow it
  if (chatId === config.allowedGroupId) {
    console.log('Group access granted - proceeding to command');
    return next();
  }

  // If it's a private chat (DM), check if user is a member of the allowed group
  if (chatType === 'private') {
    try {
      const chatMember = await ctx.telegram.getChatMember(config.allowedGroupId, userId);
      
      // Allow if user is a member (member, administrator, or creator)
      if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
        console.log('DM access granted for group member - proceeding to command');
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
  }

  // Not in allowed group and not a DM from group member
  console.log(`Access denied - chatId: ${chatId}, chatType: ${chatType}`);
  return; // Don't reply for unauthorized groups, just ignore
};