# 국내주식 실시간예상체결 (NXT)

- 메뉴: [국내주식] 실시간시세
- API ID: `국내주식 실시간예상체결 (NXT)` · 통신방식: WEBSOCKET
- 요청: `POST /tryitout/H0NXANC0`
- TR_ID: 실전 `H0NXANC0` · 모의 `-`
- 도메인: 실전 ws://ops.koreainvestment.com:21000 · 모의 -

## 개요

국내주식 실시간예상체결 (NXT)입니다.

아래와 같이 건별로 데이터를 수신 받게 되며,
수신받으신 데이터에 대한 처리는 ^기호를 통해 구분 처리하는 것을 권장드립니다.

0|H0NXANC0|002|

005930^085130^308000^5^-10000^-3.14^0.00^0^0^0^308000^307500^3^313469^96548452000^0^0^0^0.00^0^0^1^0.01^0.00^000000^3^0^000000^3^0^000000^3^0^20260707^00^N^3502^1437^44094^6872^0.01^0^0.00^B^^318000 ->첫 번째 건의 마지막 뒤 dummy 데이터 318000 추가 

^005930^085130^308000^5^-10000^-3.14^0.00^0^0^0^308000^307500^1^313470^96548760000^0^0^0^0.00^0^0^1^0.01^0.00^000000^3^0^000000^3^0^000000^3^0^20260707^00^N^3531^1437^44123^6872^0.01^0^0.00^B^^318000 -> 번째 건의 마지막 뒤 dummy 데이터 318000 추가

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| approval_key | 웹소켓 접속키 | string | N | 286 | 실시간 (웹소켓) 접속키 발급 API(/oauth2/Approval)를 사용하여 발급받은 웹소켓 접속키 |
| tr_type | 거래타입 | string | N | 1 | 1 : 등록<br>2 : 해제 |

## Request Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 2 | H0NXANC0 : 국내주식 실시간예상체결 (NXT) |
| tr_key | 구분값 | string | Y | 12 | 종목코드 (ex 005930 삼성전자) |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| MKSC_SHRN_ISCD | 유가증권단축종목코드 | string | Y | 9 |  |
| STCK_CNTG_HOUR | 주식체결시간 | string | Y | 6 |  |
| STCK_PRPR | 주식현재가 | string | Y | 4 |  |
| PRDY_VRSS_SIGN | 전일대비구분 | string | Y | 1 |  |
| PRDY_VRSS | 전일대비 | string | Y | 4 |  |
| PRDY_CTRT | 등락율 | string | Y | 8 |  |
| WGHN_AVRG_STCK_PRC | 가중평균주식가격 | string | Y | 8 |  |
| STCK_OPRC | 시가 | string | Y | 4 |  |
| STCK_HGPR | 고가 | string | Y | 4 |  |
| STCK_LWPR | 저가 | string | Y | 4 |  |
| ASKP1 | 매도호가 | string | Y | 4 |  |
| BIDP1 | 매수호가 | string | Y | 4 |  |
| CNTG_VOL | 거래량 | string | Y | 8 |  |
| ACML_VOL | 누적거래량 | string | Y | 8 |  |
| ACML_TR_PBMN | 누적거래대금 | string | Y | 8 |  |
| SELN_CNTG_CSNU | 매도체결건수 | string | Y | 4 |  |
| SHNU_CNTG_CSNU | 매수체결건수 | string | Y | 4 |  |
| NTBY_CNTG_CSNU | 순매수체결건수 | string | Y | 4 |  |
| CTTR | 체결강도 | string | Y | 8 |  |
| SELN_CNTG_SMTN | 총매도수량 | string | Y | 8 |  |
| SHNU_CNTG_SMTN | 총매수수량 | string | Y | 8 |  |
| CNTG_CLS_CODE | 체결구분 | string | Y | 1 |  |
| SHNU_RATE | 매수비율 | string | Y | 8 |  |
| PRDY_VOL_VRSS_ACML_VOL_RATE | 전일거래량대비등락율 | string | Y | 8 |  |
| OPRC_HOUR | 시가시간 | string | Y | 6 |  |
| OPRC_VRSS_PRPR_SIGN | 시가대비구분 | string | Y | 1 |  |
| OPRC_VRSS_PRPR | 시가대비 | string | Y | 4 |  |
| HGPR_HOUR | 최고가시간 | string | Y | 6 |  |
| HGPR_VRSS_PRPR_SIGN | 고가대비구분 | string | Y | 1 |  |
| HGPR_VRSS_PRPR | 고가대비 | string | Y | 4 |  |
| LWPR_HOUR | 최저가시간 | string | Y | 6 |  |
| LWPR_VRSS_PRPR_SIGN | 저가대비구분 | string | Y | 1 |  |
| LWPR_VRSS_PRPR | 저가대비 | string | Y | 4 |  |
| BSOP_DATE | 영업일자 | string | Y | 8 |  |
| NEW_MKOP_CLS_CODE | 신장운영구분코드 | string | Y | 2 |  |
| TRHT_YN | 거래정지여부 | string | Y | 1 |  |
| ASKP_RSQN1 | 매도호가잔량1 | string | Y | 8 |  |
| BIDP_RSQN1 | 매수호가잔량1 | string | Y | 8 |  |
| TOTAL_ASKP_RSQN | 총매도호가잔량 | string | Y | 8 |  |
| TOTAL_BIDP_RSQN | 총매수호가잔량 | string | Y | 8 |  |
| VOL_TNRT | 거래량회전율 | string | Y | 8 |  |
| PRDY_SMNS_HOUR_ACML_VOL | 전일동시간누적거래량 | string | Y | 8 |  |
| PRDY_SMNS_HOUR_ACML_VOL_RATE | 전일동시간누적거래량비율 | string | Y | 8 |  |
| HOUR_CLS_CODE | 시간구분코드 | string | Y | 1 |  |
| MRKT_TRTM_CLS_CODE | 임의종료구분코드 | string | Y | 1 |  |
| VI_STND_PRC | VI 상태값 | string | Y | 4 |  |
| dummy(사용하지 않는 필드) | dummy(사용하지 않는 필드) | number | Y | 4 | 사용하지 않는 필드입니다. |
