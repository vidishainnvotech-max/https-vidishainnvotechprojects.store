import aiCropImage from "../assets/project-ai-crop.jpg";
import agricultureImage from "../assets/project-agriculture.jpg";
import roverImage from "../assets/project-rover.jpg";
import portalImage from "../assets/project-portal.jpg";

const IMAGES = [aiCropImage, agricultureImage, roverImage, portalImage];

export function getProjectImage(key) {
  const numeric = Number(key);

  const seed = Number.isNaN(numeric)
    ? String(key ?? "")
        .split("")
        .reduce((total, char) => total + char.charCodeAt(0), 0)
    : Math.trunc(numeric);

  return IMAGES[Math.abs(seed) % IMAGES.length];
}
