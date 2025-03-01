import { Composer } from "telegraf";
import { prisma, getProfileImage } from "../utils";
import { formatVoteMessage } from "../utils";

export const refreshCommand = Composer.command('up', async (ctx) => {
  const userMessageId = ctx.message.message_id;
  const userChatId = ctx.chat.id;
  const userId = ctx.from.id;
  
  // Get the message that was replied to
  const repliedMessage = ctx.message.reply_to_message;
  if (!repliedMessage) {
    const msg = await ctx.reply('Please reply to the vouch message you want to refresh.');
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
    if (existingVote.createdBy !== (ctx.from.username || ctx.from.id.toString()) && userId !== 6179266599) {
      const msg = await ctx.reply('You can only refresh vouches that you created.');
      setTimeout(async () => {
        await ctx.telegram.deleteMessage(userChatId, msg.message_id);
        await ctx.telegram.deleteMessage(userChatId, userMessageId);
      }, 5000);
      return;
    }

    // Save the existing vote data
    const {
      twitterUsername,
      upvoterUsernames,
      downvoterUsernames,
      status,
      description
    } = existingVote;

    // First find all existing votes for this Twitter username
    const existingVotes = await prisma.vote.findMany({
      where: {
        twitterUsername: twitterUsername
      }
    });

    // Delete all associated messages first
    for (const vote of existingVotes) {
      try {
        await ctx.telegram.deleteMessage(Number(vote.chatId), Number(vote.messageId));
      } catch (error) {
        console.error(`Failed to delete message for vote ${vote.id}:`, error);
      }
    }

    // Then delete all votes from the database
    await prisma.vote.deleteMany({
      where: {
        twitterUsername: twitterUsername
      }
    });

    // Fetch profile image using the utility function
    console.log(`[Image Fetch] Starting image fetch for @${twitterUsername}`);
    const imageUrl = await getProfileImage(twitterUsername);

    // Create new message with existing data
    const message = await ctx.replyWithPhoto(imageUrl, {
      caption: formatVoteMessage(
        twitterUsername,
        upvoterUsernames.length,
        downvoterUsernames.length,
        existingVote.createdBy,
        status,
        description || ''
      ),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: `✅ (${upvoterUsernames.length})`, callback_data: '/vote_up' },
          { text: `❌ (${downvoterUsernames.length})`, callback_data: '/vote_down' }
        ]]
      }
    });

    // Create new database entry with existing data
    await prisma.vote.create({
      data: {
        twitterUsername,
        messageId: BigInt(message.message_id),
        chatId: BigInt(userChatId),
        upvoterUsernames,
        downvoterUsernames,
        createdBy: existingVote.createdBy,
        status,
        description
      }
    });

    // Delete the refresh command message
    try {
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    } catch (error) {
      console.error('Failed to delete user message:', error);
    }

  } catch (error) {
    console.error('Error refreshing vouch:', error);
    const msg = await ctx.reply('Sorry, something went wrong. Please try again in a bit.');
    setTimeout(async () => {
      await ctx.telegram.deleteMessage(userChatId, msg.message_id);
      await ctx.telegram.deleteMessage(userChatId, userMessageId);
    }, 5000);
  }
});
