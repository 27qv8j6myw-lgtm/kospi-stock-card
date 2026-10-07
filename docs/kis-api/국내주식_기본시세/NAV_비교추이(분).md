# NAV 비교추이(분)

- 메뉴: [국내주식] 기본시세
- API ID: `v1_국내주식-070` · 통신방식: REST
- 요청: `GET /uapi/etfetn/v1/quotations/nav-comparison-time-trend`
- TR_ID: 실전 `FHPST02440100` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

NAV 비교추이(분) API입니다.
한국투자 HTS(eFriend Plus) > [0244] ETF/ETN 비교추이(NAV/IIV) 좌측 화면 "분별" 비교추이 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.
실전계좌의 경우, 한 번의 호출에 최근 30건까지 확인 가능합니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPST02440100 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| fid_hour_cls_code | FID 시간 구분 코드 | string | Y | 5 | 1분 :60, 3분: 180 … 120분:7200 |
| fid_cond_mrkt_div_code | FID 조건 시장 분류 코드 | string | Y | 2 | E - 고정값 |
| fid_input_iscd | FID 입력 종목코드 | string | Y | 12 | 종목코드 |

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
| bsop_hour | 영업 시간 | string | Y | 6 |  |
| nav | NAV | string | Y | 112 |  |
| nav_prdy_vrss_sign | NAV 전일 대비 부호 | string | Y | 1 |  |
| nav_prdy_vrss | NAV 전일 대비 | string | Y | 112 |  |
| nav_prdy_ctrt | NAV 전일 대비율 | string | Y | 84 |  |
| nav_vrss_prpr | NAV 대비 현재가 | string | Y | 112 |  |
| dprt | 괴리율 | string | Y | 82 |  |
| stck_prpr | 주식 현재가 | string | Y | 10 |  |
| prdy_vrss | 전일 대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일 대비 부호 | string | Y | 1 |  |
| prdy_ctrt | 전일 대비율 | string | Y | 82 |  |
| acml_vol | 누적 거래량 | string | Y | 18 |  |
| cntg_vol | 체결 거래량 | string | Y | 18 |  |

## Request Example (Python)

```json
{
"fid_cond_mrkt_div_code":"E",
"fid_input_iscd":"069500",
"fid_hour_cls_code":"60"
}
```

## Response Example

```json
{
    "output": [
        {
            "bsop_hour": "153000",
            "nav": "36127.30",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrss": "91.08",
            "nav_prdy_ctrt": "0.25",
            "nav_vrss_prpr": "-37.30",
            "dprt": "-0.10",
            "stck_prpr": "36090",
            "prdy_vrss": "110",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "0.31",
            "acml_vol": "3714732",
            "cntg_vol": "93993"
        },
        {
            "bsop_hour": "152900",
            "nav": "36170.22",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrss": "134.00",
            "nav_prdy_ctrt": "0.37",
            "nav_vrss_prpr": "-60.22",
            "dprt": "-0.17",
            "stck_prpr": "36110",
            "prdy_vrss": "130",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "0.36",
            "acml_vol": "3620739",
            "cntg_vol": "46"
        },
        {
            "bsop_hour": "152800",
            "nav": "36170.22",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrss": "134.00",
            "nav_prdy_ctrt": "0.37",
            "nav_vrss_prpr": "-60.22",
            "dprt": "-0.17",
            "stck_prpr": "36110",
            "prdy_vrss": "130",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "0.36",
            "acml_vol": "3620739",
            "cntg_vol": "46"
        },
        {
            "bsop_hour": "152700",
            "nav": "36170.22",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrss": "134.00",
            "nav_prdy_ctrt": "0.37",
            "nav_vrss_prpr": "-60.22",
            "dprt": "-0.17",
            "stck_prpr": "36110",
            "prdy_vrss": "130",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "0.36",
            "acml_vol": "3620739",
            "cntg_vol": "46"
        },
        {
            "bsop_hour": "152600",
            "nav": "36170.22",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrss": "134.00",
            "nav_prdy_ctrt": "0.37",
            "nav_vrss_prpr": "-60.22",
            "dprt": "-0.17",
            "stck_prpr": "36110",
            "prdy_vrss": "130",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "0.36",
            "acml_vol": "3620739",
            "cntg_vol": "46"
        },
        {
            "bsop_hour": "152500",
            "nav": "36170.22",
            "nav_prdy_vrss_sign": "2",
            "nav_prdy_vrs
... (생략)
```
