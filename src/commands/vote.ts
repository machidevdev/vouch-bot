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