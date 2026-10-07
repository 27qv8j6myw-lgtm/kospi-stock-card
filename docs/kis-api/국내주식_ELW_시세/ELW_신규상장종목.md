# ELW 신규상장종목

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-181` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/newly-listed`
- TR_ID: 실전 `FHKEW154800C0` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 신규상장종목 API입니다. 
한국투자 HTS(eFriend Plus) > [0297] ELW 신규상장종목 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHKEW154800C0 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (W) |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | Unique key(11548) |
| FID_DIV_CLS_CODE | 분류구분코드 | string | Y | 2 | 전체(02), 콜(00), 풋(01) |
| FID_UNAS_INPUT_ISCD | 기초자산입력종목코드 | string | Y | 12 | 'ex) 000000(전체), 2001(코스피200)<br>, 3003(코스닥150), 005930(삼성전자) ' |
| FID_INPUT_ISCD_2 | 입력종목코드2 | string | Y | 8 | '00003(한국투자증권), 00017(KB증권),<br> 00005(미래에셋증권)' |
| FID_INPUT_DATE_1 | 입력날짜1 | string | Y | 10 | 날짜 (ex) 20240402) |
| FID_BLNC_CLS_CODE | 결재방법 | string | Y | 2 | 0(전체), 1(일반), 2(조기종료) |

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
| stck_lstn_date | 주식상장일자 | string | Y | 8 |  |
| elw_kor_isnm | ELW한글종목명 | string | Y | 40 |  |
| elw_shrn_iscd | ELW단축종목코드 | string | Y | 9 |  |
| unas_isnm | 기초자산종목명 | string | Y | 40 |  |
| pblc_co_name | 발행회사명 | string | Y | 40 |  |
| lstn_stcn | 상장주수 | string | Y | 18 |  |
| acpr | 행사가 | string | Y | 112 |  |
| stck_last_tr_date | 주식최종거래일자 | string | Y | 8 |  |
| elw_ko_barrier | 조기종료발생기준가격 | string | Y | 112 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:11548
FID_DIV_CLS_CODE:02
FID_UNAS_INPUT_ISCD:000000
FID_INPUT_ISCD_2:00003
FID_INPUT_DATE_1:20240410
FID_BLNG_CLS_CODE:0
```

## Response Example

```json
{
    "output": [
        {
            "stck_lstn_date": "20240320",
            "elw_kor_isnm": "한국K924HLB콜",
            "elw_shrn_iscd": "57K924",
            "unas_isnm": "HLB",
            "pblc_co_name": "한국투자증권(주)",
            "lstn_stcn": "7100000",
            "acpr": "78000.00",
            "stck_last_tr_date": "20240613",
            "elw_ko_barrier": "0.00"
        },
        {
            "stck_lstn_date": "20240320",
            "elw_kor_isnm": "한국K925HMM콜",
            "elw_shrn_iscd": "57K925",
            "unas_isnm": "HMM",
            "pblc_co_name": "한국투자증권(주)",
            "lstn_stcn": "6700000",
            "acpr": "20000.00",
            "stck_last_tr_date": "20240912",
            "elw_ko_barrier": "0.00"
        },
        {
            "stck_lstn_date": "20240320",
            "elw_kor_isnm": "한국K926HMM콜",
            "elw_shrn_iscd": "57K926",
            "unas_isnm": "HMM",
            "pblc_co_name": "한국투자증권(주)",
            "lstn_stcn": "5600000",
            "acpr": "20000.00",
            "stck_last_tr_date": "20241212",
            "elw_ko_barrier": "0.00"
        },
        {
            "stck_lstn_date": "20240320",
            "elw_kor_isnm": "한국KB45HMM풋",
            "elw_shrn_iscd": "57KB45",
            "unas_isnm": "HMM",
            "pblc_co_name": "한국투자증권(주)",
            "lstn_stcn": "6900000",
            "acpr": "17700.00",
            "stck_last_tr_date": "20240613",
            "elw_ko_barrier": "0.00"
        },
        {
            "stck_lstn_date": "20240320",
            "elw_kor_isnm": "한국K927KB금융콜",
            "elw_shrn_iscd": "57K927",
            "unas_isnm": "KB금융",
            "pblc_co_name": "한국투자증권(주)",
            "lstn_stcn": "24400000",
            "acpr": "73600.00",
            "stck_last_tr_date": "20240613",
            "elw_ko_barrier": "0.00"
        },
        {
            "stck_lstn_date": "20240320",
            "elw_kor_isnm": "한국K928KB금융콜",
            "elw_shrn_iscd": "57K928",
            "unas_isnm": "KB금융",
            "pblc_co_name": "한국투자증권(주)",
            "lstn_stcn": "22300000",
            "acpr": "73600.00",
            "stck_last_tr_date": "20240912",
            "elw_ko_barrier": "0.00"
        },
        {
            "stck_lstn_date": "20240320",
            "elw_kor_isnm": "한국K929KB금융콜",
            "elw_shrn_iscd": "57K929",
            "unas_isnm": "KB금융",
            "pblc_co_name": "한국투자증권(주)",
            "lstn_stcn": "18200000",
            "acpr": "72000.00
... (생략)
```
