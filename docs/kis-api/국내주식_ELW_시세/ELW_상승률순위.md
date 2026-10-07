# ELW 상승률순위

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-167` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/ranking/updown-rate`
- TR_ID: 실전 `FHPEW02770000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 상승률순위 API입니다. 
한국투자 HTS(eFriend Plus) > [0277] ELW 상승률순위 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02770000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 사용자권한정보 | string | Y | 2 | 시장구분코드 (W) |
| FID_COND_SCR_DIV_CODE | 거래소코드 | string | Y | 5 | Unique key(20277) |
| FID_UNAS_INPUT_ISCD | 상승율/하락율 구분 | string | Y | 12 | '000000(전체), 2001(코스피200)<br>, 3003(코스닥150), 005930(삼성전자) ' |
| FID_INPUT_ISCD | N일자값 | string | Y | 12 | '00000(전체), 00003(한국투자증권)<br>, 00017(KB증권), 00005(미래에셋주식회사)' |
| FID_INPUT_RMNN_DYNU_1 | 거래량조건 | string | Y | 5 | '0(전체), 1(1개월이하), 2(1개월~2개월), <br>3(2개월~3개월), 4(3개월~6개월),<br>5(6개월~9개월),6(9개월~12개월), 7(12개월이상)' |
| FID_DIV_CLS_CODE | NEXT KEY BUFF | string | Y | 2 | 0(전체), 1(콜), 2(풋) |
| FID_INPUT_PRICE_1 | 사용자권한정보 | string | Y | 12 |  |
| FID_INPUT_PRICE_2 | 거래소코드 | string | Y | 12 |  |
| FID_INPUT_VOL_1 | 상승율/하락율 구분 | string | Y | 18 |  |
| FID_INPUT_VOL_2 | N일자값 | string | Y | 18 |  |
| FID_INPUT_DATE_1 | 거래량조건 | string | Y | 10 |  |
| FID_RANK_SORT_CLS_CODE | NEXT KEY BUFF | string | Y | 2 | '0(상승율), 1(하락율), 2(시가대비상승율)<br>, 3(시가대비하락율), 4(변동율)' |
| FID_BLNG_CLS_CODE | 사용자권한정보 | string | Y | 2 | 0(전체) |
| FID_INPUT_DATE_2 | 거래소코드 | string | Y | 10 |  |

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
| hts_kor_isnm | HTS한글종목명 | string | Y | 40 |  |
| elw_shrn_iscd | ELW단축종목코드 | string | Y | 9 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| stck_sdpr | 주식기준가 | string | Y | 10 |  |
| sdpr_vrss_prpr_sign | 기준가대비현재가부호 | string | Y | 1 |  |
| sdpr_vrss_prpr | 기준가대비현재가 | string | Y | 10 |  |
| sdpr_vrss_prpr_rate | 기준가대비현재가비율 | string | Y | 84 |  |
| stck_oprc | 주식시가2 | string | Y | 10 |  |
| oprc_vrss_prpr_sign | 시가2대비현재가부호 | string | Y | 1 |  |
| oprc_vrss_prpr | 시가2대비현재가 | string | Y | 10 |  |
| oprc_vrss_prpr_rate | 시가2대비현재가비율 | string | Y | 84 |  |
| stck_hgpr | 주식최고가 | string | Y | 10 |  |
| stck_lwpr | 주식최저가 | string | Y | 10 |  |
| prd_rsfl_sign | 기간등락부호 | string | Y | 1 |  |
| prd_rsfl | 기간등락 | string | Y | 10 |  |
| prd_rsfl_rate | 기간등락비율 | string | Y | 84 |  |
| stck_cnvr_rate | 주식전환비율 | string | Y | 136 |  |
| hts_rmnn_dynu | HTS잔존일수 | string | Y | 5 |  |
| acpr | 행사가 | string | Y | 112 |  |
| unas_isnm | 기초자산명 | string | Y | 40 |  |
| unas_shrn_iscd | 기초자산코드 | string | Y | 12 |  |
| lp_hldn_rate | LP보유비율 | string | Y | 84 |  |
| prit | 패리티 | string | Y | 112 |  |
| prls_qryr_stpr_prc | 손익분기주가가격 | string | Y | 112 |  |
| delta_val | 델타값 | string | Y | 114 |  |
| theta | 세타 | string | Y | 84 |  |
| prls_qryr_rate | 손익분기비율 | string | Y | 84 |  |
| stck_lstn_date | 주식상장일자 | string | Y | 8 |  |
| stck_last_tr_date | 주식최종거래일자 | string | Y | 8 |  |
| hts_ints_vltl | HTS내재변동성 | string | Y | 114 |  |
| lvrg_val | 레버리지값 | string | Y | 114 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:20277
FID_UNAS_INPUT_ISCD:000000
FID_INPUT_ISCD:00000
FID_INPUT_RMNN_DYNU_1:0
FID_DIV_CLS_CODE:0
FID_INPUT_PRICE_1:
FID_INPUT_PRICE_2:
FID_INPUT_VOL_1:
FID_INPUT_VOL_2:
FID_INPUT_DATE_1:1
FID_RANK_SORT_CLS_CODE:0
FID_BLNG_CLS_CODE:0
FID_INPUT_DATE_2:
```

## Response Example

```json
{
    "output": [
        {
            "hts_kor_isnm": "한국JAKWLS일렉콜",
            "elw_shrn_iscd": "57JAKW",
            "elw_prpr": "460",
            "prdy_vrss": "350",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "318.18",
            "acml_vol": "3320",
            "stck_sdpr": "110",
            "sdpr_vrss_prpr_sign": "2",
            "sdpr_vrss_prpr": "460",
            "sdpr_vrss_prpr_rate": "0.00",
            "stck_oprc": "470",
            "oprc_vrss_prpr_sign": "5",
            "oprc_vrss_prpr": "-10",
            "oprc_vrss_prpr_rate": "-2.13",
            "stck_hgpr": "605",
            "stck_lwpr": "0",
            "prd_rsfl_sign": "2",
            "prd_rsfl": "0",
            "prd_rsfl_rate": "34.44",
            "stck_cnvr_rate": "0.010000",
            "hts_rmnn_dynu": "63",
            "acpr": "95600.00",
            "unas_isnm": "LS ELECTRIC",
            "unas_shrn_iscd": "010120",
            "lp_hldn_rate": "99.96",
            "prit": "146.12",
            "prls_qryr_stpr_prc": "141600.00",
            "delta_val": "0.930744",
            "theta": "0.7829",
            "prls_qryr_rate": "1.3600",
            "stck_lstn_date": "20231116",
            "stck_last_tr_date": "20240613",
            "hts_ints_vltl": "71.91",
            "lvrg_val": "2.820154"
        },
        {
            "hts_kor_isnm": "KBJF27KOSPI200콜",
            "elw_shrn_iscd": "58JF27",
            "elw_prpr": "2395",
            "prdy_vrss": "1745",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "268.46",
            "acml_vol": "100",
            "stck_sdpr": "650",
            "sdpr_vrss_prpr_sign": "2",
            "sdpr_vrss_prpr": "2395",
            "sdpr_vrss_prpr_rate": "0.00",
            "stck_oprc": "2395",
            "oprc_vrss_prpr_sign": "3",
            "oprc_vrss_prpr": "0",
            "oprc_vrss_prpr_rate": "0.00",
            "stck_hgpr": "2395",
            "stck_lwpr": "0",
            "prd_rsfl_sign": "3",
            "prd_rsfl": "0",
            "prd_rsfl_rate": "0.00",
            "stck_cnvr_rate": "100.000000",
            "hts_rmnn_dynu": "28",
            "acpr": "345.00",
            "unas_isnm": "KOSPI200",
            "unas_shrn_iscd": "2001",
            "lp_hldn_rate": "99.99",
            "prit": "106.44",
            "prls_qryr_stpr_prc": "368.95",
            "delta_val": "0.900891",
            "theta": "13.8535",
            "prls_qryr_rate": "0.4600",
            "stck_lstn_date": "20231228",

... (생략)
```
