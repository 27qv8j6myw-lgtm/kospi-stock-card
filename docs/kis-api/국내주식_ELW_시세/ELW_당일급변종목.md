# ELW 당일급변종목

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-171` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/ranking/quick-change`
- TR_ID: 실전 `FHPEW02870000` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 당일급변종목 API입니다. 
한국투자 HTS(eFriend Plus) > [0287] ELW 당일급변종목 화면의 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02870000 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | 시장구분코드 (W) |
| FID_COND_SCR_DIV_CODE | 조건화면분류코드 | string | Y | 5 | Unique key(20287) |
| FID_UNAS_INPUT_ISCD | 기초자산입력종목코드 | string | Y | 12 | '000000(전체), 2001(코스피200)<br>, 3003(코스닥150), 005930(삼성전자) ' |
| FID_INPUT_ISCD | 발행사 | string | Y | 12 | '00000(전체), 00003(한국투자증권)<br>, 00017(KB증권), 00005(미래에셋주식회사)' |
| FID_MRKT_CLS_CODE | 시장구분코드 | string | Y | 2 | Unique key(A) |
| FID_INPUT_PRICE_1 | 가격(이상) | string | Y | 12 |  |
| FID_INPUT_PRICE_2 | 가격(이하) | string | Y | 12 |  |
| FID_INPUT_VOL_1 | 거래량(이상) | string | Y | 18 |  |
| FID_INPUT_VOL_2 | 거래량(이하) | string | Y | 18 |  |
| FID_HOUR_CLS_CODE | 시간구분코드 | string | Y | 5 | 1(분), 2(일) |
| FID_INPUT_HOUR_1 | 입력 일 또는 분 | string | Y | 10 |  |
| FID_INPUT_HOUR_2 | 기준시간(분 선택 시) | string | Y | 10 |  |
| FID_RANK_SORT_CLS_CODE | 순위정렬구분코드 | string | Y | 2 | '1(가격급등), 2(가격급락), 3(거래량급증)<br>, 4(매수잔량급증), 5(매도잔량급증)' |
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
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| askp | 매도호가 | string | Y | 10 |  |
| bidp | 매수호가 | string | Y | 10 |  |
| total_askp_rsqn | 총매도호가잔량 | string | Y | 12 |  |
| total_bidp_rsqn | 총매수호가잔량 | string | Y | 12 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| stnd_val | 기준값 | string | Y | 10 |  |
| stnd_val_vrss | 기준값대비 | string | Y | 11 |  |
| stnd_val_ctrt | 기준값대비율 | string | Y | 162 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_COND_SCR_DIV_CODE:20287
FID_UNAS_INPUT_ISCD:000000
FID_INPUT_ISCD:00000
FID_MRKT_CLS_CODE:A
FID_INPUT_PRICE_1:
FID_INPUT_PRICE_2:
FID_INPUT_VOL_1:
FID_INPUT_VOL_2:
FID_HOUR_CLS_CODE:2
FID_INPUT_HOUR_1:1
FID_INPUT_HOUR_2:
FID_RANK_SORT_CLS_CODE:1
FID_BLNG_CLS_CODE:0
```

## Response Example

```json
{
    "output": [
        {
            "elw_shrn_iscd": "57JAKW",
            "elw_kor_isnm": "한국JAKWLS일렉콜",
            "elw_prpr": "460",
            "prdy_vrss_sign": "2",
            "prdy_vrss": "350",
            "prdy_ctrt": "318.18",
            "askp": "0",
            "bidp": "145",
            "total_askp_rsqn": "0",
            "total_bidp_rsqn": "49060",
            "acml_vol": "3320",
            "stnd_val": "110",
            "stnd_val_vrss": "350",
            "stnd_val_ctrt": "318.18"
        },
        {
            "elw_shrn_iscd": "58JF27",
            "elw_kor_isnm": "KBJF27KOSPI200콜",
            "elw_prpr": "2395",
            "prdy_vrss_sign": "2",
            "prdy_vrss": "1745",
            "prdy_ctrt": "268.46",
            "askp": "0",
            "bidp": "15",
            "total_askp_rsqn": "0",
            "total_bidp_rsqn": "29000",
            "acml_vol": "100",
            "stnd_val": "650",
            "stnd_val_vrss": "1745",
            "stnd_val_ctrt": "268.46"
        },...
    ],
    "rt_cd": "0",
    "msg_cd": "MCA00000",
    "msg1": "정상처리 되었습니다."
}
```
