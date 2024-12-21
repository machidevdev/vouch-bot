import { adminComposer } from "../composers/adminComposer";
import { Context, deunionize } from "telegraf";
import { prisma } from "../utils";
import { formatVoteMessage } from "../utils";
import { Queue } from "../queue";

// Create a dedicated queue for update operations
const updateQueue = new Queue();

// Helper function to send temporary messages
async function sendTemporaryMessage(ctx: Context, text: string, deleteAfter: number = 10000) {
  const chat = deunionize(ctx.chat);
  if (!chat) return null;
  const message = await ctx.reply(text);
  setTimeout(async () => {
    try {
      await ctx.telegram.deleteMessage(chat.id, message.message_id);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, deleteAfter);
  return message;
}

adminComposer.command('update', async (ctx) => {
  const statusMessages: number[] = [];  // Track message IDs
  const chat = deunionize(ctx.chat);
  if (!chat) return;

  // Helper to delete all status messages
  const cleanupMessages = async () => {
    for (const messageId of statusMessages) {
      try {
        await ctx.telegram.deleteMessage(chat.id, messageId);
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
    statusMessages.length = 0;
  };

  // Modified to just track messages without auto-deletion
  const trackMessage = async (text: string) => {
    const message = await ctx.reply(text);
    statusMessages.push(message.message_id);
    return message;
  };

  const args = ctx.message.text.split(' ').slice(1);
  const [upvotes, downvotes, days] = args.map(Number);

  if (args.length !== 3 || isNaN(upvotes) || isNaN(downvotes) || isNaN(days)) {
    await trackMessage('Usage: /update <required_upvotes> <required_downvotes> <days_to_look_back>');
    setTimeout(() => cleanupMessages(), 10000);
    return;
  }

  const statusMessage = await trackMessage('Starting update process...');
  if (!statusMessage) return;

  updateQueue.add(async () => {
    try {
      // Update settings first
      await prisma.settings.create({
        data: {
          requiredUpvotes: upvotes,
          requiredDownvotes: downvotes
        }
      });

      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);

      const votes = await prisma.vote.findMany({
        where: {
          createdAt: {
            gte: dateFilter
          }
        }
      });
      
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        undefined,
        `Found ${votes.length} votes in the last ${days} days. Processing...`
      );

      let updatedCount = 0;
      let errorCount = 0;

      for (const vote of votes) {
        try {
          console.log(`Processing vote for ${vote.twitterUsername} (current status: ${vote.status})`);
          
          let newStatus = 'pending';
          if (vote.upvoterUsernames.length >= upvotes) {
            newStatus = 'approved';
          } else if (vote.downvoterUsernames.length >= downvotes) {
            newStatus = 'rejected';
          }

          console.log(`Calculated new status: ${newStatus}`);

          if (newStatus === vote.status) {
            console.log(`No status change needed for ${vote.twitterUsername}`);
            continue;
          }

          console.log(`Updating status for ${vote.twitterUsername} from ${vote.status} to ${newStatus}`);

          const updatedVote = await prisma.vote.update({
            where: { id: vote.id },
            data: { status: newStatus }
          });

          console.log(`Database update successful for ${vote.twitterUsername}`);

          try {
            await ctx.telegram.editMessageCaption(
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
                      { text: `✅ (${vote.upvoterUsernames.length})`, callback_data: '/vote_up' },
                      { text: `❌ (${vote.downvoterUsernames.length})`, callback_data: '/vote_down' }
                    ]
                  ]
                }
              }
            );
            console.log(`Message update successful for ${vote.twitterUsername}`);
            updatedCount++;
          } catch (messageError) {
            console.error(`Failed to update message for ${vote.twitterUsername}:`, messageError);
            errorCount++;
          }

          if (updatedCount % 3 === 0) {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              statusMessage.message_id,
              undefined,
              `Processing: ${updatedCount}/${votes.length} votes updated...`
            );
          }

          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.error(`Failed to process vote for ${vote.twitterUsername}:`, error);
          errorCount++;
        }
      }

      await trackMessage(`Update completed!\n✅ Successfully updated: ${updatedCount}\n❌ Errors: ${errorCount}`);
      
      // Delete all status messages after 10 seconds
      setTimeout(() => cleanupMessages(), 10000);
    } catch (error) {
      console.error('Error in update process:', error);
      await trackMessage('❌ Error occurred during update process');
      setTimeout(() => cleanupMessages(), 10000);
    }
  });

  await trackMessage('Update task has been queued and will run in the background.');
});

adminComposer.command('updatestatus', async (ctx) => {
  const status = updateQueue.getStatus();
  await sendTemporaryMessage(
    ctx,
    `Update Queue Status:\n` +
    `Pending tasks: ${status.pendingTasks}\n` +
    `Currently processing: ${status.isProcessing}`
  );
});

