# ELW 변동성 추이(일별)

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-178` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/volatility-trend-daily`
- TR_ID: 실전 `FHPEW02840200` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 변동성 추이(일별) API입니다.
한국투자 HTS(eFriend Plus) > [0284] ELW 변동성 추이 화면의 "일별" 변동성 추이 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02840200 |
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
| stck_bsop_date | 주식 영업 일자 | string | Y | 8 |  |
| elw_prpr | ELW 현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 8 |  |
| elw_oprc | elw 시가2 | string | Y | 10 |  |
| elw_hgpr | elw 최고가 | string | Y | 10 |  |
| elw_lwpr | elw 최저가 | string | Y | 10 |  |
| acml_vol | 누적 거래량 | string | Y | 18 |  |
| d10_hist_vltl | 10일 역사적 변동성 | string | Y | 11 |  |
| d20_hist_vltl | 20일 역사적 변동성 | string | Y | 11 |  |
| d30_hist_vltl | 30일 역사적 변동성 | string | Y | 11 |  |
| d60_hist_vltl | 60일 역사적 변동성 | string | Y | 11 |  |
| d90_hist_vltl | 90일 역사적 변동성 | string | Y | 11 |  |
| hts_ints_vltl | HTS 내재 변동성 | string | Y | 11 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_INPUT_ISCD:57JS61
```

## Response Example

```json
{
    "output": [
        {
            "stck_bsop_date": "20240503",
            "elw_prpr": "5",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "elw_oprc": "5",
            "elw_hgpr": "5",
            "elw_lwpr": "5",
            "acml_vol": "76410",
            "d10_hist_vltl": "21.05",
            "d20_hist_vltl": "20.32",
            "d30_hist_vltl": "19.58",
            "d60_hist_vltl": "17.91",
            "d90_hist_vltl": "18.33",
            "hts_ints_vltl": "23.37"
        },
        {
            "stck_bsop_date": "20240502",
            "elw_prpr": "5",
            "prdy_vrss": "-15",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-75.00",
            "elw_oprc": "20",
            "elw_hgpr": "20",
            "elw_lwpr": "5",
            "acml_vol": "6509850",
            "d10_hist_vltl": "23.00",
            "d20_hist_vltl": "21.31",
            "d30_hist_vltl": "20.17",
            "d60_hist_vltl": "19.07",
            "d90_hist_vltl": "18.33",
            "hts_ints_vltl": "20.16"
        },
        {
            "stck_bsop_date": "20240430",
            "elw_prpr": "20",
            "prdy_vrss": "-5",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-20.00",
            "elw_oprc": "25",
            "elw_hgpr": "25",
            "elw_lwpr": "15",
            "acml_vol": "1839420",
            "d10_hist_vltl": "23.69",
            "d20_hist_vltl": "21.39",
            "d30_hist_vltl": "20.42",
            "d60_hist_vltl": "19.43",
            "d90_hist_vltl": "18.33",
            "hts_ints_vltl": "23.45"
        },
        {
            "stck_bsop_date": "20240429",
            "elw_prpr": "25",
            "prdy_vrss": "-40",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-61.54",
            "elw_oprc": "35",
            "elw_hgpr": "40",
            "elw_lwpr": "25",
            "acml_vol": "3301030",
            "d10_hist_vltl": "26.85",
            "d20_hist_vltl": "21.38",
            "d30_hist_vltl": "20.48",
            "d60_hist_vltl": "19.44",
            "d90_hist_vltl": "18.37",
            "hts_ints_vltl": "21.85"
        },
        {
            "stck_bsop_date": "20240426",
            "elw_prpr": "65",
            "prdy_vrss": "-70",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-51.85",
            "elw_oprc": "65",
            "elw_hgpr": "95",
            "elw_lwpr": "50",
            "acml_vol": "11476800
... (생략)
```
