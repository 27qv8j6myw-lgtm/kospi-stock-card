# ELW 투자지표추이(분별)

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-174` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/indicator-trend-minute`
- TR_ID: 실전 `FHPEW02740300` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 투자지표추이(분별) API입니다.
한국투자 HTS(eFriend Plus) > [0274] ELW 투자지표추이 화면 데이터의 "분별 비교추이" 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02740300 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (W) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | ex) 58J297(KBJ297삼성전자콜) |
| FID_HOUR_CLS_CODE | 시간구분코드 | string | Y | 5 | '60(1분), 180(3분), 300(5분), 600(10분), 1800(30분), 3600(60분), 7200(60분)<br>' |
| FID_PW_DATA_INCU_YN | 과거데이터 포함 여부 | string | Y | 2 | N(과거데이터포함X),Y(과거데이터포함O) |

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
| stck_bsop_date | 주식영업일자 | string | Y | 8 |  |
| stck_cntg_hour | 주식체결시간 | string | Y | 6 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| elw_oprc | ELW시가2 | string | Y | 10 |  |
| elw_hgpr | ELW최고가 | string | Y | 10 |  |
| elw_lwpr | ELW최저가 | string | Y | 10 |  |
| lvrg_val | 레버리지값 | string | Y | 114 |  |
| gear | 기어링 | string | Y | 84 |  |
| prmm_val | 프리미엄값 | string | Y | 114 |  |
| invl_val | 내재가치값 | string | Y | 132 |  |
| prit | 패리티 | string | Y | 112 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| cntg_vol | 체결거래량 | string | Y | 18 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_INPUT_ISCD:57K281
FID_HOUR_CLS_CODE:60
FID_PW_DATA_INCU_YN:Y
```

## Response Example

```json
{
    "output": [
        {
            "stck_bsop_date": "20240503",
            "stck_cntg_hour": "131900",
            "elw_prpr": "40",
            "elw_oprc": "40",
            "elw_hgpr": "40",
            "elw_lwpr": "40",
            "lvrg_val": "-10.8818",
            "gear": "19.5700",
            "prmm_val": "5.1086",
            "invl_val": "17.00",
            "prit": "102.17",
            "acml_vol": "827720",
            "cntg_vol": "55700"
        },
        {
            "stck_bsop_date": "20240503",
            "stck_cntg_hour": "131800",
            "elw_prpr": "40",
            "elw_oprc": "40",
            "elw_hgpr": "40",
            "elw_lwpr": "40",
            "lvrg_val": "19.5700",
            "gear": "33.5300",
            "prmm_val": "5.1086",
            "invl_val": "17.00",
            "prit": "-10.72",
            "acml_vol": "772020",
            "cntg_vol": "0"
        },
        {
            "stck_bsop_date": "20240503",
            "stck_cntg_hour": "131700",
            "elw_prpr": "40",
            "elw_oprc": "40",
            "elw_hgpr": "40",
            "elw_lwpr": "40",
            "lvrg_val": "19.5700",
            "gear": "33.5300",
            "prmm_val": "5.1086",
            "invl_val": "17.00",
            "prit": "-10.72",
            "acml_vol": "772020",
            "cntg_vol": "0"
        },
        {
            "stck_bsop_date": "20240503",
            "stck_cntg_hour": "131600",
            "elw_prpr": "40",
            "elw_oprc": "40",
            "elw_hgpr": "40",
            "elw_lwpr": "40",
            "lvrg_val": "19.5700",
            "gear": "33.5300",
            "prmm_val": "5.1086",
            "invl_val": "17.00",
            "prit": "-10.72",
            "acml_vol": "772020",
            "cntg_vol": "0"
        },
        {
            "stck_bsop_date": "20240503",
            "stck_cntg_hour": "131500",
            "elw_prpr": "40",
            "elw_oprc": "40",
            "elw_hgpr": "40",
            "elw_lwpr": "40",
            "lvrg_val": "19.5700",
            "gear": "33.5300",
            "prmm_val": "5.1086",
            "invl_val": "17.00",
            "prit": "-10.72",
            "acml_vol": "772020",
            "cntg_vol": "0"
        },
        {
            "stck_bsop_date": "20240503",
            "stck_cntg_hour": "131400",
            "elw_prpr": "40",
            "elw_oprc": "40",
            "elw_hgpr": "40",
            "elw_lwpr": "40",
            "lvrg_val": "
... (생략)
```
