import { Composer } from "telegraf";
import { prisma } from "../utils";
import { formatVoteMessage } from "../utils";



export const vouchCommand = Composer.command('vouch', async (ctx) => {
  const userMessageId = ctx.message.message_id;
  const userChatId = ctx.chat.id;
  
  const messageText = ctx.message.text;
  let username: string | null = null;
  let description: string | null = null;

  const parts = messageText.split(/\s+/);
  if (parts.length < 2) {
    await ctx.reply('Please provide a valid Twitter username or URL\nExample: /vouch @username [description] or /vouch https://x.com/username [description]');
    return;
  }

  // Check for Twitter URL
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?x\.com\/([^\/\s]+)/;
  const urlMatch = parts[1].match(twitterUrlRegex);
  
  if (urlMatch) {
    username = urlMatch[1];
    description = parts.slice(2).join(' ') || null;
  } else {
    // Check for username format (with @)
    const usernameMatch = parts[1].match(/@?(\w+)/);
    if (usernameMatch) {
      username = usernameMatch[1];
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
        twitterUsername: username
      }
    });

    if (existingVote) {
      // Forward existing vote message
      ctx.sendMessage('Vouch already exists', {
        reply_parameters: {
          message_id: Number(existingVote.messageId),
          chat_id: Number(existingVote.chatId)
        }
      })
      return;
    }
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, something went wrong.');
  }
  
  try {
    const profileImageUrl = `https://unavatar.io/twitter/${username}`;
    
    const message = await ctx.replyWithPhoto(profileImageUrl, {
      caption: formatVoteMessage(username, 1, 0, ctx.from.username || ctx.from.id.toString(), 'pending', description ?? ''),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ (1)', callback_data: 'vote_up' },
            { text: '❌ (0)', callback_data: 'vote_down' }
          ]
        ]
      }
    });

    await prisma.vote.create({
      data: {
        twitterUsername: username,
        messageId: BigInt(message.message_id),
        chatId: BigInt(ctx.chat.id),
        upvoterUsernames: [ctx.from.username || ctx.from.id.toString()],
        downvoterUsernames: [],
        createdBy: ctx.from.username || ctx.from.id.toString(),
        status: 'pending',
        description: description
      }
    });

  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, something went wrong.');
  }
  //delete the users message and leave only the vouch
  await ctx.telegram.deleteMessage(userChatId, userMessageId);

});