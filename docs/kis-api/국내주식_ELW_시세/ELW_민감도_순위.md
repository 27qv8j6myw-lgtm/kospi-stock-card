# ELW 민감도 순위

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-170` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/ranking/sensitivity`
- TR_ID: 실전 `FHPEW02850000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 민감도 순위 API입니다. 
한국투자 HTS(eFriend Plus) > [0285] ELW 민감도 순위 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02850000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (W) |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | Unique key(20285) |
| FID_UNAS_INPUT_ISCD | 기초자산입력종목코드 | string | Y | 12 | '000000(전체), 2001(코스피200)<br>, 3003(코스닥150), 005930(삼성전자) ' |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | '00000(전체), 00003(한국투자증권)<br>, 00017(KB증권), 00005(미래에셋주식회사)' |
| FID_DIV_CLS_CODE | 콜풋구분코드 | string | Y | 2 | 0(전체), 1(콜), 2(풋) |
| FID_INPUT_PRICE_1 | 가격(이상) | string | Y | 12 |  |
| FID_INPUT_PRICE_2 | 가격(이하) | string | Y | 12 |  |
| FID_INPUT_VOL_1 | 거래량(이상) | string | Y | 18 |  |
| FID_INPUT_VOL_2 | 거래량(이하) | string | Y | 18 |  |
| FID_RANK_SORT_CLS_CODE | 순위정렬구분코드 | string | Y | 2 | '0(이론가), 1(델타), 2(감마), 3(로), 4(베가) , 5(로)<br>, 6(내재변동성), 7(90일변동성)' |
| FID_INPUT_RMNN_DYNU_1 | 잔존일수(이상) | string | Y | 5 |  |
| FID_INPUT_DATE_1 | 조회기준일 | string | Y | 10 |  |
| FID_BLNG_CLS_CODE | 결재방법 | string | Y | 2 | 0(전체), 1(일반), 2(조기종료) |

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
| elw_shrn_iscd | ELW단축종목코드 | string | Y | 9 |  |
| elw_kor_isnm | ELW한글종목명 | string | Y | 40 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| hts_thpr | HTS이론가 | string | Y | 112 |  |
| delta_val | 델타값 | string | Y | 114 |  |
| gama | 감마 | string | Y | 84 |  |
| theta | 세타 | string | Y | 84 |  |
| vega | 베가 | string | Y | 84 |  |
| rho | 로우 | string | Y | 84 |  |
| hts_ints_vltl | HTS내재변동성 | string | Y | 114 |  |
| d90_hist_vltl | 90일역사적변동성 | string | Y | 114 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:20285
FID_UNAS_INPUT_ISCD:000000
FID_INPUT_ISCD:00000
FID_INPUT_RMNN_DYNU_1:0
FID_DIV_CLS_CODE:0
FID_INPUT_PRICE_1:
FID_INPUT_PRICE_2:
FID_INPUT_VOL_1:
FID_INPUT_VOL_2:
FID_RANK_SORT_CLS_CODE:0
FID_INPUT_RMNN_DYNU_1:
FID_INPUT_DATE_1:
FID_BLNG_CLS_CODE:0
```

## Response Example

```json
{
    "output": [
        {
            "elw_shrn_iscd": "57K852",
            "elw_kor_isnm": "한국K852KOSPI200콜",
            "elw_prpr": "7770",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "hts_thpr": "8290.81",
            "delta_val": "1.000000",
            "gama": "0.0000",
            "theta": "3.8670",
            "vega": "0.0000",
            "rho": "19.3352",
            "hts_ints_vltl": "0.00",
            "d90_hist_vltl": "16.793295"
        },
        {
            "elw_shrn_iscd": "57JAVS",
            "elw_kor_isnm": "한국JAVSKOSPI200콜",
            "elw_prpr": "4690",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "hts_thpr": "7891.32",
            "delta_val": "1.000000",
            "gama": "0.0000",
            "theta": "3.9449",
            "vega": "0.0000",
            "rho": "119.9611",
            "hts_ints_vltl": "0.00",
            "d90_hist_vltl": "16.793295"
        },
        {
            "elw_shrn_iscd": "57JAVD",
            "elw_kor_isnm": "한국JAVDKOSPI200콜",
            "elw_prpr": "7800",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "hts_thpr": "7793.07",
            "delta_val": "0.993055",
            "gama": "0.0005",
            "theta": "4.3385",
            "vega": "4.0200",
            "rho": "91.7439",
            "hts_ints_vltl": "17.48",
            "d90_hist_vltl": "16.793295"
        },...
    ],
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "msg1": "정상처리 되었습니다."
}
```
