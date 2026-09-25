import {
  BufferSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

function reportProgress(track, fraction) {
  self.postMessage({ type: "progress", track, fraction: Math.max(0, Math.min(0.99, fraction)) });
}

async function getTrackDuration(track) {
  const metadataDuration = Number(await track.getDurationFromMetadata());
  if (Number.isFinite(metadataDuration) && metadataDuration > 0) return metadataDuration;
  const computedDuration = Number(await track.computeDuration());
  if (!Number.isFinite(computedDuration) || computedDuration <= 0) {
    throw new Error("无法确认音视频轨时长，已阻止生成文件");
  }
  return computedDuration;
}

function validateTrackDurations(videoDuration, audioDuration, expectedDuration) {
  const referenceDuration = expectedDuration > 0 ? expectedDuration : Math.max(videoDuration, audioDuration);
  const tolerance = Math.max(3, referenceDuration * 0.03);
  if (expectedDuration > 0 && Math.abs(videoDuration - expectedDuration) > tolerance) {
    throw new Error(`视频轨时长 ${videoDuration.toFixed(1)} 秒与当前视频 ${expectedDuration.toFixed(1)} 秒不符，已阻止生成文件`);
  }
  if (expectedDuration > 0 && Math.abs(audioDuration - expectedDuration) > tolerance) {
    throw new Error(`音频轨时长 ${audioDuration.toFixed(1)} 秒与当前视频 ${expectedDuration.toFixed(1)} 秒不符，已阻止生成文件`);
  }
  if (Math.abs(videoDuration - audioDuration) > tolerance) {
    throw new Error(`音视频轨时长不一致（${videoDuration.toFixed(1)} / ${audioDuration.toFixed(1)} 秒），已阻止生成文件`);
  }
}

async function copyPackets(inputTrack, outputSource, decoderConfig, label, duration) {
  const sink = new EncodedPacketSink(inputTrack);
  let count = 0;
  for await (const packet of sink.packets()) {
    await outputSource.add(packet, count === 0 && decoderConfig ? { decoderConfig } : undefined);
    count += 1;
    if ((count & 63) === 0) {
      reportProgress(label, duration > 0 ? packet.timestamp / duration : 0);
    }
  }
  outputSource.close();
  reportProgress(label, 0.99);
  if (count === 0) throw new Error(`没有读取到${label === "video" ? "视频" : "音频"}编码包`);
  return count;
}

async function remux(message) {
  const videoInput = new Input({ source: new BufferSource(message.video), formats: [MP4] });
  const audioInput = new Input({ source: new BufferSource(message.audio), formats: [MP4] });
  let output;
  try {
    const [videoTrack, audioTrack] = await Promise.all([
      videoInput.getPrimaryVideoTrack(),
      audioInput.getPrimaryAudioTrack(),
    ]);
    if (!videoTrack || !audioTrack) throw new Error("无法识别音视频轨；可改用分轨下载");

    const [videoCodec, audioCodec, videoConfig, audioConfig] = await Promise.all([
      videoTrack.getCodec(),
      audioTrack.getCodec(),
      videoTrack.getDecoderConfig(),
      audioTrack.getDecoderConfig(),
    ]);
    if (!videoCodec || !audioCodec || !videoConfig || !audioConfig) {
      throw new Error("编码信息不完整；可改用分轨下载");
    }
    const expectedDuration = Number(message.duration) || 0;
    const [videoDuration, audioDuration] = await Promise.all([
      getTrackDuration(videoTrack),
      getTrackDuration(audioTrack),
    ]);
    validateTrackDurations(videoDuration, audioDuration, expectedDuration);

    const videoSource = new EncodedVideoPacketSource(videoCodec);
    const audioSource = new EncodedAudioPacketSource(audioCodec);
    const target = new BufferTarget();
    output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    output.addVideoTrack(videoSource, { decoderConfig: videoConfig });
    output.addAudioTrack(audioSource, { decoderConfig: audioConfig });
    if (message.title) output.setMetadataTags({ title: message.title });
    await output.start();

    const duration = expectedDuration;
    const [videoPackets, audioPackets] = await Promise.all([
      copyPackets(videoTrack, videoSource, videoConfig, "video", duration),
      copyPackets(audioTrack, audioSource, audioConfig, "audio", duration),
    ]);
    await output.finalize();
    if (!target.buffer) throw new Error("MP4 封装未生成输出数据");

    self.postMessage({
      type: "done",
      buffer: target.buffer,
      videoPackets,
      audioPackets,
      bytes: target.buffer.byteLength,
    }, [target.buffer]);
  } catch (error) {
    if (output && output.state !== "finalized" && output.state !== "canceled") {
      try { await output.cancel(); } catch {}
    }
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message.slice(0, 240) : "MP4 封装失败",
    });
  } finally {
    await Promise.allSettled([videoInput.dispose(), audioInput.dispose()]);
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "remux") return;
  void remux(event.data);
});
