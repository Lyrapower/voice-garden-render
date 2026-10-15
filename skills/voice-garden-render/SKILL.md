---
name: voice-garden-render
description: Turn a song or any audio file into an audio-reactive particle music video (MP4), offline and frame-exact. Use when someone asks for a music video, a visualizer, a Spotify Canvas / Reel / Short / TikTok background for a track, or "make this song into a video". No footage, no stock assets, no paid API.
---

# voice-garden-render

Renders an audio file into an MP4 of the [Voice Garden](https://github.com/Lyrapower/voice-garden) particle field: a turning spiral of up to 200k particles over a night sky, its brightness, glow and colour driven by the music's loudness, onsets and timbre. The output keeps the original audio. The same audio, palette and seed always give the same video.

It does not cut footage to the beat or set lyrics. If someone wants a beat-cut edit of their own clips or a typographic video, say so and suggest a tool built for that, such as HyperFrames' music-to-video skill.

## 1. Check the machine (once)

Run these and stop with a clear message if one is missing:

```bash
node --version      # 20 or newer
ffmpeg -version     # any recent FFmpeg on PATH
```

Then get the renderer, from inside the folder where the video should end up or a scratch folder:

```bash
git clone --depth 1 https://github.com/Lyrapower/voice-garden-render
cd voice-garden-render && npm install && npx playwright-core install chromium
```

If Chromium is already installed elsewhere, skip the last step and set `VGR_BROWSER=/path/to/chromium`.

## 2. Pick the settings from what the person said

**Palette** (`--palette`). Choose by mood words; default `deep-space`:

| They say something like | Palette |
| --- | --- |
| space, night, dreamy, trance, synth, ambient, "like the demo" | `deep-space` (navy, cyan, magenta, gold) |
| warm, sunset, summer, lo-fi, nostalgic, pop | `sunset` (indigo, rose, orange, peach) |
| northern lights, calm, nature, meditation, chill | `aurora` (deep blue, teal, green, lilac) |
| fire, intense, rock, techno, aggressive, dark | `ember` (dark red, red, amber, cream) |
| cold, minimal, clean, piano, winter, classical | `ice` (navy, steel, ice blue, white) |

They can also give four colours, rim to core: `--palette "#1a2985,#1fc7f2,#eb1fb8,#ff991f"`. If they name brand colours, use those.

**Size** (`--size`), by where the video goes:

| Destination | Size |
| --- | --- |
| YouTube, a website, a slide, unspecified | `1280x720` (default) or `1920x1080` |
| Reels, Shorts, TikTok, Stories, Spotify Canvas | `1080x1920` |
| Instagram feed square | `1080x1080` |

**Length**: the whole file by default. For a clip, `--start <sec> --duration <sec>`. Spotify Canvas is 3-8 s; Reels and Shorts are usually 15-60 s.

**Other knobs**, only if asked: `--trails 0` for crisp particles with no light trails, `--no-sky` for a plain dark background, `--particles 50000` on a slow machine, `--seed <n>` for a different but repeatable layout, `--bloom <0-3>` for more or less glow.

## 3. Render

```bash
npx voice-garden-render "<path/to/song.mp3>" -o "<name>.mp4" --palette <palette> --size <WxH> [--start S --duration D]
```

Tell the person roughly how long it will take before starting:

- with a GPU, about real time to a few times real time;
- without a GPU (add `--software`), about 1-4 s per frame. A 30 s clip at 30 fps is about 900 frames, so it can take 15-60 minutes. Suggest a shorter clip, `--fps 24`, or a smaller size for a first look.

The command prints progress and exits non-zero with a reason on a missing input, a file with no audio, or a blank first frame (no WebGL; retry with `--software`).

## 4. Check before handing it over

```bash
ffprobe -v error -show_entries stream=codec_name,width,height -show_entries format=duration -of compact "<name>.mp4"
```

Expect `h264` and `aac`, the size you asked for, and a duration that matches the audio or the clip. Pull one frame from the middle and look at it before saying it is done:

```bash
ffmpeg -v error -ss <half the duration> -i "<name>.mp4" -frames:v 1 check.png
```

It should show a coloured spiral, not a black or white frame. Then give the person the MP4 path, and say which palette and size you used, so they can ask for another.

## Notes

- Everything runs locally. Nothing is uploaded, and there are no API keys.
- Code is MIT. The output video belongs to whoever owns the audio; the visuals add no rights claims.
- Source, options and tests: https://github.com/Lyrapower/voice-garden-render
