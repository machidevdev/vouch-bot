import { Composer } from "telegraf";
import { prisma } from "../utils";
import { formatVoteMessage } from "../utils";
import fetch from 'node-fetch';

const FALLBACK_IMAGE = 'https://res.cloudinary.com/dqhw3jubx/image/upload/v1740100690/photo_2025-02-21_02-18-00_mbnnj9.jpg';

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
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?x\.com\/([^\/\s\?]+)/;
  const urlMatch = parts[1].match(twitterUrlRegex);
  console.log("Fetching username from URL:", urlMatch);
  if (urlMatch) {
    username = urlMatch[1].split('?')[0];
    description = parts.slice(2).join(' ') || null;
  } else {
    // Check for username format (with @)
    const usernameMatch = parts[1].match(/@?(\w+)/);
    if (usernameMatch) {
      username = usernameMatch[1].split('?')[0];
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
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, something went wrong.');
  }
  
  try {
    console.log(`[Image Fetch] Fetching profile image for @${username}`);
    
    let imageUrl: string;
    try {
      const response = await fetch(`https://unavatar.io/twitter/${username}?json`);
      const data = await response.json() as { url: string };
      
      imageUrl = data.url.includes('fallback.png') ? FALLBACK_IMAGE : data.url;
      console.log(`[Image Fetch] Got image URL: ${imageUrl}`);
    } catch (error) {
      console.error(`[Image Fetch] Error: ${error}`);
      imageUrl = FALLBACK_IMAGE;
    }

    const message = await ctx.replyWithPhoto(imageUrl, {
      caption: formatVoteMessage(
        username.trim(), 
        1, 
        0, 
        ctx.from.username || ctx.from.id.toString(), 
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
        upvoterUsernames: [ctx.from.username || ctx.from.id.toString()],
        downvoterUsernames: [],
        createdBy: ctx.from.username || ctx.from.id.toString(),
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