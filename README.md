# YouTube Audio Streamer

A Node.js application that streams audio files to YouTube while playing a fixed video. The application randomly selects from multiple audio files and automatically switches between them.

## Features

- Random selection from multiple audio files
- Continuous streaming with automatic audio switching
- Fixed video loop
- Easy deployment to Railway
- Docker support

## Prerequisites

- Node.js >= 18.0.0
- FFmpeg
- YouTube account with streaming enabled
- Railway account (for deployment)

## Local Development

1. Clone the repository:
```bash
git clone <your-repo-url>
cd youtube-audio-streamer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Update the `.env` file with your YouTube stream settings:
```
YOUTUBE_STREAM_URL=rtmp://x.rtmp.youtube.com/live2
YOUTUBE_STREAM_KEY=your-stream-key
PORT=3000
DEFAULT_VIDEO_PATH=./assets/default-video.mp4
```

5. Add your media files:
   - Place your video file as `default-video.mp4` in the `assets` folder
   - Add numbered audio files (1.mp3, 2.mp3, etc.) in the `assets` folder

6. Start the server:
```bash
npm start
```

## Railway Deployment

1. Fork this repository to your GitHub account

2. Create a new project on Railway:
   - Go to [Railway](https://railway.app/)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your forked repository

3. Set up environment variables in Railway:
   - Go to your project settings
   - Add the following variables:
     - `YOUTUBE_STREAM_URL`
     - `YOUTUBE_STREAM_KEY`
     - `DEFAULT_VIDEO_PATH`
     - `PORT`

4. Upload media files:
   - Use Railway's CLI to upload files to the assets directory:
   ```bash
   railway run "mkdir -p assets"
   railway upload ./local/path/to/video.mp4 assets/default-video.mp4
   railway upload ./local/path/to/1.mp3 assets/1.mp3
   # Repeat for other audio files
   ```

5. Deploy:
   - Railway will automatically deploy your application
   - Monitor the deployment in the Railway dashboard

## API Endpoints

- GET `/`: Health check endpoint
- POST `/start-stream`: Start streaming
  ```json
  {
    "streamKey": "your-youtube-stream-key"
  }
  ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| YOUTUBE_STREAM_URL | YouTube RTMP URL (usually rtmp://x.rtmp.youtube.com/live2) |
| YOUTUBE_STREAM_KEY | Your YouTube stream key |
| PORT | Port for the server (default: 3000) |
| DEFAULT_VIDEO_PATH | Path to the video file (default: ./assets/default-video.mp4) |

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT
