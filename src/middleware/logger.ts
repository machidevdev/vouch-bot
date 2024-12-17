import { Context, deunionize } from 'telegraf';
import { CallbackQuery } from 'telegraf/types';

export function loggerMiddleware<T extends Context>(ctx: T, next: () => Promise<void>) {
  const start = new Date();
  const message = deunionize(ctx.message);
  const messageText = message?.text;
  const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;

  // Log vouch commands and deletion messages
  if (messageText && (messageText.startsWith('/vouch') || /^[xX]$/.test(messageText))) {
    const messageInfo = {
      timestamp: start.toISOString(),
      type: messageText.startsWith('/vouch') ? 'vouch' : 'delete',
      from: ctx.from?.username || 'unknown',
      content: messageText,
      chatId: ctx.chat?.id.toString()
    };

    console.log('Action logged:', messageInfo);
  }
  
  // Log vote actions (thumbs up/down)
  if (callbackQuery?.data?.startsWith('vote_')) {
    const voteInfo = {
      timestamp: start.toISOString(),
      type: 'vote',
      action: callbackQuery.data === 'vote_up' ? 'upvote' : 'downvote',
      from: ctx.from?.username || 'unknown',
      messageId: callbackQuery.message?.message_id,
      chatId: callbackQuery.message?.chat.id.toString()
    };

    console.log('Vote logged:', voteInfo);
  }

  // Call next middleware
  return next();
} 