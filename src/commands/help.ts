import { Composer } from "telegraf";

export const helpCommand = Composer.command('help', async (ctx) => {
  const message = `*Available Commands:*

  • \`/vouch @username [description]\` \\- Create a new vouch
  • \`/vouch https://x\\.com/username [description]\` \\- Create a vouch from URL
  • Reply with \`x\` to delete your own vouch`;
    await ctx.replyWithMarkdownV2(message);
});