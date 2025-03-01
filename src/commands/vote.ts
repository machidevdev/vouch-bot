import { Composer, Context } from "telegraf";
import { formatVoteMessage, prisma } from "../utils";





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
}



export const voteCommand = Composer.action(/^\/vote_(up|down)$/, async (ctx) => {
  console.log('voteCommand', ctx.callbackQuery);
  
  if (!ctx.callbackQuery.message) return;

  const messageId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.callbackQuery.message.chat.id;
  const voterUsername = ctx.from.username!;
  const isUpvote = ctx.match[1] === 'up';

  try {
    // Get current settings first
    const settings = await prisma.settings.findFirst({
      orderBy: { updatedAt: 'desc' }
    }) || { requiredUpvotes: 15, requiredDownvotes: 3 };

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
      await ctx.telegram.sendMessage(6179266599, 'Upvote not complete, ' + voterUsername + ' ' + messageId)
      return;
    }

    // Calculate new voter lists
    const hasUpvoted = vote.upvoterUsernames.includes(voterUsername);
    const hasDownvoted = vote.downvoterUsernames.includes(voterUsername);

    let newUpvoters = [...vote.upvoterUsernames];
    let newDownvoters = [...vote.downvoterUsernames];

    if (isUpvote) {
      if (hasUpvoted) {
        newUpvoters = newUpvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery('Upvote removed!');
      } else {
        newUpvoters.push(voterUsername);
        newDownvoters = newDownvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery(hasDownvoted ? 'Vote changed!' : 'Vote recorded!');
      }
    } else {
      if (hasDownvoted) {
        newDownvoters = newDownvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery('Downvote removed!');
      } else {
        newDownvoters.push(voterUsername);
        newUpvoters = newUpvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery(hasUpvoted ? 'Vote changed!' : 'Vote recorded!');
      }
    }

    // Determine new status based on vote counts and settings
    let newStatus = 'pending';
    if (newUpvoters.length >= settings.requiredUpvotes) {
      newStatus = 'approved';
    } else if (newDownvoters.length >= settings.requiredDownvotes) {
      newStatus = 'rejected';
    }

    // Update database with new votes and status
    const updatedVote = await prisma.vote.update({
      where: { id: vote.id },
      data: {
        upvoterUsernames: newUpvoters,
        downvoterUsernames: newDownvoters,
        status: newStatus
      }
    });

    // Update message with new vote counts and status
    await ctx.editMessageCaption(
      formatVoteMessage(
        updatedVote.twitterUsername,
        newUpvoters.length,
        newDownvoters.length,
        updatedVote.createdBy,
        newStatus,
        updatedVote.description ?? ''
      ),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ (${newUpvoters.length})`, callback_data: '/vote_up' },
              { text: `❌ (${newDownvoters.length})`, callback_data: '/vote_down' }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    await ctx.telegram.sendMessage(6179266599, 'Error recording vote ' + error)
    await ctx.answerCbQuery('Error recording vote');
  }
});