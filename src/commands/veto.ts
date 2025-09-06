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

  // Check if command has additional parameters (anything after /veto)
  const messageText = ctx.message.text;
  const hasAdditionalParams = messageText && messageText.trim().length > '/veto'.length;
  
  if (hasAdditionalParams) {
    // User used command incorrectly (e.g., "/veto @username" or "/veto some text")
    await ctx.reply(
      `ℹ️ <b>How to Use the Veto Command</b>\n\n` +
      `The <code>/veto</code> command starts an interactive process to report a user.\n\n` +
      `<b>Just use:</b> <code>/veto</code>\n\n` +
      `Click the button below to start the veto process:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Start Veto Process', callback_data: 'veto_start_process' }]
          ]
        }
      }
    );
    return;
  }

  // Start new veto session
  sessionManager.startSession(userId);
  
  const message = await ctx.reply(
    `🔒 <b>Anonymous Veto Process Started</b>\n\n` +
    `<b>📝 Step 1 of 3: Target User</b>\n\n` +
    `Please send the Twitter username or profile URL of the person you want to veto.\n\n` +
    `<b>Accepted formats:</b>\n` +
    `• @username\n` +
    `• username\n` +
    `• https://x.com/username`,
    { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
  
  // Track this message
  sessionManager.addMessageId(userId, message.message_id);
});