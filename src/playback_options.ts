export type PlayerKind = "audio" | "noaudio";

export function readPlaybackOptions(search: string) {
  const params = new URLSearchParams(search);
  return {
    player: params.get("player") === "noaudio" ? "noaudio" as const : "audio" as const,
    autoplay: params.get("autoplay") === "1",
  };
}
