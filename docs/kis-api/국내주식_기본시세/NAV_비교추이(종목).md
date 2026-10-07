# NAV 비교추이(종목)

- 메뉴: [국내주식] 기본시세
- API ID: `v1_국내주식-069` · 통신방식: REST
- 요청: `GET /uapi/etfetn/v1/quotations/nav-comparison-trend`
- TR_ID: 실전 `FHPST02440000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

NAV 비교추이(종목) API입니다.
한국투자 HTS(eFriend Plus) > [0244] ETF/ETN 비교추이(NAV/IIV) 좌측 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPST02440000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건 시장 분류 코드 | string | Y | 2 | J |
| FID_INPUT_ISCD | 입력 종목코드 | string | Y | 12 | 종목코드 |

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
| **output1** | 응답상세 | object | Y |  |  |
| stck_prpr | 주식 현재가 | string | Y | 8 |  |
| prdy_vrss | 전일 대비 | string | Y | 8 |  |
| prdy_vrss_sign | 전일 대비 부호 | string | Y | 2 |  |
| prdy_ctrt | 전일 대비율 | string | Y | 4 |  |
| acml_vol | 누적 거래량 | string | Y | 12 |  |
| acml_tr_pbmn | 누적 거래 대금 | string | Y | 60 |  |
| stck_prdy_clpr | 주식 전일 종가 | string | Y | 10 |  |
| stck_oprc | 주식 시가2 | string | Y | 10 |  |
| stck_hgpr | 주식 최고가 | string | Y | 10 |  |
| stck_lwpr | 주식 최저가 | string | Y | 10 |  |
| stck_mxpr | 주식 상한가 | string | Y | 10 |  |
| stck_llam | 주식 하한가 | string | Y | 10 |  |
| **output2** | 응답상세 | object | Y |  |  |
| nav | NAV | string | Y | 11 |  |
| nav_prdy_vrss_sign | NAV 전일 대비 부호 | string | Y | 1 |  |
| nav_prdy_vrss | NAV 전일 대비 | string | Y | 11 |  |
| nav_prdy_ctrt | NAV 전일 대비율 | string | Y | 8 |  |
| prdy_clpr_nav | NAV전일종가 | string | Y | 11 |  |
| oprc_nav | NAV시가 | string | Y | 11 |  |
| hprc_nav | NAV고가 | string | Y | 11 |  |
| lprc_nav | NAV저가 | string | Y | 11 |  |

## Request Example (Python)

```json
{
"fid_cond_mrkt_div_code":"J",
"fid_input_iscd":"069500"
}
```

## Response Example

```json
{
    "output1": {
        "stck_prpr": "36090",
        "prdy_vrss": "110",
        "prdy_vrss_sign": "2",
        "prdy_ctrt": "0.31",
        "acml_vol": "3720111",
        "acml_tr_pbmn": "134826697200",
        "stck_prdy_clpr": "35980",
        "stck_oprc": "36300",
        "stck_hgpr": "36510",
        "stck_lwpr": "36040",
        "stck_mxpr": "46770",
        "stck_llam": "25190"
    },
    "output2": {
        "nav": "36127.30",
        "nav_prdy_vrss_sign": "2",
        "nav_prdy_vrss": "91.08",
        "nav_prdy_ctrt": "0.25",
        "prdy_clpr_nav": "36036.22",
        "oprc_nav": "36065.99",
        "hprc_nav": "36543.62",
        "lprc_nav": "36065.99"
    },
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "msg1": "정상처리 되었습니다."
}
```
