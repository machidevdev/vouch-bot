import { Composer } from "telegraf";
import { message } from "telegraf/filters";
import { prisma } from "../utils";

export const removeCommand = Composer.on(message('text'), async (ctx) => {
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