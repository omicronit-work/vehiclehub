import { getLanguage } from './index';
import { modelName } from './models';

/*
 * Vehicle brands in the local script (Bangla, Thai). Display only: the brand
 * is saved exactly as typed, and a brand not listed here (or English / Malay)
 * shows as typed; AppText then writes any Latin letters left by sound.
 * Models are localised in ./models.js.
 *
 * Columns: name | Bengali | Thai. Keep one brand per row.
 */
const LANGS = ['bn', 'th'];

const TABLE = `
Toyota|টয়োটা|โตโยต้า
Honda|হোন্ডা|ฮอนด้า
Yamaha|ইয়ামাহা|ยามาฮ่า
Suzuki|সুজুকি|ซูซูกิ
Nissan|নিসান|นิสสัน
Mitsubishi|মিতসুবিশি|มิตซูบิชิ
Hyundai|হুন্ডাই|ฮุนได
Kia|কিয়া|เกีย
Mazda|মাজদা|มาสด้า
Subaru|সুবারু|ซูบารุ
Isuzu|ইসুজু|อีซูซุ
Daihatsu|দাইহাতসু|ไดฮัทสุ
Hino|হিনো|ฮีโน่
Datsun|ড্যাটসান|ดัทสัน
Lexus|লেক্সাস|เล็กซัส
Acura|অ্যাকুরা|อคูร่า
Infiniti|ইনফিনিটি|อินฟินิตี้
Genesis|জেনেসিস|เจเนซิส
Ford|ফোর্ড|ฟอร์ด
Chevrolet|শেভ্রোলে|เชฟโรเลต
Cadillac|ক্যাডিলাক|คาดิลแลค
Jeep|জিপ|จี๊ป
Dodge|ডজ|ดอดจ์
Tesla|টেসলা|เทสลา
BMW|বিএমডব্লিউ|บีเอ็มดับเบิลยู
Mercedes-Benz|মার্সিডিজ-বেঞ্জ|เมอร์เซเดส-เบนซ์
Audi|অডি|อาวดี้
Volkswagen|ফক্সভাগেন|โฟล์คสวาเกน
Porsche|পোর্শে|ปอร์เช่
Opel|ওপেল|โอเปิล
Volvo|ভলভো|วอลโว่
Land Rover|ল্যান্ড রোভার|แลนด์โรเวอร์
Jaguar|জাগুয়ার|จากัวร์
Mini|মিনি|มินิ
Peugeot|পেজো|เปอโยต์
Renault|রেনো|เรโนลต์
Citroën|সিত্রোয়েন|ซีตรอง
Fiat|ফিয়াট|เฟียต
Škoda|স্কোডা|ชโกดา
Tata|টাটা|ทาทา
Mahindra|মাহিন্দ্রা|มหินทรา
Maruti Suzuki|মারুতি সুজুকি|มารูติ ซูซูกิ
Ashok Leyland|অশোক লেল্যান্ড|อโศก เลย์แลนด์
Proton|প্রোটন|โปรตอน
Perodua|পেরোডুয়া|เปอโรดัว
BYD|বিওয়াইডি|บีวายดี
Geely|জিলি|จีลี่
Chery|চেরি|เชอรี่
MG|এমজি|เอ็มจี
Haval|হাভাল|ฮาวาล
Great Wall|গ্রেট ওয়াল|เกรท วอลล์
Bajaj|বাজাজ|บาจาจ
TVS|টিভিএস|ทีวีเอส
Hero|হিরো|ฮีโร่
Royal Enfield|রয়্যাল এনফিল্ড|รอยัล เอนฟิลด์
KTM|কেটিএম|เคทีเอ็ม
Kawasaki|কাওয়াসাকি|คาวาซากิ
Ducati|ডুকাটি|ดูคาติ
Harley-Davidson|হার্লে-ডেভিডসন|ฮาร์ลีย์-เดวิดสัน
Vespa|ভেসপা|เวสป้า
Piaggio|পিয়াজিও|เพียจิโอ
Lifan|লিফান|ลี่ฟาน
Runner|রানার|รันเนอร์
Abarth|অ্যাবার্থ|อาบาร์ธ
Alfa Romeo|আলফা রোমিও|อัลฟา โรเมโอ
Alpina|আলপিনা|อัลพิน่า
Alpine|আলপাইন|อัลไพน์
Aston Martin|অ্যাস্টন মার্টিন|แอสตัน มาร์ติน
Bentley|বেন্টলি|เบนท์ลีย์
Borgward|বোর্গওয়ার্ড|บอร์กวาร์ด
Bugatti|বুগাটি|บูกัตติ
Buick|বুইক|บิวอิค
Changan|চাংআন|ฉางอัน
Chrysler|ক্রাইসলার|ไครสเลอร์
Cupra|কুপরা|คูปร้า
Dacia|দাচিয়া|ดาเซีย
Daewoo|দেউ|แดวู
Ferrari|ফেরারি|เฟอร์รารี่
Fisker|ফিস্কার|ฟิสเกอร์
GMC|জিএমসি|GMC
Holden|হোল্ডেন|โฮลเดน
Hummer|হামার|ฮัมเมอร์
Iveco|ইভেকো|อีเวโก้
Jetour|জেটুর|เจทัวร์
Koenigsegg|কোয়েনিগসেগ|โคนิกเซกก์
Lada|লাডা|ลาด้า
Lamborghini|ল্যাম্বরগিনি|ลัมโบร์กินี
Lancia|ল্যান্সিয়া|แลนเซีย
Leapmotor|লিপমোটর|ลีปมอเตอร์
Li Auto|লি অটো|ลี่ ออโต้
Lincoln|লিংকন|ลินคอล์น
Lotus|লোটাস|โลตัส
Lucid|লুসিড|ลูซิด
Lynk & Co|লিংক অ্যান্ড কো|ลิงก์ แอนด์ โค
Maserati|মাসেরাটি|มาเซราติ
Maybach|মেব্যাক|มายบัค
McLaren|ম্যাকলারেন|แม็คลาเรน
Morgan|মরগান|มอร์แกน
Nio|নিও|นีโอ
Omoda|ওমোডা|โอโมดะ
Pagani|পাগানি|ปากานี
Polestar|পোলস্টার|โพลสตาร์
Pontiac|পন্টিয়াক|ปอนเตียก
Ram|র‍্যাম|แรม
Rivian|রিভিয়ান|ริเวียน
Rolls-Royce|রোলস-রয়েস|โรลส์-รอยซ์
Rover|রোভার|โรเวอร์
Saab|সাব|ซาบ
SEAT|সিয়াট|ซีท
Smart|স্মার্ট|สมาร์ท
Triumph|ট্রায়াম্ফ|ไทรอัมพ์
Vauxhall|ভক্সহল|วอกซ์ฮอลล์
VinFast|ভিনফাস্ট|วินฟาสต์
Wuling|উলিং|อู่หลิง
Xpeng|এক্সপেং|เสี่ยวเผิง
Zeekr|জিকর|ซีเคอร์
Brilliance|ব্রিলিয়ান্স|บริลเลียนซ์
Caterham|ক্যাটারহাম|แคเทอร์แฮม
De Tomaso|দে তোমাসো|เดอ โทมาโซ
DeLorean|ডেলোরিয়ান|เดอโลเรียน
DS Automobiles|ডিএস অটোমোবাইলস|ดีเอส ออโตโมบิลส์
INEOS|ইনিওস|อิเนออส
JAC Motors|জ্যাক মোটরস|เจเอซี มอเตอร์ส
Karma|কারমা|คาร์มา
Mercury|মার্কারি|เมอร์คิวรี
Noble|নোবেল|โนเบิล
Oldsmobile|ওল্ডসমোবাইল|โอลด์สโมบิล
Plymouth|প্লাইমাউথ|พลีมัธ
Rambler|র‍্যাম্বলার|แรมเบลอร์
Rimac|রিম্যাক|ริแมค
Saleen|স্যালিন|ซาลีน
Saturn|স্যাটার্ন|แซทเทิร์น
Scion|সাইয়ন|ไซออน
Spyker|স্পাইকার|สไปเกอร์
SsangYong (KGM)|সাংইয়ং (কেজিএম)|ซังยง (KGM)
TVR|টিভিআর|ทีวีอาร์
Vector|ভেক্টর|เวกเตอร์
Wiesmann|ভিসমান|วีสมันน์
Xiaomi|শাওমি|เสียวหมี่
Yutong|ইউটং|ยูทง
Zenvo|জেনভো|เซนโว
DFSK|ডিএফএসকে|DFSK
Dongfeng|ডংফেং|ตงเฟิง
DS|ডিএস|DS
Foton|ফোটন|โฟตอน
GAC|জিএসি|GAC
Hongqi|হংছি|หงฉี
JAC|জ্যাক|JAC
Mercedes-AMG|মার্সিডিজ-এএমজি|เมอร์เซเดส-เอเอ็มจี
Neta|নেটা|เนต้า
Jaecoo|জেকু|เจคู
Exeed|এক্সিড|เอ็กซีด
Ora|ওরা|โอร่า
Seres|সেরেস|เซเรส
SsangYong|সাংইয়ং|ซันยอง
Tank|ট্যাংক|แทงค์
Zotye|জোটিয়ে|โซตเย่
Baojun|বাওজুন|เป่าจวิ้น
Deepal|ডিপাল|ดีพอล
Aion|আয়ন|ไอออน
Force Motors|ফোর্স মোটরস|ฟอร์ซ มอเตอร์ส
Eicher|আইশার|ไอเชอร์
Scania|স্ক্যানিয়া|สแกนเนีย
MAN|ম্যান|แมน
Fuso|ফুসো|ฟูโซ่
UD Trucks|ইউডি ট্রাকস|ยูดี ทรัคส์
Aprilia|এপ্রিলিয়া|อาพริเลีย
Benelli|বেনেলি|เบเนลลี่
CFMoto|সিএফমোটো|ซีเอฟโมโต้
Husqvarna|হুসকভার্না|ฮุสวาร์น่า
Indian|ইন্ডিয়ান|อินเดียน
Kymco|কিমকো|คิมโก้
MV Agusta|এমভি আগুস্তা|เอ็มวี ออกุสต้า
SYM|এসওয়াইএম|SYM
Zontes|জন্টেস|ซอนเทส
GPX|জিপিএক্স|จีพีเอ็กซ์
Keeway|কিওয়ে|คีย์เวย์
Hyosung|হিয়োসাং|ฮโยซอง
Walton|ওয়ালটন|วอลตัน
Haojue|হাওজুয়ে|ฮาวเจวี๋ย
Lambretta|ল্যামব্রেটা|แลมเบรตต้า
Moto Guzzi|মোটো গুজি|โมโต กุซซี่
Can-Am|ক্যান-অ্যাম|แคน-แอม
Yadea|ইয়াদিয়া|ยาเดีย
Niu|নিউ|นีอู
Ather|অ্যাথার|เอเธอร์
Ola Electric|ওলা ইলেকট্রিক|โอล่า อิเล็กทริค
Jawa|জাওয়া|จาวา
Yezdi|ইয়েজদি|เยซดี
`;

// Other spellings people type → the row's name.
const ALIASES = {
  mercedes: 'Mercedes-Benz', benz: 'Mercedes-Benz', 'mercedes benz': 'Mercedes-Benz',
  vw: 'Volkswagen', citroen: 'Citroën', skoda: 'Škoda', maruti: 'Maruti Suzuki',
  'harley davidson': 'Harley-Davidson', harley: 'Harley-Davidson', 'land-rover': 'Land Rover',
  landrover: 'Land Rover', 'royal-enfield': 'Royal Enfield', 'great-wall': 'Great Wall',
  'hero honda': 'Hero', 'hero motocorp': 'Hero', 'tata motors': 'Tata', 'tvs motor': 'TVS',
  alfa: 'Alfa Romeo', 'rolls royce': 'Rolls-Royce', amg: 'Mercedes-AMG', 'mercedes amg': 'Mercedes-AMG',
  'can am': 'Can-Am', 'ssang yong': 'SsangYong', 'lynk and co': 'Lynk & Co', 'mv-agusta': 'MV Agusta',
};

// Case, spacing and accents don't matter: 'citroen' finds 'Citroën'.
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .trim().toLowerCase().replace(/\s+/g, ' ');

let byName;
let byLocal;
const table = () => {
  if (!byName) {
    byName = new Map();
    byLocal = new Map();
    const load = (text, langs) => text.trim().split('\n').forEach(row => {
      const [name, ...names] = row.split('|');
      const entry = byName.get(norm(name)) || { name };
      langs.forEach((l, i) => { if (names[i] && !entry[l]) entry[l] = names[i]; });
      byName.set(norm(name), entry);
    });
    load(TABLE, LANGS);
    byName.forEach(entry => LANGS.forEach(l => {
      if (entry[l] && entry[l] !== entry.name) byLocal.set(norm(entry[l]), entry.name);
    }));
  }
  return byName;
};
const rowOf = brand => {
  const key = norm(brand);
  return table().get(key) || table().get(norm(ALIASES[key]));
};

/** 'Yamaha' → 'ইয়ামাহা' in Bengali; as typed when not listed. */
export const brandName = (brand, lang = getLanguage()) => {
  if (!brand || !LANGS.includes(lang)) return brand;
  return rowOf(brand)?.[lang] || brand;
};

/**
 * The brand name to save for what was typed or picked: 'ইয়ামাহা' or
 * 'yamaha' → 'Yamaha' (the spelling in `list`, else the table's), so saved
 * data stays in one language. Unknown text comes back trimmed, as typed.
 */
export const matchBrand = (text, list = []) => {
  const typed = String(text ?? '').trim();
  if (!typed) return '';
  table();
  const english = byLocal.get(norm(typed)) || typed;
  const key = norm(english);
  const alias = norm(ALIASES[key]);
  return list.find(b => norm(b) === key || (alias && norm(b) === alias))
    || rowOf(english)?.name
    || (english !== typed ? english : typed);
};

/**
 * Brands whose English or local name starts with what's typed ('ইয়া' and
 * 'ya' both find Yamaha). Empty query returns the whole list.
 */
export const filterBrands = (list, query) => {
  const q = norm(query);
  if (!q) return list;
  return list.filter(b => norm(b).startsWith(q) || norm(brandName(b)).startsWith(q));
};

/** 'Yamaha FZ-S V3' (plus year when asked) with brand and model localised. */
export const vehicleName = (vehicle, { year = false } = {}) =>
  [brandName(vehicle?.brand), modelName(vehicle?.model), year ? vehicle?.year : null].filter(Boolean).join(' ');
