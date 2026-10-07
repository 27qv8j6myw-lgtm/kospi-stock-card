# VI변동성완화 (통합)

- 메뉴: [국내주식] 실시간시세
- API ID: `VI변동성완화 (통합)` · 통신방식: REST
- 요청: `POST /tryitout/H0UNVIC0`
- TR_ID: 실전 `-` · 모의 `-`
- 도메인: 실전 ws://ops.koreainvestment.com:21000 · 모의 -

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | ' 	VI변동성완화_통합 H0UNVIC0' |
| tr_cont | 연속 거래 여부 | string | N | 1 | 공백 : 초기 조회 <br>N : 다음 데이터 조회 (output header의 tr_cont가 M일 경우) |

## Request Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| TR_ID | 거래ID | string | Y | 2 | '[실전/모의투자]<br>H0UNVIC0 : VI변동성완화_통합' |
| TR_KEY | 구분값 | string | Y | 12 | 종목코드 (ex 005930 삼성전자) |

## Response Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | 요청한 tr_id |
| tr_cont | 연속 거래 여부 | string | N | 1 | 공백 : 초기 조회 <br>N : 다음 데이터 조회 (output header의 tr_cont가 M일 경우) |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| BSOP_DATE | 영업일자 | string | Y | 8 |  |
| MKSC_SHRN_ISCD | 종목코드 | string | Y | 9 |  |
| HTS_KOR_ISNM | HTS한글종목명 | string | Y | 40 |  |
| MRKT_DIV_CLS_CODE | 장분류구분코드 | string | Y | 1 |  |
| VI_CLS_CODE | VI적용구분코드 | string | Y | 1 |  |
| VI_CNCL_HOUR | VI해제시각 | string | Y | 6 |  |
| CNTG_VI_HOUR | VI발동시간 | string | Y | 6 |  |
| VI_KIND_CODE | VI종류코드 | string | Y | 1 |  |
| VI_PRC | VI발동가격 | string | Y | 4 |  |
| VI_STND_PRC | 정적VI발동기준가 | string | Y | 4 |  |
| VI_DPRT | 정적VI발동괴리율 | string | Y | 8 |  |
| VI_DMC_STND_PRC | 동적VI발동기준가 | string | Y | 4 |  |
| VI_DMC_DPRT | 동적VI발동괴리율 | string | Y | 8 |  |
| VI_COUNT | VI발동횟수 | string | Y | 4 |  |
| EXCH_CLS_CODE | 거래소 구분코드 | string | Y | 1 | 1:KRX, 2:NXT |
| ETP_YN | ETP 여부 | string | Y | 1 | Y : 예 N : 아니오 |
