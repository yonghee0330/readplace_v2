// 자동 닉네임: 형용사 + 책·종이 명사. 예: "조용한 책갈피"

const ADJECTIVES = [
  '조용한', '느린', '따뜻한', '포근한', '작은', '오래된', '다정한', '졸린', '비 오는', '새벽의',
  '말랑한', '수줍은', '고요한', '한가한', '향긋한', '반듯한', '나른한', '설레는', '차분한', '느긋한',
];
const NOUNS = [
  '책갈피', '문고본', '양장본', '갈피끈', '연필', '원고지', '각주', '서문', '책등', '띠지',
  '면지', '활자', '쪽번호', '책장', '페이지', '밑줄', '여백', '목차', '후기', '종이컵',
];

export function randomNickname(rand: () => number = Math.random): string {
  const a = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(rand() * NOUNS.length)];
  return `${a} ${n}`;
}
