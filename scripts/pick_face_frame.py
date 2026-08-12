"""
후보 프레임들 중 **얼굴이 가장 잘 나온 한 장**을 고른다.

왜 필요한가:
    타임스탬프의 프레임을 그냥 뽑으면 카메라가 멀리 있을 때 방 전경만 나온다.
    독자가 보고 싶은 것은 그 순간의 **표정**이다.

점수 = 가장 큰 얼굴의 면적 + 얼굴 개수 보너스 + 화면 중앙 가중치
얼굴이 하나도 없으면 가장 선명한(라플라시안 분산이 큰) 프레임을 고른다.

사용: python pick_face_frame.py <프레임...> --json
출력: {"best": "경로", "faces": n, "score": x, "all": [...]}
"""

# ─────────────────────────────────────────────────────────────────────────────
# 겹친 전환 프레임(크로스디졸브)은 **자동으로 걸러내지 못했다.** (2026-08-02 실측)
#
# 전참시 글에서 화면 전환 중간 프레임이 뽑혀 얼굴이 두 겹으로 겹쳐 나왔다.
# 가설을 세 번 세우고 18장을 재봤는데 **어느 지표도 갈리지 않았다**:
#
#   지표          겹친 프레임   정상 중간값   정상 최소
#   선명도            476          497         205
#   대비             55.5         59.4        47.9
#   엣지밀도        0.0202       0.0235      0.0112
#   얼굴 수 / IoU   1개 / 0.00      —           —
#   얼굴 선명도       38.4         72.7         5.8
#
# ① "얼굴이 둘로 검출된다" 는 가정부터 틀렸다 — 1개, IoU 0.00.
# ② 겹친 화면에 블라인드 무늬가 섞여 **선명도와 엣지를 오히려 올렸다.**
# ③ 얼굴 영역만 재도 38.4 가 정상 최소 5.8 보다 훨씬 높다.
#
# 임계값을 억지로 잡으면 정상 프레임(얼굴 선명도 6·9·15)을 버린다 — 그게 더 나쁘다.
# **사람이 본다.** §7-3 의 몽타주 자동 감지 실패와 같은 계열이다.
# 다시 시도하려면 한 시점의 한 장이 아니라 **후보 프레임들 사이의 변화량**을
# 봐야 할 것으로 보인다 (디졸브는 앞뒤와 급격히 다르다).
# ─────────────────────────────────────────────────────────────────────────────

import sys
import json
import os
import numpy as np
import cv2

def cascade_path(name):
    """haarcascade XML 경로를 ASCII 안전한 위치로 돌려준다.

    cv2.CascadeClassifier 는 내부적으로 C++ 파일 입출력을 쓰기 때문에
    **경로에 한글이 있으면 조용히 빈 분류기를 만든다.** 그러면 detectMultiScale
    에서 `(-215:Assertion failed) !empty()` 로 터진다.
    (imread_any 가 이미지에 대해 푸는 것과 똑같은 문제다)

    사용자 계정 이름이 한글이면 site-packages 경로가 통째로 한글이 된다.
    예: C:\\Users\\AI배움터\\AppData\\...\\cv2\\data\\

    > 2026-07-28 실측: 이 문제로 얼굴 선별이 매번 실패하고 첫 후보로 폴백했다.
    > 로그에는 한 줄만 찍혀서 눈치채기 어려웠다.

    그래서 경로에 ASCII 아닌 문자가 있으면 프로젝트 안(.tmp)으로 복사해 쓴다.
    프로젝트 경로는 ASCII 라고 가정한다 (아니면 애초에 실행이 안 된다).
    """
    src = os.path.join(cv2.data.haarcascades, name)
    try:
        src.encode('ascii')
        return src
    except UnicodeEncodeError:
        pass

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dst_dir = os.path.join(root, '.tmp', 'cascades')
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, name)
    if not os.path.exists(dst) or os.path.getsize(dst) == 0:
        with open(src, 'rb') as f_in, open(dst, 'wb') as f_out:
            f_out.write(f_in.read())
    return dst


CASCADE = cascade_path('haarcascade_frontalface_default.xml')
PROFILE = cascade_path('haarcascade_profileface.xml')


def imread_any(path):
    """한글 경로도 읽는다.

    cv2.imread 는 Windows 에서 ANSI 코드페이지로 경로를 해석해
    **한글이 들어간 파일명을 열지 못한다.** 이 프로젝트의 파일명은 글 제목에서
    만들어지므로 거의 항상 한글이다. 바이트로 읽어 메모리에서 디코딩한다.
    """
    try:
        with open(path, 'rb') as f:
            buf = np.frombuffer(f.read(), dtype=np.uint8)
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    except Exception:
        return None


def score_frame(path, front, side):
    img = imread_any(path)
    if img is None:
        return None
    h, w = img.shape[:2]
    raw = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)  # 밝기 판정은 **보정 전** 값으로
    gray = cv2.equalizeHist(raw)                 # 얼굴 검출용 (대비를 늘린다)

    boxes = list(front.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.04), int(w * 0.04))))
    # 옆얼굴도 잡는다 (대화 장면은 정면이 드물다)
    boxes += list(side.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.04), int(w * 0.04))))

    sharp = cv2.Laplacian(gray, cv2.CV_64F).var()

    # 예고편의 **타이틀 카드**를 걸러낸다 — 장면이 아니라 자막 화면이다.
    # 화면이 거의 검은데(평균 밝기 낮음) 밝은 화소가 몇 %뿐이면 글자만 있는 컷이다.
    # > 2026-08-01 실측: "THIS YEAR" 카드(1920×1080, 30KB)가 본문 사진으로 뽑혔다.
    #   보정 전 평균 밝기 1.6, 밝은 화소 0.01% 였다. 검은 화면 페이드도 같이 걸린다.
    # ⚠️ **equalizeHist 를 거친 gray 로 재면 안 된다** — 히스토그램이 늘어나
    #   거의 검은 화면도 평균이 올라가 판정이 통과한다 (처음에 그렇게 짜서 안 먹혔다).
    #   같은 예고편의 실제 어두운 장면은 보정 전 평균 34.5 라 넉넉히 갈린다.
    mean_v = float(raw.mean())
    bright_ratio = float((raw > 90).mean())
    if mean_v < 28 and bright_ratio < 0.06:
        return {'path': path, 'faces': 0, 'score': -500.0, 'biggest': 0,
                'note': 'title-card', 'mean': round(mean_v, 1),
                'bright': round(bright_ratio * 100, 2)}

    # 화면 아래에 **박힌 자막**이 있으면 감점한다.
    #
    # 각국 배급사 채널은 그 나라 자막을 영상에 태워 올린다. 한국 블로그에
    # 일본어·영어 자막이 박힌 컷이 실리면 안 된다.
    # > 2026-08-01 실측: "소니 픽처스 영화" 채널(이름은 한국식)의 예고편 캡처에
    #   일본어 자막이 박혀 있었다. 채널명만으로는 못 걸러진다.
    #
    # 판정: 아래 22% 영역에서 **밝고 가로로 이어지는 획**이 많으면 자막이다.
    # 글자는 배경보다 훨씬 밝고 수평으로 늘어선다.
    # 임계값 근거 (2026-08-01 실측, 같은 예고편):
    #   일본어 자막이 박힌 컷        ink 11.39%  ← 잡아야 한다
    #   밝은 아스팔트·흰 옷이 깔린 컷 ink  3.06%  ← 자막 없음, 잡으면 오탐
    #   그 밖의 장면                ink  0~0.9%
    # 그래서 6% 로 가른다. 자막은 흰 글자에 검은 테두리가 있어 가운데에 몰리므로
    # **가로 중앙 60% 구간**만 본다 — 화면 좌우의 밝은 배경에 덜 흔들린다.
    band = raw[int(h * 0.78):, int(w * 0.2):int(w * 0.8)]
    if band.size:
        _, bw = cv2.threshold(band, 200, 255, cv2.THRESH_BINARY)
        ink = float(bw.mean()) / 255.0
        # 가로 방향으로 이어지는 덩어리인지 — 글자는 행마다 여러 조각이 나온다
        rows_with_ink = float((bw.mean(axis=1) > 6).mean())
        subtitle = ink > 0.06 and rows_with_ink > 0.15
    else:
        subtitle = False
        ink = 0.0

    if not len(boxes):
        # 얼굴이 없으면 선명도만으로 (아주 낮은 점수대)
        s = round(sharp / 1000, 3)
        if subtitle:
            s -= 30
        return {'path': path, 'faces': 0, 'score': s, 'biggest': 0,
                'subtitle': subtitle, 'ink': round(ink * 100, 2)}

    best_area = 0
    center_bonus = 0
    for (x, y, fw, fh) in boxes:
        area = (fw * fh) / float(w * h)
        if area > best_area:
            best_area = area
            cx, cy = (x + fw / 2) / w, (y + fh / 2) / h
            # 화면 중앙에 가까울수록 가점
            center_bonus = 1.0 - min(1.0, (abs(cx - 0.5) + abs(cy - 0.45)))

    # 선명도 비중 — 예전에는 상한이 10점이라 얼굴 면적(최대 1000점)에 묻혔다.
    # 그래서 **흐린 얼굴이 선명한 얼굴을 이겼다**. 예고편은 움직임이 많아
    # 같은 장면의 후보들 사이에서 흔들린 프레임이 뽑히곤 했다.
    # (사용자 지적 2026-08-01: "캡처 화면이 너무 지글거림, 선명하게")
    # 곱셈 계수로 바꿔 흐린 후보를 확실히 밀어낸다: 라플라시안 분산 100 이하는
    # 눈에 보이게 흐리다 → ×0.55, 400 이상은 충분히 선명하다 → ×1.0
    sharp_factor = 0.55 + 0.45 * min(1.0, sharp / 400.0)
    score = (best_area * 1000 + len(boxes) * 8 + center_bonus * 10) * sharp_factor
    if subtitle:
        score -= 60  # 박힌 자막 — 같은 장면의 다른 후보를 쓰는 게 낫다
    return {'path': path, 'faces': len(boxes), 'score': round(score, 2),
            'biggest': round(best_area * 100, 2), 'sharp': round(sharp, 1),
            'subtitle': subtitle, 'ink': round(ink * 100, 2)}


def score_thumbnail(path, front, side):
    """대표 이미지용 점수.

    프레임 고르기와 기준이 다르다. 대표 이미지에는 **제목 글자가 얹히므로**
    얼굴이 하나만 크게 잡힌 단독 컷이 좋다.

    언론사 og:image 는 한 사람을 두세 컷으로 붙인 **합성본**인 경우가 많은데,
    그러면 이음새 위에 제목이 걸쳐 얼굴 사이에 글씨가 끼는 모양이 된다.
    얼굴이 여러 개면 감점해서 합성본을 밀어낸다.
    """
    img = imread_any(path)
    if img is None:
        return None
    h, w = img.shape[:2]

    # 기사에는 로고·아이콘·작은 그래픽이 섞여 들어온다. 대표로 쓸 수 없다.
    # (실측: 22KB / 작은 PNG 가 얼굴 오탐으로 대표에 뽑혔다)
    if w < 500 or h < 350:
        return {'path': path, 'faces': 0, 'score': -999.0, 'biggest': 0.0}

    # 해상도 계수 — 얼굴 크기만 보면 537×537 같은 작은 사진이 대표로 뽑혀
    # 목록 카드에서 흐려 보인다 (2026-07-29 실측). 대표 렌더 목표는 1200px 이고
    # clampToSource 가 원본보다 크게 그리지 않으므로, 짧은 변이 작을수록
    # 실제 출력도 작아진다. 900px 미만부터 완만하게 깎는다 (537px → ×0.77).
    res_factor = min(1.0, min(w, h) / 900.0) ** 0.5

    gray = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))

    boxes = list(front.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.05), int(w * 0.05))))
    boxes += list(side.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.05), int(w * 0.05))))

    if not boxes:
        # 얼굴이 없는 장면 사진 — 대표로 못 쓸 정도는 아니지만 우선순위는 낮다
        # (해상도 계수는 여기도 적용한다 — 같은 무얼굴끼리는 큰 쪽이 낫다)
        return {'path': path, 'faces': 0, 'score': round(1.0 * res_factor, 3), 'biggest': 0.0}

    best_area, center = 0.0, 0.0
    for (x, y, fw, fh) in boxes:
        area = (fw * fh) / float(w * h)
        if area > best_area:
            best_area = area
            cx = (x + fw / 2) / w
            center = 1.0 - min(1.0, abs(cx - 0.5) * 2)

    # 너무 작은 얼굴은 오탐이거나 배경 인물이다. 대표 이미지의 주인공이 될 수 없다.
    # (실측: 1.6% 짜리 오탐이 '단독 얼굴' 가점을 받아 대표로 뽑혔다)
    if best_area < 0.012:
        return {'path': path, 'faces': len(boxes), 'score': round(2.0 * res_factor, 3),
                'biggest': round(best_area * 100, 2)}

    # 얼굴 하나 = 가점, 둘 이상 = 감점(합성본일 가능성이 높다)
    solo = 25.0 if len(boxes) == 1 else -18.0 * (len(boxes) - 1)
    score = best_area * 900 + solo + center * 12
    # 해상도 계수는 **양수 점수에만** 곱한다 — 합성본 감점이 약해지면 안 된다.
    if score > 0:
        score *= res_factor
    return {'path': path, 'faces': len(boxes), 'score': round(score, 2),
            'biggest': round(best_area * 100, 2)}


def crop_letterbox(path):
    """위아래 검은 레터박스를 잘라낸다 (제자리 덮어쓰기).

    영화 예고편은 2.39:1 로 촬영돼 16:9 플레이어에 담기므로 위아래에 검은 띠가
    남는다. 1920×1080 캡처에서 그 띠가 **위아래 각 100px 남짓**을 차지한다.

    > 2026-08-01 실측 — 스파이더맨 예고편 캡처: 1080 중 약 200px 이 검은 띠였다.
    >   그 상태로 카드에 담기면 화면이 작아 보이고 '잘못 찍은 스크린샷' 처럼 읽힌다.

    판정은 **행 단위 밝기**로 한다 — 한 행의 평균이 아주 낮고 편차도 작으면
    (=고르게 검다) 레터박스다. 어두운 장면과 구분하려고 편차도 함께 본다.
    잘라낸 결과가 원본의 60% 보다 작아지면 판정을 의심해 그대로 둔다.
    """
    img = imread_any(path)
    if img is None:
        return None
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    row_mean = gray.mean(axis=1)
    row_std = gray.std(axis=1)
    black = (row_mean < 18) & (row_std < 12)

    top = 0
    while top < h and black[top]:
        top += 1
    bot = h - 1
    while bot > top and black[bot]:
        bot -= 1

    new_h = bot - top + 1
    if new_h >= h or new_h < h * 0.6:
        return {'cropped': False, 'h': h}

    out = img[top:bot + 1, 0:w]
    ok, buf = cv2.imencode('.jpg', out, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        return {'cropped': False, 'h': h}
    with open(path, 'wb') as f:
        f.write(buf.tobytes())
    return {'cropped': True, 'h': h, 'newH': new_h, 'top': top, 'bottom': h - 1 - bot}


def read_paths():
    """경로 목록을 받는다.

    argv 로 받으면 Windows 에서 **한글 경로가 깨진다**(콘솔 코드페이지 문제).
    이 프로젝트의 파일명은 글 제목에서 만들어져 거의 항상 한글이므로,
    호출부는 stdin 으로 UTF-8 줄바꿈 구분 목록을 넘긴다.
    argv 는 직접 실행해 볼 때를 위한 폴백이다.
    """
    argv_paths = [a for a in sys.argv[1:] if not a.startswith('--')]
    if argv_paths:
        return argv_paths
    data = sys.stdin.buffer.read().decode('utf-8', 'replace')
    return [ln.strip() for ln in data.splitlines() if ln.strip()]


def main():
    paths = read_paths()
    front = cv2.CascadeClassifier(CASCADE)
    side = cv2.CascadeClassifier(PROFILE)

    scorer = score_thumbnail if '--thumb' in sys.argv else score_frame
    results = [r for r in (scorer(p, front, side) for p in paths) if r]
    if not results:
        print(json.dumps({'best': None}))
        return
    results.sort(key=lambda r: r['score'], reverse=True)
    # 고른 한 장만 레터박스를 잘라낸다 (--crop-letterbox). 나머지는 곧 지워진다.
    crop = crop_letterbox(results[0]['path']) if '--crop-letterbox' in sys.argv else None
    print(json.dumps({
        'best': results[0]['path'],
        'faces': results[0]['faces'],
        'biggest': results[0]['biggest'],
        'score': results[0]['score'],
        'sharp': results[0].get('sharp'),
        'crop': crop,
        'all': results,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()

