import { Composer } from "telegraf";
import { dmAuthMiddleware } from "../middleware/dmAuth";
import { sessionManager } from "../utils/sessionManager";

export const vetoCommand = Composer.command('veto', dmAuthMiddleware(), async (ctx) => {
  const userId = ctx.from.id;
  
  // Check if user already has an active veto session
  if (sessionManager.hasActiveSession(userId)) {
    await ctx.reply('❌ You already have an active veto process running. Please complete or cancel it first by typing "cancel".');
    return;
  }

  // Start new veto session
  sessionManager.startSession(userId);
  
  await ctx.reply(
    `🔒 <b>Anonymous Veto Process Started</b>\n\n` +
    `<b>Step 1 of 3: Target User</b>\n\n` +
    `Please send the Twitter username or profile URL of the person you want to veto.\n\n` +
    `<b>Accepted formats:</b>\n` +
    `• @username\n` +
    `• username\n` +
    `• https://x.com/username\n\n` +
    `<i>Type "cancel" at any time to cancel the process.</i>`,
    { parse_mode: 'HTML' }
  );
});