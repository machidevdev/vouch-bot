import { Composer } from "telegraf";
import { sessionManager } from "../utils/sessionManager";

export const vetoCallbacks = Composer.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const session = sessionManager.getSession(userId);
  const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

  // Handle start menu callbacks (don't require session)
  if (data?.startsWith('start_')) {
    await handleStartMenuCallbacks(ctx, data);
    return;
  }
  
  if (!session || !data?.startsWith('veto_')) {
    return;
  }

  await ctx.answerCbQuery();

  try {
    switch (data) {
      case 'veto_confirm_user':
        await handleConfirmUser(ctx, session);
        break;
      case 'veto_edit_user':
        await handleEditUser(ctx, session);
        break;
      case 'veto_confirm_feedback':
        await handleConfirmFeedback(ctx, session);
        break;
      case 'veto_edit_feedback':
        await handleEditFeedback(ctx, session);
        break;
      case 'veto_done_images':
      case 'veto_skip_images':
        await handleDoneImages(ctx, session);
        break;
      case 'veto_modify_user':
        await handleModifyUser(ctx, session);
        break;
      case 'veto_modify_feedback':
        await handleModifyFeedback(ctx, session);
        break;
      case 'veto_modify_images':
        await handleModifyImages(ctx, session);
        break;
      case 'veto_back_review':
        await handleBackToReview(ctx, session);
        break;
      // Navigation buttons
      case 'veto_cancel':
        await handleCancel(ctx, session);
        break;
      case 'veto_back_to_user':
        await handleBackToUser(ctx, session);
        break;
      case 'veto_back_to_feedback':
        await handleBackToFeedback(ctx, session);
        break;
      case 'veto_start_process':
        await handleStartProcess(ctx);
        break;
      // Final actions
      case 'veto_final_send':
        const { finalizeVeto } = await import('./vetoHandler');
        await finalizeVeto(ctx, session);
        break;
      case 'veto_final_modify':
        const { showModifyOptions } = await import('./vetoHandler'); 
        await showModifyOptions(ctx, session);
        break;
      case 'veto_final_cancel':
        sessionManager.clearSession(userId);
        await ctx.editMessageCaption('❌ Veto process cancelled.');
        break;
    }
  } catch (error) {
    console.error('Error in veto callback:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
});

async function handleConfirmUser(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'feedback' });
  
  await ctx.editMessageCaption(
    `✅ <b>User Confirmed:</b> @${session.targetUsername}\n\n<b>💬 Step 2 of 3: Feedback</b>\n\nPlease explain why you're vetoing this user. Be specific and constructive.\n\n<i>You can write as much as needed (max 2000 characters).</i>`,
    { 
      parse_mode: 'HTML', 
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back', callback_data: 'veto_back_to_user' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
}

async function handleEditUser(ctx: any, session: any) {
  await ctx.editMessageCaption(
    `<b>📝 Step 1 of 3: Target User</b>\n\nPlease send the Twitter username or profile URL again.\n\n<b>Accepted formats:</b>\n• @username\n• username\n• https://x.com/username`,
    { 
      parse_mode: 'HTML', 
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
  
  sessionManager.updateSession(ctx.from.id, { step: 'username', targetUsername: undefined, feedback: undefined, images: [] });
}

async function handleConfirmFeedback(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'images' });
  
  await ctx.editMessageText(
    `✅ <b>Feedback Confirmed</b>\n\n<b>📷 Step 3 of 3: Attach Images (Optional)</b>\n\nSend any images you want to include with your veto, or skip this step.\n\n<i>You can add up to 5 images. Send them one by one or select multiple at once.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Skip to Review', callback_data: 'veto_skip_images' }],
          [{ text: '🔙 Back', callback_data: 'veto_back_to_feedback' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
}

async function handleEditFeedback(ctx: any, session: any) {
  await ctx.editMessageText(
    `<b>💬 Step 2 of 3: Feedback</b>\n\nPlease send your feedback again.\n\n<i>You can write as much as needed (max 2000 characters).</i>`,
    { 
      parse_mode: 'HTML', 
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back', callback_data: 'veto_back_to_user' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
  
  sessionManager.updateSession(ctx.from.id, { feedback: undefined, images: [] });
}

async function handleDoneImages(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'review' });
  
  await showVetoPreview(ctx, session);
}

async function showVetoPreview(ctx: any, session: any) {
  const { getProfileImage, formatVetoMessage } = await import('../utils');
  
  try {
    const imageCount = session.images?.length || 0;
    const imageText = imageCount > 0 ? `\n<b>Images:</b> ${imageCount} attached` : `\n<b>Images:</b> User's Twitter profile picture will be used`;
    
    // Create preview message
    const previewCaption = formatVetoMessage(
      session.targetUsername,
      0, // No votes yet
      0, // No votes yet  
      [session.feedback],
      1 // Single veto
    ) + `\n\n🔍 <b>PREVIEW - This is how your veto will appear</b>`;

    const finalCaption = previewCaption + imageText + `\n\n<b>📋 Review Your Veto</b>\n<b>⚠️ This action is irreversible once submitted.</b>\n\nWhat would you like to do?`;
    
    const replyMarkup = {
      inline_keyboard: [
        [{ text: '✅ Submit Veto', callback_data: 'veto_final_send' }],
        [{ text: '✏️ Modify', callback_data: 'veto_final_modify' }, { text: '❌ Cancel', callback_data: 'veto_final_cancel' }]
      ]
    };

    // Show preview with either user images or profile picture
    if (imageCount > 1) {
      // Multiple images - use media group
      const mediaGroup = session.images.map((imageId: string, index: number) => ({
        type: 'photo' as const,
        media: imageId,
        caption: index === 0 ? finalCaption : undefined,
        parse_mode: index === 0 ? 'HTML' as const : undefined
      }));

      await ctx.replyWithMediaGroup(mediaGroup);
      
      // Send buttons separately since media groups can't have inline keyboards
      await ctx.reply('Choose an action:', { reply_markup: replyMarkup });
      
    } else if (imageCount === 1) {
      // Single attached image
      await ctx.replyWithPhoto(session.images[0], {
        caption: finalCaption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
    } else {
      // No images - use Twitter profile picture
      const profileImage = await getProfileImage(session.targetUsername);
      await ctx.replyWithPhoto(profileImage, {
        caption: finalCaption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });
    }
  } catch (error) {
    console.error('Error showing preview:', error);
    await ctx.reply('❌ Error showing preview. Please try again.');
  }
}

async function handleModifyUser(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'username', targetUsername: undefined, feedback: undefined, images: [] });
  
  await ctx.editMessageText(
    `<b>📝 Step 1 of 3: Target User</b>\n\nPlease send the Twitter username or profile URL.\n\n<b>Accepted formats:</b>\n• @username\n• username\n• https://x.com/username`,
    { 
      parse_mode: 'HTML', 
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
}

async function handleModifyFeedback(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'feedback', feedback: undefined, images: [] });
  
  await ctx.editMessageText(
    `<b>💬 Step 2 of 3: Feedback</b>\n\nPlease send your feedback.\n\n<i>You can write as much as needed (max 2000 characters).</i>`,
    { 
      parse_mode: 'HTML', 
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back', callback_data: 'veto_back_to_user' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
}

async function handleModifyImages(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'images', images: [] });
  
  await ctx.editMessageText(
    `<b>📷 Step 3 of 3: Attach Images (Optional)</b>\n\nSend any images you want to include with your veto, or skip this step.\n\n<i>You can add up to 5 images. Send them one by one or select multiple at once.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Skip to Review', callback_data: 'veto_skip_images' }],
          [{ text: '🔙 Back', callback_data: 'veto_back_to_feedback' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
}

async function handleBackToReview(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'review' });
  
  await showVetoPreview(ctx, session);
}

async function handleCancel(ctx: any, session: any) {
  const userId = ctx.from.id;
  
  // Delete all tracked messages
  if (session.messageIds && session.messageIds.length > 0) {
    for (const messageId of session.messageIds) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, messageId);
      } catch (error) {
        // Ignore errors for messages that can't be deleted (too old, already deleted, etc.)
        console.log(`Could not delete message ${messageId}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  // Try to delete/edit the current message (the one with cancel button)
  try {
    await ctx.editMessageText('❌ Veto process cancelled.');
    // Wait a moment then delete this message too
    setTimeout(async () => {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log('Could not delete cancel message:', error instanceof Error ? error.message : String(error));
      }
    }, 2000);
  } catch {
    try {
      await ctx.editMessageCaption('❌ Veto process cancelled.');
      // Wait a moment then delete this message too
      setTimeout(async () => {
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.log('Could not delete cancel message:', error instanceof Error ? error.message : String(error));
        }
      }, 2000);
    } catch {
      // If we can't edit, send a new message that will auto-delete
      const cancelMessage = await ctx.reply('❌ Veto process cancelled.');
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, cancelMessage.message_id);
        } catch (error) {
          console.log('Could not delete cancel message:', error instanceof Error ? error.message : String(error));
        }
      }, 2000);
    }
  }
  
  // Clear the session
  sessionManager.clearSession(userId);
}

async function handleBackToUser(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'username', targetUsername: undefined, feedback: undefined, images: [] });
  
  try {
    await ctx.editMessageText(
      `<b>📝 Step 1 of 3: Target User</b>\n\nPlease send the Twitter username or profile URL of the person you want to veto.\n\n<b>Accepted formats:</b>\n• @username\n• username\n• https://x.com/username`,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancel', callback_data: 'veto_cancel' }]
          ]
        }
      }
    );
  } catch {
    const message = await ctx.reply(
      `<b>📝 Step 1 of 3: Target User</b>\n\nPlease send the Twitter username or profile URL of the person you want to veto.\n\n<b>Accepted formats:</b>\n• @username\n• username\n• https://x.com/username`,
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
    sessionManager.addMessageId(ctx.from.id, message.message_id);
  }
}

async function handleBackToFeedback(ctx: any, session: any) {
  sessionManager.updateSession(ctx.from.id, { step: 'feedback', feedback: undefined, images: [] });
  
  try {
    await ctx.editMessageText(
      `<b>💬 Step 2 of 3: Feedback</b>\n\nPlease explain why you're vetoing @${session.targetUsername}. Be specific and constructive.\n\n<i>You can write as much as needed (max 2000 characters).</i>`,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back', callback_data: 'veto_back_to_user' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
          ]
        }
      }
    );
  } catch {
    const message = await ctx.reply(
      `<b>💬 Step 2 of 3: Feedback</b>\n\nPlease explain why you're vetoing @${session.targetUsername}. Be specific and constructive.\n\n<i>You can write as much as needed (max 2000 characters).</i>`,
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back', callback_data: 'veto_back_to_user' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
          ]
        }
      }
    );
    
    // Track this message
    sessionManager.addMessageId(ctx.from.id, message.message_id);
  }
}

async function handleStartProcess(ctx: any) {
  const userId = ctx.from.id;
  
  // Check if user already has an active session
  if (sessionManager.hasActiveSession(userId)) {
    await ctx.answerCbQuery('❌ You already have an active veto process running.');
    return;
  }
  
  // Start new veto session
  sessionManager.startSession(userId);
  
  // Edit the current message to start the veto process
  const message = await ctx.editMessageText(
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
  
  await ctx.answerCbQuery('✅ Veto process started!');
}

async function handleStartMenuCallbacks(ctx: any, data: string) {
  await ctx.answerCbQuery();
  
  switch (data) {
    case 'start_veto':
      await handleStartVeto(ctx);
      break;
    case 'start_list':
      await handleStartList(ctx);
      break;
    case 'start_help':
      await handleStartHelp(ctx);
      break;
    case 'start_back_menu':
      await handleBackToMenu(ctx);
      break;
  }
}

async function handleStartVeto(ctx: any) {
  const userId = ctx.from.id;
  
  // Check if user already has an active session
  if (sessionManager.hasActiveSession(userId)) {
    await ctx.editMessageText(
      '❌ <b>Active Veto Process Found</b>\n\nYou already have an active veto process running. Please complete or cancel it first.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'start_back_menu' }]
          ]
        }
      }
    );
    return;
  }
  
  // Start new veto session
  sessionManager.startSession(userId);
  
  // Edit the current message to start the veto process
  const message = await ctx.editMessageText(
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
}

async function handleStartList(ctx: any) {
  try {
    const hashedUserId = await import('../utils').then(m => m.hashUserId(ctx.from.id.toString()));
    const { prisma } = await import('../utils');
    
    // Fetch all feedback submitted by this user
    const userFeedback = await prisma.feedback.findMany({
      where: {
        submittedBy: { has: hashedUserId }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (userFeedback.length === 0) {
      await ctx.editMessageText(
        '📋 <b>Your Reports</b>\n\nYou haven\'t submitted any reports yet.\n\nUse the veto feature to report problematic users.',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚨 Start Veto Process', callback_data: 'start_veto' }],
              [{ text: '🔙 Back to Menu', callback_data: 'start_back_menu' }]
            ]
          }
        }
      );
      return;
    }
    
    const reportList = userFeedback.map((feedback, index) => 
      `${index + 1}. <b>@${feedback.targetUsername}</b>\n` +
      `   ✅ ${feedback.upvoterUsernames.length} | ❌ ${feedback.downvoterUsernames.length}\n` +
      `   📅 ${feedback.createdAt.toLocaleDateString()}`
    ).join('\n\n');
    
    await ctx.editMessageText(
      `📋 <b>Your Reports (${userFeedback.length})</b>\n\n${reportList}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'start_back_menu' }]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error loading user reports:', error);
    await ctx.editMessageText(
      '❌ <b>Error</b>\n\nCould not load your reports. Please try again later.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'start_back_menu' }]
          ]
        }
      }
    );
  }
}

async function handleStartHelp(ctx: any) {
  await ctx.editMessageText(
    `ℹ️ <b>Safe Bot Help</b>\n\n` +
    `<b>🚨 Anonymous Veto</b>\n` +
    `Report problematic users privately through a 3-step process:\n` +
    `• Step 1: Enter Twitter username/URL\n` +
    `• Step 2: Provide detailed feedback\n` +
    `• Step 3: Attach supporting images (optional)\n\n` +
    `<b>📋 View Reports</b>\n` +
    `Browse community feedback and vote on existing reports.\n\n` +
    `<b>🔒 Privacy</b>\n` +
    `All reports are anonymous and user IDs are hashed for privacy.\n\n` +
    `<b>⚠️ Guidelines</b>\n` +
    `• One report per user per target\n` +
    `• Be specific and constructive in feedback\n` +
    `• Only group members can access these features`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Menu', callback_data: 'start_back_menu' }]
        ]
      }
    }
  );
}

async function handleBackToMenu(ctx: any) {
  const userName = ctx.from.first_name || 'there';
  
  await ctx.editMessageText(
    `👋 <b>Welcome ${userName}!</b>\n\n` +
    `🛡️ <b>Safe Bot</b> - Community Safety & Verification\n\n` +
    `<b>Available Features:</b>\n` +
    `🚨 <b>Anonymous Veto</b> - Report problematic users privately\n` +
    `📋 <b>View Reports</b> - See community feedback and votes\n\n` +
    `Select a feature to get started:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚨 Start Veto Process', callback_data: 'start_veto' }],
          [{ text: '📋 View Reports', callback_data: 'start_list' }],
          [{ text: 'ℹ️ Help & Info', callback_data: 'start_help' }]
        ]
      }
    }
  );
}

