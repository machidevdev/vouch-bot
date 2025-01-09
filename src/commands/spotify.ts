import { Composer } from "telegraf";
import { message } from "telegraf/filters";
import { InputFile } from "telegraf/types";
import sharp from 'sharp';
const { getData, getPreview, getTracks, getDetails } =
  require('spotify-url-info')(fetch)

export const spotifyCommand = Composer.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  
  if (!text.includes('spotify.com/track/')) return;

  try {
    const data = await getPreview(text);
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
    
    await ctx.sendAudio(
      { source: Buffer.from(audioBuffer), filename: 'audio.mp3' },
      {
        caption: `🎵 <b>${data.title}</b>\n` +
                `💿 <b>${data.artist}</b>\n` +
                `📱 Shared by: @${ctx.from.username || ctx.from.id}`,
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
});