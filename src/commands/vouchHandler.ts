import { Composer } from "telegraf";
import { sessionManager } from "../utils/sessionManager";
import { prisma, getProfileImage, formatVoteMessage } from "../utils";
import { config } from "../config/env";

export const vouchHandler = Composer.on('message', async (ctx, next) => {
  // Only handle text messages in DMs or groups where user has active vouch session
  if (!('text' in ctx.message)) {
    return next();
  }

  const userId = ctx.from.id;
  const session = sessionManager.getVouchSession(userId);
  
  if (!session) {
    return next();
  }

  const messageText = ctx.message.text;

  try {
    switch (session.step) {
      case 'username':
        await handleUsernameStep(ctx, session, messageText);
        break;
      case 'description':
        await handleDescriptionStep(ctx, session, messageText);
        break;
      default:
        return next();
    }
  } catch (error) {
    console.error('Error in vouch handler:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
});

async function handleUsernameStep(ctx: any, session: any, messageText: string) {
  const userId = ctx.from.id;
  let username: string | null = null;

  // Parse username from message
  const twitterUrlRegex = /(?:https?:\/\/)?(?:www\.)?x\.com\/([^\/\s\?]+)/;
  const urlMatch = messageText.match(twitterUrlRegex);
  
  if (urlMatch) {
    username = urlMatch[1].split('?')[0];
  } else {
    const usernameMatch = messageText.match(/@?([a-zA-Z0-9_]+)/);
    if (usernameMatch) {
      username = usernameMatch[1];
    }
  }

  if (!username) {
    // Edit the main message instead of sending a new reply
    if (session.mainMessageId) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          '❌ <b>Invalid Username Format</b>\n\n' +
          'Please provide a valid Twitter username or URL.\n\n' +
          '<b>Accepted formats:</b>\n' +
          '• @username\n' +
          '• username\n' +
          '• https://x.com/username',
          { 
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
              ]
            }
          }
        );
      } catch (error) {
        console.error('Failed to edit message:', error);
        // Fallback to reply if editing fails
        await ctx.reply('❌ Invalid username format. Please try again.');
      }
    }
    return;
  }

  // Prevent vouching for the bot
  if (username.toLowerCase() === 'safe_magic_bot') {
    await ctx.reply('❌ Cannot vouch for the bot itself.');
    return;
  }

  // Check if vouch already exists
  let existingVote = null;
  try {
    existingVote = await prisma.vote.findFirst({
      where: { twitterUsername: username }
    });
  } catch (error) {
    console.error('Error checking existing vouch:', error);
    await ctx.reply('❌ Error checking existing vouches. Please try again.');
    return;
  }

  // Try to fetch profile image to validate username
  try {
    const imageUrl = await getProfileImage(username);
    
    // Edit the main message with photo and new content
    if (session.mainMessageId) {
      let caption;
      if (existingVote) {
        // Existing vouch - show current status and allow adding to it
        const currentUpvotes = existingVote.upvoterUsernames.length;
        const currentDownvotes = existingVote.downvoterUsernames.length;
        
        const existingVouchers = existingVote.voucherUsernames || [existingVote.createdBy];
        
        const previewCaption = formatVoteMessage(
          username,
          currentUpvotes,
          currentDownvotes,
          existingVouchers,
          existingVote.status,
          existingVote.description || undefined
        );
        
        caption = 
          `🔄 <b>Existing Vouch Found: @${username}</b>\n\n` +
          `<b>Current Status:</b>\n` +
          `${previewCaption}\n\n` +
          `<b>💬 Step 2 of 3: Add Your Support</b>\n\n` +
          `This user has already been vouched for. You can add your support and optionally include additional description.\n\n` +
          `<i>Add a description (max 500 characters) or skip to just add your upvote.</i>`;
      } else {
        // New vouch - standard flow
        caption = 
          `✅ <b>User Found: @${username}</b>\n\n` +
          `<b>💬 Step 2 of 3: Description (Optional)</b>\n\n` +
          `Add a brief description explaining why you're vouching for this user, or skip to proceed without description.\n\n` +
          `<i>Keep it concise and positive (max 500 characters).</i>`;
      }

      try {
        await ctx.telegram.editMessageMedia(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          {
            type: 'photo',
            media: imageUrl,
            caption: caption,
            parse_mode: 'HTML'
          },
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏭️ Skip Description', callback_data: 'vouch_skip_description' }],
                [{ text: '✏️ Edit User', callback_data: 'vouch_edit_user' }, { text: '❌ Cancel', callback_data: 'vouch_cancel' }]
              ]
            }
          }
        );
      } catch (error) {
        console.error('Failed to edit message with media:', error);
        // Fallback to text edit if media edit fails
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          caption,
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
      }
    }

    // Update session with existing vote info
    sessionManager.updateVouchSession(userId, { 
      targetUsername: username, 
      step: 'description',
      existingVoteId: existingVote?.id
    });
    
  } catch (error) {
    console.error('Error fetching profile image:', error);
    
    // Edit the main message to show the error
    if (session.mainMessageId) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          `❌ <b>User Not Found</b>\n\n` +
          `Could not find Twitter user "@${username}". Please check the username and try again.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'vouch_retry_user' }],
                [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
              ]
            }
          }
        );
      } catch (editError) {
        console.error('Failed to edit message with error:', editError);
        // Fallback to reply if editing fails
        await ctx.reply('❌ User not found. Please try again.');
      }
    }
  }

  // Delete user's message
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Failed to delete user message:', error);
  }
}

async function handleDescriptionStep(ctx: any, session: any, messageText: string) {
  const userId = ctx.from.id;
  
  if (messageText.length > 500) {
    // Edit the main message to show the error
    if (session.mainMessageId) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          '❌ <b>Description Too Long</b>\n\n' +
          'Please keep the description under 500 characters.',
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏭️ Skip Description', callback_data: 'vouch_skip_description' }],
                [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
              ]
            }
          }
        );
      } catch (error) {
        console.error('Failed to edit message:', error);
        await ctx.reply('❌ Description too long. Please try again.');
      }
    }
    return;
  }

  // Update session with description and move to review
  sessionManager.updateVouchSession(userId, { 
    description: messageText.trim(),
    step: 'review' 
  });

  await showVouchPreview(ctx, { ...session, description: messageText.trim() });

  // Delete user's message
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Failed to delete user message:', error);
  }
}

export async function showVouchPreview(ctx: any, session: any) {
  try {
    const imageUrl = await getProfileImage(session.targetUsername);
    
    // Create preview of how the vouch will look
    const currentUser = ctx.from.username || ctx.from.id.toString();
    let previewVouchers = [currentUser];
    
    // If adding to existing vouch, include existing vouchers
    if (session.existingVoteId) {
      const existingVote = await prisma.vote.findUnique({
        where: { id: session.existingVoteId }
      });
      if (existingVote) {
        const existingVouchers = existingVote.voucherUsernames || [existingVote.createdBy];
        if (!existingVouchers.includes(currentUser)) {
          previewVouchers = [...existingVouchers, currentUser];
        } else {
          previewVouchers = existingVouchers;
        }
      }
    }
    
    const previewCaption = formatVoteMessage(
      session.targetUsername,
      1, // Will have 1 upvote (from creator)
      0, // No downvotes initially
      previewVouchers,
      'pending',
      session.description
    ) + '\n\n🔍 <b>PREVIEW - This is how your vouch will appear</b>';

    const finalCaption = previewCaption + '\n\n<b>📋 Review Your Vouch</b>\n<b>⚠️ This action is irreversible once submitted.</b>\n\nWhat would you like to do?';
    
    // Edit the main message to show the preview
    if (session.mainMessageId) {
      try {
        await ctx.telegram.editMessageMedia(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          {
            type: 'photo',
            media: imageUrl,
            caption: finalCaption,
            parse_mode: 'HTML'
          },
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Submit Vouch', callback_data: 'vouch_final_submit' }],
                [{ text: '✏️ Edit Description', callback_data: 'vouch_edit_description' }],
                [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
              ]
            }
          }
        );
      } catch (error) {
        console.error('Failed to edit message with media for preview:', error);
        // Fallback to text edit if media edit fails
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          finalCaption,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Submit Vouch', callback_data: 'vouch_final_submit' }],
                [{ text: '✏️ Edit Description', callback_data: 'vouch_edit_description' }],
                [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
              ]
            }
          }
        );
      }
    }
    
  } catch (error) {
    console.error('Error showing vouch preview:', error);
    // Edit the main message to show error
    if (session.mainMessageId) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          '❌ Error showing preview. Please try again.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'vouch_cancel' }]
              ]
            }
          }
        );
      } catch (editError) {
        console.error('Failed to edit message with error:', editError);
        await ctx.reply('❌ Error showing preview. Please try again.');
      }
    }
  }
}

export async function finalizeVouch(ctx: any, session: any) {
  const userId = ctx.from.id;
  const chatType = session.chatType;
  const currentUser = ctx.from.username || ctx.from.id.toString();
  
  console.log('finalizeVouch called - session:', JSON.stringify(session));
  console.log('chatType:', chatType, 'userId:', userId);
  
  try {
    // Get profile image
    console.log('Getting profile image for:', session.targetUsername);
    const imageUrl = await getProfileImage(session.targetUsername);
    
    // Always post vouches to the allowed group in the vouch thread
    const targetChatId = config.allowedGroupId;
    const threadId = config.vouchThreadId;
    
    console.log('Posting vouch to group:', targetChatId, 'thread:', threadId);

    if (session.existingVoteId) {
      // Existing vouch - update it
      console.log('Updating existing vouch with ID:', session.existingVoteId);
      
      const existingVote = await prisma.vote.findUnique({
        where: { id: session.existingVoteId }
      });
      
      if (!existingVote) {
        throw new Error('Existing vote not found');
      }
      
      // Add current user to upvoters if not already there
      const updatedUpvoters = existingVote.upvoterUsernames.includes(currentUser) 
        ? existingVote.upvoterUsernames 
        : [...existingVote.upvoterUsernames, currentUser];
      
      // Add current user to vouchers if not already there
      const existingVouchers = existingVote.voucherUsernames || [existingVote.createdBy];
      const updatedVouchers = existingVouchers.includes(currentUser)
        ? existingVouchers
        : [...existingVouchers, currentUser];
      
      // Merge descriptions
      let mergedDescription = existingVote.description || '';
      if (session.description && session.description.trim()) {
        if (mergedDescription) {
          // If there's existing description, add the new one with proper formatting
          mergedDescription = `${mergedDescription}\n\n${session.description}`;
        } else {
          // If no existing description, just use the new one
          mergedDescription = session.description;
        }
      }
      
      // Update the database
      const updatedVote = await prisma.vote.update({
        where: { id: session.existingVoteId },
        data: {
          voucherUsernames: updatedVouchers,
          upvoterUsernames: updatedUpvoters,
          description: mergedDescription
        }
      });
      
      console.log('Database update successful');
      
      // Delete old message if possible
      try {
        await ctx.telegram.deleteMessage(
          Number(existingVote.chatId), 
          Number(existingVote.messageId)
        );
        console.log('Old message deleted successfully');
      } catch (deleteError) {
        console.log('Could not delete old message (continuing anyway):', deleteError instanceof Error ? deleteError.message : String(deleteError));
      }
      
      // Create updated message
      console.log('Creating updated vouch message...');
      const sendOptions: any = {
        caption: formatVoteMessage(
          session.targetUsername,
          updatedUpvoters.length,
          existingVote.downvoterUsernames.length,
          updatedVouchers,
          existingVote.status,
          mergedDescription
        ),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: `✅ (${updatedUpvoters.length})`, callback_data: '/vote_up' },
            { text: `❌ (${existingVote.downvoterUsernames.length})`, callback_data: '/vote_down' }
          ]]
        }
      };

      // Add thread ID if specified
      if (threadId) {
        sendOptions.message_thread_id = parseInt(threadId);
      }

      const vouchMessage = await ctx.telegram.sendPhoto(targetChatId, imageUrl, sendOptions);
      
      // Update message ID in database
      await prisma.vote.update({
        where: { id: session.existingVoteId },
        data: {
          messageId: BigInt(vouchMessage.message_id)
        }
      });
      
      console.log('Updated vouch message created with ID:', vouchMessage.message_id);
      
    } else {
      // New vouch
      console.log('Creating new vouch message...');
      const sendOptions: any = {
        caption: formatVoteMessage(
          session.targetUsername,
          1,
          0,
          [currentUser],
          'pending',
          session.description
        ),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: `✅ (1)`, callback_data: '/vote_up' },
            { text: `❌ (0)`, callback_data: '/vote_down' }
          ]]
        }
      };

      // Add thread ID if specified
      if (threadId) {
        sendOptions.message_thread_id = parseInt(threadId);
      }

      const vouchMessage = await ctx.telegram.sendPhoto(targetChatId, imageUrl, sendOptions);

      console.log('Vouch message created with ID:', vouchMessage.message_id);
      
      // Save new vouch to database
      console.log('Saving new vouch to database...');
      await prisma.vote.create({
        data: {
          twitterUsername: session.targetUsername,
          messageId: BigInt(vouchMessage.message_id),
          chatId: BigInt(targetChatId),
          voucherUsernames: [currentUser],
          upvoterUsernames: [currentUser],
          downvoterUsernames: [],
          createdBy: currentUser,
          status: 'pending',
          description: session.description
        }
      });
      
      console.log('Database save successful');
    }
    
    // Show success message by editing the main message
    if (session.mainMessageId) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          `✅ <b>Vouch Successfully Created!</b>\n\n` +
          `Your vouch for @${session.targetUsername} has been posted to the group.`,
          { parse_mode: 'HTML' }
        );

        // Auto-delete success message after 5 seconds
        setTimeout(async () => {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, session.mainMessageId);
          } catch (error) {
            console.log('Could not delete success message:', error);
          }
        }, 5000);
      } catch (editError) {
        console.log('Could not edit message with success, sending new message:', editError);
        const successMsg = await ctx.reply(
          `✅ <b>Vouch Successfully Created!</b>\n\n` +
          `Your vouch for @${session.targetUsername} has been posted to the group.`,
          { parse_mode: 'HTML' }
        );
        
        // Auto-delete after 5 seconds
        setTimeout(async () => {
          try {
            await ctx.telegram.deleteMessage(ctx.chat.id, successMsg.message_id);
          } catch (error) {
            console.log('Could not delete success message:', error);
          }
        }, 5000);
      }
    }

    // Clear session
    sessionManager.clearVouchSession(userId);

  } catch (error) {
    console.error('Error finalizing vouch:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Edit the main message to show the error
    if (session.mainMessageId) {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          session.mainMessageId,
          undefined,
          '❌ Error creating vouch. Please try again.',
          { parse_mode: 'HTML' }
        );
      } catch (editError) {
        console.error('Failed to edit message with error:', editError);
        await ctx.reply('❌ Error creating vouch. Please try again.');
      }
    }
  }
}
