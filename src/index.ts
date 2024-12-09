import { Context, Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { loggerMiddleware } from './middleware/logger';
import { MyContext } from './types';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize your bot
const prisma = new PrismaClient();
const bot = new Telegraf<MyContext>(process.env.BOT_TOKEN!);

// Register the logger middleware
bot.use(loggerMiddleware);


bot.telegram.setMyCommands([
  { command: 'vouch', description: 'Vouch for a user, using a Twitter username (@milady) or URL (https://x.com/milady)' },
]); 

// Command handlers
bot.command('start', async (ctx) => {
  await ctx.reply('Welcome! Bot is running.');
});

bot.command('help', async (ctx) => {
  await ctx.reply('How can I help you?');
});


// Add this function to format vote messages
function formatVoteMessage(twitterUsername: string, upvotes: number, downvotes: number): string {
  let status = '';
  
  if (upvotes >= 5) {
    status = '\n\n✅ <b>Status: ACCEPTED</b>\nThis user has been vouched for by the community.';
  } else if (downvotes >= 3) {
    status = '\n\n❌ <b>Status: REJECTED</b>\nThis user has been rejected by the community.';
  } else {
    const votesNeeded = 5 - upvotes;
    status = `\n\n⏳ <b>Status: PENDING</b>\n${votesNeeded} more IN votes needed for acceptance.`;
  }

  return `
Voting for: <a href="https://x.com/${twitterUsername}">@${twitterUsername}</a>

<b>Current votes:</b>
IN: <b>${upvotes}</b>
OUT: <b>${downvotes}</b>${status}`;
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

  try {
    const existingVote = await prisma.vote.findFirst({
      where: {
        twitterUsername: username
      }
    });

    if (existingVote) {
      await ctx.reply(`Vouch already exists.`);
      return;
    }
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, something went wrong.');
  }
  
  try {
    const profileImageUrl = `https://unavatar.io/twitter/${username}`;
    
    const message = await ctx.replyWithPhoto(profileImageUrl, {
      caption: formatVoteMessage(username, 0, 0),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'In (0)', callback_data: 'vote_up' },
            { text: 'Out (0)', callback_data: 'vote_down' }
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
        downvoterUsernames: []
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

    // Handle vote
    const updateData = isUpvote
      ? {
          upvoterUsernames: [...vote.upvoterUsernames, voterUsername],
          downvoterUsernames: vote.downvoterUsernames.filter(username => username !== voterUsername)
        }
      : {
          downvoterUsernames: [...vote.downvoterUsernames, voterUsername],
          upvoterUsernames: vote.upvoterUsernames.filter(username => username !== voterUsername)
        };

    await prisma.vote.update({
      where: { id: vote.id },
      data: updateData
    });

    // Update message with new vote counts
    await updateVoteMessage(ctx, vote.id);
    await ctx.answerCbQuery('Vote recorded!');

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
      vote.downvoterUsernames.length
    ),
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `In (${vote.upvoterUsernames.length})`, callback_data: 'vote_up' },
            { text: `Out (${vote.downvoterUsernames.length})`, callback_data: 'vote_down' }
          ]
        ]
      }
    }
  );
}



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