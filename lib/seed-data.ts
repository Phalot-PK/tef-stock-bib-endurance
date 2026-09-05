export type AllocationSeed = {
  event: string;
  color: string;
  bibConfirm: number;
  bibSign: number;
  rider: string;
  club: string;
  location: string;
  stockCode: string;
  stockColor: string;
  matchStatus: string;
};

const cen40Bibs = [
  1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
  25, 29, 30, 32, 33, 34, 36, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 50,
];
const cen80Bibs = [
  2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 25, 26,
  27, 28, 29,
];

export const stockSeeds = [
  ...cen40Bibs.map((bib, index) => ({
    code: `TEF_EN_${String(index + 24).padStart(4, '0')}`,
    event: 'CEN 40 KM',
    color: 'Green',
    bib,
    value: 300,
  })),
  ...cen80Bibs.map((bib, index) => ({
    code: `TEF_EN_${String(index + 1).padStart(4, '0')}`,
    event: 'CEN 80 KM',
    color: 'Orange',
    bib,
    value: 300,
  })),
];

const dpeRows: Array<[number, string, string, string]> = [
  [1, 'Green', 'ชนิดาภา ทวีพัฒนะพงศ์', 'Horsey'],
  [2, 'Green', 'ธัญาดา ทวีพัฒนะพงศ์', 'Horsey'],
  [3, 'Orange', 'พัชรพล บุญอยู่', 'Gik Kor'],
  [4, 'Green', 'ธนัท ปฏิบัติ', 'Rayong'],
  [5, 'Green', 'นลินนิภา มีศิลป์', 'Gik Kor'],
  [6, 'Green', 'ภูษิศา โบราณประสิทธิ์', 'Horseland'],
  [7, 'Orange', 'ศรุตา วรรณธนัตดี', 'Mounted Police'],
  [8, 'Green', 'เกสรา พิเสฐคุณาลัย', 'Suphan'],
  [9, 'Green', 'ธนัชคม พุทธารัก', 'Horsey'],
  [10, 'Orange', 'ณัฐวรรณ จิตรภูเมืองปาน', 'Horsey'],
  [11, 'Green', 'ณัฏฐ์รเดช จิตรภูเมืองปาน', 'Horsey'],
  [12, 'Orange', 'นันทพัทธ์ ทวีพัฒนะพงศ์', 'Mcc'],
  [13, 'Green', 'เมลดา แนวโนนทัน', 'Faro Farm+NSRC'],
  [14, 'Orange', 'สุกฤยา อรรคพร', 'Faro Farm+NSRC'],
  [15, 'Green', 'ภาสินี วิลาสวรรณ', 'Suphan'],
  [16, 'Green', 'วิญญาภัทย์ จำปาเงิน', 'Suphan'],
  [17, 'Green', 'ณภัสนันท์ คนทน', 'Suphan'],
  [18, 'Green', 'กัลยกร บุญกิตติชัยพันธ์', 'Mounted Police'],
  [19, 'Green', 'กัลยาภรณ์ บุญกิตติชัยพันธ์', 'Mounted Police'],
  [20, 'Green', 'พิมพ์ลดา วรรณไพบูลย์', 'Horsey'],
  [21, 'Green', 'กษิต แวววงศ์', 'Faro Farm+NSRC'],
  [22, 'Green', 'พิมพ์กฤช แสนสุข', 'Mcc'],
  [23, 'Green', 'กษมา เกิดสว่าง', 'Mcc'],
  [24, 'Green', 'ขวัญศิชา ประมูลทอง', 'Horseland'],
  [25, 'Green', 'ฐิติวัฒน์ รัตนศรีงาม', 'Horseland'],
  [26, 'Orange', 'ยุทธพล นวลใย', 'Chomtas'],
  [27, 'Green', 'พัชญพงษ์ วรรณไพบูลย์', 'Horsey'],
  [28, 'Orange', 'ลลินทิพย์ บุญญะธรรม', 'Suphan'],
  [29, 'Green', 'พงศกร เหมะรัต', 'Faro Farm+NSRC'],
  [30, 'Green', 'ศิวกร สมบูรณ์', 'Faro Farm+NSRC'],
  [32, 'Green', 'ชนานันท์ นวลใย', 'Chomtas'],
  [33, 'Green', 'ธนิก กิจวินลัย', 'Faro Farm+NSRC'],
  [34, 'Green', 'ณัฐเศรษฐ เลียบเลียน', 'Mcc'],
  [36, 'Green', 'วุฒิณณ์ อุ่นคำ', 'Mounted Police'],
  [38, 'Green', 'นักรบ สุขสุศรี', 'Faro Farm+NSRC'],
  [39, 'Green', 'พีรดา วงศ์เวาประเสริฐ', 'Horsey'],
  [40, 'Green', 'อดิศร กล่ำเกลี้ยง', 'Faro Farm+NSRC'],
  [41, 'Green', 'เบญญาภา กรดเพ็ชร์', 'Horseland'],
  [42, 'Green', 'เพชรพราว ปานวิเชียร', 'Suphan'],
  [43, 'Green', 'จันทคุณ แสงสุขวาว', 'Suphan'],
  [44, 'Green', 'ขวัญทิชา แก้วมีเงิน', 'Faro Farm+NSRC'],
  [45, 'Green', 'ณัฐณิชา ศิวทองกุล', 'Chomtas'],
  [46, 'Green', 'จันทวัฒน์ นาคะเลิศควี', 'Suphan'],
  [47, 'Green', 'ณัฐเศรษฐ เจริญรื่น', 'Gik Kor'],
];

const rawAllocations: Array<
  [string, string, number, number, string, string, string]
> = dpeRows.map(([bib, color, rider, club]) => [
  'DPE Aug 2026',
  color,
  bib,
  bib,
  rider,
  club,
  bib === 22 ? 'สำนักงาน/สมาคม' : 'Thai Polo',
]);

export const allocationSeeds: AllocationSeed[] = rawAllocations.map(
  ([event, color, bibConfirm, bibSign, rider, club, location]) => {
    const stock =
      stockSeeds.find(
        (item) =>
          item.bib === bibConfirm &&
          item.color.toLowerCase() === color.toLowerCase(),
      ) ?? stockSeeds.find((item) => item.bib === bibConfirm);
    const exact = stock && stock.color.toLowerCase() === color.toLowerCase();
    return {
      event,
      color,
      bibConfirm,
      bibSign,
      rider,
      club,
      location,
      stockCode: stock?.code ?? '',
      stockColor: stock?.color ?? '',
      matchStatus: exact
        ? 'ตรงกับสต๊อกตั้งต้น'
        : stock
          ? `สีต่างกัน (${stock.color}/${color})`
          : 'ไม่พบในสต๊อกตั้งต้น',
    };
  },
);
