# ELW 민감도 추이(일별)

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-176` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/sensitivity-trend-daily`
- TR_ID: 실전 `FHPEW02830200` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 민감도 추이(일별) API입니다.
한국투자 HTS(eFriend Plus) > [0283] ELW 민감도 추이 화면의 "일자별" 민감도추이 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02830200 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (W) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | ex)(58J438(KBJ438삼성전자풋) |

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
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| hts_thpr | HTS이론가 | string | Y | 112 |  |
| delta_val | 델타값 | string | Y | 114 |  |
| gama | 감마 | string | Y | 84 |  |
| theta | 세타 | string | Y | 84 |  |
| vega | 베가 | string | Y | 84 |  |
| rho | 로우 | string | Y | 84 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_INPUT_ISCD:57K281
```

## Response Example

```json
{
    "output": [
        {
            "stck_bsop_date": "20240507",
            "elw_prpr": "25",
            "prdy_vrss": "-20",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-44.44",
            "hts_thpr": "20.39",
            "delta_val": "-0.4034",
            "gama": "0.0000",
            "theta": "0.5843",
            "vega": "0.9954",
            "rho": "-0.3529"
        },
        {
            "stck_bsop_date": "20240503",
            "elw_prpr": "45",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "hts_thpr": "39.43",
            "delta_val": "-0.5792",
            "gama": "0.0000",
            "theta": "0.5531",
            "vega": "0.9786",
            "rho": "-0.5143"
        },
        {
            "stck_bsop_date": "20240502",
            "elw_prpr": "45",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "hts_thpr": "37.16",
            "delta_val": "-0.5529",
            "gama": "0.0000",
            "theta": "0.5859",
            "vega": "1.0136",
            "rho": "-0.5143"
        },
        {
            "stck_bsop_date": "20240430",
            "elw_prpr": "45",
            "prdy_vrss": "-5",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-10.00",
            "hts_thpr": "39.30",
            "delta_val": "-0.5847",
            "gama": "0.0000",
            "theta": "0.4979",
            "vega": "1.0113",
            "rho": "-0.5579"
        },
        {
            "stck_bsop_date": "20240429",
            "elw_prpr": "50",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "hts_thpr": "44.66",
            "delta_val": "-0.6211",
            "gama": "0.0000",
            "theta": "0.4599",
            "vega": "0.9938",
            "rho": "-0.6106"
        },
        {
            "stck_bsop_date": "20240426",
            "elw_prpr": "50",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "hts_thpr": "44.96",
            "delta_val": "-0.6202",
            "gama": "0.0000",
            "theta": "0.4439",
            "vega": "1.0115",
            "rho": "-0.6308"
        },
        {
            "stck_bsop_date": "20240425",
            "elw_prpr": "50",
            "prdy_vrss": "5",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "11.11",
            "h
... (생략)
```
