import { AspectRatioOption, StyleOption } from "./types";

export const TEXT_SUGGESTIONS = [
  {
    title: "Quantum Physics",
    text: "Explain quantum computing in 3 simple sentences.",
    icon: "Atom",
  },
  {
    title: "Poem about AI",
    text: "Write a short, beautiful poem about artificial intelligence and art.",
    icon: "Feather",
  },
  {
    title: "Healthy Snack",
    text: "Give me 3 quick ideas for a healthy, high-protein afternoon snack.",
    icon: "Apple",
  },
];

export const IMAGE_SUGGESTIONS = [
  {
    title: "Cyberpunk Rain",
    text: "A serene cyberpunk alleyway at night with glowing neon signs and rain puddles.",
    icon: "Sparkles",
  },
  {
    title: "Cozy Cottage",
    text: "A warm cozy cottage in a snowy pine forest at sunset, watercolor style.",
    icon: "Home",
  },
  {
    title: "Astronaut Mars",
    text: "An astronaut playing an acoustic guitar on a red mountain ridge of Mars.",
    icon: "Compass",
  },
];

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { value: "1:1", label: "1:1 Square", ratioClass: "aspect-square" },
  { value: "16:9", label: "16:9 Landscape", ratioClass: "aspect-video" },
  { value: "9:16", label: "9:16 Portrait", ratioClass: "aspect-[9/16]" },
  { value: "4:3", label: "4:3 Standard", ratioClass: "aspect-[4/3]" },
  { value: "3:4", label: "3:4 Classic", ratioClass: "aspect-[3/4]" },
];

export const STYLE_OPTIONS: StyleOption[] = [
  {
    value: "none",
    label: "No Preset Style",
    description: "Let the model decide based on your prompt wording",
  },
  {
    value: "photorealistic",
    label: "Photorealistic",
    description: "Camera lens, authentic lighting, cinematic shot",
  },
  {
    value: "3D render",
    label: "3D Render",
    description: "Vibrant octane render style, smooth clay or gloss",
  },
  {
    value: "minimalist",
    label: "Minimalist Art",
    description: "Flat illustration, clean vector shapes, elegant colors",
  },
  {
    value: "watercolor",
    label: "Watercolor Painting",
    description: "Soft pigment bleeds, wet-on-wet details, organic paper texture",
  },
  {
    value: "pixel art",
    label: "Retro Pixel Art",
    description: "Retro 16-bit sprites, dithering, limited color palette",
  },
  {
    value: "cyberpunk",
    label: "Cyberpunk Synthwave",
    description: "Glowing magenta and neon blue highlights, futuristic elements",
  },
  {
    value: "line art",
    label: "Minimalist Line Art",
    description: "Fine black ink contours on clean off-white background",
  },
];
