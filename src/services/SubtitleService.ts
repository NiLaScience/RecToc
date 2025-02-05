interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

class SubtitleService {
  static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  static generateWebVTT(segments: TranscriptSegment[]): string {
    let vtt = 'WEBVTT\n\n';
    
    segments.forEach((segment) => {
      vtt += `${this.formatTime(segment.start)} --> ${this.formatTime(segment.end)}\n`;
      vtt += `${segment.text}\n\n`;
    });

    return vtt;
  }

  static createSubtitleTrack(video: HTMLVideoElement, segments: TranscriptSegment[]): void {
    // Remove any existing subtitle tracks
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }

    // Create a blob from the VTT content
    const vttContent = this.generateWebVTT(segments);
    const vttBlob = new Blob([vttContent], { type: 'text/vtt' });
    const vttUrl = URL.createObjectURL(vttBlob);

    // Create and add the track element
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'English';
    track.srclang = 'en';
    track.src = vttUrl;
    track.default = true;

    video.appendChild(track);

    // Clean up the URL when the video is unloaded
    video.addEventListener('unload', () => {
      URL.revokeObjectURL(vttUrl);
    });
  }

  static addSubtitlesToVideo(video: HTMLVideoElement, transcript: { segments: TranscriptSegment[] } | null): void {
    if (!transcript || !transcript.segments || transcript.segments.length === 0) {
      return;
    }

    this.createSubtitleTrack(video, transcript.segments);
  }
}

export default SubtitleService; 