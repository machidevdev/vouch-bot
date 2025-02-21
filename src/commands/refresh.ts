import { Composer } from "telegraf";
import { prisma } from "../utils";
import { formatVoteMessage } from "../utils";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

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

    // Delete the existing message and database entry
    try {
      await ctx.telegram.deleteMessage(userChatId, Number(existingVote.messageId));
      await prisma.vote.delete({
        where: {
          id: existingVote.id
        }
      });
    } catch (error) {
      console.error('Error deleting existing vote:', error);
    }

    // Fetch new profile image
    console.log(`[Image Fetch] Fetching profile image for @${twitterUsername} via puppeteer`);
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.goto(`https://twitter.com/${twitterUsername}`);
    
    let imageUrl: string;
    try {
      await page.waitForSelector('img', { timeout: 20000 });
      const images = await page.$$eval('img', imgs => imgs.map(img => img.src));
      const profileImage = images.find(src => src.includes('_400x400'));
      
      if (!profileImage) throw new Error('Could not find profile image');
      imageUrl = profileImage;
    } catch (error) {
      console.log(`[Image Fetch] Failed to get profile image, using placeholder`);
      imageUrl = 'https://res.cloudinary.com/dqhw3jubx/image/upload/v1740100690/photo_2025-02-21_02-18-00_mbnnj9.jpg';
    }
    
    console.log(`[Image Fetch] Successfully got image for @${twitterUsername}: ${imageUrl}`);
    await browser.close();

    // Create new message with existing data
    const message = await ctx.replyWithPhoto(imageUrl, {
      caption: formatVoteMessage(
        twitterUsername,
        upvoterUsernames.length,
        downvoterUsernames.length,
        ctx.from.username || ctx.from.id.toString(),
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
        createdBy: ctx.from.username || ctx.from.id.toString(),
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
