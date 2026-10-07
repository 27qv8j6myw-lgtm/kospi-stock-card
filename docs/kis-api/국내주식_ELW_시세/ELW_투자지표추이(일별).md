# ELW 투자지표추이(일별)

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-173` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/indicator-trend-daily`
- TR_ID: 실전 `FHPEW02740200` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 투자지표추이(일별) API입니다.
한국투자 HTS(eFriend Plus) > [0274] ELW 투자지표추이 화면에서 "일자별 비교추이" 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02740200 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 시장분류코드 | string | Y | 2 | W |
| FID_INPUT_ISCD | 종콕코드 | string | Y | 12 | ex. 57K281 |

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
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| lvrg_val | 레버리지값 | string | Y | 114 |  |
| gear | 기어링 | string | Y | 84 |  |
| tmvl_val | 시간가치값 | string | Y | 132 |  |
| invl_val | 내재가치값 | string | Y | 132 |  |
| prit | 패리티 | string | Y | 112 |  |
| elw_oprc | ELW시가2 | string | Y | 10 |  |
| elw_hgpr | ELW최고가 | string | Y | 10 |  |
| elw_lwpr | ELW최저가 | string | Y | 10 |  |
| apprch_rate | 접근도 | string | Y | 112 |  |

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
            "stck_bsop_date": "20240503",
            "elw_prpr": "40",
            "prdy_vrss_sign": "5",
            "prdy_vrss": "-5",
            "prdy_ctrt": "-11.11",
            "acml_vol": "1000020",
            "lvrg_val": "-11.0377",
            "gear": "19.45",
            "tmvl_val": "18.00",
            "invl_val": "22.00",
            "prit": "102.82",
            "elw_oprc": "40",
            "elw_hgpr": "40",
            "elw_lwpr": "35",
            "apprch_rate": "0.00"
        },
        {
            "stck_bsop_date": "20240502",
            "elw_prpr": "45",
            "prdy_vrss_sign": "3",
            "prdy_vrss": "0",
            "prdy_ctrt": "0.00",
            "acml_vol": "789280",
            "lvrg_val": "-9.5810",
            "gear": "17.33",
            "tmvl_val": "25.00",
            "invl_val": "20.00",
            "prit": "102.56",
            "elw_oprc": "45",
            "elw_hgpr": "45",
            "elw_lwpr": "35",
            "apprch_rate": "0.00"
        },
        {
            "stck_bsop_date": "20240430",
            "elw_prpr": "45",
            "prdy_vrss_sign": "5",
            "prdy_vrss": "-5",
            "prdy_ctrt": "-10.00",
            "acml_vol": "62090",
            "lvrg_val": "-10.0683",
            "gear": "17.22",
            "tmvl_val": "20.00",
            "invl_val": "25.00",
            "prit": "103.22",
            "elw_oprc": "50",
            "elw_hgpr": "50",
            "elw_lwpr": "45",
            "apprch_rate": "0.00"
        },...
        {
            "stck_bsop_date": "20240117",
            "elw_prpr": "0",
            "prdy_vrss_sign": "0",
            "prdy_vrss": "0",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "lvrg_val": "-0.0000",
            "gear": "0.00",
            "tmvl_val": "-90.00",
            "invl_val": "90.00",
            "prit": "0.00",
            "elw_oprc": "0",
            "elw_hgpr": "0",
            "elw_lwpr": "0",
            "apprch_rate": "0.00"
        }
    ],
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "msg1": "정상처리 되었습니다."
}
```
