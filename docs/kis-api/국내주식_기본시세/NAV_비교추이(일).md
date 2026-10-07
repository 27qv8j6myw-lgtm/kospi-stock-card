# NAV 비교추이(일)

- 메뉴: [국내주식] 기본시세
- API ID: `v1_국내주식-071` · 통신방식: REST
- 요청: `GET /uapi/etfetn/v1/quotations/nav-comparison-daily-trend`
- TR_ID: 실전 `FHPST02440200` · 모의 `-`
- 도메인: 실전 - · 모의 -

## 개요

NAV 비교추이(일) API입니다.
한국투자 HTS(eFriend Plus) > [0244] ETF/ETN 비교추이(NAV/IIV) 좌측 화면 "일별" 비교추이 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.
실전계좌의 경우, 한 번의 호출에 최대 100건까지 확인 가능합니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPST02440200 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| fid_cond_mrkt_div_code | FID 조건 시장 분류 코드 | string | Y | 2 | J 입력 |
| fid_input_iscd | FID 입력 종목코드 | string | Y | 12 | 종목코드 (6자리) |
| fid_input_date_1 | FID 입력 날짜1 | string | Y | 10 | 조회 시작일자 (ex. 20240101) |
| fid_input_date_2 | FID 입력 날짜2 | string | Y | 10 | 조회 종료일자 (ex. 20240220) |

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
| stck_clpr | 주식 종가 | string | Y | 10 |  |
| prdy_vrss | 전일 대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일 대비 부호 | string | Y | 1 |  |
| prdy_ctrt | 전일 대비율 | string | Y | 82 |  |
| acml_vol | 누적 거래량 | string | Y | 18 |  |
| cntg_vol | 체결 거래량 | string | Y | 18 |  |
| dprt | 괴리율 | string | Y | 82 |  |
| nav_vrss_prpr | NAV 대비 현재가 | string | Y | 112 |  |
| nav | NAV | string | Y | 112 |  |
| nav_prdy_vrss_sign | NAV 전일 대비 부호 | string | Y | 1 |  |
| nav_prdy_vrss | NAV 전일 대비 | string | Y | 112 |  |
| nav_prdy_ctrt | NAV 전일 대비율 | string | Y | 84 |  |

## Request Example (Python)

```json
{
"fid_cond_mrkt_div_code":"J",
"fid_input_iscd":"069500",
"fid_input_date_1":"20240101",
"fid_input_date_2":"20240220"
}
```

## Response Example

```json
{
    "output": [
        {
            "stck_bsop_date": "20240220",
            "stck_clpr": "35875",
            "prdy_vrss": "-425",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-1.17",
            "acml_vol": "6441149",
            "cntg_vol": "",
            "dprt": "-0.21",
            "nav_vrss_prpr": "-77.09",
            "nav": "35952.09",
            "nav_prdy_vrss_sign": "5",
            "nav_prdy_vrss": "-400.32",
            "nav_prdy_ctrt": "-1.10"
        },
        {
            "stck_bsop_date": "20240219",
            "stck_clpr": "36300",
            "prdy_vrss": "560",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "1.57",
            "acml_vol": "6673013",
            "cntg_vol": "",
            "dprt": "-0.14",
            "nav_vrss_prpr": "-52.41",
            "nav": "36352.41",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrss": "536.42",
            "nav_prdy_ctrt": "1.50"
        },
        {
            "stck_bsop_date": "20240216",
            "stck_clpr": "35740",
            "prdy_vrss": "355",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "1.00",
            "acml_vol": "7035777",
            "cntg_vol": "",
            "dprt": "-0.21",
            "nav_vrss_prpr": "-75.99",
            "nav": "35815.99",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrss": "432.75",
            "nav_prdy_ctrt": "1.22"
        },
        {
            "stck_bsop_date": "20240215",
            "stck_clpr": "35385",
            "prdy_vrss": "-50",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-0.14",
            "acml_vol": "6137814",
            "cntg_vol": "",
            "dprt": "0.00",
            "nav_vrss_prpr": "1.76",
            "nav": "35383.24",
            "nav_prdy_vrss_sign": "5",
            "nav_prdy_vrss": "-147.98",
            "nav_prdy_ctrt": "-0.42"
        },
        {
            "stck_bsop_date": "20240214",
            "stck_clpr": "35435",
            "prdy_vrss": "-490",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-1.36",
            "acml_vol": "7163970",
            "cntg_vol": "",
            "dprt": "-0.27",
            "nav_vrss_prpr": "-96.22",
            "nav": "35531.22",
            "nav_prdy_vrss_sign": "5",
            "nav_prdy_vrss": "-468.25",
            "nav_prdy_ctrt": "-1.30"
        },
        {
            "stck_bsop_date": "20240213",
            "stck_clpr": "35925",
            "prdy_vrss"
... (생략)
```
