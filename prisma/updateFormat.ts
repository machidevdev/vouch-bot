import { PrismaClient } from '@prisma/client';
import { Telegraf } from 'telegraf';
import { config } from '../src/config/env';
import { formatVoteMessage } from '../src/utils';

process.env.APP_ENV = process.env.APP_ENV || 'staging';

const prisma = new PrismaClient();
const bot = new Telegraf(config.botToken);

async function updateMessageFormats() {
  try {
    // Get all votes
    const votes = await prisma.vote.findMany();
    console.log(`Found ${votes.length} votes to update`);

    for (const vote of votes) {
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
            vote.status,
            vote.description ?? ''
          ),
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: `✅ (${vote.upvoterUsernames.length})`, callback_data: '/vote_up' },
                  { text: `❌ (${vote.downvoterUsernames.length})`, callback_data: '/vote_down' }
                ]
              ]
            }
          }
        );
        console.log(`Updated format for ${vote.twitterUsername}`);
      } catch (error) {
        console.error(`Failed to update message for ${vote.twitterUsername}:`, error);
      }

      // Add a small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Format update completed');
  } catch (error) {
    console.error('Error updating formats:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

updateMessageFormats(); 