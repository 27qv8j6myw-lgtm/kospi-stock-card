# ELW 지표순위

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-169` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/ranking/indicator`
- TR_ID: 실전 `FHPEW02790000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 지표순위 API입니다. 
한국투자 HTS(eFriend Plus) > [0279] ELW 지표순위 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02790000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (W) |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | Unique key(20279) |
| FID_UNAS_INPUT_ISCD | 기초자산입력종목코드 | string | Y | 12 | '000000(전체), 2001(코스피200)<br>, 3003(코스닥150), 005930(삼성전자) ' |
| FID_INPUT_ISCD | 발행사 | string | Y | 12 | '00000(전체), 00003(한국투자증권)<br>, 00017(KB증권), 00005(미래에셋주식회사)' |
| FID_DIV_CLS_CODE | 콜풋구분코드 | string | Y | 2 | 0(전체), 1(콜), 2(풋) |
| FID_INPUT_PRICE_1 | 가격(이상) | string | Y | 12 |  |
| FID_INPUT_PRICE_2 | 가격(이하) | string | Y | 12 |  |
| FID_INPUT_VOL_1 | 거래량(이상) | string | Y | 18 |  |
| FID_INPUT_VOL_2 | 거래량(이하) | string | Y | 18 |  |
| FID_RANK_SORT_CLS_CODE | 순위정렬구분코드 | string | Y | 2 | 0(전환비율), 1(레버리지), 2(행사가 ), 3(내재가치), 4(시간가치) |
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
| **output1** | 응답상세 | object array | Y |  | array |
| elw_shrn_iscd | ELW단축종목코드 | string | Y | 9 |  |
| elw_kor_isnm | ELW한글종목명 | string | Y | 40 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| stck_cnvr_rate | 주식전환비율 | string | Y | 136 |  |
| lvrg_val | 레버리지값 | string | Y | 114 |  |
| acpr | 행사가 | string | Y | 112 |  |
| tmvl_val | 시간가치값 | string | Y | 132 |  |
| invl_val | 내재가치값 | string | Y | 132 |  |
| elw_ko_barrier | 조기종료발생기준가격 | string | Y | 112 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:20279
FID_UNAS_INPUT_ISCD:000000
FID_INPUT_ISCD:00000
FID_DIV_CLS_CODE:0
FID_INPUT_PRICE_1:
FID_INPUT_PRICE_2:
FID_INPUT_VOL_1:
FID_INPUT_VOL_2:
FID_RANK_SORT_CLS_CODE:0
FID_BLNG_CLS_CODE:0
```

## Response Example

```json
{
    "output": [
        {
            "elw_shrn_iscd": "52JW82",
            "elw_kor_isnm": "미래JW82KOSPI200콜",
            "elw_prpr": "360",
            "prdy_vrss": "-170",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-32.08",
            "acml_vol": "726070",
            "stck_cnvr_rate": "100.000000",
            "lvrg_val": "35.047882",
            "acpr": "375.00",
            "tmvl_val": "360.00",
            "invl_val": "0.00",
            "elw_ko_barrier": "0.00"
        },
        {
            "elw_shrn_iscd": "52JW83",
            "elw_kor_isnm": "미래JW83KOSPI200콜",
            "elw_prpr": "450",
            "prdy_vrss": "180",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "66.67",
            "acml_vol": "194290",
            "stck_cnvr_rate": "100.000000",
            "lvrg_val": "32.774658",
            "acpr": "372.50",
            "tmvl_val": "450.00",
            "invl_val": "0.00",
            "elw_ko_barrier": "0.00"
        },
        {
            "elw_shrn_iscd": "52JW84",
            "elw_kor_isnm": "미래JW84KOSPI200콜",
            "elw_prpr": "565",
            "prdy_vrss": "215",
            "prdy_vrss_sign": "2",
            "prdy_ctrt": "61.43",
            "acml_vol": "41160",
            "stck_cnvr_rate": "100.000000",
            "lvrg_val": "30.090385",
            "acpr": "370.00",
            "tmvl_val": "565.00",
            "invl_val": "0.00",
            "elw_ko_barrier": "0.00"
        },
        {
            "elw_shrn_iscd": "52JW85",
            "elw_kor_isnm": "미래JW85KOSPI200콜",
            "elw_prpr": "640",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "stck_cnvr_rate": "100.000000",
            "lvrg_val": "30.062588",
            "acpr": "367.50",
            "tmvl_val": "640.00",
            "invl_val": "0.00",
            "elw_ko_barrier": "0.00"
        },
        {
            "elw_shrn_iscd": "52JW86",
            "elw_kor_isnm": "미래JW86KOSPI200콜",
            "elw_prpr": "450",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "stck_cnvr_rate": "100.000000",
            "lvrg_val": "55.580410",
            "acpr": "365.00",
            "tmvl_val": "228.00",
            "invl_val": "222.00",
            "elw_ko_barrier": "0.00"
        },...
    ],
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "m
... (생략)
```
