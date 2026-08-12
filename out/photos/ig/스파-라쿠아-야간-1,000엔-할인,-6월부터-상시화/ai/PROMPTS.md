# 인플루언서 인생샷 3컷 — 프롬프트 꾸러미

API 결제 한도가 풀리면 아래 한 줄로 자동 생성된다.

```
node scripts/ai-influencer.mjs --title "스파 라쿠아 야간 1,000엔 할인, 6월부터 상시화"
```

지금 바로 만들려면 **ChatGPT 앱**에 아래 프롬프트를 붙이고 지정한 사진을 첨부한다.
(앱 이미지 생성은 구독에 포함이라 API 결제와 별개다)

## 세 컷을 이렇게 나눈 이유

| | 배경 | 구도 | 각도 |
|---|---|---|---|
| 1 | 파스텔 카바나 + 선더돌핀 야경 (`-08`) | 와이드 · 인물 좌측 1/3 · 뒷모습 3/4 | **로우앵글**(허리 높이에서 올려봄) |
| 2 | Beach in the SKY 간판 · 해질녘 (`-05`) | 미디엄 · 인물 우측 · 옆모습 | **아이레벨** |
| 3 | 야간 실내 풀 · 통유리 (`-13`) | 와이드 · 인물 우측 1/3 작게 · 완전 뒷모습 | **하이앵글**(어깨 위에서 내려봄) |

세 컷의 **각도를 전부 다르게** 잡았다. 같은 각도로 세 장을 찍으면 한 장을 세 번 쓴
것처럼 보인다. 인물 크기도 크게-중간-작게로 바꿔 흐름을 만든다.

**얼굴은 세 컷 모두 카메라를 정면으로 보지 않는다.** 두 가지를 동시에 해결한다 —
AI 티가 가장 많이 나는 곳이 얼굴이고, 실제 인생샷도 뒷모습·옆모습이 대부분이다.

**인물 일치**: 1번을 먼저 만들고, **그 결과 이미지를 2·3번에 함께 첨부**한다.
말로만 "같은 사람" 이라고 하면 매번 다른 얼굴이 나온다.
옷은 라쿠아 **관내복(회색 상하의)** 으로 고정했다 — 실제로 그 구역에서 입는 옷이라
일치를 잡아 주면서 장소 설명도 된다.

---

## 공통 지시 (세 컷 모두 앞에 붙인다)

```
Photorealistic candid travel photo taken on a smartphone. Natural imperfect framing,
real skin texture with visible pores and slight shine, natural hair strands, no beauty
retouching, no plastic skin, no over-sharpening, no HDR glow, no watermark, no text overlay.
Realistic mixed lighting with correct color temperature and soft natural shadows.
The woman is a Korean traveler in her mid-20s, slim, long dark brown hair loosely tied,
wearing the facility's grey loungewear set (short-sleeve top and relaxed pants) and slippers.
Her face is never fully facing the camera — keep the shot natural and unposed.
Keep the background architecture, furniture, lighting fixtures and view exactly as in the
reference photo; do not invent new buildings or change the layout.
```

## 1번 — 카바나 야경 (첨부: `…-08.jpg`)

```
Composition: wide shot, camera held low near waist height looking slightly up.
The woman stands at the left third of the frame, seen from behind at a three-quarter angle,
one hand lifting the pastel gauze curtain of the cabana as she steps in.
Her head is turned away toward the illuminated roller coaster track in the background,
so only the line of her cheek and ear is visible. The cabana occupies the right two thirds.
Night, warm lamp light on the fabric, cool blue city lights behind.
```

## 2번 — 간판 해질녘 (첨부: `…-05.jpg` **+ 1번 결과물**)

```
Composition: medium shot at eye level, shot from the side.
The woman stands beside the wooden "Beach in the SKY / OTONA Beach" sign on the right,
seen in profile, looking up at the dusk sky away from the camera.
Her arms rest naturally at her sides; she is not posing for the lens.
Keep the sign fully readable and unobstructed. Shallow depth of field on the foreground cactus.
Dusk, soft pink and blue sky, warm rim light on her hair and shoulder.

The first reference image is the location. The second reference image shows the SAME WOMAN
who must appear here — keep her exact face, hairstyle, body type and the identical grey
loungewear set. Same person, different moment.
```

## 3번 — 실내 풀 야경 (첨부: `…-13.jpg` **+ 1번 결과물**)

```
Composition: wide shot from a high angle behind her, camera above shoulder height.
The woman sits curled in one of the rattan ball chairs facing the floor-to-ceiling
window, seen entirely from behind, small in the frame at the right third.
The lit pool fills the lower half of the frame and the night city view fills the window.
She holds a phone loosely in one hand, not raised. Warm candle light in the foreground,
cool teal pool light below.

The first reference image is the location. The second reference image shows the SAME WOMAN
who must appear here — keep her exact face, hairstyle, body type and the identical grey
loungewear set. Same person, different moment.
```

---

⚠️ **생성 이미지는 그 장소에 다녀온 증거가 아니다.** 연출컷·표지컷으로만 쓰고,
사실을 증명하는 자리(간판·요금표·시설 구조)에는 실사만 쓴다.
