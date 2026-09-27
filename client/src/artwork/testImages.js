// Filenames map in order to ArtSlot_01 through ArtSlot_15.
// Preserve spelling/case; encode filenames so spaces work in browser requests.
// This temporary selection will be replaced by the popup's selected URLs.
const testImageFiles = [
  'CottonRiver.jpg',
  'Elephant.jpg',
  'Kanye.jpg',
  'LadyInTheForest.jpg',
  'MarioDTS.png',
  'MontogomeryCalendar.png',
  'Nest.jpg',
  'Portrait Study1.png',
  'Pure Souls.png',
  'QueensGambit.jpg',
  'Sargent.jpg',
  'Sargent2.jpg',
  'Sketch1.jpg',
  'Spoon.jpg',
  'Study.jpg',
];

export const testImageUrls = testImageFiles.map((filename) => `/test-art/${encodeURIComponent(filename)}`);
