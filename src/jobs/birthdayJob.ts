import * as cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { config } from '../config/env';

/**
 * Gets a random hour between 9 AM and 9 PM (9-21)
 */
function getRandomHour(): number {
  return Math.floor(Math.random() * (21 - 9 + 1)) + 9;
}

/**
 * Gets a random minute (0-59)
 */
function getRandomMinute(): number {
  return Math.floor(Math.random() * 60);
}

/**
 * Schedules the next birthday message at a random time
 */
function scheduleNextBirthdayMessage(bot: Telegraf): cron.ScheduledTask | null {
  const hour = getRandomHour();
  const minute = getRandomMinute();

  // Create cron expression for specific time: minute hour * * *
  const cronExpression = `${minute} ${hour} * * *`;

  console.log(`[Birthday Job] Scheduled next birthday message at ${hour}:${minute.toString().padStart(2, '0')}`);

  const task = cron.schedule(cronExpression, async () => {
    try {
      console.log('[Birthday Job] Sending birthday message...');

      // Send message to channel ID 41 (as message_thread_id)
      await bot.telegram.sendMessage(
        config.allowedGroupId,
        '/happy_birthday_foks',
        {
          message_thread_id: 41
        }
      );

      console.log('[Birthday Job] Birthday message sent successfully');

      // Stop current task
      task.stop();

      // Schedule next message for tomorrow at a new random time
      scheduleNextBirthdayMessage(bot);

    } catch (error) {
      console.error('[Birthday Job] Error sending birthday message:', error);
    }
  });

  return task;
}

/**
 * Initializes the birthday job scheduler
 */
export function initializeBirthdayJob(bot: Telegraf): void {
  console.log('[Birthday Job] Initializing birthday message scheduler...');

  // Skip in local development if no group ID is set
  if (config.isDevelopment && config.allowedGroupId === 'local') {
    console.log('[Birthday Job] Skipping in local development mode');
    return;
  }

  // Schedule the first message
  scheduleNextBirthdayMessage(bot);

  console.log('[Birthday Job] Birthday message scheduler initialized');
}
