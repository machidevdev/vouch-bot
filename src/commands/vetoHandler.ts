import { Composer } from "telegraf";
import { dmAuthMiddleware } from "../middleware/dmAuth";
import { sessionManager } from "../utils/sessionManager";
import { getProfileImage, prisma, hashUserId, formatVetoMessage } from "../utils";
import { config } from "../config/env";

export const vetoHandler = Composer.on('message', dmAuthMiddleware(), async (ctx, next) => {
  const userId = ctx.from.id;
  const session = sessionManager.getSession(userId);
  
  // If no active session, continue to next middleware
  if (!session) {
    return next();
  }

  const messageText = ctx.text;
  
  // Handle cancel command
  if (messageText?.toLowerCase() === 'cancel') {
    sessionManager.clearSession(userId);
    await ctx.reply('❌ Veto process cancelled.');
    return;
  }

  try {
    switch (session.step) {
      case 'username':
        await handleUsernameStep(ctx, session, messageText);
        break;
      case 'feedback':
        await handleFeedbackStep(ctx, session, messageText);
        break;
      case 'images':
        await handleImagesStep(ctx, session);
        break;
      case 'review':
        await handleReviewStep(ctx, session, messageText);
        break;
    }
  } catch (error) {
    console.error('Error in veto handler:', error);
    await ctx.reply('❌ An error occurred. Please try again or type "cancel" to start over.');
  }
});

async function handleUsernameStep(ctx: any, session: any, messageText: string | undefined) {
  if (!messageText) {
    await ctx.reply('❌ Please send a text message with the username or URL.');
    return;
  }

  let targetUsername: string | null = null;

  // Check for Twitter URL
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?x\.com\/([^\/\s\?]+)/;
  const urlMatch = messageText.match(twitterUrlRegex);
  
  if (urlMatch) {
    targetUsername = urlMatch[1].split('?')[0].toLowerCase();
  } else {
    // Check for username format (with or without @)
    const usernameMatch = messageText.match(/@?([a-zA-Z0-9_]+)/);
    if (usernameMatch) {
      targetUsername = usernameMatch[1].toLowerCase();
    }
  }

  if (!targetUsername) {
    await ctx.reply('❌ Invalid username format. Please send a valid Twitter username or URL.\n\nExamples:\n• @username\n• username\n• https://x.com/username');
    return;
  }

  // Check if user already submitted feedback for this target
  const hashedUserId = hashUserId(ctx.from.id.toString());
  const existingVeto = await prisma.feedback.findFirst({
    where: {
      targetUsername: { equals: targetUsername, mode: 'insensitive' },
      submittedBy: { has: hashedUserId }
    }
  });

  if (existingVeto) {
    await ctx.reply('❌ You have already submitted feedback for this user. Each user can only submit one veto per target.');
    sessionManager.clearSession(ctx.from.id);
    return;
  }

  // Fetch profile image
  try {
    console.log(`[Image Fetch] Starting image fetch for @${targetUsername}`);
    const imageUrl = await getProfileImage(targetUsername);
    
    const message = await ctx.replyWithPhoto(imageUrl, {
      caption: `✅ <b>Target User Confirmed</b>\n\n<b>Username:</b> @${targetUsername}\n\nIs this the correct person?`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'veto_confirm_user' },
            { text: '✏️ Edit', callback_data: 'veto_edit_user' }
          ]
        ]
      }
    });

    // Track this message and update session with username
    sessionManager.addMessageId(ctx.from.id, message.message_id);
    sessionManager.updateSession(ctx.from.id, { targetUsername });
    
  } catch (error) {
    console.error('Error fetching profile image:', error);
    await ctx.reply(`❌ Could not fetch profile for @${targetUsername}. Please check the username and try again.`);
  }
}

async function handleFeedbackStep(ctx: any, session: any, messageText: string | undefined) {
  if (!messageText) {
    await ctx.reply('❌ Please send a text message with your feedback.');
    return;
  }

  if (messageText.length > 2000) {
    await ctx.reply('❌ Feedback is too long. Please keep it under 2000 characters.');
    return;
  }

  // Update session with feedback
  sessionManager.updateSession(ctx.from.id, { feedback: messageText });

  const message = await ctx.reply(
    `✅ <b>Feedback Recorded</b>\n\n<b>Your feedback:</b>\n<i>${messageText}</i>\n\nIs this correct?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'veto_confirm_feedback' },
            { text: '✏️ Edit', callback_data: 'veto_edit_feedback' }
          ]
        ]
      }
    }
  );
  
  // Track this message
  sessionManager.addMessageId(ctx.from.id, message.message_id);
}

async function handleImagesStep(ctx: any, session: any) {
  // Handle photo uploads
  if (ctx.message.photo) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const currentImages = session.images || [];
    
    if (currentImages.length >= 5) {
      await ctx.reply('❌ Maximum 5 images allowed.');
      return;
    }

    const updatedImages = [...currentImages, fileId];
    sessionManager.updateSession(ctx.from.id, { images: updatedImages });
    
    const message = await ctx.reply(
      `✅ <b>Image ${updatedImages.length}/5 added</b>\n\nYou can:\n• Send more images (up to ${5 - updatedImages.length} remaining)\n• Send multiple images at once\n• Proceed to review`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Proceed to Review', callback_data: 'veto_done_images' }],
            [{ text: '🔙 Back', callback_data: 'veto_back_to_feedback' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
          ]
        }
      }
    );
    
    // Track this message
    sessionManager.addMessageId(ctx.from.id, message.message_id);
  } else if (ctx.message.media_group_id) {
    // Handle media group (multiple images sent at once)
    // Note: This is a simplified approach - in a production app you'd want to 
    // collect all messages with the same media_group_id
    const fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : null;
    
    if (fileId) {
      const currentImages = session.images || [];
      if (currentImages.length < 5) {
        const updatedImages = [...currentImages, fileId];
        sessionManager.updateSession(ctx.from.id, { images: updatedImages });
        
        const message = await ctx.reply(
          `✅ <b>Images received (${updatedImages.length}/5)</b>\n\nYou can:\n• Send more images (up to ${5 - updatedImages.length} remaining)\n• Send multiple images at once\n• Proceed to review`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Proceed to Review', callback_data: 'veto_done_images' }],
                [{ text: '🔙 Back', callback_data: 'veto_back_to_feedback' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
              ]
            }
          }
        );
        
        // Track this message
        sessionManager.addMessageId(ctx.from.id, message.message_id);
      }
    }
  } else {
    const message = await ctx.reply(
      `📷 <b>Step 3 of 3: Attach Images (Optional)</b>\n\nSend any images you want to include with your veto, or skip this step.\n\n<i>You can add up to 5 images. Send them one by one or select multiple at once.</i>`,
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
    
    // Track this message
    sessionManager.addMessageId(ctx.from.id, message.message_id);
  }
}

async function handleReviewStep(ctx: any, session: any, messageText: string | undefined) {
  if (!messageText) return;

  const choice = messageText.toLowerCase();
  
  switch (choice) {
    case 'send':
    case '1':
      await finalizeVeto(ctx, session);
      break;
    case 'modify':
    case '2':
      await showModifyOptions(ctx, session);
      break;
    case 'cancel':
    case '3':
      sessionManager.clearSession(ctx.from.id);
      await ctx.reply('❌ Veto cancelled.');
      break;
    default:
      await ctx.reply('❌ Please respond with "send", "modify", or "cancel" (or use numbers 1, 2, 3).');
  }
}

export async function finalizeVeto(ctx: any, session: any) {
  try {
    const hashedUserId = hashUserId(ctx.from.id.toString());
    const creatorUsername = ctx.from.username;
    
    // Check for existing veto for this username
    const existingVeto = await prisma.feedback.findFirst({
      where: { targetUsername: { equals: session.targetUsername, mode: 'insensitive' } }
    });

    let vetoRecord;
    let isNewVeto = false;

    if (existingVeto) {
      // Merge with existing veto - add creator as upvoter if they have a username and aren't already voting
      let newUpvoters = [...existingVeto.upvoterUsernames];
      let newDownvoters = [...existingVeto.downvoterUsernames];
      
      if (creatorUsername && !newUpvoters.includes(creatorUsername) && !newDownvoters.includes(creatorUsername)) {
        newUpvoters.push(creatorUsername);
      }
      
      vetoRecord = await prisma.feedback.update({
        where: { id: existingVeto.id },
        data: {
          feedback: [...existingVeto.feedback, session.feedback],
          submittedBy: [...existingVeto.submittedBy, hashedUserId],
          upvoterUsernames: newUpvoters,
          downvoterUsernames: newDownvoters,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new veto - automatically add creator as upvoter if they have a username
      const initialUpvoters = creatorUsername ? [creatorUsername] : [];
      
      isNewVeto = true;
      vetoRecord = await prisma.feedback.create({
        data: {
          targetUsername: session.targetUsername,
          feedback: [session.feedback],
          submittedBy: [hashedUserId],
          upvoterUsernames: initialUpvoters,
          downvoterUsernames: []
        }
      });
    }

    // Post to Telegram topic
    if (config.threadId && config.allowedGroupId && config.allowedGroupId !== 'local') {
      const imageCount = session.images?.length || 0;
      const vetoCaption = formatVetoMessage(
        session.targetUsername,
        vetoRecord.upvoterUsernames.length,
        vetoRecord.downvoterUsernames.length,
        vetoRecord.feedback,
        vetoRecord.feedback.length
      );

      const replyMarkup = {
        inline_keyboard: [[
          { text: `👢 Kick (${vetoRecord.upvoterUsernames.length})`, callback_data: '/veto_up' },
          { text: `✅ Keep (${vetoRecord.downvoterUsernames.length})`, callback_data: '/veto_down' }
        ]]
      };

      let message;

      if (imageCount > 1) {
        // Multiple images - send main message with profile first, then images separately
        const profileImage = await getProfileImage(session.targetUsername);
        message = await ctx.telegram.sendPhoto(
          config.allowedGroupId,
          profileImage,
          {
            caption: vetoCaption,
            parse_mode: 'HTML',
            message_thread_id: parseInt(config.threadId),
            reply_markup: replyMarkup
          }
        );

        // Send attached images as separate media group
        const mediaGroup = session.images.map((imageId: string) => ({
          type: 'photo' as const,
          media: imageId
        }));

        await ctx.telegram.sendMediaGroup(
          config.allowedGroupId,
          mediaGroup,
          { message_thread_id: parseInt(config.threadId) }
        );

      } else if (imageCount === 1) {
        // Single attached image
        message = await ctx.telegram.sendPhoto(
          config.allowedGroupId,
          session.images[0],
          {
            caption: vetoCaption,
            parse_mode: 'HTML',
            message_thread_id: parseInt(config.threadId),
            reply_markup: replyMarkup
          }
        );
      } else {
        // No images - use Twitter profile picture
        const profileImage = await getProfileImage(session.targetUsername);
        message = await ctx.telegram.sendPhoto(
          config.allowedGroupId,
          profileImage,
          {
            caption: vetoCaption,
            parse_mode: 'HTML',
            message_thread_id: parseInt(config.threadId),
            reply_markup: replyMarkup
          }
        );
      }

      // Update record with message info (if not already done for media group)
      if (imageCount <= 1) {
        await prisma.feedback.update({
          where: { id: vetoRecord.id },
          data: {
            messageId: BigInt(message.message_id),
            chatId: BigInt(config.allowedGroupId)
          }
        });
      }

      // Delete old message if merging
      if (!isNewVeto && existingVeto?.messageId && existingVeto?.chatId) {
        try {
          await ctx.telegram.deleteMessage(Number(existingVeto.chatId), Number(existingVeto.messageId));
        } catch (deleteError) {
          console.error('Error deleting old veto message:', deleteError);
        }
      }

      // Update record with message info
      await prisma.feedback.update({
        where: { id: vetoRecord.id },
        data: {
          messageId: BigInt(message.message_id),
          chatId: BigInt(config.allowedGroupId)
        }
      });
    }

    sessionManager.clearSession(ctx.from.id);
    await ctx.reply('✅ Your anonymous veto has been submitted successfully and posted to the community for review.\n\n⚠️ <b>This action is irreversible.</b>', { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('Error finalizing veto:', error);
    await ctx.reply('❌ Error submitting veto. Please try again.');
  }
}

export async function showModifyOptions(ctx: any, session: any) {
  const message = await ctx.reply(
    `<b>🔧 Modify Veto</b>\n\nWhat would you like to change?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '👤 Change User', callback_data: 'veto_modify_user' }],
          [{ text: '💬 Change Feedback', callback_data: 'veto_modify_feedback' }],
          [{ text: '📷 Change Images', callback_data: 'veto_modify_images' }],
          [{ text: '🔙 Back to Review', callback_data: 'veto_back_review' }, { text: '❌ Cancel', callback_data: 'veto_cancel' }]
        ]
      }
    }
  );
  
  // Track this message
  sessionManager.addMessageId(ctx.from.id, message.message_id);
}