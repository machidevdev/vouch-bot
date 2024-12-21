import { PrismaClient } from '@prisma/client';
import { Telegraf } from 'telegraf';
import { config } from '../src/config/env';
import { formatVoteMessage } from '../src/utils';

process.env.APP_ENV = process.env.APP_ENV || 'staging';

const prisma = new PrismaClient();
const bot = new Telegraf(config.botToken);

async function updateStatuses(requiredUpvotes: number, requiredDownvotes: number, daysAgo: number) {
  try {
    // Calculate the date from X days ago
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - daysAgo);

    // Get votes within date range
    const votes = await prisma.vote.findMany({
      where: {
        createdAt: {
          gte: dateFilter
        }
      }
    });
    
    console.log(`Found ${votes.length} votes in the last ${daysAgo} days`);

    for (const vote of votes) {
      // Determine new status
      let newStatus = 'pending';
      if (vote.upvoterUsernames.length >= requiredUpvotes) {
        newStatus = 'accepted';
      } else if (vote.downvoterUsernames.length >= requiredDownvotes) {
        newStatus = 'rejected';
      }

      // Only update if status changed
      if (newStatus !== vote.status) {
        // Update database
        await prisma.vote.update({
          where: { id: vote.id },
          data: { status: newStatus }
        });

        // Update Telegram message
        try {
          await bot.telegram.editMessageCaption(
            Number(vote.chatId),
            Number(vote.messageId),
            undefined,
            formatVoteMessage(
              vote.twitterUsername,
              vote.upvoterUsernames.length,
              vote.downvoterUsernames.length,
              vote.createdBy,
              newStatus,
              vote.description ?? ''
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
          console.log(`Updated message for ${vote.twitterUsername}: ${newStatus}`);
        } catch (error) {
          console.error(`Failed to update message for ${vote.twitterUsername}:`, error);
        }
      }
    }

    console.log('Status update completed');
  } catch (error) {
    console.error('Error updating statuses:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Get parameters from command line
const upvotes = parseInt(process.argv[2]);
const downvotes = parseInt(process.argv[3]);
const days = parseInt(process.argv[4]);

if (isNaN(upvotes) || isNaN(downvotes) || isNaN(days)) {
  console.error('Please provide valid numbers for upvotes, downvotes, and days');
  console.log('Usage: ts-node updateStatuses.ts <upvotes> <downvotes> <days>');
  process.exit(1);
}

updateStatuses(upvotes, downvotes, days); 