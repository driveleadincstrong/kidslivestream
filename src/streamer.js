import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

// Keep track of stream attempts and errors
let streamAttempts = 0;
const MAX_STREAM_ATTEMPTS = 5;
const STREAM_RETRY_DELAY = 10000; // 10 seconds
let isStreamHealthy = true;
let lastStreamCheck = Date.now();
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

async function getRandomVideoFile() {
    const videoFiles = [];
    // Generate numbers from 0 to 159 with leading zeros (3 digits)
    for (let i = 0; i <= 144; i++) {
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
let streamHealthCheck;

function resetStreamState() {
    streamAttempts = 0;
    isStreamHealthy = true;
    lastStreamCheck = Date.now();
}

function monitorStreamHealth() {
    if (currentStream) {
        const now = Date.now();
        if (now - lastStreamCheck > HEALTH_CHECK_INTERVAL) {
            if (!isStreamHealthy) {
                console.log('Stream health check failed. Attempting restart...');
                restartStream();
            }
            lastStreamCheck = now;
        }
    }
}

async function restartStream(config) {
    if (streamAttempts >= MAX_STREAM_ATTEMPTS) {
        console.error(`Maximum stream attempts (${MAX_STREAM_ATTEMPTS}) reached. Waiting for manual intervention.`);
        return;
    }

    console.log(`Attempting stream restart (attempt ${streamAttempts + 1}/${MAX_STREAM_ATTEMPTS})`);
    streamAttempts++;

    try {
        await startStream(config);
        resetStreamState();
    } catch (error) {
        console.error('Error during stream restart:', error);
        setTimeout(() => restartStream(config), STREAM_RETRY_DELAY);
    }
}

export async function startStream({ streamKey, streamUrl }) {
    console.log('Starting stream with configuration:', {
        streamUrl,
        streamKeyLength: streamKey?.length
    });

    // Get a random video file that hasn't been played recently
    let videoPath;
    do {
        videoPath = await getRandomVideoFile();
    } while (lastPlayedVideos.has(videoPath) && lastPlayedVideos.size < 61);

    lastPlayedVideos.add(videoPath);
    
    if (lastPlayedVideos.size >= 61) {
        lastPlayedVideos.clear();
        console.log('All videos have been played, resetting playlist');
    }

    const streamDestination = `${streamUrl}/${streamKey}`;

    if (currentStream) {
        try {
            currentStream.kill('SIGTERM');
            clearInterval(streamHealthCheck);
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
                '-stream_loop -1', // Loop the input indefinitely
                '-threads 4', // Limit threads
                '-reconnect 1', // Enable reconnection
                '-reconnect_streamed 1', // Reconnect if stream fails
                '-reconnect_delay_max 5', // Maximum reconnection delay in seconds
            ])
            .videoCodec('libx264')
            .outputOptions([
                '-preset veryfast', // Changed from ultrafast for better stability
                '-tune zerolatency',
                '-maxrate 2000k', // Increased bitrate for better quality
                '-bufsize 4000k', // Increased buffer size
                '-pix_fmt yuv420p',
                '-g 60', // Increased GOP size for better compression
                '-keyint_min 48', // Minimum GOP size
                '-sc_threshold 0', // Disable scene change detection
                '-f flv',
                '-threads 4',
                '-cpu-used 4',
                '-retry_on_error 1', // Retry on error
                '-stimeout 30000000', // Socket timeout (30 seconds)
            ])
            .on('start', (command) => {
                console.log('FFmpeg process started with command:', command);
                console.log('Stream started with video file:', videoPath);
                currentStream = stream;
                isStreamHealthy = true;
                lastStreamCheck = Date.now();

                // Set up stream health monitoring
                streamHealthCheck = setInterval(() => {
                    monitorStreamHealth();
                }, HEALTH_CHECK_INTERVAL);

                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error('Streaming error:', err.message);
                console.error('FFmpeg stdout:', stdout);
                console.error('FFmpeg stderr:', stderr);
                isStreamHealthy = false;
                
                if (err.message.includes('SIGKILL') || err.message.includes('Connection refused') || err.message.includes('Connection timed out')) {
                    console.log('Stream interrupted, attempting restart...');
                    setTimeout(() => {
                        restartStream({ streamKey, streamUrl });
                    }, STREAM_RETRY_DELAY);
                }
            })
            .on('end', () => {
                console.log('Stream ended normally');
                isStreamHealthy = false;
                // Attempt to restart the stream
                setTimeout(() => {
                    restartStream({ streamKey, streamUrl });
                }, STREAM_RETRY_DELAY);
            });

        stream.save(streamDestination);
    });
}
