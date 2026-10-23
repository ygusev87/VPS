// Palette taken from the warm "engineering notebook" look of the reference
// site: cream paper, tan hairlines, navy ink, teal for interaction.
export const C = {
  bg: '#f6eddd',
  bgDeep: '#efe3d1',
  card: '#f9f2e5',
  line: '#cec0ad',
  lineSoft: '#e2d7c7',
  navy: '#18213d',
  navy2: '#24304a',
  ink: '#4f535b',
  teal: '#1aa3a1',
  tealDeep: '#3f7f8e',
  trace: '#d3bea3',
  red: '#e5533d',
  amber: '#f0a53a',
  green: '#3f8a4f',
  brass: '#c9a25a',
  metal: '#b9bdc6',
  warm: '#ffcf6b',
} as const;

/** Wire colours, cycled for wires that do not touch a battery. */
export const WIRE_COLORS = [C.teal, C.amber, C.green, '#8a63c9', '#2a56a3'];
