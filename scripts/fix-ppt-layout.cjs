const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'portfolio-ppt-data.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

data.slides.forEach((slide) => {
  if (slide.cards && Array.isArray(slide.cards)) {
    slide.cards.forEach((card) => {
      // 1. Bottom full width message card (w > 10 usually)
      if (card.w > 10 && slide.title !== '월 운영 전체 흐름') {
        card.x = 0.7;
        card.w = 11.65;
        if (card.y > 4.8 && card.y < 5.3) {
          card.y = 5.1;
        }
      }

      // 2. Align 3-column cards
      if (card.w > 3.4 && card.w < 3.7 && card.w !== 11.65) {
        if (card.x < 2) card.x = 0.7;
        else if (card.x < 6) card.x = 4.75;
        else card.x = 8.8;
        card.w = 3.55;
      }
      // 3. Align 4-column cards
      else if (card.w > 2.5 && card.w < 2.8 && card.w !== 11.65) {
        if (card.x < 2) card.x = 0.7;
        else if (card.x < 5) card.x = 3.73;
        else if (card.x < 8) card.x = 6.76;
        else card.x = 9.79;
        card.w = 2.53;
      }
      // 4. Align 5-column cards (Slide 7, Slide 14)
      else if (card.w > 2.1 && card.w <= 2.2) {
        if (card.x < 2) card.x = 0.75;
        else if (card.x < 4) card.x = 3.1;
        else if (card.x < 6) card.x = 5.45;
        else if (card.x < 8) card.x = 7.8;
        else card.x = 10.15;
        card.w = 2.15;
      }
    });

    // Special fix for Slide 6 (Business Flow) Message card
    if (
      slide.title === '월 운영 전체 흐름' &&
      slide.cards[slide.cards.length - 1].title === '핵심 메시지'
    ) {
      slide.cards[slide.cards.length - 1].x = 0.55;
      slide.cards[slide.cards.length - 1].w = 12.44;
    }

    // Special fix for Slide 7 (DOMAIN)
    if (slide.title === '핵심 도메인 설계: 수집 거래와 전표 분리') {
      if (slide.cards.length === 7) {
        slide.cards[5].x = 0.75;
        slide.cards[5].w = 5.5;
        slide.cards[6].x = 6.55;
        slide.cards[6].w = 5.75;
      }
    }

    // Special fix for Slide 10 (CLAIM FIRST)
    if (slide.title === '선점 기반 트랜잭션 설계') {
      if (slide.cards.length === 7) {
        slide.cards[4].x = 0.7;
        slide.cards[4].w = 5.58;
        slide.cards[5].x = 6.76;
        slide.cards[5].w = 5.59;
      }
    }

    // Special fix for Slide 14 (DESIGN RULE)
    if (slide.title === '복잡도 배치 원칙: 실패 비용이 구조를 결정') {
      // Row 1 has 3 items, but they are wide.
      // original x: 0.7, 4.05, 7.4. w: 3.1.
      // Let's snap them.
      slide.cards[0].x = 0.7;
      slide.cards[0].w = 3.1;
      slide.cards[1].x = 4.05;
      slide.cards[1].w = 3.1;
      slide.cards[2].x = 7.4;
      slide.cards[2].w = 3.1;

      // Row 2 has 4 items
      slide.cards[3].x = 0.7;
      slide.cards[3].w = 2.53;
      slide.cards[4].x = 3.73;
      slide.cards[4].w = 2.53;
      slide.cards[5].x = 6.76;
      slide.cards[5].w = 2.53;
      slide.cards[6].x = 9.79;
      slide.cards[6].w = 2.53;
    }
  }
});

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Successfully aligned grid rules and sizes for PPT layout.');
