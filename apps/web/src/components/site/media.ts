// Curated, verified Unsplash photography (license-free to hotlink; images.unsplash.com
// is allow-listed in next.config + CSP). Swap any URL for a /public/brand asset later.
const u = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

export const IMG = {
  team: u('1522071820081-009f0129c71c'),
  execWoman: u('1573496359142-b8d87734a5a2'),
  workspace: u('1497366754035-f200968a6e72'),
  family: u('1511895426328-dc8714191300'),
  wellness: u('1571019613454-1cb2f99b2d8b'),
  education: u('1503676260728-1c00da094a0b'),
  finance: u('1554224155-6726b3ff858f'),
  career: u('1507003211169-0a1dd7228f2d'),
  heroAbstract: u('1639762681485-074b7f938ba0'),
};
