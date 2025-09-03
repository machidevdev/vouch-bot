import { Composer } from "telegraf";
import { prisma, hashUserId } from "../utils";
import { dmAuthMiddleware } from "../middleware/dmAuth";

export const listCommand = Composer.command('list', dmAuthMiddleware(), async (ctx) => {
  try {
    const hashedUserId = hashUserId(ctx.from.id.toString());
    
    // Fetch all feedback submitted by this user
    const userFeedback = await prisma.feedback.findMany({
      where: {
        submittedBy: {
          has: hashedUserId
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (userFeedback.length === 0) {
      await ctx.reply('📝 You haven\'t submitted any feedback yet.\n\nUse /veto @username your_feedback to submit anonymous feedback.');
      return;
    }

    let message = `📝 <b>Your Anonymous Feedback (${userFeedback.length} items)</b>\n\n`;
    
    userFeedback.forEach((feedback) => {
      const date = feedback.createdAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Show all feedback entries for this user
      const feedbackText = feedback.feedback.join('\n• ');
      const truncatedFeedback = feedbackText.length > 200 
        ? feedbackText.substring(0, 200) + '...'
        : feedbackText;
      
      message += `- For @${feedback.targetUsername}\n`;
      message += `📅 ${date}\n`;
      message += `💬 <i>• ${truncatedFeedback}</i>\n\n`;
    });

    message += '<i>All feedback is submitted anonymously.</i>';

    await ctx.reply(message, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    await ctx.reply('Sorry, there was an error retrieving your feedback. Please try again later.');
  }
});