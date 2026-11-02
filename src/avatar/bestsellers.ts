// NPC가 들고 있는 "최근 베스트셀러" 후보.
// 네트워크 없이 시드만으로 고른다. blurb는 머리 위 책을 눌렀을 때 바로 보여 준다.

export interface Bestseller {
  title: string;
  author: string;
  publisher: string;
  /** 한두 문장의 짧은 소개 */
  blurb: string;
}

/** 국내 서점 최근 화제작·스테디셀러 위주(소설·에세이·인문 섞음). */
export const BESTSELLERS: readonly Bestseller[] = [
  { title: '작별하지 않는다', author: '한강', publisher: '문학동네', blurb: '제주의 아픔과 기억, 그리고 애도를 시적인 문장으로 풀어낸 한강의 장편소설.' },
  { title: '채식주의자', author: '한강', publisher: '창비', blurb: '고기를 거부한 한 여성을 둘러싼 폭력과 욕망을 세 시선으로 그린 연작소설. 맨부커상 수상작.' },
  { title: '흰', author: '한강', publisher: '문학동네', blurb: '흰색을 매개로 상실과 애도를 응시하는 산문적 소설. 고요하고 날카로운 문장이 이어진다.' },
  { title: '소년이 온다', author: '한강', publisher: '창비', blurb: '1980년 광주에서 사라진 소년의 흔적을 따라가며 국가 폭력과 증언의 무게를 담은 소설.' },
  { title: '희랍어 시간', author: '한강', publisher: '문학동네', blurb: '말을 잃은 여성과 점점 시력을 잃어 가는 남성이 희랍어 수업에서 만나 나누는 침묵과 연결.' },
  { title: '파친코 1', author: '이민진', publisher: '문학사상', blurb: '재일조선인 가족의 역사를 4대에 걸쳐 그린 대하소설. 차별과 생존, 사랑의 서사가 펼쳐진다.' },
  { title: '파친코 2', author: '이민진', publisher: '문학사상', blurb: '파친코 1에 이은 후반부. 전후 일본에서 다음 세대가 정체성과 운명을 마주한다.' },
  { title: '불편한 편의점', author: '김호연', publisher: '나무옆의자', blurb: '서울역 앞 편의점에 모인 사람들의 사연이 따뜻한 유머와 함께 이어지는 힐링 소설.' },
  { title: '불편한 편의점 2', author: '김호연', publisher: '나무옆의자', blurb: '독고와 이웃들의 일상이 이어지는 후속작. 서로의 빈자리를 메워 주는 관계가 돋보인다.' },
  { title: '달러구트 꿈 백화점', author: '이미예', publisher: '팩토리나인', blurb: '잠든 손님에게 꿈을 파는 백화점 이야기. 판타지 속에서 위로와 희망을 건넨다.' },
  { title: '아몬드', author: '손원평', publisher: '창비', blurb: '감정을 느끼는 데 어려움이 있는 소년 윤재가 세상과 사람을 배워 가는 성장 소설.' },
  { title: '구의 증명', author: '최진영', publisher: '문학과지성사', blurb: '죽은 연인을 되살리려는 처절한 집착을 담은 짧은 소설. 사랑과 상실의 극한을 응시한다.' },
  { title: '밝은 밤', author: '최은영', publisher: '문학동네', blurb: '외할머니와 엄마, 그리고 ‘나’로 이어지는 여성 3대의 삶을 섬세하게 그려 낸 장편.' },
  { title: '시선으로부터,', author: '정세랑', publisher: '문학동네', blurb: '사라진 조각가 심시선의 흔적을 쫓는 이야기. 예술, 우정, 사회를 유쾌하고 단단하게 짚는다.' },
  { title: '보건교사 안은영', author: '정세랑', publisher: '민음사', blurb: '기운을 보는 보건교사 안은영이 학교의 기이한 존재들과 맞서며 아이들을 지키는 판타지.' },
  { title: '미드나잇 라이브러리', author: '매트 헤이그', publisher: '인플루엔셜', blurb: '인생 사이의 도서관에서 다른 삶을 시험해 보는 이야기. ‘만약’의 선택들을 돌아보게 한다.' },
  { title: '도둑맞은 집중력', author: '요한 하리', publisher: '어크로스', blurb: '집중력이 흩어지는 이유를 사회·기술·습관에서 찾아보고, 주의를 되찾는 방법을 제안하는 논픽션.' },
  { title: '마흔에 읽는 쇼펜하우어', author: '강용수', publisher: '유노북스', blurb: '쇼펜하우어의 삶을 쉽게 풀어, 중년의 번뇌와 욕망을 다스리는 관점을 전하는 교양서.' },
  { title: '역행자', author: '자청', publisher: '웅진지식하우스', blurb: '본능을 거스르는 습관으로 삶을 바꾸는 방법을 자기계발 관점에서 정리한 책.' },
  { title: '세이노의 가르침', author: '세이노', publisher: '데이원', blurb: '오랜 기간 온라인에 공개됐던 세이노의 현실적 조언을 모은 처세·자기계발서.' },
  { title: '퓨처 셀프', author: '벤저민 하디', publisher: '상상스퀘어', blurb: '미래의 나와 연결될수록 오늘의 선택이 달라진다는 심리학적 자기계발 메시지.' },
  { title: '어떻게 말해줘야 할까', author: '오은영', publisher: '김영사', blurb: '아이 마음을 다치지 않게 하면서도 단단한 경계를 세우는 대화법을 담은 육아서.' },
  { title: '어린이라는 세계', author: '김소영', publisher: '사계절', blurb: '어린이의 시선으로 일상과 권리를 다시 바라보게 하는 에세이. 작고 구체적인 장면이 많다.' },
  { title: '내가 틀릴 수도 있습니다', author: '비욘 나티코 린데블라드', publisher: '다산초당', blurb: '숲속 수행자의 시선으로 겸손과 현재를 이야기하는 잠언 에세이.' },
  { title: '물고기는 존재하지 않는다', author: '룰루 밀러', publisher: '곰출판', blurb: '분류학자 데이비드 스타 조던의 생애를 따라가며 ‘질서’와 ‘진실’을 되묻는 논픽션.' },
  { title: '코스모스', author: '칼 세이건', publisher: '사이언스북스', blurb: '우주의 탄생부터 생명과 문명까지, 과학을 시적으로 풀어낸 고전적 교양서.' },
  { title: '데미안', author: '헤르만 헤세', publisher: '민음사', blurb: '소년 싱클레어가 데미안을 만나 자아와 세계를 깨달아 가는 성장 소설의 고전.' },
  { title: '나미야 잡화점의 기적', author: '히가시노 게이고', publisher: '현대문학', blurb: '폐점한 잡화점의 상담 편지가 시대를 넘어 이어지며 사람과 사람을 잇는 미스터리.' },
  { title: '연금술사', author: '파울로 코엘료', publisher: '문학동네', blurb: '자신의 ‘개인적인 전설’을 찾아 떠나는 소년의 여행. 꿈과 징표에 관한 우화.' },
  { title: '여행의 이유', author: '김영하', publisher: '문학동네', blurb: '왜 떠나는지, 무엇을 보고 돌아오는지. 김영하가 여행의 감각을 산문으로 정리한 에세이.' },
];

/** 제목으로 소개문을 찾는다(피어가 같은 책을 읽을 때 로컬 소개 보강용). */
export function blurbForTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return null;
  const hit = BESTSELLERS.find((b) => b.title === t || b.title.includes(t) || t.includes(b.title));
  return hit?.blurb ?? null;
}
