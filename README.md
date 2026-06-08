# 코럼 v3

Google Spreadsheet의 데이터를 읽어서 자동으로 리스트와 상세 페이지를 만드는 GitHub Pages용 정적 사이트다.

## 반영된 기능

- Google Sheet CSV 연동
- 흰색/검정색 중심 모던 UI
- 순위순 리스트 출력
- 검색 기능
- 상세 페이지 자동 생성
- `Rating` 값별 색상 배지
- `맵 길이` 값별 색상 배지
- `TOP 1~TOP 5`, `Main`, `Extended`, `Legacy` 자동 표시
- TOP 1~TOP 5 썸네일 배경 카드
- Extended 배경색 `#efefef`
- Legacy 배경색 `#d9d9d9`
- 상세 페이지 URL을 순위가 아니라 `맵 코드` 기준으로 생성
- GitHub Pages용 Hash Router
- GitHub Actions 자동 배포 설정

## 실행

PowerShell에서 `npm`이 막히면 `npm.cmd`를 사용한다.

```bash
npm.cmd install
npm.cmd run dev
```

브라우저에서 아래 주소로 확인한다.

```txt
http://localhost:5173/
```

## Google Sheet 컬럼 형식

첫 행은 아래처럼 둔다.

```txt
순위,순번,맵 제목,Rating,맵 길이,맵 코드,제작자,Verifier
```

`썸네일` 컬럼은 없어도 된다. TOP 1~TOP 5 썸네일은 `public/images/` 안의 이미지 파일을 사용한다.

## Google Sheet 연결

1. Google Spreadsheet에서 `파일` → `공유` → `웹에 게시`로 들어간다.
2. 형식을 CSV로 선택해서 게시한다.
3. 생성된 CSV 링크를 `src/config.js`의 `MANUAL_CSV_URL`에 넣는다.

```js
const MANUAL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv";
const MANUAL_SITE_TITLE = "코럼 v3";
const MANUAL_SITE_VERSION = "";
```

현재 프로젝트에는 사용자가 준 CSV 링크가 이미 들어가 있다.

## 썸네일 이미지 관리

이미지는 아래 폴더에 넣는다.

```txt
public/images/
```

가장 추천하는 파일명은 맵 코드다.

```txt
public/images/97883413.png
public/images/95689442.jpg
public/images/95864899.png
public/images/101806633.png
public/images/93570869.jpg
```

지원 확장자:

```txt
png, jpg, jpeg, webp
```

파일명은 대소문자까지 정확히 맞춰야 한다.

## 구간 표시 규칙

```txt
1위  → TOP 1
2위  → TOP 2
3위  → TOP 3
4위  → TOP 4
5위  → TOP 5
6~10위 → Main
11~25위 → Extended
26위 이후 → Legacy
```

## Rating 20 처리

시트에 `20`이 들어오면 사이트에서는 `20.0`으로 처리한다.

## URL 구조

Hash Router를 사용한다.

```txt
#/                 홈
#/list             전체 리스트
#/maps/97883413    맵 상세 페이지
#/about            정보
```

상세 페이지는 순위가 아니라 `맵 코드`를 기준으로 만든다.

## GitHub Pages 배포

1. 이 프로젝트를 GitHub 저장소에 push한다.
2. 저장소의 `Settings` → `Pages`로 들어간다.
3. Source를 `GitHub Actions`로 설정한다.
4. `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드하고 배포한다.

## 빌드 확인

```bash
npm.cmd run build
npm.cmd run preview
```
