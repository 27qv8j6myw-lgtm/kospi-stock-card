# ELW 변동성추이(체결)

- 메뉴: [국내주식] ELW 시세
- API ID: `국내주식-177` · 통신방식: REST
- 요청: `GET /uapi/elw/v1/quotations/volatility-trend-ccnl`
- TR_ID: 실전 `FHPEW02840100` · 모의 `-`
- 도메인: 실전 https://openapi.koreainvestment.com:9443 · 모의 -

## 개요

ELW 변동성 추이(체결) API입니다. 
한국투자 HTS(eFriend Plus) > [0284] ELW 변동성 추이 화면의 "시간별" 변동성 추이 기능을 API로 개발한 사항으로, 해당 화면을 참고하시면 기능을 이해하기 쉽습니다.

## Request Header

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| tr_id | 거래ID | string | Y | 13 | FHPEW02840100 |
| tr_cont | 연속 거래 여부 | string | N | 1 | tr_cont를 이용한 다음조회 불가 API |

## Request Query Parameter

| Element | 한글명 | Type | 필수 | 길이 | 설명 |
|---|---|---|---|---|---|
| FID_COND_MRKT_DIV_CODE | 조건시장분류코드 | string | Y | 2 | W(Unique key) |
| FID_INPUT_ISCD | 입력종목코드 | string | Y | 12 | ex) 58J297(KBJ297삼성전자콜) |

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
| **output** | 응답상세 | object array | Y |  |  |
| stck_cntg_hour | 주식체결시간 | string | Y | 6 |  |
| elw_prpr | ELW현재가 | string | Y | 10 |  |
| prdy_vrss | 전일대비 | string | Y | 10 |  |
| prdy_vrss_sign | 전일대비부호 | string | Y | 1 |  |
| prdy_ctrt | 전일대비율 | string | Y | 82 |  |
| bidp | 매수호가 | string | Y | 10 |  |
| askp | 매도호가 | string | Y | 10 |  |
| acml_vol | 누적거래량 | string | Y | 18 |  |
| hts_ints_vltl | HTS내재변동성 | string | Y | 114 |  |

## Request Example (Python)

```text
FID_COND_MRKT_DIV_CODE:W
FID_INPUT_ISCD:58J540
```

## Response Example

```json
{
    "output": [
        {
            "stck_cntg_hour": "150121",
            "elw_prpr": "45",
            "prdy_vrss": "-10",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-18.18",
            "bidp": "45",
            "askp": "50",
            "acml_vol": "52690",
            "hts_ints_vltl": "33.05"
        },
        {
            "stck_cntg_hour": "140354",
            "elw_prpr": "45",
            "prdy_vrss": "-10",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-18.18",
            "bidp": "45",
            "askp": "0",
            "acml_vol": "52680",
            "hts_ints_vltl": "31.96"
        },
        {
            "stck_cntg_hour": "140340",
            "elw_prpr": "45",
            "prdy_vrss": "-10",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-18.18",
            "bidp": "45",
            "askp": "0",
            "acml_vol": "47680",
            "hts_ints_vltl": "31.96"
        },
        {
            "stck_cntg_hour": "140334",
            "elw_prpr": "45",
            "prdy_vrss": "-10",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-18.18",
            "bidp": "45",
            "askp": "50",
            "acml_vol": "47670",
            "hts_ints_vltl": "31.96"
        },
        {
            "stck_cntg_hour": "140334",
            "elw_prpr": "45",
            "prdy_vrss": "-10",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-18.18",
            "bidp": "45",
            "askp": "50",
            "acml_vol": "42690",
            "hts_ints_vltl": "31.96"
        },
        {
            "stck_cntg_hour": "140334",
            "elw_prpr": "45",
            "prdy_vrss": "-10",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-18.18",
            "bidp": "45",
            "askp": "50",
            "acml_vol": "42680",
            "hts_ints_vltl": "31.96"
        },
        {
            "stck_cntg_hour": "140334",
            "elw_prpr": "45",
            "prdy_vrss": "-10",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-18.18",
            "bidp": "45",
            "askp": "50",
            "acml_vol": "37680",
            "hts_ints_vltl": "31.96"
        },
        {
            "stck_cntg_hour": "114800",
            "elw_prpr": "50",
            "prdy_vrss": "-5",
            "prdy_vrss_sign": "5",
            "prdy_ctrt": "-9.09",
            "bidp": "50",
            "askp": "55",
            "acml_vol": "37670",
            "h
... (생략)
```
