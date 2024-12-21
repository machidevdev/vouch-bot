import { adminComposer } from "../composers/adminComposer";
import { prisma } from "../utils";

adminComposer.command('set', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const [upvotes, downvotes] = args.map(Number);

  if (args.length !== 2 || isNaN(upvotes) || isNaN(downvotes)) {
    await ctx.reply('Usage: /settings <required_upvotes> <required_downvotes>');
    return;
  }

  try {
    const newSettings = await prisma.settings.create({
      data: {
        requiredUpvotes: upvotes,
        requiredDownvotes: downvotes
      }
    });

    await ctx.reply(
      `✅ Settings updated successfully!\n\n` +
      `Required upvotes: ${newSettings.requiredUpvotes}\n` +
      `Required downvotes: ${newSettings.requiredDownvotes}`
    );
  } catch (error) {
    console.error('Error updating settings:', error);
    await ctx.reply('❌ Error updating settings');
  }
});

// Command to view current settings
adminComposer.command('viewsettings', async (ctx) => {
  try {
    const settings = await prisma.settings.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    const message = settings 
      ? `Current settings:\n\n` +
        `Required upvotes: ${settings.requiredUpvotes}\n` +
        `Required downvotes: ${settings.requiredDownvotes}\n` +
        `Last updated: ${settings.updatedAt.toLocaleString()}`
      : `Current settings (default):\n\n` +
        `Required upvotes: 15\n` +
        `Required downvotes: 3`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Error fetching settings:', error);
    await ctx.reply('❌ Error fetching settings');
  }
}); 