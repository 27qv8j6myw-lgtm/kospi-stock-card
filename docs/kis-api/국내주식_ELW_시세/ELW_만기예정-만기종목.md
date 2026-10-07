# ELW 만기예정/만기종목

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-184` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/expiration-stocks`
- TR_ID: 실전 `FHKEW154700C0` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 만기예정/만기종목 API입니다. 
한국투자 HTS(eFriend Plus) > [0290] ELW 만기예정/만기종목 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

최근 100건까지 데이터 조회 가능합니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHKEW154700C0 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | W 입력 |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | 11547 입력 |
| FID_INPUT_DATE_1 | 입력날짜1 | string | Y | 10 | 입력날짜 ~ (ex) 20240402) |
| FID_INPUT_DATE_2 | 입력날짜2 | string | Y | 10 | ~입력날짜 (ex) 20240408) |
| FID_DIV_CLS_CODE | 분류구분코드 | string | Y | 2 | 0(콜),1(풋),2(전체) |
| FID_ETC_CLS_CODE | 기타구분코드 | string | Y | 2 | 공백 입력 |
| FID_UNAS_INPUT_ISCD | 기초자산입력종목코드 | string | Y | 12 | 000000(전체), 2001(KOSPI 200), 기초자산코드(종목코드 ex. 삼성전자-005930) |
| FID_INPUT_ISCD_2 | 발행회사코드 | string | Y | 8 | 00000(전체), 00003(한국투자증권), 00017(KB증권), 00005(미래에셋증권) |
| FID_BLNG_CLS_CODE | 결제방법 | string | Y | 2 | 0(전체),1(일반),2(조기종료) |
| FID_INPUT_OPTION_1 | 입력옵션1 | string | Y | 10 | 공백 입력 |

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
| unas_isnm | 기초자산종목명 | string | Y | 40 |  |
| unas_prpr | 기초자산현재가 | string | Y | 112 |  |
| acpr | 행사가 | string | Y | 112 |  |
| stck_cnvr_rate | 주식전환비율 | string | Y | 136 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| stck_lstn_date | 주식상장일자 | string | Y | 8 |  |
| stck_last_tr_date | 주식최종거래일자 | string | Y | 8 |  |
| total_rdmp_amt | 총상환금액 | string | Y | 18 |  |
| rdmp_amt | 상환금액 | string | Y | 186 |  |
| lstn_stcn | 상장주수 | string | Y | 18 |  |
| lp_hvol | LP보유량 | string | Y | 18 |  |
| ccls_paym_prc | 확정지급2가격 | string | Y | 223 |  |
| mtrt_vltn_amt | 만기평가금액 | string | Y | 192 |  |
| evnt_prd_fin_date | 행사2기간종료일자 | string | Y | 8 |  |
| stlm_date | 결제일자 | string | Y | 8 |  |
| pblc_prc | 발행가격 | string | Y | 18 |  |
| unas_shrn_iscd | 기초자산단축종목코드 | string | Y | 9 |  |
| stnd_iscd | 표준종목코드 | string | Y | 12 |  |
| rdmp_ask_amt | 상환청구금액 | string | Y | 18 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:11547
FID_INPUT_DATE_1:20240611
FID_INPUT_DATE_2:20240618
FID_DIV_CLS_CODE:2
FID_ETC_CLS_CODE:
FID_UNAS_INPUT_ISCD:000000
FID_INPUT_ISCD_2:00000
FID_BLNG_CLS_CODE:0
FID_INPUT_OPTION_1:
```

## Response Example

```json
{
    "output": [
        {
            "elw_shrn_iscd": "58K374",
            "elw_kor_isnm": "KBK374KOSPI200풋",
            "unas_isnm": "KOSPI200",
            "unas_prpr": "367.71",
            "acpr": "372.50",
            "stck_cnvr_rate": "100.000000",
            "elw_prpr": "515",
            "stck_lstn_date": "20240320",
            "stck_last_tr_date": "20240613",
            "total_rdmp_amt": "0",
            "rdmp_amt": "0.000000",
            "lstn_stcn": "5000000",
            "lp_hvol": "4982390",
            "ccls_paym_prc": "0.000",
            "mtrt_vltn_amt": "367.71",
            "evnt_prd_fin_date": "20240617",
            "stlm_date": "20240619",
            "pblc_prc": "1143",
            "unas_shrn_iscd": "2001",
            "stnd_iscd": "KRA583261E30",
            "rdmp_ask_amt": ""
        },
        {
            "elw_shrn_iscd": "58K373",
            "elw_kor_isnm": "KBK373KOSPI200풋",
            "unas_isnm": "KOSPI200",
            "unas_prpr": "367.71",
            "acpr": "370.00",
            "stck_cnvr_rate": "100.000000",
            "elw_prpr": "370",
            "stck_lstn_date": "20240320",
            "stck_last_tr_date": "20240613",
            "total_rdmp_amt": "0",
            "rdmp_amt": "0.000000",
            "lstn_stcn": "5000000",
            "lp_hvol": "4727930",
            "ccls_paym_prc": "0.000",
            "mtrt_vltn_amt": "367.71",
            "evnt_prd_fin_date": "20240617",
            "stlm_date": "20240619",
            "pblc_prc": "901",
            "unas_shrn_iscd": "2001",
            "stnd_iscd": "KRA583260E31",
            "rdmp_ask_amt": ""
        },...
    ],
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "msg1": "정상처리 되었습니다."
}
```
