import { Composer } from "telegraf";
import { message } from "telegraf/filters";
import { InputFile } from "telegraf/types";
import sharp from 'sharp';
const { getData, getPreview, getTracks, getDetails } =
  require('spotify-url-info')(fetch)

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function retry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY,
  context = ''
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`Retry attempt failed${context ? ` for ${context}` : ''}, attempts left: ${retries}`, error);
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay, context);
  }
}

export const spotifyCommand = Composer.on(message('text'), async (ctx, next) => {
  const text = ctx.message.text;
  let spotifyUrl = '';
  
  if (!text.includes('spotify.com/track/')) return next();

  try {
    const spotifyUrlRegex = /(https?:\/\/[^\s]+spotify\.com\/track\/[^\s]+)/;
    const match = text.match(spotifyUrlRegex);
    if (!match) return next();

    spotifyUrl = match[0];
    const additionalText = text.replace(spotifyUrl, '').trim();
    
    const data = await retry(async () => {
      const preview = await getPreview(spotifyUrl);
      if (!preview || !preview.image || !preview.audio) {
        throw new Error('Invalid preview data');
      }
      return preview;
    }, MAX_RETRIES, RETRY_DELAY, `Spotify preview: ${spotifyUrl}`);
    
    await ctx.deleteMessage(ctx.message.message_id);
    
    // Download and resize image
    const resizedImage = await retry(async () => {
      const imageResponse = await fetch(data.image);
      if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      const imageBuffer = await imageResponse.arrayBuffer();
      return sharp(Buffer.from(imageBuffer))
        .resize(320, 320)
        .jpeg({ quality: 80 })
        .toBuffer();
    });

    // Download audio
    const audioBuffer = await retry(async () => {
      const audioResponse = await fetch(data.audio);
      if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      return audioResponse.arrayBuffer();
    });
    
    const caption = `🎵 <b>${data.title}</b>\n` +
                   `💿 <b>${data.artist}</b>\n` +
                   `📱 Shared by: @${ctx.from.username || ctx.from.id}` +
                   (additionalText ? `\n\n💭 ${additionalText}` : '');
    
    await ctx.sendAudio(
      { source: Buffer.from(audioBuffer), filename: 'audio.mp3' },
      {
        caption: caption,
        parse_mode: 'HTML',
        title: data.title,
        performer: data.artist,
        duration: 30,
        thumbnail: { source: resizedImage, filename: 'thumbnail.jpg' },
        reply_markup: {
          inline_keyboard: [[
            { text: "🎧 Listen on Spotify", url: data.link }
          ]]
        }
      }
    );

  } catch (error) {
    console.error(`Error processing Spotify link ${spotifyUrl}:`, error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    await ctx.reply('zzz... something did not happen.');
  }
  await next();
});