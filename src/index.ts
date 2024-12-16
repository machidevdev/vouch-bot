import { Context, Telegraf, } from 'telegraf';
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


// Add these at the top with other global variables
interface VoteThresholds {
  requiredUpvotes: number;
  maxDownvotes: number;
}

let currentThresholds: VoteThresholds = {
  requiredUpvotes: 20,
  maxDownvotes: 3
};

bot.telegram.setMyCommands([
  { command: 'vouch', description: 'Vouch for a user, using a Twitter username (@milady) or URL (https://x.com/milady)' },
]); 

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

// Add this helper function for delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add this helper function for retrying failed operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed, retrying in ${delayMs}ms...`);
      lastError = error;
      await delay(delayMs);
    }
  }
  
  console.error('All retries failed:', lastError);  
  throw lastError;
}

bot.command('update', async (ctx) => {
  console.log('Updating thresholds');
  const args = ctx.message.text.split(' ');
  if (args.length !== 4) {
    await ctx.reply('Usage: /update <requiredUpvotes> <maxDownvotes> <daysToLookBack>');
    return;
  }

  const requiredUpvotes = parseInt(args[1]);
  const maxDownvotes = parseInt(args[2]);
  const daysToLookBack = parseInt(args[3]);

  if (isNaN(requiredUpvotes) || isNaN(maxDownvotes) || isNaN(daysToLookBack)) {
    await ctx.reply('Please provide valid numbers');
    return;
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToLookBack);

    const votes = await prisma.vote.findMany({
      where: {
        createdAt: {
          gte: cutoffDate
        }
      }
    });
    
    console.log(`Found ${votes.length} votes in the last ${daysToLookBack} days`);
    let updatedCount = 0;
    let failedCount = 0;

    // Update each vote's status and message with delay
    for (const vote of votes) {
      console.log('Updating vote:', vote.id);
      try {
        let newStatus = 'pending';
        if (vote.upvoterUsernames.length >= requiredUpvotes) {
          newStatus = 'approved';
        } else if (vote.downvoterUsernames.length >= maxDownvotes) {
          newStatus = 'rejected';
        }

        // Update status in database
        await prisma.vote.update({
          where: { id: vote.id },
          data: { status: newStatus }
        });

        // Update message with retry logic
        await retryOperation(async () => {
          await ctx.telegram.editMessageCaption(
            vote.chatId.toString(),
            Number(vote.messageId),
            undefined,
            formatVoteMessage(
              vote.twitterUsername,
              vote.upvoterUsernames.length,
              vote.downvoterUsernames.length,
              vote.createdBy,
              newStatus
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
        }, 3, 3000); // 3 retries, 3 second delay between retries

        updatedCount++;
        await delay(3000); // Wait 3 seconds between updates
      } catch (error) {
        console.error(`Failed to update message for vote ID ${vote.id} after retries:`, error);
        failedCount++;
      }
    }

    await ctx.reply(
      `Update complete:\n` +
      `✅ Successfully updated: ${updatedCount}\n` +
      `❌ Failed to update: ${failedCount}\n` +
      `Settings:\n` +
      `Required upvotes: ${requiredUpvotes}\n` +
      `Max downvotes: ${maxDownvotes}`
    );
  } catch (error) {
    console.error('Error updating messages:', error);
    await ctx.reply('Error updating messages');
  }
});

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

// Add this command to update thresholds and refresh messages


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