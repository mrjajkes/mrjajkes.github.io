const audio = document.querySelector('#catalog-audio');
const player = document.querySelector('#audio-player');
const toggle = player?.querySelector('.audio-toggle');
const toggleIcon = toggle?.querySelector('span');
const title = document.querySelector('#audio-title');
const status = document.querySelector('#audio-status');
const progress = document.querySelector('#audio-progress');
const volume = document.querySelector('#audio-volume');
const mute = document.querySelector('#audio-mute');
const volumeOn = mute?.querySelector('.volume-on');
const volumeOff = mute?.querySelector('.volume-off');
const time = document.querySelector('#audio-time');
const tracks = [...document.querySelectorAll('.track[data-audio]')];

if (audio && player && toggle && toggleIcon && title && status && progress && volume &&
    mute && volumeOn && volumeOff && time) {
  let activeTrack = null;

  const savedVolume = Number(localStorage.getItem('mrjajkes-volume'));
  audio.volume = Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1
    ? savedVolume
    : Number(volume.value);
  volume.value = String(audio.volume);

  const formatTime = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  };

  const updateState = () => {
    const playing = !audio.paused;
    toggleIcon.textContent = playing ? '\u275A\u275A' : '\u25B6';
    toggle.setAttribute('aria-label', playing ? 'Pause current track' : 'Play current track');

    for (const track of tracks) {
      const active = track === activeTrack;
      track.setAttribute('aria-pressed', String(active && playing));
      track.querySelector('.track-action').textContent = active && playing ? '\u275A\u275A' : '\u25B6';
    }
  };

  const updateVolume = () => {
    const muted = audio.muted || audio.volume === 0;
    mute.setAttribute('aria-pressed', String(muted));
    mute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    volumeOn.hidden = muted;
    volumeOff.hidden = !muted;
    volume.value = String(audio.volume);
  };

  const updateProgress = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    progress.value = duration ? String((audio.currentTime / duration) * 100) : '0';
    time.value = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
  };

  const play = async () => {
    try {
      status.textContent = 'now playing';
      await audio.play();
    } catch (error) {
      status.textContent = 'playback unavailable';
      updateState();
      console.error('Unable to play audio', error);
    }
  };

  tracks.forEach(track => {
    track.addEventListener('click', async () => {
      if (track === activeTrack) {
        if (audio.paused) await play();
        else audio.pause();
        return;
      }

      activeTrack = track;
      audio.pause();
      audio.src = track.dataset.audio;
      title.textContent = track.dataset.title;
      player.hidden = false;
      updateProgress();
      updateState();
      await play();
    });
  });

  toggle.addEventListener('click', async () => {
    if (!activeTrack) return;
    if (audio.paused) await play();
    else audio.pause();
  });

  progress.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = (Number(progress.value) / 100) * audio.duration;
  });

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    if (audio.volume > 0) audio.muted = false;
    localStorage.setItem('mrjajkes-volume', volume.value);
  });

  mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
  });

  audio.addEventListener('play', updateState);
  audio.addEventListener('pause', updateState);
  audio.addEventListener('ended', updateState);
  audio.addEventListener('volumechange', updateVolume);
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('timeupdate', updateProgress);

  updateState();
  updateProgress();
  updateVolume();
}
