# KIS(한국투자증권) 오픈API 레퍼런스

원본: `한국투자증권_오픈API_전체문서_20261007_030009.xlsx` · API 338개. `scripts/kis-api-docs.py` 로 생성 — 직접 고치지 말고 새 xlsx 로 다시 생성.

## 찾는 법

- TR_ID 로: `rg FHPTJ04160001 docs/kis-api`
- 기능으로: 아래 목록에서 API명 검색, 또는 `rg -l "투자자" docs/kis-api`
- ✅ = 이 프로젝트 `server/` 에서 이미 쓰는 TR_ID

## 공통 사항

- 모든 REST 요청 헤더: `content-type`, `authorization: Bearer <접근토큰>`, `appkey`, `appsecret`, `tr_id`, `custtype`(P 개인). 개별 문서에서는 생략.
- 연속조회: 응답 헤더 `tr_cont` 가 `M`/`F` 면 다음 요청에 `tr_cont: N` 을 넣어 이어 받는다.
- 시세 시장코드 `FID_COND_MRKT_DIV_CODE`: `J` KRX · `NX` NXT · `UN` 통합 (API 마다 지원 범위 다름 — 개별 문서 확인).
- 모의투자 미지원 API 는 모의 TR_ID 가 `-` 로 표시된다.

## OAuth인증

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [실시간 (웹소켓) 접속키 발급](OAuth인증/실시간_(웹소켓)_접속키_발급.md) | `-` | `-` | `POST /oauth2/Approval` |
| [접근토큰폐기(P)](OAuth인증/접근토큰폐기(P).md) | `-` | `-` | `POST /oauth2/revokeP` |
| [접근토큰발급(P)](OAuth인증/접근토큰발급(P).md) | `-` | `-` | `POST /oauth2/tokenP` |

## [국내주식] 주문/계좌

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [기간별계좌권리현황조회](국내주식_주문-계좌/기간별계좌권리현황조회.md) | `CTRGA011R` | `-` | `GET /uapi/domestic-stock/v1/trading/period-rights` |
| [투자계좌자산현황조회](국내주식_주문-계좌/투자계좌자산현황조회.md) | `CTRP6548R` | `-` | `GET /uapi/domestic-stock/v1/trading/inquire-account-balance` |
| [퇴직연금 예수금조회](국내주식_주문-계좌/퇴직연금_예수금조회.md) | `TTTC0506R` | `-` | `GET /uapi/domestic-stock/v1/trading/pension/inquire-deposit` |
| [주식예약주문정정취소](국내주식_주문-계좌/주식예약주문정정취소.md) | `(예약취소) CTSC0009U (예약정정) CTSC0013U` | `-` | `POST /uapi/domestic-stock/v1/trading/order-resv-rvsecncl` |
| [신용매수가능조회](국내주식_주문-계좌/신용매수가능조회.md) | `TTTC8909R` | `-` | `GET /uapi/domestic-stock/v1/trading/inquire-credit-psamount` |
| [주식통합증거금 현황](국내주식_주문-계좌/주식통합증거금_현황.md) | `TTTC0869R` | `-` | `GET /uapi/domestic-stock/v1/trading/intgr-margin` |
| [퇴직연금 미체결내역](국내주식_주문-계좌/퇴직연금_미체결내역.md) | `TTTC2201R(기존 KRX만 가능), TTTC2210R (KRX,NXT/SOR)` | `-` | `GET /uapi/domestic-stock/v1/trading/pension/inquire-daily-ccld` |
| [기간별매매손익현황조회](국내주식_주문-계좌/기간별매매손익현황조회.md) | `TTTC8715R` | `-` | `GET /uapi/domestic-stock/v1/trading/inquire-period-trade-profit` |
| [주식주문(정정취소)](국내주식_주문-계좌/주식주문(정정취소).md) | `TTTC0013U` | `VTTC0013U` | `POST /uapi/domestic-stock/v1/trading/order-rvsecncl` |
| [주식예약주문조회](국내주식_주문-계좌/주식예약주문조회.md) | `CTSC0004R` | `-` | `GET /uapi/domestic-stock/v1/trading/order-resv-ccnl` |
| [퇴직연금 매수가능조회](국내주식_주문-계좌/퇴직연금_매수가능조회.md) | `TTTC0503R` | `-` | `GET /uapi/domestic-stock/v1/trading/pension/inquire-psbl-order` |
| [주식잔고조회](국내주식_주문-계좌/주식잔고조회.md) | `TTTC8434R` | `VTTC8434R` | `GET /uapi/domestic-stock/v1/trading/inquire-balance` |
| [퇴직연금 체결기준잔고](국내주식_주문-계좌/퇴직연금_체결기준잔고.md) | `TTTC2202R` | `-` | `GET /uapi/domestic-stock/v1/trading/pension/inquire-present-balance` |
| [매수가능조회](국내주식_주문-계좌/매수가능조회.md) | `TTTC8908R` | `VTTC8908R` | `GET /uapi/domestic-stock/v1/trading/inquire-psbl-order` |
| [기간별손익일별합산조회](국내주식_주문-계좌/기간별손익일별합산조회.md) | `TTTC8708R` | `-` | `GET /uapi/domestic-stock/v1/trading/inquire-period-profit` |
| [주식주문(현금)](국내주식_주문-계좌/주식주문(현금).md) | `(매도) TTTC0011U (매수) TTTC0012U` | `(매도) VTTC0011U (매수) VTTC0012U` | `POST /uapi/domestic-stock/v1/trading/order-cash` |
| [매도가능수량조회](국내주식_주문-계좌/매도가능수량조회.md) | `TTTC8408R` | `-` | `GET /uapi/domestic-stock/v1/trading/inquire-psbl-sell` |
| [주식일별주문체결조회](국내주식_주문-계좌/주식일별주문체결조회.md) | `(3개월이내) TTTC0081R (3개월이전) CTSC9215R` | `(3개월이내) VTTC0081R (3개월이전) VTSC9215R` | `GET /uapi/domestic-stock/v1/trading/inquire-daily-ccld` |
| [주식정정취소가능주문조회](국내주식_주문-계좌/주식정정취소가능주문조회.md) | `TTTC0084R` | `-` | `GET /uapi/domestic-stock/v1/trading/inquire-psbl-rvsecncl` |
| [주식예약주문](국내주식_주문-계좌/주식예약주문.md) | `CTSC0008U` | `-` | `POST /uapi/domestic-stock/v1/trading/order-resv` |
| [주식주문(신용)](국내주식_주문-계좌/주식주문(신용).md) | `(매도) TTTC0051U (매수) TTTC0052U` | `-` | `POST /uapi/domestic-stock/v1/trading/order-credit` |
| [퇴직연금 잔고조회](국내주식_주문-계좌/퇴직연금_잔고조회.md) | `TTTC2208R` | `-` | `GET /uapi/domestic-stock/v1/trading/pension/inquire-balance` |
| [주식잔고조회_실현손익](국내주식_주문-계좌/주식잔고조회_실현손익.md) | `TTTC8494R` | `-` | `GET /uapi/domestic-stock/v1/trading/inquire-balance-rlz-pl` |

## [국내주식] 기본시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [주식현재가 일자별](국내주식_기본시세/주식현재가_일자별.md) | `FHKST01010400` | `FHKST01010400` | `GET /uapi/domestic-stock/v1/quotations/inquire-daily-price` |
| [주식현재가 시세](국내주식_기본시세/주식현재가_시세.md) ✅ | `FHKST01010100` | `FHKST01010100` | `GET /uapi/domestic-stock/v1/quotations/inquire-price` |
| [국내주식 시간외현재가](국내주식_기본시세/국내주식_시간외현재가.md) | `FHPST02300000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-overtime-price` |
| [ETF 구성종목시세](국내주식_기본시세/ETF_구성종목시세.md) | `FHKST121600C0` | `-` | `GET /uapi/etfetn/v1/quotations/inquire-component-stock-price` |
| [주식현재가 시간외시간별체결](국내주식_기본시세/주식현재가_시간외시간별체결.md) | `FHPST02310000` | `FHPST02310000` | `GET /uapi/domestic-stock/v1/quotations/inquire-time-overtimeconclusion` |
| [NAV 비교추이(종목)](국내주식_기본시세/NAV_비교추이(종목).md) | `FHPST02440000` | `-` | `GET /uapi/etfetn/v1/quotations/nav-comparison-trend` |
| [주식현재가 시간외일자별주가](국내주식_기본시세/주식현재가_시간외일자별주가.md) | `FHPST02320000` | `FHPST02320000` | `GET /uapi/domestic-stock/v1/quotations/inquire-daily-overtimeprice` |
| [국내주식 시간외호가](국내주식_기본시세/국내주식_시간외호가.md) | `FHPST02300400` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-overtime-asking-price` |
| [주식현재가 당일시간대별체결](국내주식_기본시세/주식현재가_당일시간대별체결.md) | `FHPST01060000` | `FHPST01060000` | `GET /uapi/domestic-stock/v1/quotations/inquire-time-itemconclusion` |
| [주식현재가 시세2](국내주식_기본시세/주식현재가_시세2.md) | `FHPST01010000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-price-2` |
| [ETF 현재가 호가](국내주식_기본시세/ETF_현재가_호가.md) | `FHPST02400200` | `-` | `GET /uapi/etfetn/v1/quotations/inquire-asking-price` |
| [주식일별분봉조회](국내주식_기본시세/주식일별분봉조회.md) | `FHKST03010230` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-time-dailychartprice` |
| [국내주식기간별시세(일/주/월/년)](국내주식_기본시세/국내주식기간별시세(일-주-월-년).md) ✅ | `FHKST03010100` | `FHKST03010100` | `GET /uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice` |
| [NAV 비교추이(일)](국내주식_기본시세/NAV_비교추이(일).md) | `FHPST02440200` | `-` | `GET /uapi/etfetn/v1/quotations/nav-comparison-daily-trend` |
| [주식현재가 호가/예상체결](국내주식_기본시세/주식현재가_호가-예상체결.md) | `FHKST01010200` | `FHKST01010200` | `GET /uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn` |
| [주식현재가 체결](국내주식_기본시세/주식현재가_체결.md) | `FHKST01010300` | `FHKST01010300` | `GET /uapi/domestic-stock/v1/quotations/inquire-ccnl` |
| [주식현재가 회원사](국내주식_기본시세/주식현재가_회원사.md) | `FHKST01010600` | `FHKST01010600` | `GET /uapi/domestic-stock/v1/quotations/inquire-member` |
| [NAV 비교추이(분)](국내주식_기본시세/NAV_비교추이(분).md) | `FHPST02440100` | `-` | `GET /uapi/etfetn/v1/quotations/nav-comparison-time-trend` |
| [주식현재가 투자자](국내주식_기본시세/주식현재가_투자자.md) ✅ | `FHKST01010900` | `FHKST01010900` | `GET /uapi/domestic-stock/v1/quotations/inquire-investor` |
| [ETF/ETN 현재가](국내주식_기본시세/ETF-ETN_현재가.md) | `FHPST02400000` | `-` | `GET /uapi/etfetn/v1/quotations/inquire-price` |
| [국내주식 장마감 예상체결가](국내주식_기본시세/국내주식_장마감_예상체결가.md) | `FHKST117300C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/exp-closing-price` |
| [주식당일분봉조회](국내주식_기본시세/주식당일분봉조회.md) ✅ | `FHKST03010200` | `FHKST03010200` | `GET /uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice` |

## [국내주식] ELW 시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [ELW 현재가 시세](국내주식_ELW_시세/ELW_현재가_시세.md) | `FHKEW15010000` | `FHKEW15010000` | `GET /uapi/domestic-stock/v1/quotations/inquire-elw-price` |
| [ELW 신규상장종목](국내주식_ELW_시세/ELW_신규상장종목.md) | `FHKEW154800C0` | `-` | `GET /uapi/elw/v1/quotations/newly-listed` |
| [ELW 투자지표추이(일별)](국내주식_ELW_시세/ELW_투자지표추이(일별).md) | `FHPEW02740200` | `-` | `GET /uapi/elw/v1/quotations/indicator-trend-daily` |
| [ELW 민감도 순위](국내주식_ELW_시세/ELW_민감도_순위.md) | `FHPEW02850000` | `-` | `GET /uapi/elw/v1/ranking/sensitivity` |
| [ELW 기초자산별 종목시세](국내주식_ELW_시세/ELW_기초자산별_종목시세.md) | `FHKEW154101C0` | `-` | `GET /uapi/elw/v1/quotations/udrl-asset-price` |
| [ELW 종목검색](국내주식_ELW_시세/ELW_종목검색.md) | `FHKEW15100000` | `-` | `GET /uapi/elw/v1/quotations/cond-search` |
| [ELW 변동성 추이(분별)](국내주식_ELW_시세/ELW_변동성_추이(분별).md) | `FHPEW02840300` | `-` | `GET /uapi/elw/v1/quotations/volatility-trend-minute` |
| [ELW 변동성추이(체결)](국내주식_ELW_시세/ELW_변동성추이(체결).md) | `FHPEW02840100` | `-` | `GET /uapi/elw/v1/quotations/volatility-trend-ccnl` |
| [ELW 당일급변종목](국내주식_ELW_시세/ELW_당일급변종목.md) | `FHPEW02870000` | `-` | `GET /uapi/elw/v1/ranking/quick-change` |
| [ELW 투자지표추이(분별)](국내주식_ELW_시세/ELW_투자지표추이(분별).md) | `FHPEW02740300` | `-` | `GET /uapi/elw/v1/quotations/indicator-trend-minute` |
| [ELW 기초자산 목록조회](국내주식_ELW_시세/ELW_기초자산_목록조회.md) | `FHKEW154100C0` | `-` | `GET /uapi/elw/v1/quotations/udrl-asset-list` |
| [ELW 변동성 추이(일별)](국내주식_ELW_시세/ELW_변동성_추이(일별).md) | `FHPEW02840200` | `-` | `GET /uapi/elw/v1/quotations/volatility-trend-daily` |
| [ELW 거래량순위](국내주식_ELW_시세/ELW_거래량순위.md) | `FHPEW02780000` | `-` | `GET /uapi/elw/v1/ranking/volume-rank` |
| [ELW 지표순위](국내주식_ELW_시세/ELW_지표순위.md) | `FHPEW02790000` | `-` | `GET /uapi/elw/v1/ranking/indicator` |
| [ELW 투자지표추이(체결)](국내주식_ELW_시세/ELW_투자지표추이(체결).md) | `FHPEW02740100` | `-` | `GET /uapi/elw/v1/quotations/indicator-trend-ccnl` |
| [ELW 상승률순위](국내주식_ELW_시세/ELW_상승률순위.md) | `FHPEW02770000` | `-` | `GET /uapi/elw/v1/ranking/updown-rate` |
| [ELW 민감도 추이(일별)](국내주식_ELW_시세/ELW_민감도_추이(일별).md) | `FHPEW02830200` | `-` | `GET /uapi/elw/v1/quotations/sensitivity-trend-daily` |
| [ELW 비교대상종목조회](국내주식_ELW_시세/ELW_비교대상종목조회.md) | `FHKEW151701C0` | `-` | `GET /uapi/elw/v1/quotations/compare-stocks` |
| [ELW 만기예정/만기종목](국내주식_ELW_시세/ELW_만기예정-만기종목.md) | `FHKEW154700C0` | `-` | `GET /uapi/elw/v1/quotations/expiration-stocks` |
| [ELW LP매매추이](국내주식_ELW_시세/ELW_LP매매추이.md) | `FHPEW03760000` | `-` | `GET /uapi/elw/v1/quotations/lp-trade-trend` |
| [ELW 민감도 추이(체결)](국내주식_ELW_시세/ELW_민감도_추이(체결).md) | `FHPEW02830100` | `-` | `GET /uapi/elw/v1/quotations/sensitivity-trend-ccnl` |
| [ELW 변동성 추이(틱)](국내주식_ELW_시세/ELW_변동성_추이(틱).md) | `FHPEW02840400` | `-` | `GET /uapi/elw/v1/quotations/volatility-trend-tick` |

## [국내주식] 업종/기타

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [국내주식 예상체결지수 추이](국내주식_업종-기타/국내주식_예상체결지수_추이.md) | `FHPST01840000` | `-` | `GET /uapi/domestic-stock/v1/quotations/exp-index-trend` |
| [국내주식업종기간별시세(일/주/월/년)](국내주식_업종-기타/국내주식업종기간별시세(일-주-월-년).md) | `FHKUP03500100` | `FHKUP03500100` | `GET /uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice` |
| [국내업종 시간별지수(분)](국내주식_업종-기타/국내업종_시간별지수(분).md) | `FHPUP02110200` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-index-timeprice` |
| [국내업종 구분별전체시세](국내주식_업종-기타/국내업종_구분별전체시세.md) | `FHPUP02140000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-index-category-price` |
| [업종 분봉조회](국내주식_업종-기타/업종_분봉조회.md) | `FHKUP03500200` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice` |
| [국내휴장일조회](국내주식_업종-기타/국내휴장일조회.md) | `CTCA0903R` | `-` | `GET /uapi/domestic-stock/v1/quotations/chk-holiday` |
| [국내주식 예상체결 전체지수](국내주식_업종-기타/국내주식_예상체결_전체지수.md) | `FHKUP11750000` | `-` | `GET /uapi/domestic-stock/v1/quotations/exp-total-index` |
| [국내업종 현재지수](국내주식_업종-기타/국내업종_현재지수.md) ✅ | `FHPUP02100000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-index-price` |
| [국내선물 영업일조회](국내주식_업종-기타/국내선물_영업일조회.md) | `HHMCM000002C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/market-time` |
| [국내업종 시간별지수(초)](국내주식_업종-기타/국내업종_시간별지수(초).md) | `FHPUP02110100` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-index-tickprice` |
| [국내업종 일자별지수](국내주식_업종-기타/국내업종_일자별지수.md) | `FHPUP02120000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-index-daily-price` |
| [금리 종합(국내채권/금리)](국내주식_업종-기타/금리_종합(국내채권-금리).md) | `(구) FHPST07020000 (신)HHPST070200C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/comp-interest` |
| [변동성완화장치(VI) 현황](국내주식_업종-기타/변동성완화장치(VI)_현황.md) | `FHPST01390000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-vi-status` |
| [종합 시황/공시(제목)](국내주식_업종-기타/종합_시황-공시(제목).md) | `FHKST01011800` | `-` | `GET /uapi/domestic-stock/v1/quotations/news-title` |

## [국내주식] 종목정보

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [상품기본조회](국내주식_종목정보/상품기본조회.md) | `CTPF1604R` | `-` | `GET /uapi/domestic-stock/v1/quotations/search-info` |
| [예탁원정보(상장정보일정)](국내주식_종목정보/예탁원정보(상장정보일정).md) | `HHKDB669107C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/list-info` |
| [예탁원정보(공모주청약일정)](국내주식_종목정보/예탁원정보(공모주청약일정).md) | `HHKDB669108C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/pub-offer` |
| [국내주식 재무비율](국내주식_종목정보/국내주식_재무비율.md) | `FHKST66430300` | `-` | `GET /uapi/domestic-stock/v1/finance/financial-ratio` |
| [예탁원정보(자본감소일정)](국내주식_종목정보/예탁원정보(자본감소일정).md) | `HHKDB669106C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/cap-dcrs` |
| [예탁원정보(무상증자일정)](국내주식_종목정보/예탁원정보(무상증자일정).md) | `HHKDB669101C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/bonus-issue` |
| [국내주식 증권사별 투자의견](국내주식_종목정보/국내주식_증권사별_투자의견.md) | `FHKST663400C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/invest-opbysec` |
| [국내주식 당사 신용가능종목](국내주식_종목정보/국내주식_당사_신용가능종목.md) | `FHPST04770000` | `-` | `GET /uapi/domestic-stock/v1/quotations/credit-by-company` |
| [예탁원정보(주식매수청구일정)](국내주식_종목정보/예탁원정보(주식매수청구일정).md) | `HHKDB669103C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/purreq` |
| [예탁원정보(액면교체일정)](국내주식_종목정보/예탁원정보(액면교체일정).md) | `HHKDB669105C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/rev-split` |
| [예탁원정보(배당일정)](국내주식_종목정보/예탁원정보(배당일정).md) | `HHKDB669102C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/dividend` |
| [국내주식 종목투자의견](국내주식_종목정보/국내주식_종목투자의견.md) | `FHKST663300C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/invest-opinion` |
| [국내주식 안정성비율](국내주식_종목정보/국내주식_안정성비율.md) | `FHKST66430600` | `-` | `GET /uapi/domestic-stock/v1/finance/stability-ratio` |
| [국내주식 수익성비율](국내주식_종목정보/국내주식_수익성비율.md) | `FHKST66430400` | `-` | `GET /uapi/domestic-stock/v1/finance/profit-ratio` |
| [예탁원정보(실권주일정)](국내주식_종목정보/예탁원정보(실권주일정).md) | `HHKDB669109C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/forfeit` |
| [예탁원정보(의무예치일정)](국내주식_종목정보/예탁원정보(의무예치일정).md) | `HHKDB669110C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/mand-deposit` |
| [국내주식 손익계산서](국내주식_종목정보/국내주식_손익계산서.md) | `FHKST66430200` | `-` | `GET /uapi/domestic-stock/v1/finance/income-statement` |
| [당사 대주가능 종목](국내주식_종목정보/당사_대주가능_종목.md) | `CTSC2702R` | `-` | `GET /uapi/domestic-stock/v1/quotations/lendable-by-company` |
| [주식기본조회](국내주식_종목정보/주식기본조회.md) | `CTPF1002R` | `-` | `GET /uapi/domestic-stock/v1/quotations/search-stock-info` |
| [예탁원정보(유상증자일정)](국내주식_종목정보/예탁원정보(유상증자일정).md) | `HHKDB669100C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/paidin-capin` |
| [예탁원정보(주주총회일정)](국내주식_종목정보/예탁원정보(주주총회일정).md) | `HHKDB669111C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/sharehld-meet` |
| [국내주식 성장성비율](국내주식_종목정보/국내주식_성장성비율.md) | `FHKST66430800` | `-` | `GET /uapi/domestic-stock/v1/finance/growth-ratio` |
| [국내주식 대차대조표](국내주식_종목정보/국내주식_대차대조표.md) | `FHKST66430100` | `-` | `GET /uapi/domestic-stock/v1/finance/balance-sheet` |
| [예탁원정보(합병/분할일정)](국내주식_종목정보/예탁원정보(합병-분할일정).md) | `HHKDB669104C0` | `-` | `GET /uapi/domestic-stock/v1/ksdinfo/merger-split` |
| [국내주식 종목추정실적](국내주식_종목정보/국내주식_종목추정실적.md) | `HHKST668300C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/estimate-perform` |
| [국내주식 기타주요비율](국내주식_종목정보/국내주식_기타주요비율.md) | `FHKST66430500` | `-` | `GET /uapi/domestic-stock/v1/finance/other-major-ratios` |

## [국내주식] 시세분석

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [프로그램매매 종합현황(시간)](국내주식_시세분석/프로그램매매_종합현황(시간).md) | `FHPPG04600101` | `-` | `GET /uapi/domestic-stock/v1/quotations/comp-program-trade-today` |
| [국내주식 신용잔고 일별추이](국내주식_시세분석/국내주식_신용잔고_일별추이.md) ✅ | `FHPST04760000` | `-` | `GET /uapi/domestic-stock/v1/quotations/daily-credit-balance` |
| [시장별 투자자매매동향(일별)](국내주식_시세분석/시장별_투자자매매동향(일별).md) | `FHPTJ04040000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-investor-daily-by-market` |
| [국내주식 공매도 일별추이](국내주식_시세분석/국내주식_공매도_일별추이.md) ✅ | `FHPST04830000` | `-` | `GET /uapi/domestic-stock/v1/quotations/daily-short-sale` |
| [종목별 투자자매매동향(일별)](국내주식_시세분석/종목별_투자자매매동향(일별).md) | `FHPTJ04160001` | `-` | `GET /uapi/domestic-stock/v1/quotations/investor-trade-by-stock-daily` |
| [종목조건검색 목록조회](국내주식_시세분석/종목조건검색_목록조회.md) | `HHKST03900300` | `-` | `GET /uapi/domestic-stock/v1/quotations/psearch-title` |
| [국내주식 상하한가 포착](국내주식_시세분석/국내주식_상하한가_포착.md) | `FHKST130000C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/capture-uplowprice` |
| [프로그램매매 종합현황(일별)](국내주식_시세분석/프로그램매매_종합현황(일별).md) | `FHPPG04600001` | `-` | `GET /uapi/domestic-stock/v1/quotations/comp-program-trade-daily` |
| [종목별 일별 대차거래추이](국내주식_시세분석/종목별_일별_대차거래추이.md) | `HHPST074500C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/daily-loan-trans` |
| [종목조건검색조회](국내주식_시세분석/종목조건검색조회.md) | `HHKST03900400` | `-` | `GET /uapi/domestic-stock/v1/quotations/psearch-result` |
| [국내주식 매물대/거래비중](국내주식_시세분석/국내주식_매물대-거래비중.md) | `FHPST01130000` | `-` | `GET /uapi/domestic-stock/v1/quotations/pbar-tratio` |
| [국내기관_외국인 매매종목가집계](국내주식_시세분석/국내기관_외국인_매매종목가집계.md) ✅ | `FHPTJ04400000` | `-` | `GET /uapi/domestic-stock/v1/quotations/foreign-institution-total` |
| [관심종목 그룹별 종목조회](국내주식_시세분석/관심종목_그룹별_종목조회.md) | `HHKCM113004C6` | `-` | `GET /uapi/domestic-stock/v1/quotations/intstock-stocklist-by-group` |
| [주식현재가 회원사 종목매매동향](국내주식_시세분석/주식현재가_회원사_종목매매동향.md) | `FHPST04540000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-member-daily` |
| [종목별 프로그램매매추이(일별)](국내주식_시세분석/종목별_프로그램매매추이(일별).md) | `FHPPG04650201` | `-` | `GET /uapi/domestic-stock/v1/quotations/program-trade-by-stock-daily` |
| [관심종목 그룹조회](국내주식_시세분석/관심종목_그룹조회.md) | `HHKCM113004C7` | `-` | `GET /uapi/domestic-stock/v1/quotations/intstock-grouplist` |
| [종목별 외인기관 추정가집계](국내주식_시세분석/종목별_외인기관_추정가집계.md) | `HHPTJ04160200` | `-` | `GET /uapi/domestic-stock/v1/quotations/investor-trend-estimate` |
| [종목별일별매수매도체결량](국내주식_시세분석/종목별일별매수매도체결량.md) | `FHKST03010800` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-daily-trade-volume` |
| [국내주식 체결금액별 매매비중](국내주식_시세분석/국내주식_체결금액별_매매비중.md) | `FHKST111900C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/tradprt-byamt` |
| [프로그램매매 투자자매매동향(당일)](국내주식_시세분석/프로그램매매_투자자매매동향(당일).md) | `HHPPG046600C1` | `-` | `GET /uapi/domestic-stock/v1/quotations/investor-program-trade-today` |
| [국내 증시자금 종합](국내주식_시세분석/국내_증시자금_종합.md) | `FHKST649100C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/mktfunds` |
| [국내주식 예상체결가 추이](국내주식_시세분석/국내주식_예상체결가_추이.md) | `FHPST01810000` | `-` | `GET /uapi/domestic-stock/v1/quotations/exp-price-trend` |
| [회원사 실시간 매매동향(틱)](국내주식_시세분석/회원사_실시간_매매동향(틱).md) | `FHPST04320000` | `-` | `GET /uapi/domestic-stock/v1/quotations/frgnmem-trade-trend` |
| [시장별 투자자매매동향(시세)](국내주식_시세분석/시장별_투자자매매동향(시세).md) | `FHPTJ04030000` | `-` | `GET /uapi/domestic-stock/v1/quotations/inquire-investor-time-by-market` |
| [종목별 프로그램매매추이(체결)](국내주식_시세분석/종목별_프로그램매매추이(체결).md) | `FHPPG04650101` | `-` | `GET /uapi/domestic-stock/v1/quotations/program-trade-by-stock` |
| [외국계 매매종목 가집계](국내주식_시세분석/외국계_매매종목_가집계.md) | `FHKST644100C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/frgnmem-trade-estimate` |
| [국내주식 시간외예상체결등락률](국내주식_시세분석/국내주식_시간외예상체결등락률.md) | `FHKST11860000` | `-` | `GET /uapi/domestic-stock/v1/ranking/overtime-exp-trans-fluct` |
| [종목별 외국계 순매수추이](국내주식_시세분석/종목별_외국계_순매수추이.md) | `FHKST644400C0` | `-` | `GET /uapi/domestic-stock/v1/quotations/frgnmem-pchs-trend` |
| [관심종목(멀티종목) 시세조회](국내주식_시세분석/관심종목(멀티종목)_시세조회.md) | `FHKST11300006` | `-` | `GET /uapi/domestic-stock/v1/quotations/intstock-multprice` |

## [국내주식] 순위분석

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [국내주식 예상체결 상승/하락상위](국내주식_순위분석/국내주식_예상체결_상승-하락상위.md) | `FHPST01820000` | `-` | `GET /uapi/domestic-stock/v1/ranking/exp-trans-updown` |
| [국내주식 호가잔량 순위](국내주식_순위분석/국내주식_호가잔량_순위.md) | `FHPST01720000` | `-` | `GET /uapi/domestic-stock/v1/ranking/quote-balance` |
| [국내주식 신용잔고 상위](국내주식_순위분석/국내주식_신용잔고_상위.md) | `FHKST17010000` | `-` | `GET /uapi/domestic-stock/v1/ranking/credit-balance` |
| [국내주식 시간외거래량순위](국내주식_순위분석/국내주식_시간외거래량순위.md) | `FHPST02350000` | `-` | `GET /uapi/domestic-stock/v1/ranking/overtime-volume` |
| [국내주식 배당률 상위](국내주식_순위분석/국내주식_배당률_상위.md) | `HHKDB13470100` | `-` | `GET /uapi/domestic-stock/v1/ranking/dividend-rate` |
| [국내주식 시간외잔량 순위](국내주식_순위분석/국내주식_시간외잔량_순위.md) | `FHPST01760000` | `-` | `GET /uapi/domestic-stock/v1/ranking/after-hour-balance` |
| [국내주식 공매도 상위종목](국내주식_순위분석/국내주식_공매도_상위종목.md) | `FHPST04820000` | `-` | `GET /uapi/domestic-stock/v1/ranking/short-sale` |
| [국내주식 이격도 순위](국내주식_순위분석/국내주식_이격도_순위.md) | `FHPST01780000` | `-` | `GET /uapi/domestic-stock/v1/ranking/disparity` |
| [HTS조회상위20종목](국내주식_순위분석/HTS조회상위20종목.md) | `HHMCM000100C0` | `-` | `GET /uapi/domestic-stock/v1/ranking/hts-top-view` |
| [거래량순위](국내주식_순위분석/거래량순위.md) ✅ | `FHPST01710000` | `-` | `GET /uapi/domestic-stock/v1/quotations/volume-rank` |
| [국내주식 수익자산지표 순위](국내주식_순위분석/국내주식_수익자산지표_순위.md) | `FHPST01730000` | `-` | `GET /uapi/domestic-stock/v1/ranking/profit-asset-index` |
| [국내주식 신고/신저근접종목 상위](국내주식_순위분석/국내주식_신고-신저근접종목_상위.md) | `FHPST01870000` | `-` | `GET /uapi/domestic-stock/v1/ranking/near-new-highlow` |
| [국내주식 우선주/괴리율 상위](국내주식_순위분석/국내주식_우선주-괴리율_상위.md) | `FHPST01770000` | `-` | `GET /uapi/domestic-stock/v1/ranking/prefer-disparate-ratio` |
| [국내주식 대량체결건수 상위](국내주식_순위분석/국내주식_대량체결건수_상위.md) | `FHKST190900C0` | `-` | `GET /uapi/domestic-stock/v1/ranking/bulk-trans-num` |
| [국내주식 재무비율 순위](국내주식_순위분석/국내주식_재무비율_순위.md) | `FHPST01750000` | `-` | `GET /uapi/domestic-stock/v1/ranking/finance-ratio` |
| [국내주식 시가총액 상위](국내주식_순위분석/국내주식_시가총액_상위.md) | `FHPST01740000` | `-` | `GET /uapi/domestic-stock/v1/ranking/market-cap` |
| [국내주식 당사매매종목 상위](국내주식_순위분석/국내주식_당사매매종목_상위.md) | `FHPST01860000` | `-` | `GET /uapi/domestic-stock/v1/ranking/traded-by-company` |
| [국내주식 등락률 순위](국내주식_순위분석/국내주식_등락률_순위.md) | `FHPST01700000` | `-` | `GET /uapi/domestic-stock/v1/ranking/fluctuation` |
| [국내주식 시장가치 순위](국내주식_순위분석/국내주식_시장가치_순위.md) | `FHPST01790000` | `-` | `GET /uapi/domestic-stock/v1/ranking/market-value` |
| [국내주식 관심종목등록 상위](국내주식_순위분석/국내주식_관심종목등록_상위.md) | `FHPST01800000` | `-` | `GET /uapi/domestic-stock/v1/ranking/top-interest-stock` |
| [국내주식 체결강도 상위](국내주식_순위분석/국내주식_체결강도_상위.md) | `FHPST01680000` | `-` | `GET /uapi/domestic-stock/v1/ranking/volume-power` |
| [국내주식 시간외등락율순위](국내주식_순위분석/국내주식_시간외등락율순위.md) | `FHPST02340000` | `-` | `GET /uapi/domestic-stock/v1/ranking/overtime-fluctuation` |

## [국내주식] 실시간시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [국내지수 실시간예상체결](국내주식_실시간시세/국내지수_실시간예상체결.md) | `H0UPANC0` | `-` | `POST /tryitout/H0UPANC0` |
| [국내주식 장운영정보 (통합)](국내주식_실시간시세/국내주식_장운영정보_(통합).md) | `H0UNMKO0` | `-` | `POST /tryitout/H0UNMKO0` |
| [국내주식 실시간회원사 (NXT)](국내주식_실시간시세/국내주식_실시간회원사_(NXT).md) | `H0NXMBC0` | `-` | `POST /tryitout/H0NXMBC0` |
| [국내주식 실시간체결통보](국내주식_실시간시세/국내주식_실시간체결통보.md) | `H0STCNI0` | `H0STCNI9` | `POST /tryitout/H0STCNI0` |
| [국내주식 시간외 실시간예상체결 (KRX)](국내주식_실시간시세/국내주식_시간외_실시간예상체결_(KRX).md) | `H0STOAC0` | `-` | `POST /tryitout/H0STOAC0` |
| [국내주식 VI변동성완화장치](국내주식_실시간시세/국내주식_VI변동성완화장치.md) | `-` | `-` | `POST /tryitout/H0STVIC0` |
| [국내주식 시간외 실시간호가 (KRX)](국내주식_실시간시세/국내주식_시간외_실시간호가_(KRX).md) | `H0STOAA0` | `-` | `POST /tryitout/H0STOAA0` |
| [국내주식 실시간프로그램매매 (통합)](국내주식_실시간시세/국내주식_실시간프로그램매매_(통합).md) | `H0UNPGM0` | `-` | `POST /tryitout/H0UNPGM0` |
| [국내주식 실시간호가 (통합)](국내주식_실시간시세/국내주식_실시간호가_(통합).md) | `H0UNASP0` | `-` | `POST /tryitout/H0UNASP0` |
| [국내주식 실시간프로그램매매 (KRX)](국내주식_실시간시세/국내주식_실시간프로그램매매_(KRX).md) | `H0STPGM0` | `-` | `POST /tryitout/H0STPGM0` |
| [국내주식 장운영정보 (KRX)](국내주식_실시간시세/국내주식_장운영정보_(KRX).md) | `H0STMKO0` | `-` | `POST /tryitout/H0STMKO0` |
| [국내주식 실시간체결가 (KRX)](국내주식_실시간시세/국내주식_실시간체결가_(KRX).md) | `H0STCNT0` | `H0STCNT0` | `POST /tryitout/H0STCNT0` |
| [국내지수 실시간프로그램매매](국내주식_실시간시세/국내지수_실시간프로그램매매.md) | `H0UPPGM0` | `-` | `POST /tryitout/H0UPPGM0` |
| [VI변동성완화 (통합)](국내주식_실시간시세/VI변동성완화_(통합).md) | `-` | `-` | `POST /tryitout/H0UNVIC0` |
| [국내주식 실시간회원사 (통합)](국내주식_실시간시세/국내주식_실시간회원사_(통합).md) | `H0UNMBC0` | `-` | `POST /tryitout/H0UNMBC0` |
| [국내지수 실시간체결](국내주식_실시간시세/국내지수_실시간체결.md) | `H0UPCNT0` | `-` | `POST /tryitout/H0UPCNT0` |
| [국내주식 실시간예상체결 (KRX)](국내주식_실시간시세/국내주식_실시간예상체결_(KRX).md) | `H0STANC0` | `-` | `POST /tryitout/H0STANC0` |
| [VI변동성완화 (NXT)](국내주식_실시간시세/VI변동성완화_(NXT).md) | `-` | `-` | `POST /tryitout/H0NXVIC0` |
| [ELW 실시간호가](국내주식_실시간시세/ELW_실시간호가.md) | `H0EWASP0` | `-` | `POST /tryitout/H0EWASP0` |
| [국내주식 실시간호가 (KRX)](국내주식_실시간시세/국내주식_실시간호가_(KRX).md) | `H0STASP0` | `H0STASP0` | `POST /tryitout/H0STASP0` |
| [국내주식 실시간체결가 (통합)](국내주식_실시간시세/국내주식_실시간체결가_(통합).md) | `H0UNCNT0` | `-` | `POST /tryitout/H0UNCNT0` |
| [국내주식 실시간호가 (NXT)](국내주식_실시간시세/국내주식_실시간호가_(NXT).md) | `H0NXASP0` | `-` | `POST /tryitout/H0NXASP0` |
| [국내주식 실시간프로그램매매 (NXT)](국내주식_실시간시세/국내주식_실시간프로그램매매_(NXT).md) | `H0NXPGM0` | `-` | `POST /tryitout/H0NXPGM0` |
| [국내주식 실시간체결가 (NXT)](국내주식_실시간시세/국내주식_실시간체결가_(NXT).md) | `H0NXCNT0` | `-` | `POST /tryitout/H0NXCNT0` |
| [ELW 실시간체결가](국내주식_실시간시세/ELW_실시간체결가.md) | `H0EWCNT0` | `-` | `POST /tryitout/H0EWCNT0` |
| [ELW 실시간예상체결](국내주식_실시간시세/ELW_실시간예상체결.md) | `H0EWANC0` | `-` | `POST /tryitout/H0EWANC0` |
| [국내주식 실시간예상체결 (NXT)](국내주식_실시간시세/국내주식_실시간예상체결_(NXT).md) | `H0NXANC0` | `-` | `POST /tryitout/H0NXANC0` |
| [국내주식 실시간회원사 (KRX)](국내주식_실시간시세/국내주식_실시간회원사_(KRX).md) | `H0STMBC0` | `-` | `POST /tryitout/H0STMBC0` |
| [국내주식 실시간예상체결 (통합)](국내주식_실시간시세/국내주식_실시간예상체결_(통합).md) | `H0UNANC0` | `-` | `POST /tryitout/H0UNANC0` |
| [국내주식 장운영정보 (NXT)](국내주식_실시간시세/국내주식_장운영정보_(NXT).md) | `H0NXMKO0` | `-` | `POST /tryitout/H0NXMKO0` |
| [국내ETF NAV추이](국내주식_실시간시세/국내ETF_NAV추이.md) | `H0STNAV0` | `-` | `POST /tryitout/H0STNAV0` |
| [국내주식 시간외 실시간체결가 (KRX)](국내주식_실시간시세/국내주식_시간외_실시간체결가_(KRX).md) | `H0STOUP0` | `-` | `POST /tryitout/H0STOUP0` |

## [국내선물옵션] 주문/계좌

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [(야간)선물옵션 증거금 상세](국내선물옵션_주문-계좌/(야간)선물옵션_증거금_상세.md) | `(구) JTCE6003R (신) CTFN7107R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/ngt-margin-detail` |
| [선물옵션 총자산현황](국내선물옵션_주문-계좌/선물옵션_총자산현황.md) | `CTRP6550R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-deposit` |
| [선물옵션기간약정수수료일별](국내선물옵션_주문-계좌/선물옵션기간약정수수료일별.md) | `CTFO6119R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-daily-amount-fee` |
| [(야간)선물옵션 잔고현황](국내선물옵션_주문-계좌/(야간)선물옵션_잔고현황.md) | `(구) JTCE6001R (신) CTFN6118R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-ngt-balance` |
| [선물옵션 잔고현황](국내선물옵션_주문-계좌/선물옵션_잔고현황.md) | `CTFO6118R` | `VTFO6118R` | `GET /uapi/domestic-futureoption/v1/trading/inquire-balance` |
| [선물옵션 주문](국내선물옵션_주문-계좌/선물옵션_주문.md) | `(주간 매수/매도) TTTO1101U (야간 매수/매도) (구) JTCE1001U (신) STTN1101U` | `(주간 매수/매도) VTTO1101U (야간은 모의투자 미제공)` | `POST /uapi/domestic-futureoption/v1/trading/order` |
| [선물옵션 잔고평가손익내역](국내선물옵션_주문-계좌/선물옵션_잔고평가손익내역.md) | `CTFO6159R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-balance-valuation-pl` |
| [선물옵션 증거금률](국내선물옵션_주문-계좌/선물옵션_증거금률.md) | `TTTO6032R` | `-` | `GET /uapi/domestic-futureoption/v1/quotations/margin-rate` |
| [선물옵션 정정취소주문](국내선물옵션_주문-계좌/선물옵션_정정취소주문.md) | `(주간 정정/취소) TTTO1103U (야간 정정/취소) (구) JTCE1002U (신) STTN1103U` | `(주간 정정/취소) VTTO1103U (야간은 모의투자 미제공)` | `POST /uapi/domestic-futureoption/v1/trading/order-rvsecncl` |
| [선물옵션 주문체결내역조회](국내선물옵션_주문-계좌/선물옵션_주문체결내역조회.md) | `TTTO5201R` | `VTTO5201R` | `GET /uapi/domestic-futureoption/v1/trading/inquire-ccnl` |
| [(야간)선물옵션 주문체결 내역조회](국내선물옵션_주문-계좌/(야간)선물옵션_주문체결_내역조회.md) | `(구) JTCE5005R (신) STTN5201R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-ngt-ccnl` |
| [(야간)선물옵션 주문가능 조회](국내선물옵션_주문-계좌/(야간)선물옵션_주문가능_조회.md) | `(구) JTCE1004R (신) STTN5105R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-psbl-ngt-order` |
| [선물옵션 잔고정산손익내역](국내선물옵션_주문-계좌/선물옵션_잔고정산손익내역.md) | `CTFO6117R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-balance-settlement-pl` |
| [선물옵션 주문가능](국내선물옵션_주문-계좌/선물옵션_주문가능.md) | `TTTO5105R` | `VTTO5105R` | `GET /uapi/domestic-futureoption/v1/trading/inquire-psbl-order` |
| [선물옵션 기준일체결내역](국내선물옵션_주문-계좌/선물옵션_기준일체결내역.md) | `CTFO5139R` | `-` | `GET /uapi/domestic-futureoption/v1/trading/inquire-ccnl-bstime` |

## [국내선물옵션] 기본시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [선물옵션 시세](국내선물옵션_기본시세/선물옵션_시세.md) | `FHMIF10000000` | `FHMIF10000000` | `GET /uapi/domestic-futureoption/v1/quotations/inquire-price` |
| [국내선물 기초자산 시세](국내선물옵션_기본시세/국내선물_기초자산_시세.md) | `FHPIF05030000` | `-` | `GET /uapi/domestic-futureoption/v1/quotations/display-board-top` |
| [선물옵션 일중예상체결추이](국내선물옵션_기본시세/선물옵션_일중예상체결추이.md) | `FHPIF05110100` | `-` | `GET /uapi/domestic-futureoption/v1/quotations/exp-price-trend` |
| [선물옵션기간별시세(일/주/월/년)](국내선물옵션_기본시세/선물옵션기간별시세(일-주-월-년).md) | `FHKIF03020100` | `FHKIF03020100` | `GET /uapi/domestic-futureoption/v1/quotations/inquire-daily-fuopchartprice` |
| [선물옵션 분봉조회](국내선물옵션_기본시세/선물옵션_분봉조회.md) | `FHKIF03020200` | `-` | `GET /uapi/domestic-futureoption/v1/quotations/inquire-time-fuopchartprice` |
| [선물옵션 시세호가](국내선물옵션_기본시세/선물옵션_시세호가.md) | `FHMIF10010000` | `FHMIF10010000` | `GET /uapi/domestic-futureoption/v1/quotations/inquire-asking-price` |

## [국내선물옵션] 실시간시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [주식옵션 실시간호가](국내선물옵션_실시간시세/주식옵션_실시간호가.md) | `H0ZOASP0` | `-` | `POST /tryitout/H0ZOASP0` |
| [선물옵션 실시간체결통보](국내선물옵션_실시간시세/선물옵션_실시간체결통보.md) | `H0IFCNI0` | `H0IFCNI9` | `POST /tryitout/H0IFCNI0` |
| [KRX야간선물 실시간종목체결](국내선물옵션_실시간시세/KRX야간선물_실시간종목체결.md) | `H0MFCNT0` | `-` | `POST /tryitout/H0MFCNT0` |
| [KRX야간선물 실시간호가](국내선물옵션_실시간시세/KRX야간선물_실시간호가.md) | `H0MFASP0` | `-` | `POST /tryitout/H0MFASP0` |
| [KRX야간옵션 실시간체결가](국내선물옵션_실시간시세/KRX야간옵션_실시간체결가.md) | `H0EUCNT0` | `-` | `POST /tryitout/H0EUCNT0` |
| [KRX야간옵션실시간예상체결](국내선물옵션_실시간시세/KRX야간옵션실시간예상체결.md) | `H0EUANC0` | `-` | `POST /tryitout/H0EUANC0` |
| [지수선물 실시간체결가](국내선물옵션_실시간시세/지수선물_실시간체결가.md) | `H0IFCNT0` | `-` | `POST /tryitout/H0IFCNT0` |
| [주식선물 실시간예상체결](국내선물옵션_실시간시세/주식선물_실시간예상체결.md) | `H0ZFANC0` | `-` | `POST /tryitout/H0ZFANC0` |
| [KRX야간옵션실시간체결통보](국내선물옵션_실시간시세/KRX야간옵션실시간체결통보.md) | `H0MFCNI0` | `-` | `POST /tryitout/H0EUCNI0` |
| [KRX야간선물 실시간체결통보](국내선물옵션_실시간시세/KRX야간선물_실시간체결통보.md) | `H0MFCNI0` | `-` | `POST /tryitout/H0MFCNI0` |
| [상품선물 실시간체결가](국내선물옵션_실시간시세/상품선물_실시간체결가.md) | `H0CFCNT0` | `-` | `POST /tryitout/H0CFCNT0` |
| [지수선물 실시간호가](국내선물옵션_실시간시세/지수선물_실시간호가.md) | `H0IFASP0` | `-` | `POST /tryitout/H0IFASP0` |
| [지수옵션  실시간체결가](국내선물옵션_실시간시세/지수옵션_실시간체결가.md) | `H0IOCNT0` | `-` | `POST /tryitout/H0IOCNT0` |
| [KRX야간옵션 실시간호가](국내선물옵션_실시간시세/KRX야간옵션_실시간호가.md) | `H0EUASP0` | `-` | `POST /tryitout/H0EUASP0` |
| [상품선물 실시간호가](국내선물옵션_실시간시세/상품선물_실시간호가.md) | `H0CFASP0` | `-` | `POST /tryitout/H0CFASP0` |
| [주식옵션 실시간예상체결](국내선물옵션_실시간시세/주식옵션_실시간예상체결.md) | `H0ZOANC0` | `-` | `POST /tryitout/H0ZOANC0` |
| [주식선물 실시간호가](국내선물옵션_실시간시세/주식선물_실시간호가.md) | `H0ZFASP0` | `-` | `POST /tryitout/H0ZFASP0` |
| [주식옵션 실시간체결가](국내선물옵션_실시간시세/주식옵션_실시간체결가.md) | `H0ZOCNT0` | `-` | `POST /tryitout/H0ZOCNT0` |
| [지수옵션 실시간호가](국내선물옵션_실시간시세/지수옵션_실시간호가.md) | `H0IOASP0` | `-` | `POST /tryitout/H0IOASP0` |
| [주식선물 실시간체결가](국내선물옵션_실시간시세/주식선물_실시간체결가.md) | `H0ZFCNT0` | `-` | `POST /tryitout/H0ZFCNT0` |

## [해외주식] 주문/계좌

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [해외주식 잔고](해외주식_주문-계좌/해외주식_잔고.md) | `TTTS3012R` | `VTTS3012R` | `GET /uapi/overseas-stock/v1/trading/inquire-balance` |
| [해외주식 체결기준현재잔고](해외주식_주문-계좌/해외주식_체결기준현재잔고.md) | `CTRP6504R` | `VTRP6504R` | `GET /uapi/overseas-stock/v1/trading/inquire-present-balance` |
| [해외주식 지정가체결내역조회](해외주식_주문-계좌/해외주식_지정가체결내역조회.md) | `TTTS6059R` | `-` | `GET /uapi/overseas-stock/v1/trading/inquire-algo-ccnl` |
| [해외주식 기간손익](해외주식_주문-계좌/해외주식_기간손익.md) | `TTTS3039R` | `-` | `GET /uapi/overseas-stock/v1/trading/inquire-period-profit` |
| [해외주식 매수가능금액조회](해외주식_주문-계좌/해외주식_매수가능금액조회.md) | `TTTS3007R` | `VTTS3007R` | `GET /uapi/overseas-stock/v1/trading/inquire-psamount` |
| [해외주식 정정취소주문](해외주식_주문-계좌/해외주식_정정취소주문.md) | `(미국 정정·취소) TTTT1004U (아시아 국가 하단 규격서 참고)` | `(미국 정정·취소) VTTT1004U (아시아 국가 하단 규격서 참고)` | `POST /uapi/overseas-stock/v1/trading/order-rvsecncl` |
| [해외주식 예약주문접수](해외주식_주문-계좌/해외주식_예약주문접수.md) | `(미국예약매수) TTTT3014U  (미국예약매도) TTTT3016U   (중국/홍콩/일본/베트남 예약주문) TTTS3013U` | `(미국예약매수) VTTT3014U  (미국예약매도) VTTT3016U   (중국/홍콩/일본/베트남 예약주문) VTTS3013U` | `POST /uapi/overseas-stock/v1/trading/order-resv` |
| [해외주식 미체결내역](해외주식_주문-계좌/해외주식_미체결내역.md) | `TTTS3018R` | `-` | `GET /uapi/overseas-stock/v1/trading/inquire-nccs` |
| [해외주식 미국주간정정취소](해외주식_주문-계좌/해외주식_미국주간정정취소.md) | `TTTS6038U` | `-` | `POST /uapi/overseas-stock/v1/trading/daytime-order-rvsecncl` |
| [해외주식 주문체결내역](해외주식_주문-계좌/해외주식_주문체결내역.md) | `TTTS3035R` | `VTTS3035R` | `GET /uapi/overseas-stock/v1/trading/inquire-ccnl` |
| [해외주식 결제기준잔고](해외주식_주문-계좌/해외주식_결제기준잔고.md) | `CTRP6010R` | `-` | `GET /uapi/overseas-stock/v1/trading/inquire-paymt-stdr-balance` |
| [해외주식 일별거래내역](해외주식_주문-계좌/해외주식_일별거래내역.md) | `CTOS4001R` | `-` | `GET /uapi/overseas-stock/v1/trading/inquire-period-trans` |
| [해외주식 미국주간주문](해외주식_주문-계좌/해외주식_미국주간주문.md) | `(주간매수) TTTS6036U (주간매도) TTTS6037U` | `-` | `POST /uapi/overseas-stock/v1/trading/daytime-order` |
| [해외주식 예약주문조회](해외주식_주문-계좌/해외주식_예약주문조회.md) | `(미국) TTTT3039R (일본/중국/홍콩/베트남) TTTS3014R` | `-` | `GET /uapi/overseas-stock/v1/trading/order-resv-list` |
| [해외주식 주문](해외주식_주문-계좌/해외주식_주문.md) | `(미국매수) TTTT1002U  (미국매도) TTTT1006U (아시아 국가 하단 규격서 참고)` | `(미국매수) VTTT1002U  (미국매도) VTTT1001U  (아시아 국가 하단 규격서 참고)` | `POST /uapi/overseas-stock/v1/trading/order` |
| [해외주식 예약주문접수취소](해외주식_주문-계좌/해외주식_예약주문접수취소.md) | `(미국 예약주문 취소접수) TTTT3017U (아시아국가 미제공)` | `(미국 예약주문 취소접수) VTTT3017U (아시아국가 미제공)` | `POST /uapi/overseas-stock/v1/trading/order-resv-ccnl` |
| [해외주식 지정가주문번호조회](해외주식_주문-계좌/해외주식_지정가주문번호조회.md) | `TTTS6058R` | `-` | `GET /uapi/overseas-stock/v1/trading/algo-ordno` |
| [해외증거금 통화별조회](해외주식_주문-계좌/해외증거금_통화별조회.md) | `TTTC2101R` | `-` | `GET /uapi/overseas-stock/v1/trading/foreign-margin` |

## [해외주식] 기본시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [해외주식 체결추이](해외주식_기본시세/해외주식_체결추이.md) | `HHDFS76200300` | `-` | `GET /uapi/overseas-price/v1/quotations/inquire-ccnl` |
| [해외주식 기간별시세](해외주식_기본시세/해외주식_기간별시세.md) | `HHDFS76240000` | `HHDFS76240000` | `GET /uapi/overseas-price/v1/quotations/dailyprice` |
| [해외결제일자조회](해외주식_기본시세/해외결제일자조회.md) | `CTOS5011R` | `-` | `GET /uapi/overseas-stock/v1/quotations/countries-holiday` |
| [해외주식 현재체결가](해외주식_기본시세/해외주식_현재체결가.md) | `HHDFS00000300` | `HHDFS00000300` | `GET /uapi/overseas-price/v1/quotations/price` |
| [해외주식 복수종목 시세조회](해외주식_기본시세/해외주식_복수종목_시세조회.md) | `HHDFS76220000` | `-` | `GET /uapi/overseas-price/v1/quotations/multprice` |
| [해외주식조건검색](해외주식_기본시세/해외주식조건검색.md) | `HHDFS76410000` | `HHDFS76410000` | `GET /uapi/overseas-price/v1/quotations/inquire-search` |
| [해외주식 상품기본정보](해외주식_기본시세/해외주식_상품기본정보.md) | `CTPF1702R` | `-` | `GET /uapi/overseas-price/v1/quotations/search-info` |
| [해외지수분봉조회](해외주식_기본시세/해외지수분봉조회.md) ✅ | `FHKST03030200` | `-` | `GET /uapi/overseas-price/v1/quotations/inquire-time-indexchartprice` |
| [해외주식분봉조회](해외주식_기본시세/해외주식분봉조회.md) | `HHDFS76950200` | `-` | `GET /uapi/overseas-price/v1/quotations/inquire-time-itemchartprice` |
| [해외주식 현재가상세](해외주식_기본시세/해외주식_현재가상세.md) | `HHDFS76200200` | `-` | `GET /uapi/overseas-price/v1/quotations/price-detail` |
| [해외주식 업종별코드조회](해외주식_기본시세/해외주식_업종별코드조회.md) | `HHDFS76370100` | `-` | `GET /uapi/overseas-price/v1/quotations/industry-price` |
| [해외주식 종목/지수/환율기간별시세(일/주/월/년)](해외주식_기본시세/해외주식_종목-지수-환율기간별시세(일-주-월-년).md) | `FHKST03030100` | `FHKST03030100` | `GET /uapi/overseas-price/v1/quotations/inquire-daily-chartprice` |
| [해외주식 업종별시세](해외주식_기본시세/해외주식_업종별시세.md) | `HHDFS76370000` | `-` | `GET /uapi/overseas-price/v1/quotations/industry-theme` |
| [해외주식 현재가 호가](해외주식_기본시세/해외주식_현재가_호가.md) | `HHDFS76200100` | `-` | `GET /uapi/overseas-price/v1/quotations/inquire-asking-price` |

## [해외주식] 시세분석

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [해외주식 거래증가율순위](해외주식_시세분석/해외주식_거래증가율순위.md) | `HHDFS76330000` | `-` | `GET /uapi/overseas-stock/v1/ranking/trade-growth` |
| [해외주식 기간별권리조회](해외주식_시세분석/해외주식_기간별권리조회.md) | `CTRGT011R` | `-` | `GET /uapi/overseas-price/v1/quotations/period-rights` |
| [해외주식 가격급등락](해외주식_시세분석/해외주식_가격급등락.md) | `HHDFS76260000` | `-` | `GET /uapi/overseas-stock/v1/ranking/price-fluct` |
| [해외주식 거래대금순위](해외주식_시세분석/해외주식_거래대금순위.md) | `HHDFS76320010` | `-` | `GET /uapi/overseas-stock/v1/ranking/trade-pbmn` |
| [해외주식 거래량급증](해외주식_시세분석/해외주식_거래량급증.md) | `HHDFS76270000` | `-` | `GET /uapi/overseas-stock/v1/ranking/volume-surge` |
| [해외주식 신고/신저가](해외주식_시세분석/해외주식_신고-신저가.md) | `HHDFS76300000` | `-` | `GET /uapi/overseas-stock/v1/ranking/new-highlow` |
| [해외주식 매수체결강도상위](해외주식_시세분석/해외주식_매수체결강도상위.md) | `HHDFS76280000` | `-` | `GET /uapi/overseas-stock/v1/ranking/volume-power` |
| [해외주식 거래회전율순위](해외주식_시세분석/해외주식_거래회전율순위.md) | `HHDFS76340000` | `-` | `GET /uapi/overseas-stock/v1/ranking/trade-turnover` |
| [해외뉴스종합(제목)](해외주식_시세분석/해외뉴스종합(제목).md) | `HHPSTH60100C1` | `-` | `GET /uapi/overseas-price/v1/quotations/news-title` |
| [당사 해외주식담보대출 가능 종목](해외주식_시세분석/당사_해외주식담보대출_가능_종목.md) | `CTLN4050R` | `-` | `GET /uapi/overseas-price/v1/quotations/colable-by-company` |
| [해외주식 시가총액순위](해외주식_시세분석/해외주식_시가총액순위.md) | `HHDFS76350100` | `-` | `GET /uapi/overseas-stock/v1/ranking/market-cap` |
| [해외속보(제목)](해외주식_시세분석/해외속보(제목).md) | `FHKST01011801` | `-` | `GET /uapi/overseas-price/v1/quotations/brknews-title` |
| [해외주식 상승율/하락율](해외주식_시세분석/해외주식_상승율-하락율.md) | `HHDFS76290000` | `-` | `GET /uapi/overseas-stock/v1/ranking/updown-rate` |
| [해외주식 권리종합](해외주식_시세분석/해외주식_권리종합.md) | `HHDFS78330900` | `-` | `GET /uapi/overseas-price/v1/quotations/rights-by-ice` |
| [해외주식 거래량순위](해외주식_시세분석/해외주식_거래량순위.md) | `HHDFS76310010` | `-` | `GET /uapi/overseas-stock/v1/ranking/trade-vol` |

## [해외주식] 실시간시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [해외주식 실시간호가](해외주식_실시간시세/해외주식_실시간호가.md) | `HDFSASP0` | `-` | `POST /tryitout/HDFSASP0` |
| [해외주식 지연호가(아시아)](해외주식_실시간시세/해외주식_지연호가(아시아).md) | `HDFSASP1` | `-` | `POST /tryitout/HDFSASP1` |
| [해외주식 실시간지연체결가](해외주식_실시간시세/해외주식_실시간지연체결가.md) | `HDFSCNT0` | `-` | `POST /tryitout/HDFSCNT0` |
| [해외주식 실시간체결통보](해외주식_실시간시세/해외주식_실시간체결통보.md) | `H0GSCNI0` | `H0GSCNI9` | `POST /tryitout/H0GSCNI0` |

## [해외선물옵션] 주문/계좌

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [해외선물옵션 주문](해외선물옵션_주문-계좌/해외선물옵션_주문.md) | `OTFM3001U` | `-` | `POST /uapi/overseas-futureoption/v1/trading/order` |
| [해외선물옵션 정정취소주문](해외선물옵션_주문-계좌/해외선물옵션_정정취소주문.md) | `(정정) OTFM3002U (취소) OTFM3003U` | `-` | `POST /uapi/overseas-futureoption/v1/trading/order-rvsecncl` |
| [해외선물옵션 당일주문내역조회](해외선물옵션_주문-계좌/해외선물옵션_당일주문내역조회.md) | `OTFM3116R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-ccld` |
| [해외선물옵션 미결제내역조회(잔고)](해외선물옵션_주문-계좌/해외선물옵션_미결제내역조회(잔고).md) | `OTFM1412R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-unpd` |
| [해외선물옵션 주문가능조회](해외선물옵션_주문-계좌/해외선물옵션_주문가능조회.md) | `OTFM3304R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-psamount` |
| [해외선물옵션 기간계좌손익 일별](해외선물옵션_주문-계좌/해외선물옵션_기간계좌손익_일별.md) | `OTFM3118R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-period-ccld` |
| [해외선물옵션 일별 체결내역](해외선물옵션_주문-계좌/해외선물옵션_일별_체결내역.md) | `OTFM3122R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-daily-ccld` |
| [해외선물옵션 예수금현황](해외선물옵션_주문-계좌/해외선물옵션_예수금현황.md) | `OTFM1411R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-deposit` |
| [해외선물옵션 일별 주문내역](해외선물옵션_주문-계좌/해외선물옵션_일별_주문내역.md) | `OTFM3120R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-daily-order` |
| [해외선물옵션 기간계좌거래내역](해외선물옵션_주문-계좌/해외선물옵션_기간계좌거래내역.md) | `OTFM3114R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/inquire-period-trans` |
| [해외선물옵션 증거금상세](해외선물옵션_주문-계좌/해외선물옵션_증거금상세.md) | `OTFM3115R` | `-` | `GET /uapi/overseas-futureoption/v1/trading/margin-detail` |

## [해외선물옵션] 기본시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [해외선물종목현재가](해외선물옵션_기본시세/해외선물종목현재가.md) | `HHDFC55010000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/inquire-price` |
| [해외선물종목상세](해외선물옵션_기본시세/해외선물종목상세.md) | `HHDFC55010100` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/stock-detail` |
| [해외선물 호가](해외선물옵션_기본시세/해외선물_호가.md) | `HHDFC86000000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/inquire-asking-price` |
| [해외선물 분봉조회](해외선물옵션_기본시세/해외선물_분봉조회.md) | `HHDFC55020400` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/inquire-time-futurechartprice` |
| [해외선물 체결추이(틱)](해외선물옵션_기본시세/해외선물_체결추이(틱).md) | `HHDFC55020200` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/tick-ccnl` |
| [해외선물 체결추이(주간)](해외선물옵션_기본시세/해외선물_체결추이(주간).md) | `HHDFC55020000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/weekly-ccnl` |
| [해외선물 체결추이(일간)](해외선물옵션_기본시세/해외선물_체결추이(일간).md) | `HHDFC55020100` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/daily-ccnl` |
| [해외선물 체결추이(월간)](해외선물옵션_기본시세/해외선물_체결추이(월간).md) | `HHDFC55020300` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/monthly-ccnl` |
| [해외선물 상품기본정보](해외선물옵션_기본시세/해외선물_상품기본정보.md) | `HHDFC55200000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/search-contract-detail` |
| [해외선물 미결제추이](해외선물옵션_기본시세/해외선물_미결제추이.md) | `HHDDB95030000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/investor-unpd-trend` |
| [해외옵션종목현재가](해외선물옵션_기본시세/해외옵션종목현재가.md) | `HHDFO55010000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/opt-price` |
| [해외옵션종목상세](해외선물옵션_기본시세/해외옵션종목상세.md) | `HHDFO55010100` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/opt-detail` |
| [해외옵션 호가](해외선물옵션_기본시세/해외옵션_호가.md) | `HHDFO86000000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/opt-asking-price` |
| [해외옵션 분봉조회](해외선물옵션_기본시세/해외옵션_분봉조회.md) | `HHDFO55020400` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/inquire-time-optchartprice` |
| [해외옵션 체결추이(틱)](해외선물옵션_기본시세/해외옵션_체결추이(틱).md) | `HHDFO55020200` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/opt-tick-ccnl` |
| [해외옵션 체결추이(일간)](해외선물옵션_기본시세/해외옵션_체결추이(일간).md) | `HHDFO55020100` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/opt-daily-ccnl` |
| [해외옵션 체결추이(주간)](해외선물옵션_기본시세/해외옵션_체결추이(주간).md) | `HHDFO55020000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/opt-weekly-ccnl` |
| [해외옵션 체결추이(월간)](해외선물옵션_기본시세/해외옵션_체결추이(월간).md) | `HHDFO55020300` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/opt-monthly-ccnl` |
| [해외옵션 상품기본정보](해외선물옵션_기본시세/해외옵션_상품기본정보.md) | `HHDFO55200000` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/search-opt-detail` |
| [해외선물옵션 장운영시간](해외선물옵션_기본시세/해외선물옵션_장운영시간.md) | `OTFM2229R` | `-` | `GET /uapi/overseas-futureoption/v1/quotations/market-time` |

## [해외선물옵션]실시간시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [해외선물옵션 실시간체결가](해외선물옵션실시간시세/해외선물옵션_실시간체결가.md) | `HDFFF020` | `-` | `POST /tryitout/HDFFF020` |
| [해외선물옵션 실시간호가](해외선물옵션실시간시세/해외선물옵션_실시간호가.md) | `HDFFF010` | `-` | `POST /tryitout/HDFFF010` |
| [해외선물옵션 실시간주문내역통보](해외선물옵션실시간시세/해외선물옵션_실시간주문내역통보.md) | `HDFFF1C0` | `-` | `POST /tryitout/HDFFF1C0` |
| [해외선물옵션 실시간체결내역통보](해외선물옵션실시간시세/해외선물옵션_실시간체결내역통보.md) | `HDFFF2C0` | `-` | `POST /tryitout/HDFFF2C0` |

## [장내채권] 주문/계좌

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [장내채권 매수주문](장내채권_주문-계좌/장내채권_매수주문.md) | `TTTC0952U` | `-` | `POST /uapi/domestic-bond/v1/trading/buy` |
| [장내채권 매도주문](장내채권_주문-계좌/장내채권_매도주문.md) | `TTTC0958U` | `-` | `POST /uapi/domestic-bond/v1/trading/sell` |
| [장내채권 정정취소주문](장내채권_주문-계좌/장내채권_정정취소주문.md) | `TTTC0953U` | `-` | `POST /uapi/domestic-bond/v1/trading/order-rvsecncl` |
| [채권정정취소가능주문조회](장내채권_주문-계좌/채권정정취소가능주문조회.md) | `CTSC8035R` | `-` | `GET /uapi/domestic-bond/v1/trading/inquire-psbl-rvsecncl` |
| [장내채권 주문체결내역](장내채권_주문-계좌/장내채권_주문체결내역.md) | `CTSC8013R` | `-` | `GET /uapi/domestic-bond/v1/trading/inquire-daily-ccld` |
| [장내채권 잔고조회](장내채권_주문-계좌/장내채권_잔고조회.md) | `CTSC8407R` | `-` | `GET /uapi/domestic-bond/v1/trading/inquire-balance` |
| [장내채권 매수가능조회](장내채권_주문-계좌/장내채권_매수가능조회.md) | `TTTC8910R` | `-` | `GET /uapi/domestic-bond/v1/trading/inquire-psbl-order` |

## [장내채권] 기본시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [장내채권현재가(호가)](장내채권_기본시세/장내채권현재가(호가).md) | `FHKBJ773401C0` | `-` | `GET /uapi/domestic-bond/v1/quotations/inquire-asking-price` |
| [장내채권현재가(시세)](장내채권_기본시세/장내채권현재가(시세).md) | `FHKBJ773400C0` | `-` | `GET /uapi/domestic-bond/v1/quotations/inquire-price` |
| [장내채권현재가(체결)](장내채권_기본시세/장내채권현재가(체결).md) | `FHKBJ773403C0` | `-` | `GET /uapi/domestic-bond/v1/quotations/inquire-ccnl` |
| [장내채권현재가(일별)](장내채권_기본시세/장내채권현재가(일별).md) | `FHKBJ773404C0` | `-` | `GET /uapi/domestic-bond/v1/quotations/inquire-daily-price` |
| [장내채권 기간별시세(일)](장내채권_기본시세/장내채권_기간별시세(일).md) | `FHKBJ773701C0` | `-` | `GET /uapi/domestic-bond/v1/quotations/inquire-daily-itemchartprice` |
| [장내채권 평균단가조회](장내채권_기본시세/장내채권_평균단가조회.md) | `CTPF2005R` | `-` | `GET /uapi/domestic-bond/v1/quotations/avg-unit` |
| [장내채권 발행정보](장내채권_기본시세/장내채권_발행정보.md) | `CTPF1101R` | `-` | `GET /uapi/domestic-bond/v1/quotations/issue-info` |
| [장내채권 기본조회](장내채권_기본시세/장내채권_기본조회.md) | `CTPF1114R` | `-` | `GET /uapi/domestic-bond/v1/quotations/search-bond-info` |

## [장내채권] 실시간시세

| API | 실전 TR_ID | 모의 TR_ID | 요청 |
|---|---|---|---|
| [일반채권 실시간체결가](장내채권_실시간시세/일반채권_실시간체결가.md) | `H0BJCNT0` | `-` | `POST /tryitout/H0BJCNT0` |
| [일반채권 실시간호가](장내채권_실시간시세/일반채권_실시간호가.md) | `H0BJCNT0` | `-` | `POST /tryitout/H0BJASP0` |
| [채권지수 실시간체결가](장내채권_실시간시세/채권지수_실시간체결가.md) | `H0BICNT0` | `-` | `POST /tryitout/H0BICNT0` |
