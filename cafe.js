// ===== คาเฟ่: กาแฟ ชา นม น้ำต่าง ๆ + เบเกอรี่ =====
// ค่าฐานคิดที่แก้วเย็นขนาดกลาง 16 oz (กาแฟ 2 ช็อต) ตามร้านคาเฟ่ทั่วไปในไทย
// แต่ละเมนู = ฐาน (กาแฟ/ชา/ผง/ซอส/น้ำผลไม้) + นม (ml, เลือกชนิดนมได้) + ความหวาน 100% (ไซรัป/นมข้น)
// ความหวาน 0–125% คูณเฉพาะส่วนหวาน · ร้อน/เย็น/ปั่น และขนาดแก้ว คูณทั้งแก้ว
const SY = g => ({ k2: Math.round(g * 3.9), p: 0, c: g, f: 0 });           // ไซรัปน้ำตาล g
const R1 = v => Math.round(v * 10) / 10;
export const CAFE = {
 groups: [
  { k: 'coffee', n: 'กาแฟ' }, { k: 'tea', n: 'ชา / มัทฉะ' }, { k: 'other', n: 'นม โกโก้ น้ำอื่น ๆ' }
 ],
 drinks: [
  // --- กาแฟ ---
  { k: 'americano', g: 'coffee', n: 'อเมริกาโน่', al: 'americano กาแฟดำ', base: { k2: 5, p: 0.3, c: 1, f: 0 }, milk: 0, sw: SY(15), sw0: 0 },
  { k: 'orange', g: 'coffee', n: 'กาแฟส้ม', al: 'อเมริกาโน่ส้ม orange coffee', base: { k2: 75, p: 1.2, c: 17, f: 0.3 }, milk: 0, sw: SY(15), sw0: 50, temps: ['iced', 'frappe'] },
  { k: 'coconut', g: 'coffee', n: 'อเมริกาโน่มะพร้าว', al: 'coconut americano น้ำมะพร้าว', base: { k2: 35, p: 0.6, c: 8, f: 0.2 }, milk: 0, sw: SY(10), sw0: 0, temps: ['iced', 'frappe'] },
  { k: 'honeylemon', g: 'coffee', n: 'อเมริกาโน่น้ำผึ้งมะนาว', al: 'honey lemon', base: { k2: 8, p: 0.3, c: 2, f: 0 }, milk: 0, sw: { k2: 75, p: 0, c: 20, f: 0 }, sw0: 100 },
  { k: 'espresso', g: 'coffee', n: 'เอสเพรสโซ่ (ช็อต)', al: 'espresso ช็อต', base: { k2: 3, p: 0.2, c: 0.5, f: 0 }, milk: 0, sw: SY(5), sw0: 0, fix: 1 },
  { k: 'latte', g: 'coffee', n: 'ลาเต้', al: 'latte ลาเต', base: { k2: 5, p: 0.3, c: 1, f: 0 }, milk: 200, sw: SY(20), sw0: 100 },
  { k: 'cappu', g: 'coffee', n: 'คาปูชิโน่', al: 'cappuccino คาปู', base: { k2: 5, p: 0.3, c: 1, f: 0 }, milk: 160, sw: SY(20), sw0: 100 },
  { k: 'flatwhite', g: 'coffee', n: 'แฟลตไวท์', al: 'flat white เดอร์ตี้ dirty', base: { k2: 5, p: 0.3, c: 1, f: 0 }, milk: 120, sw: SY(10), sw0: 0, temps: ['hot', 'iced'] },
  { k: 'mocha', g: 'coffee', n: 'มอคค่า', al: 'mocha มอคคา มอคค่า', base: { k2: 80, p: 1, c: 17, f: 0.7 }, milk: 180, sw: SY(15), sw0: 100 },
  { k: 'caramel', g: 'coffee', n: 'คาราเมลมัคคิอาโต้', al: 'caramel macchiato คาราเมล', base: { k2: 55, p: 0.3, c: 13, f: 0.5 }, milk: 200, sw: SY(15), sw0: 100 },
  { k: 'esyen', g: 'coffee', n: 'เอสเย็น', al: 'กาแฟเย็น กาแฟโบราณ นมข้น', nm: { hot: 'กาแฟร้อนแบบไทย (นมข้น)', iced: 'เอสเย็น (นมข้น)', frappe: 'เอสเย็นปั่น (นมข้น)' }, base: { k2: 100, p: 2.7, c: 9, f: 6 }, milk: 0, sw: { k2: 190, p: 3.2, c: 37, f: 3.5 }, sw0: 100 },
  { k: 'oliang', g: 'coffee', n: 'โอเลี้ยง', al: 'กาแฟดำเย็น กาแฟโบราณ', nm: { hot: 'กาแฟดำร้อนแบบโบราณ', iced: 'โอเลี้ยง', frappe: 'โอเลี้ยงปั่น' }, base: { k2: 10, p: 0.3, c: 2, f: 0 }, milk: 0, sw: SY(30), sw0: 100 },
  // --- ชา ---
  { k: 'thaitea', g: 'tea', n: 'ชาไทย', al: 'ชาเย็น ชานม thai tea', nm: { hot: 'ชาไทยร้อน', iced: 'ชาเย็น (ชาไทย)', frappe: 'ชาเย็นปั่น' }, base: { k2: 110, p: 2.7, c: 11, f: 6.5 }, milk: 0, sw: { k2: 190, p: 3.2, c: 37, f: 3.5 }, sw0: 100 },
  { k: 'greenthai', g: 'tea', n: 'ชาเขียวนม', al: 'ชาเขียวนมเย็น green tea', base: { k2: 110, p: 2.7, c: 11, f: 6.5 }, milk: 0, sw: { k2: 190, p: 3.2, c: 37, f: 3.5 }, sw0: 100 },
  { k: 'matcha', g: 'tea', n: 'มัทฉะลาเต้', al: 'matcha มัจฉะ ชาเขียว', base: { k2: 10, p: 0.9, c: 1, f: 0.2 }, milk: 200, sw: SY(20), sw0: 50 },
  { k: 'milktea', g: 'tea', n: 'ชานมไต้หวัน', al: 'ชานมไข่มุก บราวน์ชูการ์ bubble tea', base: { k2: 100, p: 1, c: 12, f: 5 }, milk: 0, sw: SY(30), sw0: 100 },
  { k: 'lemontea', g: 'tea', n: 'ชามะนาว', al: 'ชาดำ ชาดำเย็น lemon tea', base: { k2: 6, p: 0, c: 1.5, f: 0 }, milk: 0, sw: SY(30), sw0: 100 },
  { k: 'fruittea', g: 'tea', n: 'ชาผลไม้', al: 'ชาพีช ลิ้นจี่ ยูซุ peach', base: { k2: 40, p: 0.3, c: 10, f: 0 }, milk: 0, sw: SY(25), sw0: 100, temps: ['iced', 'frappe'] },
  // --- นม โกโก้ น้ำอื่น ๆ ---
  { k: 'cocoa', g: 'other', n: 'โกโก้', al: 'ช็อกโกแลต ช็อคโกแลต cocoa chocolate', base: { k2: 70, p: 3.5, c: 9, f: 2.5 }, milk: 200, sw: SY(25), sw0: 100 },
  { k: 'freshmilk', g: 'other', n: 'นมสด', al: 'milk', base: { k2: 0, p: 0, c: 0, f: 0 }, milk: 250, sw: SY(10), sw0: 0 },
  { k: 'pinkmilk', g: 'other', n: 'นมชมพู', al: 'นมเย็น นมแดง', base: { k2: 0, p: 0, c: 0, f: 0 }, milk: 220, sw: SY(30), sw0: 100, temps: ['iced', 'frappe'] },
  { k: 'soda', g: 'other', n: 'อิตาเลียนโซดา', al: 'โซดา italian soda', base: { k2: 0, p: 0, c: 0, f: 0 }, milk: 0, sw: SY(35), sw0: 100, temps: ['iced'] },
  { k: 'honeylime', g: 'other', n: 'น้ำผึ้งมะนาว', al: 'honey lemon', base: { k2: 8, p: 0.1, c: 2.5, f: 0 }, milk: 0, sw: { k2: 90, p: 0, c: 24, f: 0 }, sw0: 100 },
  { k: 'oj', g: 'other', n: 'น้ำส้มคั้น', al: 'orange juice น้ำส้ม', base: { k2: 135, p: 2, c: 31, f: 0.6 }, milk: 0, sw: SY(10), sw0: 0, temps: ['iced', 'frappe'] },
  { k: 'smoothie', g: 'other', n: 'สมูทตี้ผลไม้', al: 'smoothie ผลไม้ปั่น', nm: { iced: 'สมูทตี้ผลไม้' }, base: { k2: 150, p: 2, c: 35, f: 0.6 }, milk: 0, sw: SY(20), sw0: 100, temps: ['iced'] },
  { k: 'yogsmooth', g: 'other', n: 'สมูทตี้โยเกิร์ต', al: 'smoothie yogurt โยเกิร์ตปั่น', nm: { iced: 'สมูทตี้โยเกิร์ต' }, base: { k2: 200, p: 6, c: 38, f: 2.5 }, milk: 0, sw: SY(20), sw0: 100, temps: ['iced'] },
  { k: 'coconutw', g: 'other', n: 'น้ำมะพร้าว', al: 'coconut water', base: { k2: 60, p: 0.7, c: 14, f: 0.2 }, milk: 0, sw: SY(0), sw0: 0, nosw: 1, temps: ['iced'] }
 ],
 // นมต่อ 100 ml
 milks: [
  { k: 'whole', n: 'นมสด (ปกติ)', k2: 65, p: 3.3, c: 4.8, f: 3.6 },
  { k: 'low', n: 'นมพร่องมันเนย', k2: 46, p: 3.4, c: 5, f: 1.5 },
  { k: 'skim', n: 'นมขาดมันเนย', k2: 35, p: 3.4, c: 5, f: 0.2 },
  { k: 'soy', n: 'นมถั่วเหลือง', k2: 45, p: 3, c: 4, f: 2 },
  { k: 'almond', n: 'นมอัลมอนด์', k2: 17, p: 0.5, c: 0.6, f: 1.3 },
 ],
 temps: [{ k: 'hot', n: 'ร้อน', m: 0.7 }, { k: 'iced', n: 'เย็น', m: 1 }, { k: 'frappe', n: 'ปั่น', m: 1.3 }],
 frappe: { k2: 35, p: 0, c: 8, f: 0.3 },                                          // ผงปั่น/น้ำเชื่อมเพิ่มของเมนูปั่น
 sizes: [{ k: 0.8, n: 'แก้วเล็ก' }, { k: 1, n: 'แก้วกลาง' }, { k: 1.35, n: 'แก้วใหญ่' }],
 sweets: [{ k: 0, n: 'ไม่หวาน' }, { k: 25, n: 'หวาน 25%' }, { k: 50, n: 'หวานน้อย 50%' }, { k: 75, n: 'หวาน 75%' }, { k: 100, n: 'หวานปกติ' }, { k: 125, n: 'หวานมาก' }],
 extras: [
  { k: 'shot', n: 'เพิ่มช็อต', k2: 3, p: 0.2, c: 0.5, f: 0 },
  { k: 'pump', n: 'ไซรัปเพิ่ม 1 ปั๊ม', k2: 30, p: 0, c: 7.5, f: 0 },
  { k: 'whip', n: 'วิปครีม', k2: 80, p: 0.5, c: 3, f: 7.5 },
  { k: 'drizzle', n: 'ราดคาราเมล/ช็อกโกแลต', k2: 40, p: 0.2, c: 9, f: 0.4 },
  { k: 'cheese', n: 'ชีสโฟม', k2: 120, p: 2, c: 5, f: 10 },
  { k: 'pearl', n: 'ไข่มุก', k2: 150, p: 0, c: 37, f: 0.2 },
  { k: 'jelly', n: 'เจลลี่/บุก', k2: 40, p: 0, c: 10, f: 0 }
 ],
 drank: [{ k: 100, n: 'หมดแก้ว' }, { k: 75, n: '¾' }, { k: 50, n: 'ครึ่ง' }, { k: 25, n: '¼' }],
 // เบเกอรี่ / ขนม · ค่าต่อ 1 ชิ้น ขนาดขายหน้าร้านทั่วไป
 bakery: [
  { k: 'croissant', n: 'ครัวซองต์เนยสด', k2: 270, p: 5, c: 28, f: 15 },
  { k: 'croham', n: 'ครัวซองต์แฮมชีส', k2: 380, p: 14, c: 30, f: 23 },
  { k: 'croalmond', n: 'ครัวซองต์อัลมอนด์', k2: 430, p: 9, c: 40, f: 26 },
  { k: 'painchoc', n: 'เพน โอ ช็อกโกแลต', k2: 300, p: 5, c: 32, f: 17 },
  { k: 'danish', n: 'เดนิชผลไม้', k2: 300, p: 4, c: 36, f: 15 },
  { k: 'muffin', n: 'มัฟฟินบลูเบอร์รี่', k2: 400, p: 6, c: 55, f: 17 },
  { k: 'muffinchoc', n: 'มัฟฟินช็อกโกแลต', k2: 440, p: 6, c: 55, f: 22 },
  { k: 'brownie', n: 'บราวนี่', k2: 260, p: 3, c: 33, f: 14 },
  { k: 'cookie', n: 'คุกกี้ช็อกโกแลตชิพ (ชิ้นใหญ่)', k2: 230, p: 3, c: 30, f: 11 },
  { k: 'scone', n: 'สโคน + แยม/ครีม', k2: 350, p: 6, c: 45, f: 15 },
  { k: 'banana', n: 'เค้กกล้วยหอม (ชิ้น)', k2: 250, p: 3, c: 35, f: 11 },
  { k: 'chocake', n: 'เค้กช็อกโกแลต (ชิ้น)', k2: 400, p: 5, c: 50, f: 20 },
  { k: 'cheesecake', n: 'ชีสเค้ก (ชิ้น)', k2: 400, p: 7, c: 30, f: 28 },
  { k: 'banoffee', n: 'บานอฟฟี่ (ชิ้น)', k2: 420, p: 4, c: 50, f: 23 },
  { k: 'crepecake', n: 'เครปเค้ก (ชิ้น)', k2: 350, p: 6, c: 35, f: 20 },
  { k: 'rollcake', n: 'โรลเค้ก (ชิ้น)', k2: 250, p: 3, c: 32, f: 12 },
  { k: 'eggtart', n: 'ทาร์ตไข่', k2: 200, p: 4, c: 22, f: 11 },
  { k: 'choux', n: 'ชูครีม', k2: 150, p: 3, c: 15, f: 9 },
  { k: 'macaron', n: 'มาการอง', k2: 80, p: 1.5, c: 11, f: 3.5 },
  { k: 'donut', n: 'โดนัทเคลือบ', k2: 250, p: 3, c: 30, f: 13 },
  { k: 'toast', n: 'ขนมปังปิ้งเนยนม/เนยน้ำตาล (2 แผ่น)', k2: 280, p: 5, c: 35, f: 13 },
  { k: 'honeytoast', n: 'ฮันนี่โทสต์ (ครึ่งชุด)', k2: 550, p: 8, c: 70, f: 26 },
  { k: 'waffle', n: 'วาฟเฟิล/แพนเค้ก + ไซรัป (2 ชิ้น)', k2: 450, p: 9, c: 60, f: 18 },
  { k: 'sandham', n: 'แซนด์วิชแฮมชีส', k2: 330, p: 15, c: 32, f: 15 },
  { k: 'sandtuna', n: 'แซนด์วิชทูน่า', k2: 350, p: 15, c: 32, f: 17 },
  { k: 'sandchick', n: 'แซนด์วิชอกไก่โฮลวีท', k2: 300, p: 22, c: 32, f: 8 }
 ],
 share: [{ k: 100, n: 'กินคนเดียว' }, { k: 50, n: 'แบ่งครึ่ง' }, { k: 33, n: 'แบ่ง 3 คน' }]
};
const Pick = (L, k) => L.find(x => String(x.k) === String(k)) || L[0];
function add(a, x, m) { if (!x || !(m > 0) || x.k2 == null) return a; return { k: a.k + x.k2 * m, p: a.p + x.p * m, c: a.c + x.c * m, f: a.f + x.f * m }; }
const fin = t => ({ k: Math.round(t.k), p: R1(t.p), c: R1(t.c), f: R1(t.f) });
// สเตตเครื่องดื่ม: {drink, temp, size, milk, sweet, extras:[...], drank}
export function cafeTemps(d) { return d.fix ? [] : CAFE.temps.filter(t => !d.temps || d.temps.includes(t.k)); }
export function cafeCalc(st) {
 const d = Pick(CAFE.drinks, st.drink), TL = cafeTemps(d), tp = d.fix ? CAFE.temps[0] : (TL.find(t => t.k === st.temp) || TL.find(t => t.k === 'iced') || TL[0]), sz = d.fix ? 1 : (+st.size || 1);
 const mk = Pick(CAFE.milks, st.milk), sw = d.nosw ? 0 : (st.sweet == null ? d.sw0 : +st.sweet), m = d.fix ? 1 : tp.m * sz;
 let t = { k: 0, p: 0, c: 0, f: 0 };
 t = add(t, d.base, m); if (d.milk) t = add(t, mk, d.milk / 100 * m); t = add(t, d.sw, sw / 100 * m);
 if (tp.k === 'frappe' && !d.fix) t = add(t, CAFE.frappe, sz);
 const ex = (st.extras || []).map(k => CAFE.extras.find(x => x.k === k)).filter(Boolean);
 ex.forEach(x => { t = add(t, x, 1); });
 const dr = (st.drank == null ? 100 : +st.drank) / 100;
 t = { k: t.k * dr, p: t.p * dr, c: t.c * dr, f: t.f * dr };
 const name = d.fix ? d.n : (d.nm?.[tp.k] || d.n + (tp.k === 'hot' ? 'ร้อน' : tp.k === 'frappe' ? 'ปั่น' : 'เย็น'));
 const bits = [];
 if (!d.fix) bits.push(Pick(CAFE.sizes, sz).n);
 if (d.milk) bits.push(mk.n);
 if (!d.nosw) bits.push(Pick(CAFE.sweets, sw).n);
 if (ex.length) bits.push(ex.map(x => x.n).join(' + '));
 if (dr < 1) bits.push(`ดื่ม ${Math.round(dr * 100)}%`);
 return { name, desc: bits.join(' · '), temp: tp.k, ...fin(t) };
}
export function bakeryCalc(k, n, share) {
 const b = CAFE.bakery.find(x => x.k === k); if (!b) return null;
 const m = (+n || 1) * ((share == null ? 100 : +share) / 100);
 return { name: b.n + ((+n || 1) > 1 ? ` ×${n}` : ''), desc: (share != null && +share < 100) ? Pick(CAFE.share, share).n : 'เบเกอรี่/ขนม', ...fin(add({ k: 0, p: 0, c: 0, f: 0 }, b, m)) };
}
// รายการสำหรับค้นในคลังอาหาร: เครื่องดื่มเย็นขนาดกลาง (หวานปกติ / หวานน้อย / ไม่หวาน) + เบเกอรี่
export function cafeFoods() {
 const out = [];
 for (const d of CAFE.drinks) {
  const lv = d.nosw ? [0] : d.fix ? [0, 100] : (d.base.k2 || d.milk) ? [100, 50, 0] : [100, 50];
  for (const sw of lv) {
   const r = cafeCalc({ drink: d.k, temp: 'iced', size: 1, milk: 'whole', sweet: sw, extras: [], drank: 100 });
   out.push({ id: `cf_${d.k}_${sw}`, n: `${r.name}${d.nosw ? '' : ' ' + Pick(CAFE.sweets, sw).n} (คาเฟ่)`, al: d.al || '', u: 'pc', un: 'แก้ว', d: 1, k: r.k, p: r.p, c: r.c, f: r.f, cat: 'คาเฟ่/เครื่องดื่ม', cf: { drink: d.k, temp: r.temp, sweet: sw } });
  }
 }
 for (const b of CAFE.bakery) out.push({ id: `bk_${b.k}`, n: b.n + ' (เบเกอรี่)', u: 'pc', un: 'ชิ้น', d: 1, k: b.k2, p: b.p, c: b.c, f: b.f, cat: 'คาเฟ่/เบเกอรี่', bk: b.k });
 return out;
}
