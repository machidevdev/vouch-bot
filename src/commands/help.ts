import { Composer } from "telegraf";

export const helpCommand = Composer.command('help', async (ctx, next) => {
  const message = `*Available Commands:*

  • \`/vouch @username description(optional)\` \\- Create a new vouch
  • \`/vouch https://x\\.com/username description(optional)\` \\- Create a vouch from URL
  • Reply to a vouch with \`x\` to delete your own vouch
  • \`/up\` \\- Update a vouch's pfp and bump it\\. Usable only by who created the vouch;
  When using just @username be sure to enter the user's X handle\\.
  Note: Some profile pictures are not loading correctly, this is a known issue\\.`;
    await ctx.replyWithMarkdownV2(message);
    await next();
});