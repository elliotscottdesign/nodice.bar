// RAL Classic colour palette for the No Dice poster maker.
// ─────────────────────────────────────────────────────────────────────────────
// PORTED COPY. The original lives in the TEAM HUB repo at
//   Plonk-Borough-2.0/src/dj/ralColours.js
// The two repos can't share an import, so this is a deliberate second copy.
// If a swatch changes in one, change it in BOTH.
// ─────────────────────────────────────────────────────────────────────────────

export type RalSwatch = {
  c: string;   // RAL code, e.g. "3020"
  hex: string; // hex approximation of the RAL ink
  n: string;   // human name, e.g. "Traffic red"
};

export const RAL: RalSwatch[] = [
  { c: '1000', hex: '#CDBA88', n: 'Green beige' }, { c: '1001', hex: '#D0B084', n: 'Beige' },
  { c: '1002', hex: '#D2AA6D', n: 'Sand yellow' }, { c: '1003', hex: '#F9A800', n: 'Signal yellow' },
  { c: '1004', hex: '#E49E00', n: 'Golden yellow' }, { c: '1005', hex: '#CB8E00', n: 'Honey yellow' },
  { c: '1006', hex: '#E29000', n: 'Maize yellow' }, { c: '1007', hex: '#E88C00', n: 'Daffodil yellow' },
  { c: '1011', hex: '#AF804F', n: 'Brown beige' }, { c: '1012', hex: '#DDAF27', n: 'Lemon yellow' },
  { c: '1013', hex: '#E3D9C6', n: 'Oyster white' }, { c: '1014', hex: '#DDC49A', n: 'Ivory' },
  { c: '1015', hex: '#E6D2B5', n: 'Light ivory' }, { c: '1016', hex: '#F1DD38', n: 'Sulfur yellow' },
  { c: '1017', hex: '#F6A950', n: 'Saffron yellow' }, { c: '1018', hex: '#FACA30', n: 'Zinc yellow' },
  { c: '1019', hex: '#A48F7A', n: 'Grey beige' }, { c: '1020', hex: '#A08F65', n: 'Olive yellow' },
  { c: '1021', hex: '#F6B600', n: 'Colza yellow' }, { c: '1023', hex: '#F7B500', n: 'Traffic yellow' },
  { c: '1024', hex: '#BA8F4C', n: 'Ochre yellow' }, { c: '1026', hex: '#FFFF00', n: 'Luminous yellow' },
  { c: '1027', hex: '#A77F0E', n: 'Curry' }, { c: '1028', hex: '#FF9B00', n: 'Melon yellow' },
  { c: '1032', hex: '#E2A300', n: 'Broom yellow' }, { c: '1033', hex: '#F99A1C', n: 'Dahlia yellow' },
  { c: '1034', hex: '#EB9C52', n: 'Pastel yellow' }, { c: '1035', hex: '#908370', n: 'Pearl beige' },
  { c: '1036', hex: '#80643F', n: 'Pearl gold' }, { c: '1037', hex: '#F09200', n: 'Sun yellow' },
  { c: '2000', hex: '#DD7907', n: 'Yellow orange' }, { c: '2001', hex: '#BE4E20', n: 'Red orange' },
  { c: '2002', hex: '#C63927', n: 'Vermilion' }, { c: '2003', hex: '#FA842B', n: 'Pastel orange' },
  { c: '2004', hex: '#E75B12', n: 'Pure orange' }, { c: '2005', hex: '#FF2300', n: 'Luminous orange' },
  { c: '2007', hex: '#FFA421', n: 'Luminous bright orange' }, { c: '2008', hex: '#F3752C', n: 'Bright red orange' },
  { c: '2009', hex: '#E15501', n: 'Traffic orange' }, { c: '2010', hex: '#D4652F', n: 'Signal orange' },
  { c: '2011', hex: '#EC7C25', n: 'Deep orange' }, { c: '2012', hex: '#DB6A50', n: 'Salmon orange' },
  { c: '2013', hex: '#954527', n: 'Pearl orange' }, { c: '2017', hex: '#FA4402', n: 'RAL orange' },
  { c: '3000', hex: '#AB2524', n: 'Flame red' }, { c: '3001', hex: '#A02128', n: 'Signal red' },
  { c: '3002', hex: '#A1232B', n: 'Carmine red' }, { c: '3003', hex: '#8D1D2C', n: 'Ruby red' },
  { c: '3004', hex: '#701F29', n: 'Purple red' }, { c: '3005', hex: '#5E2028', n: 'Wine red' },
  { c: '3007', hex: '#402225', n: 'Black red' }, { c: '3009', hex: '#703731', n: 'Oxide red' },
  { c: '3011', hex: '#7E292C', n: 'Brown red' }, { c: '3012', hex: '#CB8D73', n: 'Beige red' },
  { c: '3013', hex: '#9C322E', n: 'Tomato red' }, { c: '3014', hex: '#D47479', n: 'Antique pink' },
  { c: '3015', hex: '#E1A6AD', n: 'Light pink' }, { c: '3016', hex: '#AC4034', n: 'Coral red' },
  { c: '3017', hex: '#D3545F', n: 'Rose' }, { c: '3018', hex: '#D14152', n: 'Strawberry red' },
  { c: '3020', hex: '#C1121C', n: 'Traffic red' }, { c: '3022', hex: '#D56D56', n: 'Salmon pink' },
  { c: '3024', hex: '#F70000', n: 'Luminous red' }, { c: '3026', hex: '#FF0000', n: 'Luminous bright red' },
  { c: '3027', hex: '#B42041', n: 'Raspberry red' }, { c: '3028', hex: '#E72512', n: 'Pure red' },
  { c: '3031', hex: '#AC323B', n: 'Orient red' }, { c: '3032', hex: '#711521', n: 'Pearl ruby red' },
  { c: '3033', hex: '#B24C43', n: 'Pearl pink' },
  { c: '4001', hex: '#8A5A83', n: 'Red lilac' }, { c: '4002', hex: '#933D50', n: 'Red violet' },
  { c: '4003', hex: '#D15B8F', n: 'Heather violet' }, { c: '4004', hex: '#691639', n: 'Claret violet' },
  { c: '4005', hex: '#83639D', n: 'Blue lilac' }, { c: '4006', hex: '#992572', n: 'Traffic purple' },
  { c: '4007', hex: '#4A203B', n: 'Purple violet' }, { c: '4008', hex: '#904684', n: 'Signal violet' },
  { c: '4009', hex: '#A38995', n: 'Pastel violet' }, { c: '4010', hex: '#C63678', n: 'Telemagenta' },
  { c: '4011', hex: '#8773A1', n: 'Pearl violet' }, { c: '4012', hex: '#6B6880', n: 'Pearl blackberry' },
  { c: '5000', hex: '#384C70', n: 'Violet blue' }, { c: '5001', hex: '#1F4764', n: 'Green blue' },
  { c: '5002', hex: '#2B2C7C', n: 'Ultramarine blue' }, { c: '5003', hex: '#2A3756', n: 'Sapphire blue' },
  { c: '5004', hex: '#1D1F2A', n: 'Black blue' }, { c: '5005', hex: '#154889', n: 'Signal blue' },
  { c: '5007', hex: '#41678D', n: 'Brilliant blue' }, { c: '5008', hex: '#313C48', n: 'Grey blue' },
  { c: '5009', hex: '#2E5978', n: 'Azure blue' }, { c: '5010', hex: '#13447C', n: 'Gentian blue' },
  { c: '5011', hex: '#232C3F', n: 'Steel blue' }, { c: '5012', hex: '#3481B8', n: 'Light blue' },
  { c: '5013', hex: '#232D53', n: 'Cobalt blue' }, { c: '5014', hex: '#6C7C98', n: 'Pigeon blue' },
  { c: '5015', hex: '#2874B2', n: 'Sky blue' }, { c: '5017', hex: '#0E518D', n: 'Traffic blue' },
  { c: '5018', hex: '#21888F', n: 'Turquoise blue' }, { c: '5019', hex: '#1A5784', n: 'Capri blue' },
  { c: '5020', hex: '#0B4151', n: 'Ocean blue' }, { c: '5021', hex: '#07737A', n: 'Water blue' },
  { c: '5022', hex: '#2F2A5A', n: 'Night blue' }, { c: '5023', hex: '#4D668E', n: 'Distant blue' },
  { c: '5024', hex: '#6A93B0', n: 'Pastel blue' }, { c: '5025', hex: '#296478', n: 'Pearl gentian blue' },
  { c: '5026', hex: '#102C54', n: 'Pearl night blue' },
  { c: '6000', hex: '#327662', n: 'Patina green' }, { c: '6001', hex: '#28713E', n: 'Emerald green' },
  { c: '6002', hex: '#276235', n: 'Leaf green' }, { c: '6003', hex: '#4B573E', n: 'Olive green' },
  { c: '6004', hex: '#0E4243', n: 'Blue green' }, { c: '6005', hex: '#0F4336', n: 'Moss green' },
  { c: '6006', hex: '#40433B', n: 'Grey olive' }, { c: '6007', hex: '#283424', n: 'Bottle green' },
  { c: '6008', hex: '#35382E', n: 'Brown green' }, { c: '6009', hex: '#26392F', n: 'Fir green' },
  { c: '6010', hex: '#3E753B', n: 'Grass green' }, { c: '6011', hex: '#68825B', n: 'Reseda green' },
  { c: '6012', hex: '#31403D', n: 'Black green' }, { c: '6013', hex: '#797C5A', n: 'Reed green' },
  { c: '6014', hex: '#444337', n: 'Yellow olive' }, { c: '6015', hex: '#3D403A', n: 'Black olive' },
  { c: '6016', hex: '#026A52', n: 'Turquoise green' }, { c: '6017', hex: '#468641', n: 'May green' },
  { c: '6018', hex: '#48A43F', n: 'Yellow green' }, { c: '6019', hex: '#B7D9B1', n: 'Pastel green' },
  { c: '6020', hex: '#354733', n: 'Chromium green' }, { c: '6021', hex: '#86A47C', n: 'Pale green' },
  { c: '6022', hex: '#3E3C32', n: 'Brown olive' }, { c: '6024', hex: '#008754', n: 'Traffic green' },
  { c: '6025', hex: '#53753C', n: 'Fern green' }, { c: '6026', hex: '#005D52', n: 'Opal green' },
  { c: '6027', hex: '#81C0BB', n: 'Light green' }, { c: '6028', hex: '#2D5546', n: 'Pine green' },
  { c: '6029', hex: '#007243', n: 'Mint green' }, { c: '6032', hex: '#0F8558', n: 'Signal green' },
  { c: '6033', hex: '#478A84', n: 'Mint turquoise' }, { c: '6034', hex: '#7FB0B2', n: 'Pastel turquoise' },
  { c: '6035', hex: '#1B542C', n: 'Pearl green' }, { c: '6036', hex: '#005D4C', n: 'Pearl opal green' },
  { c: '6037', hex: '#25E712', n: 'Pure green' }, { c: '6038', hex: '#00F700', n: 'Luminous green' },
  { c: '7000', hex: '#7E8B92', n: 'Squirrel grey' }, { c: '7001', hex: '#8F999F', n: 'Silver grey' },
  { c: '7002', hex: '#817F68', n: 'Olive grey' }, { c: '7003', hex: '#7A7B6D', n: 'Moss grey' },
  { c: '7004', hex: '#9EA0A1', n: 'Signal grey' }, { c: '7005', hex: '#6B716F', n: 'Mouse grey' },
  { c: '7006', hex: '#756F61', n: 'Beige grey' }, { c: '7008', hex: '#746643', n: 'Khaki grey' },
  { c: '7009', hex: '#5B6259', n: 'Green grey' }, { c: '7010', hex: '#575D57', n: 'Tarpaulin grey' },
  { c: '7011', hex: '#555D61', n: 'Iron grey' }, { c: '7012', hex: '#596163', n: 'Basalt grey' },
  { c: '7013', hex: '#555548', n: 'Brown grey' }, { c: '7015', hex: '#51565C', n: 'Slate grey' },
  { c: '7016', hex: '#373F43', n: 'Anthracite grey' }, { c: '7021', hex: '#2E3234', n: 'Black grey' },
  { c: '7022', hex: '#4B4D46', n: 'Umbra grey' }, { c: '7023', hex: '#818479', n: 'Concrete grey' },
  { c: '7024', hex: '#474A50', n: 'Graphite grey' }, { c: '7026', hex: '#374447', n: 'Granite grey' },
  { c: '7030', hex: '#939388', n: 'Stone grey' }, { c: '7031', hex: '#5D6970', n: 'Blue grey' },
  { c: '7032', hex: '#B9B9A8', n: 'Pebble grey' }, { c: '7033', hex: '#818979', n: 'Cement grey' },
  { c: '7034', hex: '#939176', n: 'Yellow grey' }, { c: '7035', hex: '#CBD0CC', n: 'Light grey' },
  { c: '7036', hex: '#9A9697', n: 'Platinum grey' }, { c: '7037', hex: '#7C7F7E', n: 'Dusty grey' },
  { c: '7038', hex: '#B4B8B0', n: 'Agate grey' }, { c: '7039', hex: '#6B695F', n: 'Quartz grey' },
  { c: '7040', hex: '#9DA3A6', n: 'Window grey' }, { c: '7042', hex: '#8F9695', n: 'Traffic grey A' },
  { c: '7043', hex: '#4E5451', n: 'Traffic grey B' }, { c: '7044', hex: '#BDBDB2', n: 'Silk grey' },
  { c: '7045', hex: '#91969A', n: 'Telegrey 1' }, { c: '7046', hex: '#82898E', n: 'Telegrey 2' },
  { c: '7047', hex: '#CFD0CF', n: 'Telegrey 4' }, { c: '7048', hex: '#888175', n: 'Pearl mouse grey' },
  { c: '8000', hex: '#887142', n: 'Green brown' }, { c: '8001', hex: '#9C6B30', n: 'Ochre brown' },
  { c: '8002', hex: '#7B5141', n: 'Signal brown' }, { c: '8003', hex: '#80542F', n: 'Clay brown' },
  { c: '8004', hex: '#8F4E35', n: 'Copper brown' }, { c: '8007', hex: '#6F4A2F', n: 'Fawn brown' },
  { c: '8008', hex: '#6F4F28', n: 'Olive brown' }, { c: '8011', hex: '#5A3A29', n: 'Nut brown' },
  { c: '8012', hex: '#673831', n: 'Red brown' }, { c: '8014', hex: '#49392D', n: 'Sepia brown' },
  { c: '8015', hex: '#633A34', n: 'Chestnut brown' }, { c: '8016', hex: '#4C2F26', n: 'Mahogany brown' },
  { c: '8017', hex: '#44322D', n: 'Chocolate brown' }, { c: '8019', hex: '#3F3A3A', n: 'Grey brown' },
  { c: '8022', hex: '#211F20', n: 'Black brown' }, { c: '8023', hex: '#A65E2F', n: 'Orange brown' },
  { c: '8024', hex: '#79553C', n: 'Beige brown' }, { c: '8025', hex: '#755C49', n: 'Pale brown' },
  { c: '8028', hex: '#4E3B2B', n: 'Terra brown' }, { c: '8029', hex: '#773C27', n: 'Pearl copper' },
  { c: '9001', hex: '#EFEBDC', n: 'Cream' }, { c: '9002', hex: '#DDDED4', n: 'Grey white' },
  { c: '9003', hex: '#F4F8F4', n: 'Signal white' }, { c: '9004', hex: '#2E3032', n: 'Signal black' },
  { c: '9005', hex: '#0A0A0D', n: 'Jet black' }, { c: '9006', hex: '#A5A8A6', n: 'White aluminium' },
  { c: '9007', hex: '#8F8F8C', n: 'Grey aluminium' }, { c: '9010', hex: '#F7F9EF', n: 'Pure white' },
  { c: '9011', hex: '#1C1C1C', n: 'Graphite black' }, { c: '9016', hex: '#F7FBF5', n: 'Traffic white' },
  { c: '9017', hex: '#2A2D2F', n: 'Traffic black' }, { c: '9018', hex: '#CFD3CD', n: 'Papyrus white' },
]

const byHex = new Map(RAL.map((r) => [r.hex.toLowerCase(), r]));

// Human label for a hex: "RAL 3020 · Traffic red" if known, else the hex.
export const ralLabel = (hex: string): string => {
  const r = byHex.get(String(hex || "").toLowerCase());
  return r ? `RAL ${r.c} · ${r.n}` : hex || "";
};

// Filter by a code/name query (for the picker's search box).
export const ralSearch = (q: string): RalSwatch[] => {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return RAL;
  return RAL.filter((r) => r.c.includes(s) || r.n.toLowerCase().includes(s));
};
