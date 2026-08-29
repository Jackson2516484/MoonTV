// 投屏工具：优先使用 Remote Playback API（Chromecast），回退 AirPlay
export function castCurrentVideo(
  video: HTMLVideoElement | null | undefined
): { ok: boolean; message?: string } {
  if (!video) {
    return { ok: false, message: '播放器未就绪' };
  }

  try {
    // 始终允许远程播放
    video.disableRemotePlayback = false;
    video.removeAttribute('disableRemotePlayback');

    const anyVideo = video as any;

    // Chrome / Android → Chromecast（Remote Playback API）
    if (video.remote && typeof video.remote.prompt === 'function') {
      video.remote
        .prompt()
        .then(() => {
          // 用户已选择投屏设备
        })
        .catch((err: unknown) => {
          console.warn('投屏被取消或失败:', err);
        });
      return { ok: true };
    }

    // iOS Safari → AirPlay
    if (typeof anyVideo.webkitShowPlaybackTargetPicker === 'function') {
      anyVideo.webkitShowPlaybackTargetPicker();
      return { ok: true };
    }

    return { ok: false, message: '当前设备不支持投屏' };
  } catch (err) {
    console.error('投屏失败:', err);
    return { ok: false, message: '投屏失败' };
  }
}

export function isCastSupported(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false;
  const anyVideo = video as any;
  return (
    (typeof video.remote !== 'undefined' &&
      typeof (video.remote as any)?.prompt === 'function') ||
    typeof anyVideo.webkitShowPlaybackTargetPicker === 'function'
  );
}