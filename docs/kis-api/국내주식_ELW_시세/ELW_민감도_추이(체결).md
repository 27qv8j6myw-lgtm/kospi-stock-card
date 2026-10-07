# ELW 민감도 추이(체결)

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-175` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/sensitivity-trend-ccnl`
- TR_ID: 실전 `FHPEW02830100` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 민감도 추이(체결) API입니다.
한국투자 HTS(eFriend Plus) > [0283] ELW 민감도 추이 화면 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02830100 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (W) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | ex) 58J297(KBJ297삼성전자콜) |

## Response Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | 요청한 tr_id |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Response Body

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| rt_cd | 성공 실패 여부 | string | Y | 1 |  |
| msg_cd | 응답코드 | string | Y | 8 |  |
| msg1 | 응답메세지 | string | Y | 80 |  |
| **output** | 응답상세 | object array | Y |  | array |
| stck_cntg_hour | 주식체결시간 | string | Y | 6 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| hts_thpr | hts 이론가 | string | Y | 112 |  |
| delta_val | 델타 값 | string | Y | 114 |  |
| gama | 감마 | string | Y | 84 |  |
| theta | 세타 | string | Y | 84 |  |
| vega | 베가 | string | Y | 84 |  |
| rho | 로우 | string | Y | 84 |  |
