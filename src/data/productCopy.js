// Product-page copy. Original wording based on how the maker sells the item:
// what it is and how it is packed. Flavor, size and color lists stay on the
// variant row, not in this sentence.

function puffCount(name) {
  const k = String(name).match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Number(k[1]) * 1000;
  const n = String(name).match(/(\d{3,6})\s*-?\s*puff/i);
  if (n) return Number(n[1]);
  return null;
}
function withPuffs(name, sentence) {
  const n = puffCount(name);
  if (!n || sentence.includes(String(n))) return sentence;
  return sentence.replace(/\.$/, '') + `, sold as the ${n.toLocaleString('en-US')}-puff device.`;
}

const BRAND = {
  'Swisher Sweets'(p) {
    if (/leaf wrap/i.test(p.name)) return 'Natural tobacco leaf wraps from Swisher Sweets, cut for the counter and packed by the leaf style on the label.';
    if (/leaf/i.test(p.name)) return 'Natural-leaf cigars from Swisher Sweets, rolled in tobacco leaf instead of a sheet wrapper.';
    if (/twin/i.test(p.name)) return 'A Swisher Sweets twin pack that pairs the Mini with a regular cigarillo. Both are sweet-tipped and sealed in foil.';
    if (/mini/i.test(p.name)) return 'The short Swisher Sweets cigarillo, with the same sweet tip and slow burn as the full size.';
    if (/BLK/i.test(p.name)) return 'Swisher Sweets BLK cigarillos with a darkened sweet tip, two to a resealable foil pouch.';
    return 'Sweet-tipped cigarillos with a homogenized tobacco wrapper. They come in a resealable foil pouch so the rest of the pack stays soft.';
  },
  'White Owl'(p) {
    if (/mini/i.test(p.name)) return 'The short White Owl cigarillo, machine-made with a sweetened wrapper and packed for the counter.';
    return 'Machine-made cigarillos with a sweetened homogenized wrapper, sealed in a foil pouch.';
  },
  Game(p) {
    if (/leaf/i.test(p.name)) return 'Game Leaf cigars rolled in natural leaf and packed in a small pouch.';
    if (/mini/i.test(p.name)) return 'The small-ring Game cigarillo, with the same sweet wrapper as the full size.';
    return 'Value cigarillos with a sweetened wrapper, packed in foil for the counter.';
  },
  "4K's"(p) {
    if (/wrap/i.test(p.name)) return "4K's flavored cigar wraps, a homogenized sheet cut and packed for rolling.";
    return "4K's cigarillos with a sweetened wrapper, the value pouch next to Game and Swisher on the counter.";
  },
  'Royal Blunts'(p) {
    if (/mini/i.test(p.name)) return 'Royal Blunts mini cigarillos, a short blunt-style smoke in a small pack.';
    return 'Royal Blunts EZ Roll, a slow-burning blunt wrap sold flat so it rolls without cracking.';
  },
  Backwoods(p) {
    if (/true wrap/i.test(p.name)) return 'Backwoods True Wraps, a uniform leaf wrap made to roll like a Backwoods cigar.';
    if (/true pack/i.test(p.name)) return 'Backwoods True, the homogenized-leaf Backwoods, two to a pack.';
    if (/single/i.test(p.name)) return 'A single Backwoods cigar, rolled in a whole tobacco leaf with the stem still in.';
    return 'Backwoods cigars rolled in a whole natural tobacco leaf, five to a resealable pouch.';
  },
  'Black & Mild'(p) {
    if (/5-pack/.test(p.name)) return 'Black & Mild pipe-tobacco cigars in a five-count pack. Most styles finish with a wood tip or a plastic tip.';
    return 'Black & Mild pipe-tobacco cigars in the upright 25-count box. The classic styles are finished with a wood tip.';
  },
  'Dutch Masters'() {
    return 'Dutch Masters cigarillos, two to a foil pouch, with the brand\'s sweet homogenized wrapper.';
  },
  'Good Times'(p) {
    if (/paper/i.test(p.name)) return 'Good Times rolling papers packed in a jar for the counter.';
    return 'Good Times Flat Wraps, thin flavored cigar wraps pressed flat so they store in a small pack.';
  },
  'Zig-Zag'(p) {
    if (/hemp/i.test(p.name)) return 'Zig-Zag hemp wraps, two to a pack, made from hemp rather than tobacco leaf.';
    return 'Zig-Zag cigar wraps in the counter display, the same gummed-paper house as their rolling papers.';
  },
  'Al Capone'(p) {
    if (/leaf/i.test(p.name)) return 'Al Capone leaf wraps, a small natural-leaf wrap for a single roll.';
    if (/without filter/i.test(p.name)) return 'Al Capone slender cigars in the tower pack, without a filter.';
    if (/filter/i.test(p.name)) return 'Al Capone slender cigars with a filter, in the upright tower pack.';
    if (/10-pack/.test(p.name)) return 'Al Capone small cigars, ten to a pack.';
    return 'Al Capone small cigars, the Italian dry-cured style in a compact pack.';
  },
  'Garcia y Vega'() { return 'Garcia y Vega cigars, a sweet tipped cigar in the classic green pack.'; },
  Djarum() { return 'Djarum clove cigars, rolled with tobacco and clove spice in the Indonesian kretek style.'; },
  'Hav-A-Tampa'() { return 'Hav-A-Tampa cigars with a wood tip, the Tampa sweet-cigar style sold in a small pack.'; },
  Jackpot() { return 'Jackpot cigarillos, a value sweet cigarillo in a foil pouch.'; },
  Optimo() { return 'Optimo cigars, a slim sweet cigar often finished with a tip.'; },
  'Snoop Dogg'(p) {
    return p.name.includes('4-pack')
      ? 'Snoop Dogg cigarillos, four to a pack, a blunt-style smoke with a slow burn.'
      : 'Snoop Dogg cigarillos, two to a pack, a blunt-style smoke with a slow burn.';
  },
  Slapwoods(p) {
    return /single/i.test(p.name)
      ? 'A single Slapwoods wrap, natural leaf sold one wrap at a time.'
      : 'Slapwoods natural-leaf cigar wraps, five wraps to a pack.';
  },
  LooseLeaf(p) {
    if (/5-pack/.test(p.name)) return 'LooseLeaf flavored wraps, five to a pack.';
    if (/2-pack/.test(p.name)) return 'LooseLeaf flavored wraps, two to a pack, a soft sheet made for rolling.';
    if (/crushed/i.test(p.name)) return 'LooseLeaf crushed leaf, broken tobacco leaf for blending into a roll.';
    if (/slug/i.test(p.name)) return 'LooseLeaf slugs, compressed leaf pieces sold for rolling.';
    if (/split|diamond/i.test(p.name)) return 'LooseLeaf Diamond wraps in the splits cut, a wider leaf piece than the standard wrap.';
    return 'LooseLeaf tobacco wraps, a soft flavored sheet packed for the counter.';
  },
  'Grabba Leaf'() { return 'Grabba Leaf, a whole tobacco leaf sold for wrapping, in the large and small cuts.'; },
  'King Palm'(p) {
    return /goji/i.test(p.name)
      ? 'King Palm Goji wraps, a leaf wrap from the same house as the King Palm roll.'
      : 'King Palm rolls, a hand-rolled palm leaf with a corn-husk filter built into the roll.';
  },
  'Wild Hemp'() { return 'Wild Hemp wraps made from hemp, two to a pack, with no tobacco in the wrap itself.'; },
  'High Hemp'() { return 'High Hemp organic hemp wraps, a tobacco-free wrap packed for the counter.'; },
  Billionaire() { return 'Billionaire hemp wraps, a tobacco-free wrap in a small counter pack.'; },
  'Tyson 2.0'(p) {
    return /paper/i.test(p.name)
      ? 'Tyson 2.0 rolling papers, gummed papers in the Futurola collaboration pack.'
      : 'Tyson 2.0 blunt wraps by Futurola, a slow-burning wrap in a counter display box.';
  },
  'Bob Marley'(p) {
    if (/cone/i.test(p.name)) return 'Bob Marley pre-rolled cones, papers already shaped so they only need to be filled.';
    if (/wrap/i.test(p.name)) return 'Bob Marley wraps, a hemp wrap in the brand\'s counter pack.';
    return 'Bob Marley rolling papers, unbleached and gummed, in the classic and organic cuts.';
  },
  RAW(p) {
    if (/tip/i.test(p.name)) return 'RAW rolling tips, unrefined paper tips that sit in the end of a roll.';
    if (/guarana/i.test(p.name)) return 'RAW Guarana wraps, a wrap made with guarana leaf rather than a tobacco sheet.';
    if (/cone/i.test(p.name)) return 'RAW pre-rolled cones in Classic, Organic and Black. The cone is already formed and open at the wide end.';
    return 'RAW rolling papers, unrefined gummed paper in the Classic 1 1/4 and king-size slim cuts.';
  },
  OCB(p) {
    return /cone/i.test(p.name)
      ? 'OCB pre-rolled cones, the French rolling-paper house\'s ready-formed cones.'
      : 'OCB rolling papers, thin gummed papers from the French mill.';
  },
  JOB(p) {
    return /jar/i.test(p.name) || /red/i.test(p.name)
      ? 'JOB rolling papers in the red jar, fine gummed papers packed for the counter.'
      : 'JOB fine gummed rolling papers, sold in the jar or the box.';
  },
  TOP() { return 'TOP fine gummed rolling papers, a thin paper sold in the jar and the box.'; },
  ZYN(p) {
    if (/european/i.test(p.name)) return 'ZYN nicotine pouches in a European assortment. Tobacco-free pouches in the slim can, mixed strengths and flavors as the tin is packed.';
    if (/6mg/.test(p.name)) return 'ZYN tobacco-free nicotine pouches, 6 mg of nicotine per pouch, in the slim white can.';
    if (/3mg/.test(p.name)) return 'ZYN tobacco-free nicotine pouches, 3 mg of nicotine per pouch, in the slim white can.';
    return 'ZYN tobacco-free nicotine pouches in a slim can. Nothing is smoked or chewed; the pouch sits under the lip.';
  },
  ALP(p) { return `ALP tobacco-free nicotine pouches${/9mg/.test(p.name) ? ', 9 mg per pouch' : ', 6 mg per pouch'}. A small white pouch for under the lip, sold in a can.`; },
  PIK(p) {
    if (/16mg/.test(p.name)) return 'PIK tobacco-free nicotine pouches, 16 mg per pouch, 20 pouches to a can.';
    return 'PIK tobacco-free nicotine pouches, 6 mg per pouch, sold in a can.';
  },
  Rouge() { return 'Rouge tobacco-free nicotine pouches in a slim can, made to sit under the lip.'; },
  Gambler(p) {
    if (/tube cut/i.test(p.name)) return 'Gambler Tube Cut filter tubes, a pre-formed tube with the filter already attached, 200 to a box.';
    if (/tube/i.test(p.name)) return 'Gambler filter cigarette tubes for roll-your-own, 200 tubes to a box.';
    if (/big bag/i.test(p.name)) return 'Gambler pipe tobacco in the large bag, a blend sold for packing a pipe or a roll.';
    return 'Gambler pipe tobacco in the small bag.';
  },
  OHM(p) {
    return /big/i.test(p.name)
      ? 'OHM pipe tobacco in the large bag.'
      : 'OHM pipe tobacco in the small bag.';
  },
  'American Club'(p) {
    return /big/i.test(p.name)
      ? 'American Club pipe tobacco in the large bag.'
      : 'American Club pipe tobacco in the small bag.';
  },
  Shargio() { return 'Shargio filter cigarette tubes, boxed for roll-your-own in king size and 100s.'; },
  Seneca(p) {
    return /filtered cigar/i.test(p.name)
      ? 'Seneca filtered cigars, a little cigar in a cigarette-style pack with a filter tip.'
      : 'Seneca cigarettes in 100s and king-size shorts, a value pack for the licensed counter.';
  },
  '24/7'() { return '24/7 cigarettes in 100s and king-size shorts, a value cigarette packed for the counter.'; },
  Cheyenne() { return 'Cheyenne filtered cigars, little cigars with a filter in a cigarette-style box.'; },
  'American Spirit'() { return 'American Spirit roll-your-own tobacco, a whole-leaf blend in a pouch.'; },
  Bugler() { return 'Bugler roll-your-own cigarette tobacco in a pouch, with the fine cut made for a hand roll.'; },
  Kite() { return 'Kite menthol roll-your-own tobacco in a pouch, cut for cigarette papers.'; },
  'Geek Bar'(p) {
    if (/mate/i.test(p.name) && /pod/i.test(p.name)) return 'Prefilled pods for the Geek Bar Mate. The pod carries the liquid; the Mate body is reused.';
    if (/mate/i.test(p.name)) return withPuffs(p.name, 'Geek Bar Mate, a reusable-style disposable sold with its pod.');
    if (/pod/i.test(p.name)) return 'Replacement pods for the Geek Bar device named on the pack. Each pod is prefilled and pushes onto the battery.';
    if (/pulse x/i.test(p.name)) return withPuffs(p.name, 'Geek Bar Pulse X disposable, with the curved screen and a regular and pulse mode. It is prefilled and draws to fire.');
    if (/pulse 2/i.test(p.name)) return withPuffs(p.name, 'Geek Bar Pulse 2, the next Pulse disposable, prefilled with a screen and a pulse mode.');
    if (/pulse/i.test(p.name)) return withPuffs(p.name, 'Geek Bar Pulse disposable, prefilled, with a screen and a pulse mode that draws harder than the regular mode.');
    if (/clr/i.test(p.name)) return 'Geek Bar CLR, a clear-body disposable that shows the liquid, prefilled and draw-activated.';
    if (/x2/i.test(p.name)) return withPuffs(p.name, 'Geek Bar X2 disposable, prefilled and draw-activated.');
    return withPuffs(p.name, 'A Geek Bar disposable vape, prefilled and draw-activated.');
  },
  Foger(p) {
    if (/pod/i.test(p.name)) return 'Replacement pods for the Foger Switch Pro. The pod is prefilled and seats in the charging body.';
    if (/bit/i.test(p.name)) return withPuffs(p.name, 'Foger Bit disposable, a compact prefilled device.');
    return 'Foger Switch Pro sold as a full kit: the disposable pod and the power bank that recharges it. The pod comes prefilled.';
  },
  RAZ(p) {
    if (/pod/i.test(p.name)) return 'Prefilled pods for the RAZ Vue. The pod swaps onto the device.';
    if (/vue full/i.test(p.name)) return 'RAZ Vue sold as a full kit, the device and its prefilled pod together.';
    return withPuffs(p.name, 'RAZ disposable vape, prefilled and draw-activated.');
  },
  Kangvape(p) { return withPuffs(p.name, 'Kangvape disposable, prefilled and draw-activated.'); },
  'Lost Mary'() { return withPuffs('Lost Mary 35K', 'Lost Mary disposable, the Elf Bar house\'s prefilled device, draw-activated.'); },
  Juul(p) {
    return /4-pack/.test(p.name)
      ? 'JUUL menthol pods in a four-pack, 5% nicotine salts. Each pod clicks into a JUUL device.'
      : 'JUUL pods in a two-pack. Each pod is prefilled with nicotine salts and clicks into the JUUL device.';
  },
  Luffbar() { return 'Luffbar disposable vape, prefilled and draw-activated.'; },
  Breeze() { return 'Breeze disposable vape, prefilled and draw-activated.'; },
  'Fifty Bar'() { return 'Fifty Bar disposable vape, prefilled and draw-activated.'; },
  North() { return 'North disposable vape, the 5,000-puff device, prefilled and draw-activated.'; },
  Kadobar() { return withPuffs('Kadobar 40K', 'Kadobar disposable vape, prefilled and draw-activated.'); },
  MFU(p) {
    if (/pod/i.test(p.name)) return 'Prefilled pods for the MFU device.';
    return withPuffs(p.name, 'MFU disposable vape, prefilled and draw-activated.');
  },
  Nexa(p) { return withPuffs(p.name, 'Nexa disposable vape, prefilled and draw-activated.'); },
  Tarbar() { return 'Tarbar disposable vape, prefilled and draw-activated.'; },
  Doom() { return 'Prefilled pods for the Doom bar.'; },
  Extre() { return 'Prefilled pods for the Extre bar.'; },
  'Bidi Stick'() { return 'Bidi Stick, a small stick-shaped disposable vape, prefilled.'; },
  'Red Bull'(p) {
    const size = (p.name.match(/\d+\s*oz/i) || [''])[0];
    return `Red Bull energy drink${size ? ` in the ${size} can` : ''}. Carbonated, with caffeine, taurine and B vitamins.`;
  },
  Monster(p) {
    if (/java/i.test(p.name)) return 'Monster Java, a coffee energy drink in a can, brewed coffee mixed with the Monster energy formula.';
    return 'Monster Energy in the 16 oz can. Carbonated, with caffeine, taurine and ginseng. The color on the can is the recipe.';
  },
  'Alani Nu'() { return 'Alani Nu energy drink in a slim can. Carbonated, with caffeine, and sold in the flavor printed on the can.'; },
  'Coca-Cola'() { return 'Coca-Cola, the classic cola.'; },
  Sprite() { return 'Sprite lemon-lime soda, caffeine-free.'; },
  Pepsi() { return 'Pepsi-Cola.'; },
  'Dr Pepper'() { return 'Dr Pepper, a pepper-style soda.'; },
  Fanta() { return 'Fanta fruit soda.'; },
  Faygo(p) {
    return /can/i.test(p.name)
      ? 'Faygo soda in cans, the Detroit soda-pop line, including Redpop and Rock & Rye.'
      : 'Faygo soda in 20 oz bottles, the Detroit soda-pop line.';
  },
  Arizona() { return 'Arizona tall-can drinks: iced tea, juice cocktails and the RX energy can. Brewed-style tea and fruit juice, sold by the can on the label.'; },
  'Tropical Fantasy'(p) {
    return /aloe/i.test(p.name)
      ? 'Tropical Fantasy aloe vera drinks, fruit juice with pieces of aloe in the bottle.'
      : 'Tropical Fantasy fruit drinks in the pint bottle, a value juice drink for the cooler.';
  },
  Jarritos() { return 'Jarritos soda in the glass bottle, made with cane sugar in the Mexican soda style.'; },
  'Minute Maid'(p) {
    return /20/.test(p.name)
      ? 'Minute Maid juice drinks in the 20 oz bottle.'
      : 'Minute Maid juices in the 12 oz bottle.';
  },
  Tropicana(p) {
    return /big/.test(p.name)
      ? 'Tropicana juice in the large bottle, not from concentrate on the flagship orange.'
      : 'Tropicana juice in the small bottle.';
  },
  "Welch's"(p) {
    return /snack|bag/i.test(p.name)
      ? "Welch's Fruit Snacks, fruit-juice gummies in a peg bag."
      : "Welch's juice drinks, grape and other fruit blends.";
  },
  Calypso() { return 'Calypso lemonade in the glass bottle, a ready-to-drink lemonade.'; },
  Foco() { return 'Foco Asian fruit drinks, coconut, mango and the other juices in the can or bottle.'; },
  Vinut() { return 'Vinut juice drinks, including the soursop and passion fruit the brand is known for.'; },
  Jumex() { return 'Jumex nectar in the can, a Mexican fruit nectar with a thicker body than a juice drink.'; },
  Kuii() { return 'Kuii nata drinks, fruit juice with nata de coco cubes in the bottle.'; },
  'Bug Juice'() { return 'Bug Juice fruit drink, a value juice for the cooler.'; },
  Gatorade(p) {
    return /big/.test(p.name)
      ? 'Gatorade thirst quencher in the large bottle, with electrolytes and the flavor on the label.'
      : 'Gatorade thirst quencher in the small bottle.';
  },
  Powerade(p) {
    return /big/.test(p.name)
      ? 'Powerade sports drink in the large bottle, with electrolytes and B vitamins.'
      : 'Powerade sports drink in the small bottle.';
  },
  Electrolit() { return 'Electrolit hydration drink, an electrolyte solution sold in a bottle for the cooler.'; },
  Nesquik() { return 'Nesquik flavored milk, a ready-to-drink milk in the bottle.'; },
  Snickers(p) {
    return /milk/i.test(p.name)
      ? 'Snickers chocolate milk, a ready-to-drink milk in the bottle.'
      : 'Snickers bars, milk chocolate with nougat, caramel and peanuts. Regular and king size.';
  },
  "Reese's"() { return "Reese's peanut butter cups and pieces in milk chocolate. The row covers the cup, the white cup, Pieces and Fast Break, in regular and king size."; },
  "Hershey's"() { return "Hershey's milk chocolate bars, including the almond and cookies styles, in regular and king size."; },
  "M&M's"() { return "M&M's, chocolate candies in a sugar shell, in the peg bag and the share bag."; },
  Skittles() { return 'Skittles fruit chews with a hard sugar shell. Original, Wild Berry, Sour and the other bags, in regular and king size.'; },
  Haribo(p) {
    return /tub/i.test(p.name)
      ? 'Haribo Goldbears gummy bears in a counter tub.'
      : 'Haribo gummy candy in peg bags, Goldbears and the sour and shaped bags.';
  },
  Trolli() { return 'Trolli gummy candy in peg bags, including the Sour Brite crawlers.'; },
  'Airheads'(p) {
    if (/soda/i.test(p.name)) return 'Airheads soda, a fruit-flavored soft drink.';
    if (/bite/i.test(p.name)) return 'Airheads Bites, bite-size pieces of Airheads taffy.';
    if (/xtreme/i.test(p.name)) return 'Airheads Xtremes, a sour candy belt.';
    return 'Airheads taffy bars in the 36-count display box. A flat, chewy bar wrapped one at a time.';
  },
  'Now and Later'(p) {
    return /jar|giant/i.test(p.name)
      ? 'Now and Later Giant Chewy taffy in a counter jar. The square chew that starts hard and softens.'
      : 'Now and Later taffy, the square chew that starts firm and softens, in the peg bag.';
  },
  Tootsie() { return 'Tootsie Frooties, fruit chews from the Tootsie house, in a bag for the peg board.'; },
  Charms() { return 'Charms Blow Pops, a bubble-gum center inside a hard candy, in the 48-count display.'; },
  Gushers(p) {
    return /bag/i.test(p.name)
      ? 'Gushers fruit snacks in a peg bag. A soft snack with a liquid center.'
      : 'Gushers fruit snacks in the variety box. A soft snack with a liquid center.';
  },
  Nerds(p) {
    return /cluster/i.test(p.name)
      ? 'Nerds Gummy Clusters, gummy candy coated in Nerds crunch, in a share pouch.'
      : 'Nerds candy in peg bags, the tiny crunchy candies in a box or pouch.';
  },
  Mamba(p) {
    return /small/i.test(p.name)
      ? 'Mamba fruit chews in the small stick.'
      : 'Mamba fruit chews in the big bar, a soft chew wrapped in a strip.';
  },
  'Laffy Taffy'(p) {
    return /rope/i.test(p.name)
      ? 'Laffy Taffy ropes, a long pull of the same taffy as the tub pieces.'
      : 'Laffy Taffy in the 145-count tub, individually wrapped taffy for the counter.';
  },
  'Sour Punch'(p) {
    return /tub/i.test(p.name)
      ? 'Sour Punch Twists in a counter tub, a sour licorice twist.'
      : 'Sour Punch candy, sour licorice bites and twists.';
  },
  'Sour Power'() { return 'Sour Power Straws, long sour candy straws.'; },
  'Sour Strips'() { return 'Sour Strips, a flat belt of sour candy.'; },
  'Mike and Ike'() { return 'Mike and Ike chewy candy in the theater box, a jelly-bean style piece.'; },
  'Jolly Rancher'() { return 'Jolly Rancher hard candy in the 5 lb bulk bag, the fruit hard candy for a jar or a scoop bin.'; },
  Starburst() { return 'Starburst fruit chews, square taffy in the share-size bag.'; },
  'Life Savers'(p) {
    if (/hard/i.test(p.name)) return 'Life Savers hard candy, the ring-shaped fruit candy.';
    if (/share/i.test(p.name)) return 'Life Savers Gummies in the share-size bag, 15 bags to a box.';
    return 'Life Savers Gummies in peg bags.';
  },
  'Rip Rolls'() { return 'Rip Rolls sour licorice rolls in a counter display.'; },
  "Wrigley's"(p) {
    return /50/.test(p.name)
      ? "Wrigley's 5-stick gum at the 50 cent price, Spearmint, Doublemint and Juicy Fruit."
      : "Wrigley's gum in the slim pack: Juicy Fruit, Spearmint, Doublemint, Big Red and Winterfresh.";
  },
  Extra(p) {
    return /share/i.test(p.name)
      ? 'Extra sugar-free gum in the share-size pack.'
      : 'Extra sugar-free gum in the long pack, a soft stick made for a long chew.';
  },
  '5 Gum'() { return '5 Gum, a sugar-free gum from Wrigley, in the long pack.'; },
  Dentyne() { return 'Dentyne gum, a sugar-free gum sold in a small pack.'; },
  'Dubble Bubble'() { return 'Dubble Bubble gum in a counter jar, the classic pink bubble gum.'; },
  Halls() { return 'Halls cough drops, a menthol lozenge.'; },
  'Milky Way'() { return 'Milky Way bars, milk chocolate over nougat and caramel.'; },
  Orbit() { return 'Orbit sugar-free gum in the pellet or stick pack.'; },
  Trident() { return 'Trident sugar-free gum.'; },
  Mentos() { return 'Mentos chewy mints in the roll, a soft mint with a candy shell.'; },
  Butterfinger() { return 'Butterfinger bars, a crisp peanut-butter center under chocolate, in regular and king size.'; },
  'Kit Kat'() { return 'Kit Kat wafer bars, crisp wafers layered with chocolate, in regular and king size.'; },
  Twix() { return 'Twix bars, a shortbread biscuit with caramel under milk chocolate, in regular and king size.'; },
  'Almond Joy'() { return 'Almond Joy bars, coconut and whole almonds under milk chocolate.'; },
  Mounds() { return 'Mounds bars, coconut under dark chocolate, with no almond.'; },
  PayDay() { return 'PayDay bars, caramel and peanuts with no chocolate coating, in regular and king size.'; },
  '3 Musketeers'() { return '3 Musketeers bars, a light chocolate nougat under milk chocolate.'; },
  Ferrara() { return 'Ferrara theater-box candy, Lemonheads and Boston Baked Beans, the small hard candies in a box.'; },
  Tueni() { return 'Tueni fruit chews in a counter box, a soft fruit chew wrapped for the peg or the box.'; },
  'Long Boys'() { return 'Long Boys coconut candy in a counter tub.'; },
  'Chick-O-Stick'() { return 'Chick-O-Stick peanut-butter and coconut candy in the 160-count jar.'; },
  "Atkinson's"() { return "Atkinson's peanut butter bars in a counter jar."; },
  eFrutti() { return 'eFrutti gummy candy in a counter jar.'; },
  "Candyman's"(p) {
    return /cherry/i.test(p.name)
      ? "Candyman's cherry candy lumps in a counter dispenser box."
      : "Candyman's mint candy lumps in a counter dispenser box.";
  },
  'Jungle Jollies'() { return 'Jungle Jollies candy packed in counter boxes.'; },
  'Silly Dots'() { return 'A counter box of chewable tablets. This listing makes no health claim.'; },
  BIC() { return 'BIC pocket lighters, a flint lighter with a child-resistant hood, sold in counter trays.'; },
  Zippo(p) {
    return /butane/i.test(p.name)
      ? 'Zippo butane for refillable torch lighters.'
      : 'Zippo lighter fluid for the classic Zippo wick lighter.';
  },
  'Eagle Torch'() { return 'Eagle Torch refillable torch lighters in a counter display, a jet flame rather than a soft flame.'; },
  'Lighter Leash'() { return 'Lighter Leash, a retractable holder that clips a pocket lighter to a belt or a counter.'; },
  Duracell() { return 'Duracell alkaline batteries, copper-top cells in carded packs.'; },
  Panasonic() { return 'Panasonic batteries in a carded pack.'; },
  'Castrol'() { return 'Castrol GTX conventional motor oil in quarts, with the anti-sludge formula on the bottle.'; },
  Havoline() { return 'Havoline conventional motor oil in quarts.'; },
  'Pure Guard'() { return 'Pure Guard conventional motor oil in quarts.'; },
  Saxon() { return 'Saxon motor oil and transmission fluid in quarts, including the common passenger-car grades.'; },
  Coastal() { return 'Coastal synthetic-blend motor oil in quarts.'; },
  STP() { return 'STP oil treatment and fuel additives, the bottles that go in the crankcase or the tank.'; },
  'WD-40'() { return 'WD-40 multi-use spray, the water-displacing lubricant in the blue and yellow can.'; },
  PEAK(p) {
    if (/def|bluedef/i.test(p.name)) return 'PEAK BlueDEF diesel exhaust fluid in the 2.5 gallon jug, the urea solution for diesel SCR systems.';
    if (/washer/i.test(p.name)) return 'PEAK windshield washer fluid, ready to pour into the reservoir.';
    return 'PEAK antifreeze and coolant, pre-diluted or concentrate as the jug states, for the cooling system.';
  },
  Autoguard() { return 'Autoguard automotive fluids: power steering, brake fluid and antifreeze.'; },
  Itasca() { return 'Itasca Outdoors 2-cycle engine oil in 8 oz bottles, for mixing with small-engine fuel.'; },
  'Gold Band'() { return 'Gold Band lubricant, the Type A fluid in the bottle.'; },
  Tide() { return 'Tide liquid laundry detergent, the heavy-duty detergent in the jug.'; },
  Gain(p) {
    return /dish/i.test(p.name)
      ? 'Gain dish liquid, with the Gain scent, for washing dishes by hand.'
      : 'Gain liquid laundry detergent, the scented detergent in the jug.';
  },
  Ajax(p) {
    if (/powder/i.test(p.name)) return 'Ajax powder cleanser with bleach, the shake can for sinks and tubs.';
    if (/dish/i.test(p.name)) return 'Ajax dish liquid for washing dishes by hand.';
    return 'Ajax laundry detergent.';
  },
  Clorox() { return 'Clorox bleach, a sodium hypochlorite cleaner and laundry whitener in the jug.'; },
  Fabuloso() { return 'Fabuloso multi-purpose cleaner, a scented floor and surface cleaner in the bottle.'; },
  Dove() { return 'Dove beauty bar, a mild syndet bar rather than a traditional soap.'; },
  'Irish Spring'() { return 'Irish Spring deodorant bar soap.'; },
  'LA\'s Totally Awesome'(p) { return p && "LA's Totally Awesome laundry detergent, a value detergent in the jug."; },
  'Brillo'(p) {
    return /dish/i.test(p.name)
      ? 'Brillo Basics dish liquid for washing dishes by hand.'
      : 'Brillo Basics all-purpose cleaner.';
  },
  Always() { return 'Always pads, a menstrual pad in the size on the pack.'; },
  Stayfree() { return 'Stayfree pads, a menstrual pad in the size on the pack.'; },
  Tampax() { return 'Tampax tampons with an applicator, in the absorbency on the box.'; },
  'Lady Speed Stick'() { return "Lady Speed Stick women's deodorant, a solid stick."; },
  'Speed Stick'() { return "Speed Stick men's deodorant, a solid stick."; },
  Vaseline() { return 'Vaseline Original healing jelly, white petrolatum in the jar or the tub.'; },
  Carmex() { return 'Carmex medicated lip balm, in the jar, the tube or the stick.'; },
  Visine() { return 'Visine redness-relief eye drops.'; },
  'Pure Eyes'() { return 'Pure Eyes redness-relief eye drops for the OTC shelf.'; },
  Tylenol() { return 'Tylenol pain reliever, acetaminophen, in the formula named on the box.'; },
  Advil() { return 'Advil pain reliever, ibuprofen, in tablets, liqui-gels and the sinus and PM formulas.'; },
  Bayer() { return 'Bayer aspirin, acetylsalicylic acid tablets for pain and fever.'; },
  Claritin() { return 'Claritin allergy relief, loratadine, a 24-hour non-drowsy antihistamine.'; },
  Benadryl() { return 'Benadryl allergy relief, diphenhydramine, the original sedating antihistamine.'; },
  "Goody's"() { return "Goody's headache powders, aspirin and acetaminophen in a powder stick, taken without water."; },
  BC() { return 'BC headache powders, aspirin and caffeine in a powder stick.'; },
  Stanback() { return 'Stanback headache powders in the 2-count and 6-count packs.'; },
  Excedrin() { return 'Excedrin, aspirin, acetaminophen and caffeine, in the Extra Strength and Migraine formulas.'; },
  NyQuil() { return 'NyQuil cold and flu relief, the nighttime liquid or liquicap.'; },
  Mucinex() { return 'Mucinex DM, guaifenesin and dextromethorphan, for chest congestion and cough.'; },
  Tums(p) {
    return /big/.test(p.name)
      ? 'Tums antacid tablets in the large bottle, calcium carbonate chewables.'
      : 'Tums antacid tablets in the small bottle, calcium carbonate chewables.';
  },
  Rolaids() { return 'Rolaids antacid tablets, calcium carbonate and magnesium hydroxide chewables.'; },
  Pepcid() { return 'Pepcid Complete, an antacid with famotidine for heartburn.'; },
  Orajel() { return 'Orajel oral pain relief, benzocaine gel for a toothache or a mouth sore.'; },
  '5-hour Energy'(p) {
    return /extra/i.test(p.name)
      ? '5-hour Energy Extra Strength, a 1.93 oz energy shot. Not a coffee and not a soda; a small bottle of caffeine and B vitamins.'
      : '5-hour Energy, the original 1.93 oz energy shot.';
  },
  Tweaker() { return 'Tweaker energy shots, a small bottled shot for the counter.'; },
  Trojan(p) {
    return /magnum/i.test(p.name)
      ? 'Trojan Magnum condoms, the larger Trojan fit, in latex unless the pack says otherwise.'
      : 'Trojan latex condoms in the style named on the box.';
  },
  'Little Trees'() { return 'Little Trees hanging air fresheners, the fiber tree that hangs from a mirror.'; },
  BluntPower() { return 'BluntPower air freshener spray, a room and fabric spray in the scent on the can.'; },
  BluntEffects() { return 'BluntEffects jumbo hand-dipped incense sticks.'; },
  Lattafa() { return 'Lattafa air freshener spray, a concentrated room spray.'; },
  'Cheez-It'() { return "Cheez-It baked snack crackers in the Grab'n Go bag, a square cheese cracker."; },
  Ritz() { return 'Ritz cracker sandwiches, two butter crackers with a filling.'; },
  'Pop-Tarts'() { return 'Pop-Tarts toaster pastries in a counter display, a frosted pastry meant for a toaster.'; },
  Cloverhill() { return 'Cloverhill bakery snacks, Big Texas cinnamon rolls and honey buns, individually wrapped.'; },
  Pringles() { return 'Pringles stacked potato crisps in the can.'; },
  Takis() { return 'Takis rolled tortilla chips, intensely seasoned, in the small and big bags.'; },
  "Gurley's"() { return "Gurley's candy in peg bags: butterflies, circus peanuts, rings and gummy worms."; },
  Maruchan(p) {
    if (/yakisoba/i.test(p.name)) return 'Maruchan Yakisoba, stir-fried noodles in a tray that heats in the microwave.';
    if (/cup/i.test(p.name)) return 'Maruchan instant ramen in a foam cup. Add water and wait.';
    return 'Maruchan ramen noodle soup in the brick pack. A cake of noodles and a seasoning packet.';
  },
  'Van Holten\'s'() { return "Van Holten's Pickle-In-A-Pouch, a whole pickled cucumber sealed in its own brine pouch."; },
  Oreo() { return 'Oreo chocolate sandwich cookies in a single-serve pack.'; },
  'Nutter Butter'() { return 'Nutter Butter peanut-shaped sandwich cookies with peanut butter creme.'; },
  "Uncle Al's"(p) {
    return /creme/i.test(p.name)
      ? "Uncle Al's creme cookies, a sandwich cookie. The flavor on the bag is whatever the warehouse has in."
      : "Uncle Al's cookies in a bag. The flavor on the bag is whatever the warehouse has in.";
  },
  Keebler() { return 'Keebler cookies in a single-serve or peg pack.'; },
  Folgers() { return 'Folgers ground coffee in the small can or brick.'; },
  Domino() { return 'Domino pure cane sugar in the bag.'; },
  'Imperial Sugar'() { return 'Imperial Sugar pure cane sugar in the bag.'; },
  Argo() { return 'Argo 100% pure corn starch, the yellow box used for thickening.'; },
  Louisiana() { return 'Louisiana Hot Sauce, aged pepper sauce in the bottle with the red diamond label.'; },
  Twang(p) {
    return /packet|twangerz/i.test(p.name)
      ? 'Twangerz beer salt in single-serve packets for a bottle rim.'
      : 'Twang beer salt in a shaker bottle, for rimming a beer bottle.';
  },
  '1-2-3'() { return '1-2-3 vegetable cooking oil in the bottle.'; },
  'Krazy Glue'() { return 'Krazy Glue all-purpose cyanoacrylate, a one-drop super glue.'; },
  'AA Cellular'() { return 'AA Cellular Bluetooth headphones, a wireless headphone for the counter.'; },
  'Blazy Susan'() { return 'Blazy Susan wraps, pink rolling wraps in a counter pack.'; },
  Hemparillo() { return 'Hemparillo blunt wraps in the rillo size, a hemp wrap cut like a cigarillo.'; },
  Jungo() { return 'Jungo leaf, two whole-leaf wraps to a pack.'; },
  'Big Leaf'(p) {
    return /single/i.test(p.name)
      ? 'A single Big Leaf tobacco wrap.'
      : 'Big Leaf tobacco wraps, three to a pack.';
  },
  'Big Bol'() { return 'Big Bol tobacco wraps in a counter pack.'; },
  'Metro Leaf'() { return 'Metro Leaf tobacco wraps in a counter pack.'; },
  Camo() { return 'Camo wraps, a leaf wrap in a counter pack.'; },
  'Lil Leaf'() { return 'Lil Leaf wraps, a small tobacco wrap. This row is the original style.'; },
  'Havana Leaf'() { return 'Havana Leaf little wraps, a small flavored leaf wrap for one roll.'; },
  'Al Fakher'(p) {
    if (/charcoal/i.test(p.name)) return 'Al Fakher hookah charcoal, coconut coals for a bowl.';
    if (/1 kg/.test(p.name)) return 'Al Fakher shisha molasses in the 1 kg tin. Washed tobacco with molasses, glycerin and flavor.';
    if (/250/.test(p.name)) return 'Al Fakher shisha molasses in the 250 g tin.';
    return 'Al Fakher shisha molasses in the 50 g tin. Washed tobacco with molasses, made for a hookah bowl.';
  },
  Adalya() { return 'Adalya shisha molasses in the 50 g tin, a washed tobacco made for a hookah bowl.'; },
  Mazaya() { return 'Mazaya shisha molasses, washed tobacco with molasses for a hookah bowl.'; },
  'Coco Nara'() { return 'Coco Nara coconut-shell hookah charcoal, quick-light coals cut in cubes.'; },
  Ploox(p) {
    if (/pod/i.test(p.name)) return 'Prefilled pods for the Ploox hookah device.';
    if (/nest/i.test(p.name)) return 'Ploox Nest, a portable electronic hookah.';
    if (/saloon/i.test(p.name)) return 'Ploox Saloon, an electronic shisha device.';
    return withPuffs(p.name, 'Ploox electronic shisha, a hookah-style disposable.');
  },
  SKE() { return 'SKE electronic shisha, a hookah-style disposable.'; },
  Olit() { return withPuffs('Olit 40K', 'Olit electronic shisha, a hookah-style disposable.'); },
  Lost() { return withPuffs('Lost 80K', 'Lost electronic shisha, a hookah-style disposable.'); },
  'Champ'() { return 'Champ detox drink, a bottled herbal drink. This listing makes no health claim.'; },
  'Herbal Clean'() { return 'Herbal Clean QCarbo16, a 16 oz bottled drink. This listing makes no health claim.'; },
  UPass() { return 'UPass synthetic urine, 3 oz, sold as a novelty. This listing makes no other claim.'; },
  'Mellow Fellow'() { return 'A Mellow Fellow counter item. This listing makes no health claim.'; },
  'Hard Steel'() { return 'Hard Steel honey, shots and pill cards for the counter. This listing makes no health claim.'; },
  'Blue Wolf'() { return 'Blue Wolf honey sachets for the counter. This listing makes no health claim.'; },
  VIP() { return 'VIP Royal Honey gold sachets for the counter. This listing makes no health claim.'; },
  'Secret Miracle'() { return 'Secret Miracle Honey in the VIP extra-strength box. This listing makes no health claim.'; },
  'Black Tiger'() { return 'Black Tiger Honey sachets. This listing makes no health claim.'; },
  Rhino() { return 'Rhino pill cards, two tablets to a card. This listing makes no health claim.'; },
  Xuno() { return 'Xuno tablets in a counter box. This listing makes no health claim.'; },
  'Better Me'() { return 'Better Me tablets in a counter box. This listing makes no health claim.'; },
  'High Gravity'() { return 'High Gravity tablets in a counter box. This listing makes no health claim.'; },
  'Third Eye'() { return 'Third Eye tablets in a counter box. This listing makes no health claim.'; },
};

const SUB = {
  'Cigars & Cigarillos'(p) {
    if (/wrap/i.test(p.name)) return `${p.brand} cigar wraps, a leaf or sheet for rolling one smoke.`;
    if (/5-pack|5 pack/.test(p.name)) return `${p.brand} cigars or cigarillos, five to a pack.`;
    if (/2-pack/.test(p.name)) return `${p.brand} cigarillos, two to a pack.`;
    if (/4-pack/.test(p.name)) return `${p.brand} cigarillos, four to a pack.`;
    if (/single/i.test(p.name)) return `A single ${p.brand} cigar.`;
    return `${p.brand} cigarillos with a sweetened wrapper, packed for the counter.`;
  },
  'Wraps & Leafs'(p) {
    if (/hemp/i.test(p.name)) return `${p.brand} hemp wraps, a tobacco-free wrap in a small pack.`;
    if (/leaf/i.test(p.name)) return `${p.brand} tobacco leaf for rolling, sold in the cut named on the pack.`;
    return `${p.brand} wraps for rolling, packed for the counter.`;
  },
  Cigarettes(p) {
    if (/tobacco/i.test(p.name)) return `${p.brand} roll-your-own tobacco in a pouch.`;
    if (/filtered cigar/i.test(p.name)) return `${p.brand} filtered little cigars in a cigarette-style pack.`;
    return `${p.brand} cigarettes for the licensed counter.`;
  },
  'Pouches & ZYN'() { return 'Tobacco-free nicotine pouches in a can. The pouch sits under the lip; nothing is lit.'; },
  'Papers & Cones'(p) {
    if (/cone/i.test(p.name)) return `${p.brand} pre-rolled cones, papers already formed.`;
    if (/tip/i.test(p.name)) return `${p.brand} filter tips for a hand roll.`;
    return `${p.brand} gummed rolling papers.`;
  },
  'Loose Tobacco Bags'(p) {
    return /big/i.test(p.name)
      ? `${p.brand} pipe tobacco in the large bag.`
      : `${p.brand} pipe tobacco in the small bag.`;
  },
  'Tubes & Filters'() { return 'Filter cigarette tubes for roll-your-own, the filter already attached, boxed for the counter.'; },
  'Disposable Vapes'(p) { return withPuffs(p.name, `${p.brand} disposable vape, prefilled and draw-activated.`); },
  'Vape Pods'(p) { return `Prefilled pods for the ${p.brand} device. The pod carries the liquid and attaches to the battery.`; },
  'Hookah & Shisha'(p) {
    if (/charcoal|coal/i.test(p.name)) return `${p.brand} hookah charcoal.`;
    if (/hose/i.test(p.name)) return 'A washable hookah hose.';
    if (/tip/i.test(p.name)) return 'Disposable hookah mouth tips.';
    if (/vape|electronic/i.test(p.name)) return withPuffs(p.name, `${p.brand} electronic shisha, a hookah-style device.`);
    return `${p.brand} shisha molasses, washed tobacco with molasses for a hookah bowl${p.sellUnit ? `, in the ${p.sellUnit}` : ''}.`;
  },
  'Smoke Accessories'(p) {
    if (/grinder/i.test(p.name)) return `${p.name}, a metal herb grinder with a kief screen.`;
    if (/scale/i.test(p.name)) return `${p.name}, a small digital scale for the counter.`;
    if (/bong/i.test(p.name)) return `${p.name}, a glass water pipe.`;
    return `${p.name}.`;
  },
  'Sweets & Gummies'(p) { return `${p.name}, a candy for the peg board or the counter box.`; },
  'Chocolate Bars'(p) { return `${p.name}, a chocolate candy bar.`; },
  'Gum & Mints'(p) { return `${p.name}.`; },
  Bags(p) { return `${p.brand} candy in peg bags.`; },
  Jars(p) { return `${p.name}, packed in a jar or tub for the counter.`; },
  'Personal Care'(p) { return `${p.name} for the personal-care shelf.`; },
  Hardware(p) { return `${p.name} for the hardware endcap.`; },
  Cleaning(p) { return `${p.name}, a household cleaner.`; },
  'Paper & Plastic'(p) { return `${p.name} for food service and the household aisle.`; },
  'Bags & Storage'(p) { return `${p.name}.`; },
  'Laundry & Detergent'(p) { return `${p.name}.`; },
  'Other Grocery'(p) { return `${p.name}.`; },
  'Pet Food'(p) { return `${p.name}.`; },
  'OTC & Health'(p) { return `${p.name} for the medicine shelf.`; },
  'Honey & Energy'(p) { return `${p.name}, a honey packet for the counter. This listing makes no health claim.`; },
  'Counter Goods'(p) { return `${p.name} for the front counter.`; },
  Apparel(p) {
    if (/sock/i.test(p.name)) return 'Crew socks for the counter rack.';
    if (/hat/i.test(p.name)) return 'Knit winter hats.';
    if (/durag/i.test(p.name)) return 'Durags, a silk or satin head wrap.';
    if (/wave/i.test(p.name)) return 'Wave caps, a mesh cap worn over the hair.';
    if (/thermal/i.test(p.name)) return 'Thermal underwear shirts, long sleeves, sold by size.';
    if (/tank|a-shirt/i.test(p.name)) return 'A-shirt tank undershirts, sold by size.';
    if (/long-sleeve/i.test(p.name)) return 'Long-sleeve T-shirts, sold by size.';
    if (/v-neck/i.test(p.name)) return 'V-neck T-shirts, sold by size.';
    return 'Crew-neck T-shirts, sold by size.';
  },
  'Air Fresheners & Incense'(p) {
    if (/incense/i.test(p.name)) return `${p.name}, incense sticks.`;
    return `${p.name}.`;
  },
  'Lighters & Torches'(p) { return `${p.name}, a flame for the counter tray.`; },
  Electronics(p) { return `${p.name}.`; },
  'Energy Shots'(p) { return `${p.name}, a small bottled energy shot.`; },
  Toys(p) { return `${p.name}.`; },
  'Adult Wellness'(p) { return `${p.name}.`; },
  'Juices & Teas'(p) { return `${p.name}, a ready-to-drink juice or tea for the cooler.`; },
  Sodas(p) { return `${p.name}, a carbonated soft drink.`; },
  'Energy Drinks'(p) { return `${p.name}, a carbonated or still energy drink.`; },
  'Bags & Carriers'(p) {
    if (/ice/i.test(p.name)) return 'Ice bags for the cooler, filled at the store or sold empty as the row states.';
    if (/t-shirt/i.test(p.name)) return 'Plastic T-shirt carry-out bags, the grocery sack with handles.';
    if (/paper bag/i.test(p.name)) return 'Kraft paper grocery bags.';
    if (/register|paper roll/i.test(p.name)) return 'Thermal and bond paper rolls for registers, card terminals and pumps.';
    if (/ringer/i.test(p.name)) return 'Plastic rings that hold a six-pack of cans.';
    if (/carrier/i.test(p.name)) return 'Cardboard carriers for a six-pack of bottles.';
    if (/liner/i.test(p.name)) return 'Trash-can liners.';
    return `${p.name}.`;
  },
  Water(p) { return `${p.name}, bottled water.`; },
  'Sports Drinks'(p) { return `${p.name}, a sports drink with electrolytes.`; },
  'Dairy & Milk'(p) { return `${p.name}, a ready-to-drink milk for the cooler.`; },
  'Chips & Crackers'(p) { return `${p.name}.`; },
  'Quick Meals'(p) { return `${p.name}, a single-serve meal for the shelf or the microwave.`; },
  Cookies(p) { return `${p.name}.`; },
  'Cooking Basics'(p) { return `${p.name} for the baking and cooking shelf.`; },
  'Sauces & Salts'(p) { return `${p.name}.`; },
  Coffee(p) { return `${p.name}.`; },
  'Motor Oil'(p) { return `${p.name} in quarts, for the crankcase grade on the bottle.`; },
  'Auto Accessories'(p) { return `${p.name}.`; },
  Fluids(p) { return `${p.name}.`; },
  Lubricants(p) { return `${p.name}.`; },
  'Wellness Pills'(p) { return `${p.name} in a counter box. This listing makes no health claim.`; },
  Detox(p) { return `${p.name}. This listing makes no health claim.`; },
  CBD(p) { return `${p.name}. This listing makes no health claim.`; },
  Gifts(p) { return `${p.name}, a novelty gift for the counter.`; },
};

export function productCopy(p) {
  // Owner answer 2026-09-28: this row stays a chips brand, with both counts.
  if (p.id === 295) return 'Snack wraps, a chips brand. Two sizes: 40ct and 12ct. Flavors vary by availability.';
  const brandFn = BRAND[p.brand];
  if (brandFn) {
    const text = brandFn(p);
    if (text) return text.replace(/\s+/g, ' ').trim();
  }
  const subFn = SUB[p.sub];
  if (subFn) return subFn(p).replace(/\s+/g, ' ').trim();
  return `${p.name}.`.replace(/\s+/g, ' ').trim();
}

