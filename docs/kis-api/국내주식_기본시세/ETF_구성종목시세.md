# ETF 구성종목시세

- 메뉴: [국내주식] 기본시세
- API ID: `국내주식-073` · 통신방식: REST
- 요청: `GET /uapi/etfetn/v1/quotations/inquire-component-stock-price`
- TR_ID: 실전 `FHKST121600C0` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ETF 구성종목시세 API입니다. 
한국투자 HTS(eFriend Plus) > [0245] ETF/ETN 구성종목시세 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHKST121600C0 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (J) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | 종목코드 |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | Unique key( 11216 ) |

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
| stck_prpr | 주식 현재가 | string | Y | 10 |  |
| prdy_vrss | 전일 대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일 대비 부호 | string | Y | 1 |  |
| prdy_ctrt | 전일 대비율 | string | Y | 82 |  |
| etf_cnfg_issu_avls | ETF구성종목시가총액 | string | Y | 18 |  |
| nav | NAV | string | Y | 112 |  |
| nav_prdy_vrss_sign | NAV 전일 대비 부호 | string | Y | 1 |  |
| nav_prdy_vrss | NAV 전일 대비 | string | Y | 112 |  |
| nav_prdy_ctrt | NAV 전일 대비율 | string | Y | 84 |  |
| etf_ntas_ttam | ETF 순자산 총액 | string | Y | 22 |  |
| prdy_clpr_nav | NAV전일종가 | string | Y | 112 |  |
| oprc_nav | NAV시가 | string | Y | 112 |  |
| hprc_nav | NAV고가 | string | Y | 112 |  |
| lprc_nav | NAV저가 | string | Y | 112 |  |
| etf_cu_unit_scrt_cnt | ETF CU 단위 증권 수 | string | Y | 18 |  |
| etf_cnfg_issu_cnt | ETF 구성 종목 수 | string | Y | 18 |  |
| **output2** | 응답상세 | object array | Y |  | array |
| stck_shrn_iscd | 주식 단축 종목코드 | string | Y | 9 |  |
| hts_kor_isnm | HTS 한글 종목명 | string | Y | 40 |  |
| stck_prpr | 주식 현재가 | string | Y | 10 |  |
| prdy_vrss | 전일 대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일 대비 부호 | string | Y | 1 |  |
| prdy_ctrt | 전일 대비율 | string | Y | 82 |  |
| acml_vol | 누적 거래량 | string | Y | 18 |  |
| acml_tr_pbmn | 누적 거래 대금 | string | Y | 18 |  |
| tday_rsfl_rate | 당일 등락 비율 | string | Y | 52 |  |
| prdy_vrss_vol | 전일 대비 거래량 | string | Y | 18 |  |
| tr_pbmn_tnrt | 거래대금회전율 | string | Y | 82 |  |
| hts_avls | HTS 시가총액 | string | Y | 18 |  |
| etf_cnfg_issu_avls | ETF구성종목시가총액 | string | Y | 18 |  |
| etf_cnfg_issu_rlim | ETF구성종목비중 | string | Y | 72 |  |
| etf_vltn_amt | ETF구성종목내평가금액 | string | Y | 18 |  |

## Request Example (Python)

```text
fid_cond_mrkt_div_code:J
fid_input_iscd:069500
fid_cond_scr_div_code:11216
```

## Response Example

```json
{
    "output1": {
        "stck_prpr": "37195",
        "prdy_vrss": "-365",
        "prdy_vrss_sign": "5",
        "prdy_ctrt": "-0.97",
        "etf_cnfg_issu_avls": "184153",
        "nav": "37301.11",
        "nav_prdy_vrss_sign": "5",
        "nav_prdy_vrss": "-347.36",
        "nav_prdy_ctrt": "-0.92",
        "etf_ntas_ttam": "68256",
        "prdy_clpr_nav": "37648.47",
        "oprc_nav": "37653.39",
        "hprc_nav": "37720.17",
        "lprc_nav": "37223.93",
        "etf_cu_unit_scrt_cnt": "50000",
        "etf_cnfg_issu_cnt": "201"
    },
    "output2": [
        {
            "stck_shrn_iscd": "005930",
            "hts_kor_isnm": "삼성전자",
            "stck_prpr": "83700",
            "prdy_vrss": "-400",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-0.48",
            "acml_vol": "16967184",
            "acml_tr_pbmn": "1421776834400",
            "tday_rsfl_rate": "2.02",
            "prdy_vrss_vol": "-8570824",
            "tr_pbmn_tnrt": "0.28",
            "hts_avls": "4996708",
            "etf_cnfg_issu_avls": "601300800",
            "etf_cnfg_issu_rlim": "32.65",
            "etf_vltn_amt": "604174400"
        },
        {
            "stck_shrn_iscd": "000660",
            "hts_kor_isnm": "SK하이닉스",
            "stck_prpr": "187400",
            "prdy_vrss": "-1000",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-0.53",
            "acml_vol": "3042349",
            "acml_tr_pbmn": "575151315700",
            "tday_rsfl_rate": "2.34",
            "prdy_vrss_vol": "-1055882",
            "tr_pbmn_tnrt": "0.42",
            "hts_avls": "1364276",
            "etf_cnfg_issu_avls": "160039600",
            "etf_cnfg_issu_rlim": "8.69",
            "etf_vltn_amt": "160893600"
        },
        {
            "stck_shrn_iscd": "005380",
            "hts_kor_isnm": "현대차",
            "stck_prpr": "238000",
            "prdy_vrss": "-3000",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-1.24",
            "acml_vol": "993944",
            "acml_tr_pbmn": "237608070000",
            "tday_rsfl_rate": "1.87",
            "prdy_vrss_vol": "-859847",
            "tr_pbmn_tnrt": "0.47",
            "hts_avls": "503445",
            "etf_cnfg_issu_avls": "50694000",
            "etf_cnfg_issu_rlim": "2.75",
            "etf_vltn_amt": "51333000"
        },
        {
            "stck_shrn_iscd": "068270",
            "hts_kor_isnm": "셀트리온",
            "stck_prpr": "182200",
            "prdy_vrss": 
... (생략)
```
