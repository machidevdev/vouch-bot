import { Composer } from "telegraf";
import { sessionManager } from "../utils/sessionManager";
import { finalizeVouch } from "./vouchHandler";

export const vouchCallbacks = Composer.on('callback_query', async (ctx, next) => {
  const userId = ctx.from.id;
  const session = sessionManager.getVouchSession(userId);
  const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

  console.log(`VouchCallbacks reached - data: ${data}, userId: ${userId}`);

  // Only handle vouch-related callbacks
  if (!data?.startsWith('vouch_')) {
    console.log(`Not a vouch callback, skipping`);
    return next();
  }

  console.log(`Vouch callback: ${data} for user ${userId}, session exists: ${!!session}`);

  await ctx.answerCbQuery();

  try {
    switch (data) {
      case 'vouch_cancel':
        await handleCancel(ctx, session);
        break;
      case 'vouch_retry_user':
        await handleRetryUser(ctx, session);
        break;
      case 'vouch_edit_user':
        await handleEditUser(ctx, session);
        break;
      case 'vouch_skip_description':
        await handleSkipDescription(ctx, session);
        break;
      case 'vouch_edit_description':
        await handleEditDescription(ctx, session);
        break;
      case 'vouch_final_submit':
        await finalizeVouch(ctx, session);
        break;
    }
  } catch (error) {
    console.error(`Error in vouch callback ${data}:`, error);
    try {
      await ctx.editMessageCaption(`❌ An error occurred with ${data}. Please try again.`);
    } catch {
      await ctx.reply(`❌ An error occurred with ${data}. Please try again.`);
    }
  }
});

async function handleCancel(ctx: any, session: any) {
  const userId = ctx.from.id;
  
  if (!session) {
    await ctx.editMessageText('❌ No active vouch process found.');
    return;
  }

  // Delete tracked messages
  if (session.messageIds && session.messageIds.length > 0) {
    for (const messageId of session.messageIds) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
      } catch (error) {
        console.log(`Could not delete message ${messageId}:`, error);
      }
    }
  }
  
  // Try to edit/delete the current message
  try {
    await ctx.editMessageText('❌ Vouch process cancelled.');
    // Auto-delete after 2 seconds
    setTimeout(async () => {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log('Could not delete cancel message:', error);
      }
    }, 2000);
  } catch {
    try {
      await ctx.editMessageCaption('❌ Vouch process cancelled.');
      // Auto-delete after 2 seconds
      setTimeout(async () => {
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.log('Could not delete cancel message:', error);
        }
      }, 2000);
    } catch {
      // If we can't edit, send a new message that will auto-delete
      const cancelMessage = await ctx.reply('❌ Vouch process cancelled.');
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, cancelMessage.message_id);
        } catch (error) {
          console.log('Could not delete cancel message:', error);
        }
      }, 2000);
    }
  }
  
  // Clear the session
  sessionManager.clearVouchSession(userId);
}

async function handleRetryUser(ctx: any, session: any) {
  if (!session) {
    await ctx.editMessageText('❌ No active vouch process found.');
    return;
  }

  // Reset session to username step
  sessionManager.updateVouchSession(ctx.from.id, { 
    step: 'username', 
    targetUsername: undefined, 
    description: undefined 
  });
  
  try {
    await ctx.editMessageCaption(
      `✨ <b>Vouch Process</b>\n\n` +
      `<b>📝 Step 1 of 3: Target User</b>\n\n` +
      `Please send the Twitter username or profile URL of the person you want to vouch for.\n\n` +
      `<b>Accepted formats:</b>\n` +
      `• @username\n` +
      `• username\n` +
      `• https://x.com/username`,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
          ]
        }
      }
    );
  } catch {
    try {
      await ctx.editMessageText(
        `✨ <b>Vouch Process</b>\n\n` +
        `<b>📝 Step 1 of 3: Target User</b>\n\n` +
        `Please send the Twitter username or profile URL of the person you want to vouch for.\n\n` +
        `<b>Accepted formats:</b>\n` +
        `• @username\n` +
        `• username\n` +
        `• https://x.com/username`,
        { 
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
            ]
          }
        }
      );
    } catch {
      // Fallback: send new message
      const message = await ctx.reply(
        `✨ <b>Vouch Process</b>\n\n` +
        `<b>📝 Step 1 of 3: Target User</b>\n\n` +
        `Please send the Twitter username or profile URL of the person you want to vouch for.\n\n` +
        `<b>Accepted formats:</b>\n` +
        `• @username\n` +
        `• username\n` +
        `• https://x.com/username`,
        { 
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
            ]
          }
        }
      );
      
      sessionManager.addVouchMessageId(ctx.from.id, message.message_id);
    }
  }
}

async function handleEditUser(ctx: any, session: any) {
  console.log('handleEditUser called - session:', JSON.stringify(session));
  
  if (!session) {
    console.log('No session found for edit user');
    await ctx.editMessageCaption('❌ No active vouch process found.');
    return;
  }

  console.log('Calling handleRetryUser');
  await handleRetryUser(ctx, session);
}

async function handleSkipDescription(ctx: any, session: any) {
  console.log('handleSkipDescription called - session:', JSON.stringify(session));
  
  if (!session) {
    console.log('No session found for user');
    await ctx.editMessageCaption('❌ No active vouch process found.');
    return;
  }
  
  if (!session.targetUsername) {
    console.log('No targetUsername in session');
    await ctx.editMessageCaption('❌ No target user found in session.');
    return;
  }

  console.log('Updating session to review step');
  // Update session to review step without description
  sessionManager.updateVouchSession(ctx.from.id, { 
    step: 'review',
    description: undefined 
  });

  // Show preview
  console.log('Showing vouch preview');
  await showVouchPreview(ctx, { ...session, description: undefined });
}

async function handleEditDescription(ctx: any, session: any) {
  if (!session || !session.targetUsername) {
    await ctx.editMessageCaption('❌ No active vouch process found.');
    return;
  }

  // Reset to description step
  sessionManager.updateVouchSession(ctx.from.id, { 
    step: 'description',
    description: undefined 
  });

  try {
    await ctx.editMessageCaption(
      `✅ <b>User: @${session.targetUsername}</b>\n\n` +
      `<b>💬 Step 2 of 3: Description (Optional)</b>\n\n` +
      `Add a brief description explaining why you're vouching for this user, or skip to proceed without description.\n\n` +
      `<i>Keep it concise and positive (max 500 characters).</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ Skip Description', callback_data: 'vouch_skip_description' }],
            [{ text: '✏️ Edit User', callback_data: 'vouch_edit_user' }, { text: '❌ Cancel', callback_data: 'vouch_cancel' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error editing description step:', error);
    await ctx.reply('❌ Error. Please try again.');
  }
}

async function showVouchPreview(ctx: any, session: any) {
  const { getProfileImage, formatVoteMessage } = await import('../utils');
  
  try {
    const imageUrl = await getProfileImage(session.targetUsername);
    
    // Create preview of how the vouch will look
    const previewCaption = formatVoteMessage(
      session.targetUsername,
      1, // Will have 1 upvote (from creator)
      0, // No downvotes initially
      ctx.from.username || ctx.from.id.toString(),
      'pending',
      session.description
    ) + '\n\n🔍 <b>PREVIEW - This is how your vouch will appear</b>';

    const finalCaption = previewCaption + '\n\n<b>📋 Review Your Vouch</b>\n<b>⚠️ This action is irreversible once submitted.</b>\n\nWhat would you like to do?';
    
    await ctx.editMessageMedia({
      type: 'photo',
      media: imageUrl,
      caption: finalCaption,
      parse_mode: 'HTML'
    }, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Submit Vouch', callback_data: 'vouch_final_submit' }],
          [{ text: '✏️ Edit Description', callback_data: 'vouch_edit_description' }],
          [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error showing vouch preview:', error);
    await ctx.reply('❌ Error showing preview. Please try again.');
  }
}