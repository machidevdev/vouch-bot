import { Composer } from "telegraf";
import { prisma, getProfileImage } from "../utils";
import { formatVoteMessage } from "../utils";
import { sessionManager } from "../utils/sessionManager";

export const vouchCommand = Composer.command('vouch', async (ctx) => {
  console.log('Vouch command handler reached!', ctx.chat.id);
  const userId = ctx.from.id;
  const userMessageId = ctx.message.message_id;
  const userChatId = ctx.chat.id;
  const messageText = ctx.message.text;
  const chatType = ctx.chat.type === 'private' ? 'dm' : 'group';
  
  // Check if user already has an active vouch session
  if (sessionManager.hasActiveVouchSession(userId)) {
    await ctx.reply('❌ You already have an active vouch process running. Please complete or cancel it first.');
    return;
  }

  const parts = messageText.split(/\s+/);
  
  // If no parameters provided, start multi-step process
  if (parts.length < 2) {
    // Start new vouch session
    sessionManager.startVouchSession(userId, chatType);
    
    const message = await ctx.reply(
      `✨ <b>Vouch Process Started</b>\n\n` +
      `<b>📝 Step 1 of 3: Target User</b>\n\n` +
      `Please send the Twitter username or profile URL of the person you want to vouch for.\n\n` +
      `<b>Accepted formats:</b>\n` +
      `• @username\n` +
      `• username\n` +
      `• https://x.com/username`,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
          ]
        }
      }
    );
    
    // Set this as the main message that will be edited throughout the process
    sessionManager.setVouchMainMessageId(userId, message.message_id);
    
    // Delete the user's command message
    try {
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    } catch (error) {
      console.error('Failed to delete user message:', error);
    }
    
    return;
  }

  // Legacy single-command mode (when parameters are provided)
  let username: string | null = null;
  let description: string | null = null;

  // Check for Twitter URL
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?x\.com\/([^\/\s\?]+)/;
  const urlMatch = parts[1].match(twitterUrlRegex);
  console.log("Fetching username from URL:", urlMatch);
  if (urlMatch) {
    username = urlMatch[1].split('?')[0].toLowerCase();
    description = parts.slice(2).join(' ') || null;
  } else {
    // Check for username format (with @), preserving underscores
    const usernameMatch = parts[1].match(/@?([a-zA-Z0-9_]+)/);
    if (usernameMatch) {
      username = usernameMatch[1].toLowerCase();
      description = parts.slice(2).join(' ') || null;
    }
  }

  if (!username) {
    await ctx.reply('Please provide a valid Twitter username or URL\nExample: /vouch @username [description] or /vouch https://x.com/username [description]');
    return;
  }

  // Prevent vouching for the bot
  if (username.toLowerCase() === 'safe_magic_bot') {
    return;
  }

  try {
    const existingVote = await prisma.vote.findFirst({
      where: {
        twitterUsername: { equals: username, mode: 'insensitive' }
      }
    });

    if (existingVote) {
      // For groups: delete old message and create fresh one with updated info
      if (chatType === 'group') {
        // Delete the old message
        try {
          await ctx.telegram.deleteMessage(
            Number(existingVote.chatId), 
            Number(existingVote.messageId)
          );
          console.log('Successfully deleted old vouch message');
        } catch (deleteError) {
          console.log('Could not delete old vouch message:', deleteError);
          // Continue anyway - we'll still create the new message
        }

        // Check if current user already upvoted
        const currentUser = ctx.from.username || ctx.from.id.toString();
        const hasAlreadyUpvoted = existingVote.upvoterUsernames.includes(currentUser);
        const hasAlreadyDownvoted = existingVote.downvoterUsernames.includes(currentUser);

        // Prepare updated vote arrays
        let updatedUpvoters = [...existingVote.upvoterUsernames];
        let updatedDownvoters = [...existingVote.downvoterUsernames];

        // Add current user to upvoters if not already voted
        if (!hasAlreadyUpvoted && !hasAlreadyDownvoted) {
          updatedUpvoters.push(currentUser);
        }

        // Merge descriptions
        let mergedDescription = existingVote.description || '';
        if (description && description.trim()) {
          if (mergedDescription) {
            mergedDescription = `${mergedDescription}\n\n${description.trim()}`;
          } else {
            mergedDescription = description.trim();
          }
        }

        // Prepare vouchers list
        let vouchersList = existingVote.voucherUsernames || [existingVote.createdBy];
        
        // Add current user to vouchers list if not already there
        if (!vouchersList.includes(currentUser)) {
          vouchersList.push(currentUser);
        }

        // Create fresh message with updated data
        try {
          console.log(`[Image Fetch] Starting image fetch for existing vouch @${username}`);
          const imageUrl = await getProfileImage(username);

          const message = await ctx.replyWithPhoto(imageUrl, {
            caption: formatVoteMessage(
              username.trim(), 
              updatedUpvoters.length, 
              updatedDownvoters.length, 
              vouchersList, 
              existingVote.status, 
              mergedDescription
            ),
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: `✅ (${updatedUpvoters.length})`, callback_data: '/vote_up' },
                { text: `❌ (${updatedDownvoters.length})`, callback_data: '/vote_down' }
              ]]
            }
          });

          // Update the database with new message ID and vote data
          await prisma.vote.update({
            where: { id: existingVote.id },
            data: {
              messageId: BigInt(message.message_id),
              chatId: BigInt(ctx.chat.id),
              voucherUsernames: vouchersList,
              upvoterUsernames: updatedUpvoters,
              downvoterUsernames: updatedDownvoters,
              description: mergedDescription
            }
          });

          console.log('Successfully updated existing vouch with fresh message');

        } catch (error) {
          console.error('Error creating fresh vouch message:', error);
          const msg = await ctx.reply('Sorry, something went wrong while updating the vouch. Please try again in a bit.');
          setTimeout(async () => {
            try {
              await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
            } catch (e) {
              console.error('Failed to delete error message:', e);
            }
          }, 5000);
        }

        // Delete the user's command message
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, userMessageId);
        } catch (error) {
          console.error('Failed to delete user command message:', error);
        }

        return;
      } else {
        // For DMs: keep existing behavior (will be handled by the multi-step process)
        try {
          await ctx.sendMessage('Vouch already exists', {
            reply_parameters: {
              message_id: Number(existingVote.messageId),
              chat_id: Number(existingVote.chatId)
            }
          });
        } catch (error) {
          // If we can't reply to the original message, just send a new message
          await ctx.reply(`A vouch for @${username} already exists, but I couldn't find the original message.`);
        }
        return;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, something went wrong.');
  }
  
  try {
    console.log(`[Image Fetch] Starting image fetch for @${username}`);
    const imageUrl = await getProfileImage(username);

    const currentUser = ctx.from.username || ctx.from.id.toString();
    
    const message = await ctx.replyWithPhoto(imageUrl, {
      caption: formatVoteMessage(
        username.trim(), 
        1, 
        0, 
        [currentUser], 
        'pending', 
        description?.trim() ?? ''
      ),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: `✅ (1)`, callback_data: '/vote_up' },
          { text: `❌ (0)`, callback_data: '/vote_down' }
        ]]
      }
    });

    await prisma.vote.create({
      data: {
        twitterUsername: username.trim(),
        messageId: BigInt(message.message_id),
        chatId: BigInt(ctx.chat.id),
        voucherUsernames: [currentUser],
        upvoterUsernames: [currentUser],
        downvoterUsernames: [],
        createdBy: currentUser,
        status: 'pending',
        description: description?.trim()
      }
    });

  } catch (error) {
    console.error('Error creating vouch:', error);

    const msg = await ctx.reply('Sorry, something went wrong. Please try again in a bit.');
    setTimeout(async () => {
      await ctx.telegram.deleteMessage(userChatId, msg.message_id);
    }, 5000);
  }
  
  // Delete the user's message and leave only the vouch
  try {
    await ctx.telegram.deleteMessage(userChatId, userMessageId);
  } catch (error) {
    console.error('Failed to delete user message:', error);
  }
});