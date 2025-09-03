import { Composer } from "telegraf";

export const helpCommand = Composer.command('help', async (ctx, next) => {
  const message = `🤖 *Bot Commands & Features*

📝 *Vouching System:*
• \`/vouch @username [description]\` \\- Create a vouch for someone
• \`/vouch https://x\\.com/username [description]\` \\- Vouch using profile URL
• \`/vouch username [description]\` \\- Vouch without @ symbol
• \`/up\` \\- Update your vouch's profile picture and bump it
• Reply with \`/x\` to your own vouch to delete it

🔒 *Anonymous Feedback \\(DMs Only\\):*

• \`/veto\` \\- Submit using profile URL
• \`/list\` \\- View all your submitted feedback
• *Note:* Each user can only submit one feedback per target

🎵 *Music Sharing:*
• Share Spotify links and they'll render with a rich preview
• Supported: tracks, albums, playlists, and artist pages

💡 *Tips:*
• Always use the person's actual X/Twitter handle
• Some profile pictures may not load \\- this is a known issue
• Veto commands only work in direct messages with the bot`;
    await ctx.replyWithMarkdownV2(message);
    await next();
});