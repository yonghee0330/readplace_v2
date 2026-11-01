// NPC가 들고 있는 "최근 베스트셀러" 후보.
// 네트워크 없이 시드만으로 고른다. 표지 URL은 넣지 않는다(중계·CORS 의존 없음).

export interface Bestseller {
  title: string;
  author: string;
  publisher: string;
}

/** 국내 서점 최근 화제작·스테디셀러 위주(소설·에세이·인문 섞음). */
export const BESTSELLERS: readonly Bestseller[] = [
  { title: '작별하지 않는다', author: '한강', publisher: '문학동네' },
  { title: '채식주의자', author: '한강', publisher: '창비' },
  { title: '흰', author: '한강', publisher: '문학동네' },
  { title: '소년이 온다', author: '한강', publisher: '창비' },
  { title: '희랍어 시간', author: '한강', publisher: '문학동네' },
  { title: '파친코 1', author: '이민진', publisher: '문학사상' },
  { title: '파친코 2', author: '이민진', publisher: '문학사상' },
  { title: '불편한 편의점', author: '김호연', publisher: '나무옆의자' },
  { title: '불편한 편의점 2', author: '김호연', publisher: '나무옆의자' },
  { title: '달러구트 꿈 백화점', author: '이미예', publisher: '팩토리나인' },
  { title: '아몬드', author: '손원평', publisher: '창비' },
  { title: '구의 증명', author: '최진영', publisher: '문학과지성사' },
  { title: '밝은 밤', author: '최은영', publisher: '문학동네' },
  { title: '시선으로부터,', author: '정세랑', publisher: '문학동네' },
  { title: '보건교사 안은영', author: '정세랑', publisher: '민음사' },
  { title: '미드나잇 라이브러리', author: '매트 헤이그', publisher: '인플루엔셜' },
  { title: '도둑맞은 집중력', author: '요한 하리', publisher: '어크로스' },
  { title: '마흔에 읽는 쇼펜하우어', author: '강용수', publisher: '유노북스' },
  { title: '역행자', author: '자청', publisher: '웅진지식하우스' },
  { title: '세이노의 가르침', author: '세이노', publisher: '데이원' },
  { title: '퓨처 셀프', author: '벤저민 하디', publisher: '상상스퀘어' },
  { title: '어떻게 말해줘야 할까', author: '오은영', publisher: '김영사' },
  { title: '어린이라는 세계', author: '김소영', publisher: '사계절' },
  { title: '내가 틀릴 수도 있습니다', author: '비욘 나티코 린데블라드', publisher: '다산초당' },
  { title: '물고기는 존재하지 않는다', author: '룰루 밀러', publisher: '곰출판' },
  { title: '코스모스', author: '칼 세이건', publisher: '사이언스북스' },
  { title: '데미안', author: '헤르만 헤세', publisher: '민음사' },
  { title: '나미야 잡화점의 기적', author: '히가시노 게이고', publisher: '현대문학' },
  { title: '연금술사', author: '파울로 코엘료', publisher: '문학동네' },
  { title: '여행의 이유', author: '김영하', publisher: '문학동네' },
];
