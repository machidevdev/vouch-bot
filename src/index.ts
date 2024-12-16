import { Context, Telegraf, } from 'telegraf';
import * as dotenv from 'dotenv';
import { loggerMiddleware } from './middleware/logger';
import { authMiddleware } from './middleware/auth';
import { MyContext } from './types';
import { PrismaClient } from '@prisma/client';
// Load environment variables
dotenv.config();

// Initialize your bot
const prisma = new PrismaClient();
const bot = new Telegraf(process.env.BOT_TOKEN!);

// Register middlewares
bot.use(loggerMiddleware);
bot.use(authMiddleware());

// Command handlers
bot.command('start', async (ctx) => {
  await ctx.reply('Welcome! Bot is running.');
});

// Add this function to format vote messages
function formatVoteMessage(twitterUsername: string, upvotes: number, downvotes: number, createdBy: string, status: string): string {
  let statusMessage = '';
  
  switch (status) {
    case 'approved':
      statusMessage = '\n\n✅ <b>Status: ACCEPTED</b>\nThis user has been vouched for by the community.';
      break;
    case 'rejected':
      statusMessage = '\n\n❌ <b>Status: REJECTED</b>\nThis user has been rejected by the community.';
      break;
    default:
      statusMessage = `\n\n⏳ <b>Status: PENDING</b>`;
  }

  return `
Voting for: <a href="https://x.com/${twitterUsername}">@${twitterUsername}</a>
Vouched by: @${createdBy}

<b>Current votes:</b>
✅: <b>${upvotes}</b>
❌: <b>${downvotes}</b>${statusMessage}`;
}

bot.command('vouch', async (ctx) => {
  const messageText = ctx.message.text;
  let username: string | null = null;
  // Check for Twitter URL (with or without https://)
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?x\.com\/([^\/\s]+)/;
  const urlMatch = messageText.match(twitterUrlRegex);
  
  if (urlMatch) {
    username = urlMatch[1];
  } else {
    // Check for username format (with @)
    const usernameMatch = messageText.match(/@(\w+)/);
    if (usernameMatch) {
      username = usernameMatch[1];
    }
  }
  if (!username) {
    await ctx.reply('Please provide a valid Twitter username or URL\nExample: /vouch @username or /vouch https://x.com/username');
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
      caption: formatVoteMessage(username, 0, 0, ctx.from.username || ctx.from.id.toString(), 'pending'),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ (0)', callback_data: 'vote_up' },
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
        upvoterUsernames: [],
        downvoterUsernames: [],
        createdBy: ctx.from.username || ctx.from.id.toString(),
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, something went wrong.');
  }
});

bot.action(/vote_(up|down)/, async (ctx) => {
  if (!ctx.callbackQuery.message) return;
  
  const messageId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.callbackQuery.message.chat.id;
  const voterUsername = ctx.from.username;
  
  if (!voterUsername) {
    await ctx.answerCbQuery('You need a Telegram username to vote!');
    return;
  }

  const isUpvote = ctx.match[1] === 'up';

  try {
    const vote = await prisma.vote.findUnique({
      where: {
        messageId_chatId: {
          messageId: BigInt(messageId),
          chatId: BigInt(chatId)
        }
      }
    });

    if (!vote) {
      await ctx.answerCbQuery('Vote not found');
      return;
    }

    // Check if user has already voted
    const hasUpvoted = vote.upvoterUsernames.includes(voterUsername);
    const hasDownvoted = vote.downvoterUsernames.includes(voterUsername);

    // Handle vote toggle and changes
    let updateData;
    if (isUpvote && hasUpvoted) {
      // Remove upvote
      updateData = {
        upvoterUsernames: vote.upvoterUsernames.filter(username => username !== voterUsername)
      };
      await ctx.answerCbQuery('Upvote removed!');
    } else if (!isUpvote && hasDownvoted) {
      // Remove downvote
      updateData = {
        downvoterUsernames: vote.downvoterUsernames.filter(username => username !== voterUsername)
      };
      await ctx.answerCbQuery('Downvote removed!');
    } else {
      // Add new vote and remove opposite if exists
      updateData = isUpvote
        ? {
            upvoterUsernames: [...vote.upvoterUsernames, voterUsername],
            downvoterUsernames: vote.downvoterUsernames.filter(username => username !== voterUsername)
          }
        : {
            downvoterUsernames: [...vote.downvoterUsernames, voterUsername],
            upvoterUsernames: vote.upvoterUsernames.filter(username => username !== voterUsername)
          };
      await ctx.answerCbQuery(hasUpvoted || hasDownvoted ? 'Vote changed!' : 'Vote recorded!');
    }

    await prisma.vote.update({
      where: { id: vote.id },
      data: updateData
    });

    // Update message with new vote counts
    await updateVoteMessage(ctx, vote.id);

  } catch (error) {
    console.error('Error:', error);
    await ctx.answerCbQuery('Error recording vote');
  }
});

async function updateVoteMessage(ctx: Context, voteId: number) {
  const vote = await prisma.vote.findUnique({
    where: { id: voteId }
  });

  if (!vote || !ctx.callbackQuery?.message) return;

  await ctx.editMessageCaption(
    formatVoteMessage(
      vote.twitterUsername,
      vote.upvoterUsernames.length,
      vote.downvoterUsernames.length,
      vote.createdBy,
      vote.status
    ),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `✅ (${vote.upvoterUsernames.length})`, callback_data: 'vote_up' },
            { text: `❌ (${vote.downvoterUsernames.length})`, callback_data: 'vote_down' }
          ]
        ]
      }
    }
  );
}



// Add this after your other command handlers
bot.on('text', async (ctx) => {
  // Check if message is 'x' or 'X' and is a reply to another message
  if (!/^[xX]$/.test(ctx.message.text) || !ctx.message.reply_to_message) {
    return;
  }

  const repliedMessage = ctx.message.reply_to_message;
  
  try {
    // Find the vote associated with this message
    const vote = await prisma.vote.findUnique({
      where: {
        messageId_chatId: {
          messageId: BigInt(repliedMessage.message_id),
          chatId: BigInt(ctx.chat.id)
        }
      }
    });

    if (!vote) {
      return; // Silently ignore if not a vote message
    }

    // Check if the user who sent 'x' is the one who created the vote
    const senderUsername = ctx.from.username || ctx.from.id.toString();
    if (vote.createdBy !== senderUsername) {
      return;
    }

    // Delete the vote from database
    await prisma.vote.delete({
      where: { id: vote.id }
    });

    // Delete the bot's vote message
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, repliedMessage.message_id);
    } catch (error) {
      console.error('Could not delete vote message:', error);
    }

    // Delete the 'x' message
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
    } catch (error) {
      console.error('Could not delete X message:', error);
    }

  } catch (error) {
    console.error('Error handling vote deletion:', error);
  }
});



// Start bot
bot.launch()
  .then(() => {
    console.log('Bot is running!');
  })
  .catch((err) => {
    console.error('Bot launch failed:', err);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 