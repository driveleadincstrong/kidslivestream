import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

async function getRandomVideoFile() {
    const videoFiles = [];
    // Generate numbers from 0 to 159 with leading zeros (3 digits)
    for (let i = 0; i <= 159; i++) {
        videoFiles.push(`./assets/${i.toString().padStart(3, '0')}.mp4`);
    }
    
    // Randomly select a video file
    const randomIndex = Math.floor(Math.random() * videoFiles.length);
    const selectedFile = videoFiles[randomIndex];
    
    try {
        await fs.access(selectedFile);
        console.log('Selected video file:', selectedFile);
        return selectedFile;
    } catch (error) {
        console.error(`Failed to access video file ${selectedFile}`);
        throw new Error(`Video file ${selectedFile} not found. Please ensure all video files (000.mp4 through 159.mp4) are present in the assets directory.`);
    }
}

let currentStream = null;
let lastPlayedVideos = new Set(); // Keep track of recently played videos

export async function startStream({ streamKey, streamUrl }) {
    console.log('Starting stream with configuration:', {
        streamUrl,
        // Don't log the full stream key for security
        streamKeyLength: streamKey?.length
    });

    // Get a random video file that hasn't been played recently
    let videoPath;
    do {
        videoPath = await getRandomVideoFile();
    } while (lastPlayedVideos.has(videoPath) && lastPlayedVideos.size < 61);

    // Add to recently played list
    lastPlayedVideos.add(videoPath);
    
    // Reset the list if we've played all videos
    if (lastPlayedVideos.size >= 61) {
        lastPlayedVideos.clear();
        console.log('All videos have been played, resetting playlist');
    }

    const streamDestination = `${streamUrl}/${streamKey}`;

    // If there's an existing stream, kill it properly
    if (currentStream) {
        try {
            currentStream.kill('SIGTERM');
        } catch (error) {
            console.error('Error killing previous stream:', error);
        }
    }

    return new Promise((resolve, reject) => {
        console.log('Initializing FFmpeg stream...');
        
        const stream = ffmpeg()
            .input(videoPath)
            .inputOptions([
                '-re', // Read input at native frame rate
                '-threads 4' // Limit threads
            ])
            .videoCodec('libx264')
            .outputOptions([
                '-preset ultrafast', // Fastest encoding
                '-tune zerolatency', // Minimize latency
                '-maxrate 1500k', // Reduced bitrate
                '-bufsize 3000k',
                '-pix_fmt yuv420p',
                '-g 50',
                '-f flv',
                '-threads 4', // Limit threads
                '-cpu-used 4' // Reduce CPU usage
            ])
            .on('start', (command) => {
                console.log('FFmpeg process started with command:', command);
                console.log('Stream started with video file:', videoPath);
                currentStream = stream;
                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error('Streaming error:', err.message);
                console.error('FFmpeg stdout:', stdout);
                console.error('FFmpeg stderr:', stderr);
                
                // If the stream was killed, attempt to restart after a delay
                if (err.message.includes('SIGKILL')) {
                    console.log('Stream was killed, attempting restart in 5 seconds...');
                    setTimeout(() => {
                        startStream({ streamKey, streamUrl })
                            .catch(err => console.error('Error in restart attempt:', err));
                    }, 5000);
                }
                
                reject(err);
            })
            .on('end', () => {
                console.log('Stream ended, restarting with new video...');
                currentStream = null;
                // Restart stream with a new random video file after a short delay
                setTimeout(() => {
                    startStream({ streamKey, streamUrl })
                        .catch(err => console.error('Error restarting stream:', err));
                }, 2000);
            });

        // Save with lower quality settings
        stream.save(streamDestination);
    });
}
