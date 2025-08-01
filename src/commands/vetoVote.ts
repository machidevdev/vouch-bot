import { Composer, Context } from "telegraf";
import { formatVetoMessage, prisma } from "../utils";

export const vetoVoteCommand = Composer.action(/^\/veto_(up|down)$/, async (ctx) => {
  console.log('vetoVoteCommand', ctx.callbackQuery);

  if (!ctx.callbackQuery.message) {
    await ctx.answerCbQuery('Veto not found');
    console.error('Veto not found', ctx.callbackQuery.from.username, ctx.callbackQuery.message)
    return;
  }

  const messageId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.callbackQuery.message.chat.id;
  const voterUsername = ctx.from.username!;
  const isUpvote = ctx.match[1] === 'up';

  try {
    const veto = await prisma.feedback.findUnique({
      where: {
        messageId_chatId: {
          messageId: BigInt(messageId),
          chatId: BigInt(chatId)
        }
      }
    });

    if (!veto) {
      await ctx.answerCbQuery('Veto not found');
      console.error('Veto not found', voterUsername, messageId)
      return;
    }

    // Calculate new voter lists
    const hasUpvoted = veto.upvoterUsernames.includes(voterUsername);
    const hasDownvoted = veto.downvoterUsernames.includes(voterUsername);

    let newUpvoters = [...veto.upvoterUsernames];
    let newDownvoters = [...veto.downvoterUsernames];

    if (isUpvote) {
      if (hasUpvoted) {
        newUpvoters = newUpvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery('Support removed!');
      } else {
        newUpvoters.push(voterUsername);
        newDownvoters = newDownvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery(hasDownvoted ? 'Vote changed!' : 'Support recorded!');
      }
    } else {
      if (hasDownvoted) {
        newDownvoters = newDownvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery('Disagreement removed!');
      } else {
        newDownvoters.push(voterUsername);
        newUpvoters = newUpvoters.filter(u => u !== voterUsername);
        await ctx.answerCbQuery(hasUpvoted ? 'Vote changed!' : 'Disagreement recorded!');
      }
    }

    // Update database with new votes
    const updatedVeto = await prisma.feedback.update({
      where: { id: veto.id },
      data: {
        upvoterUsernames: newUpvoters,
        downvoterUsernames: newDownvoters,
      }
    });

    // Update message with new vote counts
    await ctx.editMessageCaption(
      formatVetoMessage(
        updatedVeto.targetUsername,
        newUpvoters.length,
        newDownvoters.length,
        updatedVeto.feedback,
        updatedVeto.feedback.length
      ),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ Agree (${newUpvoters.length})`, callback_data: '/veto_up' },
              { text: `❌ Disagree (${newDownvoters.length})`, callback_data: '/veto_down' }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    await ctx.answerCbQuery('Error recording vote');
  }
});