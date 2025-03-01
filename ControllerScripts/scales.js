scaleIntervals = {
  Lydian: [2, 2, 2, 1, 2, 2, 1], // Major scale with raised 4th
  Major: [2, 2, 1, 2, 2, 2, 1], // Major scale
  Mixolydian: [2, 2, 1, 2, 2, 1, 2], // Major scale with lowered 7th
  Dorian: [2, 1, 2, 2, 2, 1, 2], // Major scale with lowered 3rd and 7th
  'Natural Minor': [2, 1, 2, 2, 1, 2, 2], // Major scale with lowered 3rd, 6th and 7th
  Phrygian: [1, 2, 2, 2, 1, 2, 2], // Major scale with lowered 2nd, 3rd, 6th and 7th
  Locrian: [1, 2, 2, 1, 2, 2, 2], // Major scale with lowered 2nd, 3rd, 5th, 6th and 7th
  'Harmonic Minor': [2, 1, 2, 2, 1, 3, 1], // Major scale with lowered 3rd and 6th
  'Melodic Minor': [2, 1, 2, 2, 2, 2, 1], // Major scale with lowered 3rd
  'Double Harmonic Minor': [1, 3, 1, 2, 1, 3, 1], // Major scale with lowered 2nd and 6th
  'Double Harmonic Major': [1, 3, 1, 2, 1, 3, 1], // Major scale with raised 4th and 7th
  'Phrygian Dominant': [1, 3, 1, 2, 1, 2, 2], // Major scale with lowered 2nd and 6th
  'Mixolydian Flat 6': [2, 2, 1, 2, 1, 2, 2], // Major scale with lowered 7th
  'Lydian Dominant': [2, 2, 2, 1, 2, 1, 2], // Major scale with raised 4th and lowered 7th
  'Lydian Diminished': [2, 1, 3, 1, 1, 2, 1], // W-H-3H-H-H-W-H
  'Lydian Augmented': [2, 2, 2, 2, 1, 2, 1], // W-W-W-W-H-W-H
  'Whole Tone': [2, 2, 2, 2, 2, 2],
  'Major Whole Tone': [2, 2, 1, 2, 1, 2, 1],
  'Minor Whole Tone': [2, 1, 2, 1, 2, 2, 2],
  Hirajoshi: [4, 2, 3, 4, 3],
  'Major Pentatonic': [2, 2, 3, 2, 3],
  'Minor Pentatonic': [3, 2, 2, 3, 2],
  Blues: [3, 2, 1, 1, 3, 2],
  Arabic: [2, 1, 3, 1, 2, 2, 1],
  Persian: [1, 3, 1, 1, 2, 3, 1], // H-3H-H-H-W-3H-H
  Prometheus: [2, 2, 2, 3, 1, 2], // W-W-W-3H-H-W
  Pelog: [1, 2, 4, 1, 4],
  Chromatic: [1], // All 12 notes - leave this last
  Ionian: [2, 2, 1, 2, 2, 2, 1], // Major scale (legacy)
  Aeolian: [2, 1, 2, 2, 1, 2, 2], // Minor (legacy)
  'Algerian': [2, 1, 3, 1, 1, 3, 1, 2, 1, 2],
  'Super Locrian': [1, 2, 1, 2, 2, 2, 2],
  'Augmented': [3, 1, 3, 1, 3, 1],
  'Bebop Dominant': [2, 2, 1, 2, 2, 1, 1, 1],
  'Enigmatic': [1, 3, 2, 2, 2, 1, 1],
  'Flamenco': [1, 3, 1, 2, 1, 3, 1],
  '"Gypsy"': [2, 1, 3, 1, 1, 2, 2],
  'Half diminished': [2, 1, 2, 1, 2, 2, 2],
  'Harmonic major': [2, 2, 1, 2, 1, 3, 1],
  'Hungarian minor': [2, 1, 3, 1, 1, 3, 1],
  'Hungarian major': [3, 1, 2, 1, 2, 1, 2],
  'In': [1, 4, 2, 1, 4],
  'Insen': [1, 4, 2, 3, 2],
  'Istrian': [1, 2, 1, 2, 1, 5],
  'Iwato': [1, 4, 1, 4, 2],
  'Lydian augmented': [2, 2, 2, 2, 1, 2, 1],
  'Lydian diminished': [2, 1, 3, 1, 2, 2, 1],
  'Major bebop (7)': [2, 2, 1, 2, 1, 2, 1],
  'Major bebop (8)': [2, 2, 1, 2, 1, 1, 2, 1],
  'Major Locrian': [2, 2, 1, 1, 2, 2, 2],
  'Major pentatonic': [2, 2, 3, 2, 3],
  'Neapolitan major': [1, 2, 2, 2, 2, 2, 1],
  'Neapolitan minor': [1, 2, 2, 2, 1, 3, 1],
  'Scale of harmonics': [3, 1, 1, 2, 2, 3],
  'Tritone': [1, 3, 2, 1, 3, 2],
  'Two-semitone tritone': [1, 1, 4, 1, 1, 4],
  'Ukrainian Dorian': [2, 1, 3, 1, 2, 1, 2],
  'Yo': [2, 3, 2, 2, 3],
  'Whole Tone Major': [2, 2, 2, 2, 2, 2], // Whole tone scale (major)
  'Whole Tone Minor': [2, 2, 2, 2, 2, 2], // Whole tone scale (minor)
  'Ionian Flat 5': [2, 2, 1, 2, 1, 2, 2], // Ionian scale with lowered 5th
  'Altered Dominant': [1, 2, 1, 2, 1, 2, 2], // Altered dominant scale
  Japanese: [2, 2, 3, 2, 3], // Traditional Japanese pentatonic scale
  Egyptian: [2, 2, 3, 2, 3], // Egyptian scale, similar to the Major Pentatonic
  Enigmatic: [1, 2, 3, 2, 1, 2, 2], // A rare and mysterious scale
  Acoustic: [2, 1, 2, 2, 2, 1, 2], // Also known as the "major locrian"
  'Raga Hamsadhwani': [2, 1, 2, 2, 1, 3], // A traditional Indian raga
  'Persian Major': [1, 3, 1, 2, 1, 3, 1], // Similar to the Harmonic Minor scale but with different intervals
  'Spanish Gypsy': [1, 2, 3, 1, 2, 3, 1], // A scale used in Flamenco and Spanish music
  Exotic: [1, 3, 1, 2, 1, 2, 2], // A mysterious scale used in some world music traditions
  Klezmer: [2, 1, 3, 1, 1, 3, 1], // A scale commonly used in Jewish music
  Bhairav: [1, 2, 3, 1, 2, 3, 1], // A traditional Indian raga
  'Hungarian Minor': [2, 1, 3, 1, 2, 3, 1], // A scale with a distinct Eastern European feel
  Bebop: [2, 1, 2, 1, 2, 1, 2, 1], // A jazz scale
  Neapolitan: [1, 2, 2, 2, 2, 2, 1], // A minor scale with a lowered 2nd and 5th
  'Lydian Augmented Flat 5': [2, 2, 2, 1, 1, 3, 1], // A variation of the Lydian scale with an altered 5th
  'Maqam Rast': [2, 1, 3, 2, 1, 3, 1], // A Middle Eastern scale
  'Maqam Bayati': [2, 1, 3, 2, 2, 2, 1], // A Middle Eastern scale
  'Romanian Minor': [2, 1, 3, 1, 2, 3, 1] // A scale with an exotic sound often used in Balkan music
}
