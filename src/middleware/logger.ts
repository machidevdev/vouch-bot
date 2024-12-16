import { Context, deunionize } from 'telegraf';

export function loggerMiddleware<T extends Context>(ctx: T, next: () => Promise<void>) {
  const start = new Date();
  const message = deunionize(ctx.message);
    const messageInfo = {
        timestamp: start.toISOString(),
        updateType: ctx.updateType,
        messageType: ctx.updateType,
        from: ctx.from?.username || 'unknown',
        content: message?.text || 'non-text content',
        chatId: ctx.chat?.id.toString()
    };

    console.log('Incoming message:', messageInfo);

    // Call next middleware and log processing time
    return next().then(() => {
        const ms = new Date().getTime() - start.getTime();
        console.log('Response time:', `${ms}ms`);
    });
} 