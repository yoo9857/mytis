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
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    boxes = list(front.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.04), int(w * 0.04))))
    # 옆얼굴도 잡는다 (대화 장면은 정면이 드물다)
    boxes += list(side.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.04), int(w * 0.04))))

    sharp = cv2.Laplacian(gray, cv2.CV_64F).var()

    if not len(boxes):
        # 얼굴이 없으면 선명도만으로 (아주 낮은 점수대)
        return {'path': path, 'faces': 0, 'score': round(sharp / 1000, 3), 'biggest': 0}

    best_area = 0
    center_bonus = 0
    for (x, y, fw, fh) in boxes:
        area = (fw * fh) / float(w * h)
        if area > best_area:
            best_area = area
            cx, cy = (x + fw / 2) / w, (y + fh / 2) / h
            # 화면 중앙에 가까울수록 가점
            center_bonus = 1.0 - min(1.0, (abs(cx - 0.5) + abs(cy - 0.45)))

    score = best_area * 1000 + len(boxes) * 8 + center_bonus * 10 + min(sharp / 400, 10)
    return {'path': path, 'faces': len(boxes), 'score': round(score, 2),
            'biggest': round(best_area * 100, 2)}


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

    gray = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))

    boxes = list(front.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.05), int(w * 0.05))))
    boxes += list(side.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                        minSize=(int(w * 0.05), int(w * 0.05))))

    if not boxes:
        # 얼굴이 없는 장면 사진 — 대표로 못 쓸 정도는 아니지만 우선순위는 낮다
        return {'path': path, 'faces': 0, 'score': 1.0, 'biggest': 0.0}

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
        return {'path': path, 'faces': len(boxes), 'score': 2.0,
                'biggest': round(best_area * 100, 2)}

    # 얼굴 하나 = 가점, 둘 이상 = 감점(합성본일 가능성이 높다)
    solo = 25.0 if len(boxes) == 1 else -18.0 * (len(boxes) - 1)
    score = best_area * 900 + solo + center * 12
    return {'path': path, 'faces': len(boxes), 'score': round(score, 2),
            'biggest': round(best_area * 100, 2)}


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
    print(json.dumps({
        'best': results[0]['path'],
        'faces': results[0]['faces'],
        'biggest': results[0]['biggest'],
        'score': results[0]['score'],
        'all': results,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()

