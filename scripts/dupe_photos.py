"""
같은 사진이 두 번 실리는 것을 막는다 — **내용으로** 비교한다.

왜 필요한가:
    파일명으로는 못 잡는다. 언론사마다 파일명 규칙이 다르고, 같은 사진을 여러
    매체가 서로 다른 크기·크롭으로 배포한다.

    > 2026-07-28 실측 — 소지섭 기사: 김부장 포스터가 640x360 과 1000x700 두
    > 형태로 들어와 본문에 같은 포스터가 두 번 실렸다. 비율도 달라서(1.78 / 1.43)
    > 파일명도 크기도 비율도 같지 않았다.

방법: dHash (difference hash).
    9x8 로 줄여 흑백으로 만든 뒤 가로로 인접한 픽셀의 밝기를 비교해 64비트를 만든다.
    크기·압축·크롭이 달라도 같은 사진이면 비트가 거의 같다.

임계값 16 은 실측으로 정했다.
    > 2026-07-28 소지섭 기사의 사진 6장 거리 행렬:
    >   같은 포스터(다른 크롭)  bg3-bg4 = 12
    >   서로 다른 사진들의 최소            = 22
    > 두 무리가 12와 22 로 뚜렷하게 갈린다. 그 사이인 16 을 쓴다.
    처음에 10 으로 뒀더니 같은 포스터를 놓쳤다. 너무 올리면 다른 사진을 버린다.

사용: 파일 경로를 stdin 으로 한 줄에 하나씩 넘긴다 (argv 는 한글 경로가 깨진다).
출력: {"dupes": [["버릴경로", "남길경로", 거리], ...]}
"""
import sys
import json

import numpy as np
import cv2

THRESHOLD = 16


def imread_any(path):
    """한글 경로도 읽는다 (cv2.imread 는 Windows 에서 못 읽는다)."""
    try:
        with open(path, 'rb') as f:
            buf = np.frombuffer(f.read(), dtype=np.uint8)
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    except Exception:
        return None


def dhash(path):
    img = imread_any(path)
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = small[:, 1:] > small[:, :-1]
    return int(''.join('1' if b else '0' for b in bits.flatten()), 2)


def distance(a, b):
    return bin(a ^ b).count('1')


def pixels(path):
    """해상도(픽셀 수). 같은 사진이 여러 크기로 왔을 때 큰 쪽을 남기려고 쓴다."""
    img = imread_any(path)
    return 0 if img is None else img.shape[0] * img.shape[1]


def main():
    paths = [ln.strip() for ln in sys.stdin.buffer.read().decode('utf-8', 'replace').splitlines() if ln.strip()]
    items = []
    for p in paths:
        h = dhash(p)
        if h is not None:
            items.append({'path': p, 'hash': h, 'px': pixels(p)})

    # 큰 사진을 먼저 본다 → 같은 사진이면 작거나 잘린 쪽이 버려진다.
    # (실측: 같은 포스터가 640x360 잘린 것과 1000x700 온전한 것으로 들어왔는데
    #  들어온 순서대로 남기면 잘린 쪽이 살아남아 본문에 실렸다)
    items.sort(key=lambda x: -x['px'])

    dupes = []
    kept = []
    for it in items:
        hit = next((k for k in kept if distance(it['hash'], k['hash']) <= THRESHOLD), None)
        if hit:
            dupes.append([it['path'], hit['path'], distance(it['hash'], hit['hash'])])
        else:
            kept.append(it)

    print(json.dumps({'dupes': dupes}, ensure_ascii=False))


if __name__ == '__main__':
    main()
