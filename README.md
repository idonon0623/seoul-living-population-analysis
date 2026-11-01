# 과제 3 · 서울의 낮은 어디에 집중되는가?

2025년 서울 426개 행정동의 **주간 생활인구 밀도와 주간 특화도(LQ)**를 비교하는 도시 공간 분석입니다.

- **결과물:** https://seoul-living-population-analysis.pages.dev
- **GitHub:** https://github.com/idonon0623/seoul-living-population-analysis
- **분석 보고서:** [ASSIGNMENT3.md](ASSIGNMENT3.md)
- **분석 코드와 재현 안내:** [scripts/assignment3](scripts/assignment3/README.md)
- **지표 산출 결과:** [indicators.csv](public/data/indicators.csv)

## 연구 질문

서울의 행정동별 주간 생활인구 밀도는 어떻게 다르며, 하루 중 주간에 상대적으로 인구가 집중되는 지역과 일치하는가?

## 분석 구성

주간(09–17시) 평균 생활인구를 행정동 면적으로 나눈 **밀도**와, 하루 전체 관측량 중 주간 비중을 서울 전체 비중으로 표준화한 **LQ**를 계산합니다. 주야 인구비를 보조 지표로 사용합니다.

웹페이지에는 주제도 2개, 산점도, 상·하위 지역 비교, 시간대별 그래프와 연구 질문·계산식·전처리·해석·한계를 포함했습니다.

명동의 주간 밀도는 약 83,389명/km²로 가장 높고 소공동의 주간 LQ는 약 1.759로 가장 높습니다. 행당2동과 여의동은 밀도와 주간 특화도가 서로 다르게 나타나는 사례입니다.

## 자료와 검증

서울 열린데이터광장 [OA-23016](https://data.seoul.go.kr/dataList/OA-23016/S/1/datasetView.do)에서 수업 과정으로 수집·가공한 2025년 내국인 생활인구를 사용했습니다. 가공 원자료 3,731,760행(365일 × 426동 × 24시간)을 대조했고, 평균값 재계산 결과가 부동소수점 오차 범위에서 일치했습니다. 서울 426개 동의 경계와 인구 코드도 모두 일치합니다.

재현용 입력은 `data/assignment3/`, 출처와 원자료 검증 기록은 같은 폴더의 JSON에 있습니다. 경계는 수업 제공 2025-01-01 기준 파일이며 면적은 단순화 전 경계를 EPSG:5179로 투영해 계산했습니다. 원제공기관 ZIP 최신본을 재다운로드하지 않았고 경계의 외부 제작기관은 확인되지 않았습니다. 자세한 처리와 해석 한계는 보고서를 참고하세요.

## 실행

```sh
npm start
# http://127.0.0.1:4173
npm run build
```

웹페이지는 로컬에 포함된 Plotly와 미리 계산된 자료를 사용하며 실행에 API 키가 필요하지 않습니다.

```sh
python -m pip install -r scripts/assignment3/requirements.txt
python scripts/assignment3/build_analysis.py
```

## 발행

Cloudflare Pages의 `seoul-living-population-analysis` 프로젝트에 `public/`을 직접 업로드합니다. GitHub 푸시만으로 자동 배포되지 않습니다.

```sh
git push origin main
npx wrangler pages deploy public --project-name seoul-living-population-analysis --branch main
```

Plotly.js의 기존 MIT 라이선스 주석을 배포 파일에 보존했습니다.
