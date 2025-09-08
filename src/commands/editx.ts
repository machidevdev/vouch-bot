import { Composer } from "telegraf";
import { prisma, getProfileImage } from "../utils";
import { formatVoteMessage } from "../utils";

export const editxCommand = Composer.command('editx', async (ctx, next) => {
  const userMessageId = ctx.message.message_id;
  const userChatId = ctx.chat.id;
  const userId = ctx.from.id;
  
  // Get the message that was replied to
  const repliedMessage = ctx.message.reply_to_message;
  if (!repliedMessage) {
    const msg = await ctx.reply('Please reply to the vouch message you want to edit.');
    setTimeout(async () => {
      await ctx.telegram.deleteMessage(userChatId, msg.message_id);
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    }, 5000);
    return;
  }

  // Parse the new username from the command
  const messageText = ctx.message.text;
  let newUsername: string | null = null;

  const parts = messageText.split(/\s+/);
  if (parts.length < 2) {
    const msg = await ctx.reply('Please provide a new Twitter username\nExample: /editx @newusername or /editx https://x.com/newusername');
    setTimeout(async () => {
      await ctx.telegram.deleteMessage(userChatId, msg.message_id);
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    }, 5000);
    return;
  }

  // Check for Twitter URL
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?x\.com\/([^\/\s\?]+)/;
  const urlMatch = parts[1].match(twitterUrlRegex);
  if (urlMatch) {
    newUsername = urlMatch[1];
  } else {
    // Check for username format (with @), preserving underscores
    const usernameMatch = parts[1].match(/@?([a-zA-Z0-9_]+)/);
    if (usernameMatch) {
      newUsername = usernameMatch[1];
    }
  }

  if (!newUsername) {
    const msg = await ctx.reply('Please provide a valid Twitter username or URL');
    setTimeout(async () => {
      await ctx.telegram.deleteMessage(userChatId, msg.message_id);
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    }, 5000);
    return;
  }

  try {
    // Find the vote in the database
    const existingVote = await prisma.vote.findFirst({
      where: {
        messageId: BigInt(repliedMessage.message_id),
        chatId: BigInt(userChatId)
      }
    });

    if (!existingVote) {
      const msg = await ctx.reply('Could not find this vouch in the database.');
      setTimeout(async () => {
        await ctx.telegram.deleteMessage(userChatId, msg.message_id);
        await ctx.telegram.deleteMessage(userChatId, userMessageId);
      }, 5000);
      return;
    }

    // Check if the user is the original creator or has the special user ID
    if (userId !== 6179266599) {
      return;
    }

    // Check if a vouch for the new username already exists
    const existingNewVouch = await prisma.vote.findFirst({
      where: {
        twitterUsername: newUsername
      }
    });

    if (existingNewVouch) {
      try {
        await ctx.sendMessage('A vouch for this username already exists', {
          reply_parameters: {
            message_id: Number(existingNewVouch.messageId),
            chat_id: Number(existingNewVouch.chatId)
          }
        });
      } catch (error) {
        await ctx.reply(`A vouch for @${newUsername} already exists, but I couldn't find the original message.`);
      }
      return;
    }

    // Fetch new profile image
    console.log(`[Image Fetch] Starting image fetch for @${newUsername}`);
    const imageUrl = await getProfileImage(newUsername);

    // Create new message with updated username but keeping all other data
    const message = await ctx.replyWithPhoto(imageUrl, {
      caption: formatVoteMessage(
        newUsername,
        existingVote.upvoterUsernames.length,
        existingVote.downvoterUsernames.length,
        existingVote.voucherUsernames || [existingVote.createdBy],
        existingVote.status,
        existingVote.description || ''
      ),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: `✅ (${existingVote.upvoterUsernames.length})`, callback_data: '/vote_up' },
          { text: `❌ (${existingVote.downvoterUsernames.length})`, callback_data: '/vote_down' }
        ]]
      }
    });

    // Delete old message
    try {
      await ctx.telegram.deleteMessage(userChatId, repliedMessage.message_id);
    } catch (error) {
      console.error('Failed to delete old message:', error);
    }

    // Update database entry
    await prisma.vote.update({
      where: {
        id: existingVote.id
      },
      data: {
        twitterUsername: newUsername,
        messageId: BigInt(message.message_id)
      }
    });

    // Delete the command message
    try {
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    } catch (error) {
      console.error('Failed to delete command message:', error);
    }

  } catch (error) {
    console.error('Error editing vouch:', error);
    const msg = await ctx.reply('Sorry, something went wrong. Please try again in a bit.');
    setTimeout(async () => {
      await ctx.telegram.deleteMessage(userChatId, msg.message_id);
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    }, 5000);
  }

  await next();
});
