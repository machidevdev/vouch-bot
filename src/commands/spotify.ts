import { Composer } from "telegraf";
import { message } from "telegraf/filters";
import { InputFile } from "telegraf/types";
import sharp from 'sharp';
const { getData, getPreview, getTracks, getDetails } =
  require('spotify-url-info')(fetch)

export const spotifyCommand = Composer.on(message('text'), async (ctx, next) => {
  const text = ctx.message.text;
  
  if (!text.includes('spotify.com/track/')) return next();

  try {
    // Extract Spotify URL first
    const spotifyUrlRegex = /(https?:\/\/[^\s]+spotify\.com\/track\/[^\s]+)/;
    const match = text.match(spotifyUrlRegex);
    if (!match) return next();

    const spotifyUrl = match[0];
    const additionalText = text.replace(spotifyUrl, '').trim();
    
    const data = await getPreview(spotifyUrl);  // Pass only the URL
    if (!data) return;
    
    await ctx.deleteMessage(ctx.message.message_id);
    
    // Download and resize image
    const imageResponse = await fetch(data.image);
    const imageBuffer = await imageResponse.arrayBuffer();
    const resizedImage = await sharp(Buffer.from(imageBuffer))
      .resize(320, 320)
      .jpeg({ quality: 80 })
      .toBuffer();

    // Download audio
    const audioResponse = await fetch(data.audio);
    const audioBuffer = await audioResponse.arrayBuffer();
    
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
    console.error('Error processing Spotify link:', error);
  }
  await next();
});