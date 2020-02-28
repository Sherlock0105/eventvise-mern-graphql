// Render each frame of the animation to a video (additionally requires ffmpeg)

const fs = require('fs');
const path = require('path');
const {createCanvas} = require('canvas');
const lottie = require('lottie-node');
const {spawn} = require('child_process');

module.exports =
    async function renderAnimation({data, assetsPath, path, width, height, backgroundColor, codec, crf = 5, preset = 'fast', fps = 30}) {
        return await new Promise((resolve, reject) => {
                const canvas = createCanvas(width, height);
                const animation = lottie(data, canvas, {assetsPath});
                const frameCount = animation.getDuration(true);

                const args = [
                    '-v', 'error',
                    '-stats',
                    '-hide_banner',
                    '-y',
                    ...(backgroundColor ? ['-f', 'lavfi', '-i', `color=${backgroundColor}:${width}x${height}`] : []),
                    '-f', 'image2pipe', '-c:v', 'png', '-r', fps, '-i', '-',
                    ...(backgroundColor ? ['-filter_complex', '[0:v][1:v]overlay=shortest=1[out]', '-map', '[out]'] : []),
                    '-s', `${width}x${height}`, '-preset', preset, '-crf', crf,
                    ...(codec ? ['-vcodec', codec] : []),
                    '-an', path
                ];

                const process = spawn('ffmpeg', args);
                const {stdin} = process;
                stdin.on('error', err => {
                    if (err.code !== 'EPIPE') {
                        throw err;
                    }
                });
                process.on('exit', status => {
                    console.log('EXIT')
                    if (status) {
                        throw new Error(`FFMPEG ended with status: ${status}`);
                    }

                    resolve(1)
                });

                (function renderFrame(frame = 1) {
                    animation.goToAndStop(frame, true);
                    setImmediate(() => {
                        if (stdin.writable) {
                            if (frame <= frameCount) {
                                stdin.write(canvas.toBuffer());
                                renderFrame(frame + 1);
                            } else {
                                stdin.end();
                            }
                        }
                    });
                })();
            });
    };
