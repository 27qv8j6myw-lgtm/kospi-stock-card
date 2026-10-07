# ELW 기초자산별 종목시세

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-186` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/udrl-asset-price`
- TR_ID: 실전 `FHKEW154101C0` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 기초자산별 종목시세  API입니다.
한국투자 HTS(eFriend Plus) > [0288] ELW 기초자산별 ELW 시세 화면의 "우측 기초자산별 종목 리스트" 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHKEW154101C0 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분(W) |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | Uniquekey(11541) |
| FID_MRKT_CLS_CODE | 시장구분코드 | string | Y | 2 | 전체(A),콜(C),풋(P) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | '00000(전체), 00003(한국투자증권)<br>, 00017(KB증권), 00005(미래에셋주식회사)' |
| FID_UNAS_INPUT_ISCD | 기초자산입력종목코드 | string | Y | 12 |  |
| FID_VOL_CNT | 거래량수 | string | Y | 12 | 전일거래량(정수량미만) |
| FID_TRGT_EXLS_CLS_CODE | 대상제외구분코드 | string | Y | 32 | 거래불가종목제외(0:미체크,1:체크) |
| FID_INPUT_PRICE_1 | 입력가격1 | string | Y | 12 | 가격~원이상 |
| FID_INPUT_PRICE_2 | 입력가격2 | string | Y | 12 | 가격~월이하 |
| FID_INPUT_VOL_1 | 입력거래량1 | string | Y | 18 | 거래량~계약이상 |
| FID_INPUT_VOL_2 | 입력거래량2 | string | Y | 18 | 거래량~계약이하 |
| FID_INPUT_RMNN_DYNU_1 | 입력잔존일수1 | string | Y | 5 | 잔존일(~일이상) |
| FID_INPUT_RMNN_DYNU_2 | 입력잔존일수2 | string | Y | 5 | 잔존일(~일이하) |
| FID_OPTION | 옵션 | string | Y | 5 | 옵션상태(0:없음,1:ATM,2:ITM,3:OTM) |
| FID_INPUT_OPTION_1 | 입력옵션1 | string | Y | 10 |  |
| FID_INPUT_OPTION_2 | 입력옵션2 | string | Y | 10 |  |

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
| hts_kor_isnm | HTS한글종목명 | string | Y | 40 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| acpr | 행사가 | string | Y | 112 |  |
| prls_qryr_stpr_prc | 손익분기주가가격 | string | Y | 112 |  |
| hts_rmnn_dynu | HTS잔존일수 | string | Y | 5 |  |
| hts_ints_vltl | HTS내재변동성 | string | Y | 114 |  |
| stck_cnvr_rate | 주식전환비율 | string | Y | 136 |  |
| lp_hvol | LP보유량 | string | Y | 18 |  |
| lp_rlim | LP비중 | string | Y | 52 |  |
| lvrg_val | 레버리지값 | string | Y | 114 |  |
| gear | 기어링 | string | Y | 84 |  |
| delta_val | 델타값 | string | Y | 114 |  |
| gama | 감마 | string | Y | 84 |  |
| vega | 베가 | string | Y | 84 |  |
| theta | 세타 | string | Y | 84 |  |
| prls_qryr_rate | 손익분기비율 | string | Y | 84 |  |
| cfp | 자본지지점 | string | Y | 112 |  |
| prit | 패리티 | string | Y | 112 |  |
| invl_val | 내재가치값 | string | Y | 132 |  |
| tmvl_val | 시간가치값 | string | Y | 132 |  |
| hts_thpr | HTS이론가 | string | Y | 112 |  |
| stck_lstn_date | 주식상장일자 | string | Y | 8 |  |
| stck_last_tr_date | 주식최종거래일자 | string | Y | 8 |  |
| lp_ntby_qty | LP순매도량 | string | Y | 18 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:11541
FID_MRKT_CLS_CODE:A
FID_INPUT_ISCD:00000
FID_UNAS_INPUT_ISCD:005930
FID_VOL_CNT:
FID_TRGT_EXLS_CLS_CODE:0
FID_INPUT_PRICE_1:
FID_INPUT_PRICE_2:
FID_INPUT_VOL_1:
FID_INPUT_VOL_2:
FID_INPUT_RMNN_DYNU_1:
FID_INPUT_RMNN_DYNU_2:
FID_OPTION:0
FID_INPUT_OPTION_1:
FID_INPUT_OPTION_2:
```

## Response Example

```json
{
    "output": [
        {
            "elw_shrn_iscd": "57JAAQ",
            "hts_kor_isnm": "한국JAAQ삼성전자풋",
            "elw_prpr": "10",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "acpr": "63300.00",
            "prls_qryr_stpr_prc": "62300.00",
            "hts_rmnn_dynu": "42",
            "hts_ints_vltl": "60.72",
            "stck_cnvr_rate": "0.010000",
            "lp_hvol": "17298270",
            "lp_rlim": "99.99",
            "lvrg_val": "-9.448319",
            "gear": "77.7000",
            "delta_val": "-0.121600",
            "gama": "0.0000",
            "vega": "0.5078",
            "theta": "0.5759",
            "prls_qryr_rate": "-19.8100",
            "cfp": "-19.5600",
            "prit": "81.46",
            "invl_val": "0.00",
            "tmvl_val": "10.00",
            "hts_thpr": "0.18",
            "stck_lstn_date": "20231018",
            "stck_last_tr_date": "20240613",
            "lp_ntby_qty": "0"
        },
        {
            "elw_shrn_iscd": "57JAML",
            "hts_kor_isnm": "한국JAML삼성전자콜",
            "elw_prpr": "120",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "acpr": "64700.00",
            "prls_qryr_stpr_prc": "76700.00",
            "hts_rmnn_dynu": "7",
            "hts_ints_vltl": "0.00",
            "stck_cnvr_rate": "0.010000",
            "lp_hvol": "11995780",
            "lp_rlim": "99.96",
            "lvrg_val": "5.184000",
            "gear": "6.4800",
            "delta_val": "0.800000",
            "gama": "0.0000",
            "vega": "0.0000",
            "theta": "0.0669",
            "prls_qryr_rate": "-1.4100",
            "cfp": "-1.6700",
            "prit": "120.24",
            "invl_val": "132.00",
            "tmvl_val": "-12.00",
            "hts_thpr": "131.60",
            "stck_lstn_date": "20231116",
            "stck_last_tr_date": "20240509",
            "lp_ntby_qty": "0"
        },
        {
            "elw_shrn_iscd": "57JAMM",
            "hts_kor_isnm": "한국JAMM삼성전자콜",
            "elw_prpr": "115",
            "prdy_vrss": "0",
            "prdy_vrss_sign": "3",
            "prdy_ctrt": "0.00",
            "acml_vol": "0",
            "acpr": "67300.00",
            "prls_qryr_stpr_prc": "78800.00",
            "hts_rmnn_dynu": "42",
            "hts_ints_vltl": "32.23",
            "
... (생략)
```
